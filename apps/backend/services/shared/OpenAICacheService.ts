import { CacheService } from "./CacheService";
import { OpenAIModel } from "./OpenAIService";

export class OpenAICacheService extends CacheService {
  private static readonly EMBEDDING_PREFIX = "openai:embedding:";
  private static readonly RATE_LIMIT_PREFIX = "openai:ratelimit:";
  private static readonly EMBEDDING_TTL = 24 * 60 * 60; // 24 hours
  private static readonly RATE_LIMIT_TTL = 120; // 2 minutes

  /**
   * Get cached embedding for text
   */
  static async getEmbedding(text: string): Promise<number[] | null> {
    return this.get<number[]>(`${this.EMBEDDING_PREFIX}${text}`, {
      useMemoryCache: true,
      ttlSeconds: this.EMBEDDING_TTL,
    });
  }

  /**
   * Cache embedding for text
   */
  static async setEmbedding(text: string, embedding: number[]): Promise<void> {
    await this.set(`${this.EMBEDDING_PREFIX}${text}`, embedding, {
      useMemoryCache: true,
      ttlSeconds: this.EMBEDDING_TTL,
    });
  }

  /**
   * Get rate limit count for a model and operation
   */
  static async getRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number | null> {
    const key = `${this.RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(
      Date.now() / 60000,
    )}`;
    return this.get<number>(key, {
      useMemoryCache: false,
      ttlSeconds: this.RATE_LIMIT_TTL,
    });
  }

  /**
   * Increment rate limit count for a model and operation
   */
  static async incrementRateLimitCount(
    model: OpenAIModel,
    operation: string,
  ): Promise<number> {
    const key = `${this.RATE_LIMIT_PREFIX}${model}:${operation}:${Math.floor(
      Date.now() / 60000,
    )}`;
    const currentCount = (await this.getRateLimitCount(model, operation)) || 0;
    const newCount = currentCount + 1;
    await this.set(key, newCount, {
      useMemoryCache: false,
      ttlSeconds: this.RATE_LIMIT_TTL,
    });
    return newCount;
  }

  /**
   * Reset rate limit counters
   */
  static async resetRateLimitCounters(): Promise<void> {
    await this.invalidateByPattern(`${this.RATE_LIMIT_PREFIX}*`);
  }

  /**
   * Invalidate embedding cache for specific text
   */
  static async invalidateEmbedding(text: string): Promise<void> {
    await this.invalidate(`${this.EMBEDDING_PREFIX}${text}`);
  }

  /**
   * Invalidate all embedding caches
   */
  static async invalidateAllEmbeddings(): Promise<void> {
    await this.invalidateByPattern(`${this.EMBEDDING_PREFIX}*`);
  }
}
