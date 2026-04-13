import type { OpenAIModel } from "./OpenAIService";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_MEMORY_CACHE_SIZE = 1000;
const EMBEDDING_PREFIX = "openai:embedding:";
const RATE_LIMIT_PREFIX = "openai:ratelimit:";
const EMBEDDING_TTL = 24 * 60 * 60; // 24 hours
const RATE_LIMIT_TTL = 120; // 2 minutes

export class OpenAICacheService {
  private cache = new Map<string, CacheEntry<unknown>>();

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value as T;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  private setInCache<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.cache.size >= MAX_MEMORY_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private deleteFromCache(key: string): void {
    this.cache.delete(key);
  }

  private deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async getEmbedding(text: string): Promise<number[] | null> {
    return this.getFromCache<number[]>(`${EMBEDDING_PREFIX}${text}`);
  }

  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    this.setInCache(`${EMBEDDING_PREFIX}${text}`, embedding, EMBEDDING_TTL);
  }

  async getRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number | null> {
    const key = `${RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(Date.now() / 60000)}`;
    return this.getFromCache<number>(key);
  }

  async incrementRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number> {
    const key = `${RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(Date.now() / 60000)}`;
    const currentCount = (await this.getRateLimitCount(model, operation)) || 0;
    const newCount = currentCount + 1;
    this.setInCache(key, newCount, RATE_LIMIT_TTL);
    return newCount;
  }

  async resetRateLimitCounters(): Promise<void> {
    this.deleteByPrefix(RATE_LIMIT_PREFIX);
  }

  async invalidateEmbedding(text: string): Promise<void> {
    this.deleteFromCache(`${EMBEDDING_PREFIX}${text}`);
  }

  async invalidateAllEmbeddings(): Promise<void> {
    this.deleteByPrefix(EMBEDDING_PREFIX);
  }
}
