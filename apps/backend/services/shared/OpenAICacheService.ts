import { CacheServiceImpl } from "./CacheService";
import { OpenAIModel } from "./OpenAIService";

export interface OpenAICacheService {
  getEmbedding(text: string): Promise<number[] | null>;
  setEmbedding(text: string, embedding: number[]): Promise<void>;
  getRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number | null>;
  incrementRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number>;
  resetRateLimitCounters(): Promise<void>;
  invalidateEmbedding(text: string): Promise<void>;
  invalidateAllEmbeddings(): Promise<void>;
}

export class OpenAICacheServiceImpl
  extends CacheServiceImpl
  implements OpenAICacheService
{
  private static readonly EMBEDDING_PREFIX = "openai:embedding:";
  private static readonly RATE_LIMIT_PREFIX = "openai:ratelimit:";
  private static readonly EMBEDDING_TTL = 24 * 60 * 60; // 24 hours
  private static readonly RATE_LIMIT_TTL = 120; // 2 minutes

  /**
   * Get cached embedding for text
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    return this.get<number[]>(
      `${OpenAICacheServiceImpl.EMBEDDING_PREFIX}${text}`,
      {
        useMemoryCache: true,
        ttlSeconds: OpenAICacheServiceImpl.EMBEDDING_TTL,
      },
    );
  }

  /**
   * Cache embedding for text
   */
  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    await this.set(
      `${OpenAICacheServiceImpl.EMBEDDING_PREFIX}${text}`,
      embedding,
      {
        useMemoryCache: true,
        ttlSeconds: OpenAICacheServiceImpl.EMBEDDING_TTL,
      },
    );
  }

  /**
   * Get rate limit count for a model and operation
   */
  async getRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number | null> {
    const key = `${OpenAICacheServiceImpl.RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(
      Date.now() / 60000,
    )}`;
    return this.get<number>(key, {
      useMemoryCache: false,
      ttlSeconds: OpenAICacheServiceImpl.RATE_LIMIT_TTL,
    });
  }

  /**
   * Increment rate limit count for a model and operation
   */
  async incrementRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number> {
    const key = `${OpenAICacheServiceImpl.RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(
      Date.now() / 60000,
    )}`;
    const currentCount = (await this.getRateLimitCount(model, operation)) || 0;
    const newCount = currentCount + 1;
    await this.set(key, newCount, {
      useMemoryCache: false,
      ttlSeconds: OpenAICacheServiceImpl.RATE_LIMIT_TTL,
    });
    return newCount;
  }

  /**
   * Reset rate limit counters
   */
  async resetRateLimitCounters(): Promise<void> {
    await this.invalidateByPattern(
      `${OpenAICacheServiceImpl.RATE_LIMIT_PREFIX}*`,
    );
  }

  /**
   * Invalidate embedding cache for specific text
   */
  async invalidateEmbedding(text: string): Promise<void> {
    await this.invalidate(`${OpenAICacheServiceImpl.EMBEDDING_PREFIX}${text}`);
  }

  /**
   * Invalidate all embedding caches
   */
  async invalidateAllEmbeddings(): Promise<void> {
    await this.invalidateByPattern(
      `${OpenAICacheServiceImpl.EMBEDDING_PREFIX}*`,
    );
  }
}

/**
 * Factory function to create an OpenAICacheService instance
 */
export function createOpenAICacheService(): OpenAICacheService {
  return new OpenAICacheServiceImpl();
}
