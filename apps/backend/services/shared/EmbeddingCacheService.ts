import type { ConfigService } from "./ConfigService";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface EmbeddingCacheServiceDependencies {
  configService?: ConfigService;
}

export class EmbeddingCacheService {
  private static readonly EMBEDDING_PREFIX = "embedding:";
  private static readonly DEFAULT_TTL = 86400; // 24 hours
  private static readonly DEFAULT_MAX_CACHE_SIZE = 3000; // Default from ConfigService

  private static memoryCache = new Map<string, CacheEntry<unknown>>();
  private ttl: number;
  private maxCacheSize: number;

  constructor(private dependencies: EmbeddingCacheServiceDependencies) {
    this.ttl =
      dependencies.configService?.get("cache.ttl") ||
      EmbeddingCacheService.DEFAULT_TTL;
    this.maxCacheSize =
      dependencies.configService?.get("cache.embeddingCacheSize") ||
      EmbeddingCacheService.DEFAULT_MAX_CACHE_SIZE;
  }

  /**
   * Get a cached embedding for text
   */
  getCachedEmbedding(text: string): number[] | undefined {
    const key = `${EmbeddingCacheService.EMBEDDING_PREFIX}${text}`;
    const cached = EmbeddingCacheService.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as number[];
    }
    return undefined;
  }

  /**
   * Set a cached embedding for text
   */
  setCachedEmbedding(text: string, embedding: number[]): void {
    const key = `${EmbeddingCacheService.EMBEDDING_PREFIX}${text}`;

    // Implement simple LRU behavior if cache is full
    if (EmbeddingCacheService.memoryCache.size >= this.maxCacheSize) {
      const oldestKey = EmbeddingCacheService.memoryCache.keys().next().value;
      if (oldestKey) {
        EmbeddingCacheService.memoryCache.delete(oldestKey);
      }
    }

    EmbeddingCacheService.memoryCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + this.ttl * 1000,
    });
  }

  /**
   * Get a cached embedding for structured input
   */
  getCachedStructuredEmbedding(input: {
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
    const cached = EmbeddingCacheService.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as number[];
    }
    return undefined;
  }

  /**
   * Set a cached embedding for structured input
   */
  setCachedStructuredEmbedding(
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

    // Implement simple LRU behavior if cache is full
    if (EmbeddingCacheService.memoryCache.size >= this.maxCacheSize) {
      const oldestKey = EmbeddingCacheService.memoryCache.keys().next().value;
      if (oldestKey) {
        EmbeddingCacheService.memoryCache.delete(oldestKey);
      }
    }

    EmbeddingCacheService.memoryCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + this.ttl * 1000,
    });
  }

  /**
   * Invalidate a specific embedding cache
   */
  invalidateEmbedding(text: string): void {
    const key = `${EmbeddingCacheService.EMBEDDING_PREFIX}${text}`;
    EmbeddingCacheService.memoryCache.delete(key);
  }

  /**
   * Invalidate a specific structured embedding cache
   */
  invalidateStructuredEmbedding(input: {
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
    EmbeddingCacheService.memoryCache.delete(key);
  }

  /**
   * Clear all embedding caches
   */
  clearAllEmbeddings(): void {
    // Clear only embedding-related entries from memory cache
    for (const key of EmbeddingCacheService.memoryCache.keys()) {
      if (key.startsWith(EmbeddingCacheService.EMBEDDING_PREFIX)) {
        EmbeddingCacheService.memoryCache.delete(key);
      }
    }
  }

  /**
   * Generate a cache key for structured input
   */
  private generateStructuredKey(input: {
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

    return `${EmbeddingCacheService.EMBEDDING_PREFIX}structured:${components.join("|")}`;
  }
}

export function createEmbeddingCacheService(
  dependencies: EmbeddingCacheServiceDependencies = {},
): EmbeddingCacheService {
  return new EmbeddingCacheService(dependencies);
}
