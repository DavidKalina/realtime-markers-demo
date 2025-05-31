import { CacheService } from "./CacheService";
import type { ConfigService } from "./ConfigService";

export class EmbeddingCacheService extends CacheService {
  private static readonly EMBEDDING_PREFIX = "embedding:";
  private static readonly DEFAULT_TTL = 86400; // 24 hours
  private static readonly DEFAULT_MAX_CACHE_SIZE = 3000; // Default from ConfigService

  private static instance: EmbeddingCacheService;
  private ttl: number;
  private maxCacheSize: number;

  private constructor(configService?: ConfigService) {
    super();
    this.ttl =
      configService?.get("cache.ttl") || EmbeddingCacheService.DEFAULT_TTL;
    this.maxCacheSize =
      configService?.get("cache.embeddingCacheSize") ||
      EmbeddingCacheService.DEFAULT_MAX_CACHE_SIZE;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(configService?: ConfigService): EmbeddingCacheService {
    if (!this.instance) {
      this.instance = new EmbeddingCacheService(configService);
    }
    return this.instance;
  }

  /**
   * Get a cached embedding for text
   */
  static getCachedEmbedding(text: string): number[] | undefined {
    const key = `${this.EMBEDDING_PREFIX}${text}`;
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as number[];
    }
    return undefined;
  }

  /**
   * Set a cached embedding for text
   */
  static setCachedEmbedding(text: string, embedding: number[]): void {
    const key = `${this.EMBEDDING_PREFIX}${text}`;
    const instance = this.getInstance();

    // Implement simple LRU behavior if cache is full
    if (this.memoryCache.size >= instance.maxCacheSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + instance.ttl * 1000,
    });
  }

  /**
   * Get a cached embedding for structured input
   */
  static getCachedStructuredEmbedding(input: {
    text: string;
    title?: string;
    date?: string | Date;
    endDate?: string | Date;
    coordinates?: [number, number];
    timezone?: string;
    locationNotes?: string;
    address?: string;
  }): number[] | undefined {
    const key = this.generateStructuredKey(input);
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as number[];
    }
    return undefined;
  }

  /**
   * Set a cached embedding for structured input
   */
  static setCachedStructuredEmbedding(
    input: {
      text: string;
      title?: string;
      date?: string | Date;
      endDate?: string | Date;
      coordinates?: [number, number];
      timezone?: string;
      locationNotes?: string;
      address?: string;
    },
    embedding: number[],
  ): void {
    const key = this.generateStructuredKey(input);
    const instance = this.getInstance();

    // Implement simple LRU behavior if cache is full
    if (this.memoryCache.size >= instance.maxCacheSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + instance.ttl * 1000,
    });
  }

  /**
   * Invalidate a specific embedding cache
   */
  static invalidateEmbedding(text: string): void {
    const key = `${this.EMBEDDING_PREFIX}${text}`;
    this.memoryCache.delete(key);
  }

  /**
   * Invalidate a specific structured embedding cache
   */
  static invalidateStructuredEmbedding(input: {
    text: string;
    title?: string;
    date?: string | Date;
    endDate?: string | Date;
    coordinates?: [number, number];
    timezone?: string;
    locationNotes?: string;
    address?: string;
  }): void {
    const key = this.generateStructuredKey(input);
    this.memoryCache.delete(key);
  }

  /**
   * Clear all embedding caches
   */
  static clearAllEmbeddings(): void {
    // Clear only embedding-related entries from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(this.EMBEDDING_PREFIX)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Generate a cache key for structured input
   */
  private static generateStructuredKey(input: {
    text: string;
    title?: string;
    date?: string | Date;
    endDate?: string | Date;
    coordinates?: [number, number];
    timezone?: string;
    locationNotes?: string;
    address?: string;
  }): string {
    const components = [
      input.text,
      input.title,
      input.date instanceof Date ? input.date.toISOString() : input.date,
      input.endDate instanceof Date
        ? input.endDate.toISOString()
        : input.endDate,
      input.coordinates?.join(","),
      input.timezone,
      input.locationNotes,
      input.address,
    ].filter(Boolean);

    return `${this.EMBEDDING_PREFIX}structured:${components.join("|")}`;
  }
}
