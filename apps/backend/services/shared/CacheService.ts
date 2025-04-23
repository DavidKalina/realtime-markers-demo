// src/services/CacheService.ts
import { createHash } from "crypto";
import { Redis } from "ioredis";
import { DataSource } from "typeorm";
import { OpenAIService } from "./OpenAIService";
import { Category } from "../../entities/Category";
import { Event } from "../../entities/Event";

export class CacheService {
  private static embeddingCache = new Map<string, number[]>();
  private static categoryCache = new Map<string, string[]>();
  private static visionCache = new Map<string, string>();
  private static redisClient: Redis | null = null;

  // Cache size limits
  private static MAX_EMBEDDING_CACHE_SIZE = 3000; // Increase from 1000
  private static MAX_CATEGORY_CACHE_SIZE = 1000; // Increase from 500
  private static MAX_VISION_CACHE_SIZE = 200;

  private static cacheStats = {
    embeddingHits: 0,
    embeddingMisses: 0,
    categoryHits: 0,
    categoryMisses: 0,
    visionHits: 0,
    visionMisses: 0,
    redisHits: 0,
    redisMisses: 0,
    lastReset: Date.now(),
  };

  private static readonly FRIENDS_TTL = 300; // 5 minutes
  private static readonly FRIEND_REQUESTS_TTL = 60; // 1 minute

  static initRedis(options: { host: string; port: number; password: string }) {
    this.redisClient = new Redis(options);
  }

  static getCacheKey(text: string): string {
    return createHash("md5").update(text).digest("hex");
  }

  static getCacheStats() {
    const totalEmbedding = this.cacheStats.embeddingHits + this.cacheStats.embeddingMisses;
    const totalCategory = this.cacheStats.categoryHits + this.cacheStats.categoryMisses;
    const totalVision = this.cacheStats.visionHits + this.cacheStats.visionMisses;
    const totalRedis = this.cacheStats.redisHits + this.cacheStats.redisMisses;

    return {
      embedding: {
        hits: this.cacheStats.embeddingHits,
        misses: this.cacheStats.embeddingMisses,
        hitRate: totalEmbedding ? (this.cacheStats.embeddingHits / totalEmbedding) * 100 : 0,
      },
      category: {
        hits: this.cacheStats.categoryHits,
        misses: this.cacheStats.categoryMisses,
        hitRate: totalCategory ? (this.cacheStats.categoryHits / totalCategory) * 100 : 0,
      },
      vision: {
        hits: this.cacheStats.visionHits,
        misses: this.cacheStats.visionMisses,
        hitRate: totalVision ? (this.cacheStats.visionHits / totalVision) * 100 : 0,
      },
      redis: {
        hits: this.cacheStats.redisHits,
        misses: this.cacheStats.redisMisses,
        hitRate: totalRedis ? (this.cacheStats.redisHits / totalRedis) * 100 : 0,
      },
      uptime: Date.now() - this.cacheStats.lastReset,
    };
  }

  static resetCacheStats() {
    this.cacheStats = {
      embeddingHits: 0,
      embeddingMisses: 0,
      categoryHits: 0,
      categoryMisses: 0,
      visionHits: 0,
      visionMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      lastReset: Date.now(),
    };
  }

  static getCachedEmbedding(text: string): number[] | undefined {
    const key = this.getCacheKey(text);
    const result = this.embeddingCache.get(key);
    if (result) {
      this.cacheStats.embeddingHits++;
    } else {
      this.cacheStats.embeddingMisses++;
    }
    return result;
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
        if (inMemoryResult) {
          this.cacheStats.redisHits++;
          return inMemoryResult;
        }
      }

      // Fall back to Redis
      const result = await this.redisClient.get(key);
      if (result) {
        this.cacheStats.redisHits++;
      } else {
        this.cacheStats.redisMisses++;
      }
      return result;
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
    const result = this.visionCache.get(key);
    if (result) {
      this.cacheStats.visionHits++;
    } else {
      this.cacheStats.visionMisses++;
    }
    return result;
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
    const result = this.categoryCache.get(key);
    if (result) {
      this.cacheStats.categoryHits++;
    } else {
      this.cacheStats.categoryMisses++;
    }
    return result;
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

  static async getCachedEvent(id: string): Promise<any | null> {
    if (!this.redisClient) return null;

    const cached = await this.redisClient.get(`event:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  static async setCachedEvent(id: string, event: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.redisClient) return;

    await this.redisClient.set(`event:${id}`, JSON.stringify(event), "EX", ttlSeconds);
  }

  static async invalidateEventCache(id: string): Promise<void> {
    if (!this.redisClient) return;

    await this.redisClient.del(`event:${id}`);
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

  static async warmCache(dataSource: DataSource): Promise<void> {
    try {
      console.log("Starting cache warm-up...");

      // Warm up categories
      const categories = await dataSource.getRepository(Category).find();
      categories.forEach((category: Category) => {
        this.setCachedCategories(category.name, [category.name]);
      });

      // Warm up recent events
      const recentEvents = await dataSource.getRepository(Event).find({
        order: { eventDate: "DESC" },
        take: 100,
      });

      for (const event of recentEvents) {
        await this.setCachedEvent(event.id, event, 3600); // 1 hour TTL
      }

      // Warm up embeddings for recent event titles
      for (const event of recentEvents) {
        const textForEmbedding = `
          TITLE: ${event.title} ${event.title} ${event.title}
          CATEGORIES: ${event.categories?.map((c) => c.name).join(", ")}
          DESCRIPTION: ${event.description || ""}
        `.trim();

        const embedding = await OpenAIService.getInstance().embeddings.create({
          model: "text-embedding-3-small",
          input: textForEmbedding,
          encoding_format: "float",
        });

        this.setCachedEmbedding(textForEmbedding, embedding.data[0].embedding);
      }

      console.log("Cache warm-up completed");
    } catch (error) {
      console.error("Error during cache warm-up:", error);
    }
  }

  static getRedisClient(): Redis | null {
    return this.redisClient;
  }

  static async getCachedClusterHub(markerIds: string[]): Promise<any | null> {
    if (!this.redisClient) return null;

    const key = `cluster-hub:${markerIds.sort().join(",")}`;
    const cached = await this.redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  static async setCachedClusterHub(
    markerIds: string[],
    data: any,
    ttlSeconds: number = 300
  ): Promise<void> {
    if (!this.redisClient) return;

    const key = `cluster-hub:${markerIds.sort().join(",")}`;
    await this.redisClient.set(key, JSON.stringify(data), "EX", ttlSeconds);
  }

  static async invalidateClusterHubCache(markerIds: string[]): Promise<void> {
    if (!this.redisClient) return;

    const key = `cluster-hub:${markerIds.sort().join(",")}`;
    await this.redisClient.del(key);
  }

  static async invalidateAllClusterHubCaches(): Promise<void> {
    if (!this.redisClient) return;

    const keys = await this.redisClient.keys("cluster-hub:*");
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }

  /**
   * Get cached friends list for a user
   */
  static async getCachedFriends(userId: string): Promise<any | null> {
    if (!this.redisClient) return null;

    const cached = await this.redisClient.get(`friends:${userId}`);
    if (cached) {
      this.cacheStats.redisHits++;
      return JSON.parse(cached);
    }
    this.cacheStats.redisMisses++;
    return null;
  }

  /**
   * Cache a user's friends list
   */
  static async setCachedFriends(userId: string, friends: any[]): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.set(
        `friends:${userId}`,
        JSON.stringify(friends),
        "EX",
        this.FRIENDS_TTL
      );
    } catch (error) {
      console.error(`Error caching friends for user ${userId}:`, error);
    }
  }

  /**
   * Get cached friend requests for a user
   */
  static async getCachedFriendRequests(
    userId: string,
    type: "incoming" | "outgoing"
  ): Promise<any | null> {
    if (!this.redisClient) return null;

    const cached = await this.redisClient.get(`friend-requests:${type}:${userId}`);
    if (cached) {
      this.cacheStats.redisHits++;
      return JSON.parse(cached);
    }
    this.cacheStats.redisMisses++;
    return null;
  }

  /**
   * Cache friend requests for a user
   */
  static async setCachedFriendRequests(
    userId: string,
    type: "incoming" | "outgoing",
    requests: any[]
  ): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.set(
        `friend-requests:${type}:${userId}`,
        JSON.stringify(requests),
        "EX",
        this.FRIEND_REQUESTS_TTL
      );
    } catch (error) {
      console.error(`Error caching ${type} friend requests for user ${userId}:`, error);
    }
  }

  /**
   * Invalidate all friend-related caches for a user
   */
  static async invalidateFriendCaches(userId: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      const keys = await this.redisClient.keys(`friends:${userId}`);
      keys.push(...(await this.redisClient.keys(`friend-requests:*:${userId}`)));

      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      console.error(`Error invalidating friend caches for user ${userId}:`, error);
    }
  }

  /**
   * Invalidate friend caches for both users involved in a friendship action
   */
  static async invalidateFriendshipCaches(userId1: string, userId2: string): Promise<void> {
    await Promise.all([this.invalidateFriendCaches(userId1), this.invalidateFriendCaches(userId2)]);
  }
}
