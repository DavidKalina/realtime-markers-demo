// src/services/shared/CacheService.ts
import { Redis } from "ioredis";
import { createRedisService } from "./RedisService";

export interface CacheOptions {
  ttlSeconds?: number;
  useMemoryCache?: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheService {
  get<T>(key: string, options?: CacheOptions): Promise<T | null>;
  set<T extends string | number | object>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidateByPattern(pattern: string): Promise<void>;
  getCacheStats(): {
    redis: { hits: number; misses: number; hitRate: number };
    memory: { hits: number; misses: number; hitRate: number };
    uptime: number;
  };
  resetCacheStats(): void;
  monitorMemoryUsage(): void;
}

export class CacheServiceImpl implements CacheService {
  private redisService: ReturnType<typeof createRedisService> | null = null;
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private cacheStats = {
    redisHits: 0,
    redisMisses: 0,
    memoryHits: 0,
    memoryMisses: 0,
    lastReset: Date.now(),
  };

  // Cache size limits
  private readonly MAX_MEMORY_CACHE_SIZE = 1000;

  constructor(redisService?: ReturnType<typeof createRedisService>) {
    this.redisService = redisService || null;
  }

  initRedis(redis: Redis): void {
    this.redisService = createRedisService(redis);
  }

  getCacheStats() {
    const totalRedis = this.cacheStats.redisHits + this.cacheStats.redisMisses;
    const totalMemory =
      this.cacheStats.memoryHits + this.cacheStats.memoryMisses;

    return {
      redis: {
        hits: this.cacheStats.redisHits,
        misses: this.cacheStats.redisMisses,
        hitRate: totalRedis
          ? (this.cacheStats.redisHits / totalRedis) * 100
          : 0,
      },
      memory: {
        hits: this.cacheStats.memoryHits,
        misses: this.cacheStats.memoryMisses,
        hitRate: totalMemory
          ? (this.cacheStats.memoryHits / totalMemory) * 100
          : 0,
      },
      uptime: Date.now() - this.cacheStats.lastReset,
    };
  }

  resetCacheStats() {
    this.cacheStats = {
      redisHits: 0,
      redisMisses: 0,
      memoryHits: 0,
      memoryMisses: 0,
      lastReset: Date.now(),
    };
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { useMemoryCache = false } = options;

    // Check memory cache first if enabled
    if (useMemoryCache) {
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        this.cacheStats.memoryHits++;
        return cached.value as T;
      }
      this.cacheStats.memoryMisses++;
    }

    // Fall back to Redis
    if (!this.redisService) return null;

    try {
      const result = await this.redisService.get<T>(key);
      if (result !== null) {
        this.cacheStats.redisHits++;
        return result;
      }
      this.cacheStats.redisMisses++;
      return null;
    } catch (error) {
      console.error(`Error getting cached data for key ${key}:`, error);
      return null;
    }
  }

  async set<T extends string | number | object>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    const { ttlSeconds = 600, useMemoryCache = false } = options;

    // Store in memory cache if enabled
    if (useMemoryCache) {
      // Implement simple LRU behavior
      if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
        const oldestKey = this.memoryCache.keys().next().value;
        if (oldestKey) {
          this.memoryCache.delete(oldestKey);
        }
      }

      this.memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }

    // Store in Redis if available
    if (this.redisService) {
      try {
        await this.redisService.set(key, value, ttlSeconds);
      } catch (error) {
        console.error(`Error setting cached data for key ${key}:`, error);
      }
    }
  }

  async invalidate(key: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(key);

    // Remove from Redis
    if (this.redisService) {
      try {
        await this.redisService.del(key);
      } catch (error) {
        console.error(`Error invalidating cache for key ${key}:`, error);
      }
    }
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    if (!this.redisService) return;

    try {
      await this.redisService.delByPattern(pattern);
    } catch (error) {
      console.error(`Error invalidating cache for pattern ${pattern}:`, error);
    }
  }

  monitorMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const mbUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
    const mbTotal = Math.round(memUsage.heapTotal / 1024 / 1024);

    // Auto-clear memory cache if memory pressure is high (>85%)
    if (mbUsed / mbTotal > 0.85) {
      this.memoryCache.clear();
      console.warn(
        `Memory pressure detected: ${mbUsed}MB/${mbTotal}MB - Memory cache cleared`,
      );
    }
  }
}

/**
 * Factory function to create a CacheService instance
 */
export function createCacheService(redis?: Redis): CacheService {
  const cacheService = new CacheServiceImpl();
  if (redis) {
    cacheService.initRedis(redis);
  }
  return cacheService;
}
