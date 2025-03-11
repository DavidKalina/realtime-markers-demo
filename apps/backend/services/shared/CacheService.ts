// src/services/CacheService.ts
import { createHash } from "crypto";
import { Redis } from "ioredis";

export class CacheService {
  private static embeddingCache = new Map<string, number[]>();
  private static categoryCache = new Map<string, string[]>();
  private static visionCache = new Map<string, string>();
  private static redisClient: Redis | null = null;

  // Cache size limits
  private static MAX_EMBEDDING_CACHE_SIZE = 3000; // Increase from 1000
  private static MAX_CATEGORY_CACHE_SIZE = 1000; // Increase from 500
  private static MAX_VISION_CACHE_SIZE = 200;

  static initRedis(options: { host: string; port: number; password: string }) {
    this.redisClient = new Redis(options);
  }

  static getCacheKey(text: string): string {
    return createHash("md5").update(text).digest("hex");
  }

  static getCachedEmbedding(text: string): number[] | undefined {
    const key = this.getCacheKey(text);
    return this.embeddingCache.get(key);
  }

  static setCachedEmbedding(text: string, embedding: number[]): void {
    const key = this.getCacheKey(text);

    // Implement simple LRU behavior
    if (this.embeddingCache.size >= this.MAX_EMBEDDING_CACHE_SIZE) {
      const oldestKey = this.embeddingCache.keys().next().value;
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
      }
    }

    this.embeddingCache.set(key, embedding);
  }

  static async getCachedData(key: string): Promise<string | null> {
    if (!this.redisClient) return null;

    try {
      // First check in-memory cache for vision results
      if (key.startsWith("vision:")) {
        const inMemoryResult = this.visionCache.get(key);
        if (inMemoryResult) return inMemoryResult;
      }

      // Fall back to Redis
      return await this.redisClient.get(key);
    } catch (error) {
      console.error(`Error getting cached data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic method to set cached data in Redis
   */
  static async setCachedData(key: string, data: string, ttlSeconds: number = 600): Promise<void> {
    try {
      // For vision results, also store in memory for faster access
      if (key.startsWith("vision:")) {
        this.setCachedVision(key, data);
      }

      // Store in Redis if available
      if (this.redisClient) {
        await this.redisClient.set(key, data, "EX", ttlSeconds);
      }
    } catch (error) {
      console.error(`Error setting cached data for key ${key}:`, error);
    }
  }

  static getCachedVision(key: string): string | undefined {
    return this.visionCache.get(key);
  }

  /**
   * Set cached vision processing result
   */
  static setCachedVision(key: string, result: string): void {
    if (this.visionCache.size >= this.MAX_VISION_CACHE_SIZE) {
      const oldestKey = this.visionCache.keys().next().value;
      if (oldestKey) {
        this.visionCache.delete(oldestKey);
      }
    }

    this.visionCache.set(key, result);
  }

  static getCachedCategories(text: string): string[] | undefined {
    const key = this.getCacheKey(text);
    return this.categoryCache.get(key);
  }

  static async getCachedSearch(key: string): Promise<any | null> {
    if (!this.redisClient) return null;

    const cached = await this.redisClient.get(`search:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  static async setCachedSearch(key: string, results: any, ttlSeconds: number = 600): Promise<void> {
    if (!this.redisClient) return;

    await this.redisClient.set(`search:${key}`, JSON.stringify(results), "EX", ttlSeconds);
  }

  static async invalidateSearchCache(): Promise<void> {
    if (!this.redisClient) return;

    const keys = await this.redisClient.keys("search:*");
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }

  static setCachedCategories(text: string, categories: string[]): void {
    const key = this.getCacheKey(text);

    if (this.categoryCache.size >= this.MAX_CATEGORY_CACHE_SIZE) {
      const oldestKey = this.categoryCache.keys().next().value;
      if (oldestKey) {
        this.categoryCache.delete(oldestKey);
      }
    }

    this.categoryCache.set(key, categories);
  }

  static monitorMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const mbUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
    const mbTotal = Math.round(memUsage.heapTotal / 1024 / 1024);

    // Auto-clear cache if memory pressure is high (>85%)
    if (mbUsed / mbTotal > 0.85) {
      this.embeddingCache.clear();
      this.categoryCache.clear();
      console.warn(`Memory pressure detected: ${mbUsed}MB/${mbTotal}MB - Cache cleared`);
    }
  }
}
