import { CacheService } from "./CacheService";
import { OpenAIModel } from "./OpenAIService";

export class OpenAICacheService
  extends CacheService
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
      `${OpenAICacheService.EMBEDDING_PREFIX}${text}`,
      {
        useMemoryCache: true,
        ttlSeconds: OpenAICacheService.EMBEDDING_TTL,
      },
    );
  }

  /**
   * Cache embedding for text
   */
  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    await this.set(
      `${OpenAICacheService.EMBEDDING_PREFIX}${text}`,
      embedding,
      {
        useMemoryCache: true,
        ttlSeconds: OpenAICacheService.EMBEDDING_TTL,
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
    const key = `${OpenAICacheService.RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(
      Date.now() / 60000,
    )}`;
    return this.get<number>(key, {
      useMemoryCache: false,
      ttlSeconds: OpenAICacheService.RATE_LIMIT_TTL,
    });
  }

  /**
   * Increment rate limit count for a model and operation
   */
  async incrementRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number> {
    const key = `${OpenAICacheService.RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(
      Date.now() / 60000,
    )}`;
    const currentCount = (await this.getRateLimitCount(model, operation)) || 0;
    const newCount = currentCount + 1;
    await this.set(key, newCount, {
      useMemoryCache: false,
      ttlSeconds: OpenAICacheService.RATE_LIMIT_TTL,
    });
    return newCount;
  }

  /**
   * Reset rate limit counters
   */
  async resetRateLimitCounters(): Promise<void> {
    await this.invalidateByPattern(
      `${OpenAICacheService.RATE_LIMIT_PREFIX}*`,
    );
  }

  /**
   * Invalidate embedding cache for specific text
   */
  async invalidateEmbedding(text: string): Promise<void> {
    await this.invalidate(`${OpenAICacheService.EMBEDDING_PREFIX}${text}`);
  }

  /**
   * Invalidate all embedding caches
   */
  async invalidateAllEmbeddings(): Promise<void> {
    await this.invalidateByPattern(
      `${OpenAICacheService.EMBEDDING_PREFIX}*`,
    );
  }
}

