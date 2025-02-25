// src/services/CacheService.ts
import { createHash } from "crypto";
import { Redis } from "ioredis";

export class CacheService {
  private static embeddingCache = new Map<string, number[]>();
  private static categoryCache = new Map<string, string[]>();
  private static redisClient: Redis | null = null;

  // Cache size limits
  private static MAX_EMBEDDING_CACHE_SIZE = 1000;
  private static MAX_CATEGORY_CACHE_SIZE = 500;

  static initRedis(options: { host: string; port: number }) {
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
}
