// src/services/shared/CacheService.ts
import { Redis } from "ioredis";

export interface CacheOptions {
  ttlSeconds?: number;
  useMemoryCache?: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  protected static redisClient: Redis | null = null;
  protected static memoryCache = new Map<string, CacheEntry<unknown>>();

  // Cache size limits
  protected static MAX_MEMORY_CACHE_SIZE = 1000;

  protected static cacheStats = {
    redisHits: 0,
    redisMisses: 0,
    memoryHits: 0,
    memoryMisses: 0,
    lastReset: Date.now(),
  };

  static initRedis(options: { host: string; port: number; password: string }) {
    this.redisClient = new Redis(options);
  }

  static getRedisClient(): Redis | null {
    return this.redisClient;
  }

  static getCacheStats() {
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

  static resetCacheStats() {
    this.cacheStats = {
      redisHits: 0,
      redisMisses: 0,
      memoryHits: 0,
      memoryMisses: 0,
      lastReset: Date.now(),
    };
  }

  protected static async get<T>(
    key: string,
    options: CacheOptions = {},
  ): Promise<T | null> {
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
    if (!this.redisClient) return null;

    try {
      const result = await this.redisClient.get(key);
      if (result) {
        this.cacheStats.redisHits++;
        return JSON.parse(result) as T;
      }
      this.cacheStats.redisMisses++;
      return null;
    } catch (error) {
      console.error(`Error getting cached data for key ${key}:`, error);
      return null;
    }
  }

  protected static async set<T>(
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
    if (this.redisClient) {
      try {
        await this.redisClient.set(
          key,
          JSON.stringify(value),
          "EX",
          ttlSeconds,
        );
      } catch (error) {
        console.error(`Error setting cached data for key ${key}:`, error);
      }
    }
  }

  protected static async invalidate(key: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(key);

    // Remove from Redis
    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        console.error(`Error invalidating cache for key ${key}:`, error);
      }
    }
  }

  protected static async invalidateByPattern(pattern: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        // Remove matching keys from memory cache
        keys.forEach((key) => this.memoryCache.delete(key));

        // Remove from Redis
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      console.error(`Error invalidating cache for pattern ${pattern}:`, error);
    }
  }

  static monitorMemoryUsage(): void {
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
