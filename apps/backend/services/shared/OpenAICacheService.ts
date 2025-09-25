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
  incrementTokenUsage(
    model: OpenAIModel,
    operation: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
    dateKey?: string,
  ): Promise<void>;
  getTokenUsage(
    model: OpenAIModel,
    operation: string,
    dateKey?: string,
  ): Promise<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>;
}

export class OpenAICacheServiceImpl
  extends CacheServiceImpl
  implements OpenAICacheService
{
  private static readonly EMBEDDING_PREFIX = "openai:embedding:";
  private static readonly RATE_LIMIT_PREFIX = "openai:ratelimit:";
  private static readonly USAGE_PREFIX = "openai:usage:";
  private static readonly EMBEDDING_TTL = 24 * 60 * 60; // 24 hours
  private static readonly RATE_LIMIT_TTL = 120; // 2 minutes
  private static readonly USAGE_TTL = 8 * 24 * 60 * 60; // 8 days

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

  private buildUsageKey(
    model: OpenAIModel,
    operation: string,
    dateKey?: string,
  ): string {
    const day = dateKey || new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${OpenAICacheServiceImpl.USAGE_PREFIX}${day}:${model}:${operation}`;
  }

  async incrementTokenUsage(
    model: OpenAIModel,
    operation: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
    dateKey?: string,
  ): Promise<void> {
    const key = this.buildUsageKey(model, operation, dateKey);
    const current =
      (await this.get<{
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }>(key)) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const updated = {
      promptTokens: current.promptTokens + (usage.promptTokens || 0),
      completionTokens: current.completionTokens + (usage.completionTokens || 0),
      totalTokens: current.totalTokens + (usage.totalTokens || 0),
    };

    await this.set(key, updated, {
      useMemoryCache: false,
      ttlSeconds: OpenAICacheServiceImpl.USAGE_TTL,
    });
  }

  async getTokenUsage(
    model: OpenAIModel,
    operation: string,
    dateKey?: string,
  ): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null> {
    const key = this.buildUsageKey(model, operation, dateKey);
    return this.get<{
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>(key);
  }
}

/**
 * Factory function to create an OpenAICacheService instance
 */
export function createOpenAICacheService(): OpenAICacheService {
  return new OpenAICacheServiceImpl();
}
