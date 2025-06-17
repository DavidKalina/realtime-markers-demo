import { Redis } from "ioredis";
import type { UserPushToken } from "../../entities/UserPushToken";
import type { PushNotificationResult } from "../PushNotificationService";

export interface PushNotificationCacheService {
  /**
   * Cache user tokens
   */
  setUserTokens(userId: string, tokens: UserPushToken[]): Promise<void>;

  /**
   * Get cached user tokens
   */
  getUserTokens(userId: string): Promise<UserPushToken[] | null>;

  /**
   * Invalidate user tokens cache
   */
  invalidateUserTokens(userId: string): Promise<void>;

  /**
   * Cache push notification results
   */
  setPushResults(
    jobId: string,
    results: PushNotificationResult[],
  ): Promise<void>;

  /**
   * Get cached push notification results
   */
  getPushResults(jobId: string): Promise<PushNotificationResult[] | null>;

  /**
   * Invalidate push results cache
   */
  invalidatePushResults(jobId: string): Promise<void>;
}

export class PushNotificationCacheServiceImpl
  implements PushNotificationCacheService
{
  private redis: Redis;
  private readonly USER_TOKENS_TTL = 300; // 5 minutes
  private readonly PUSH_RESULTS_TTL = 3600; // 1 hour

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Cache user tokens
   */
  async setUserTokens(userId: string, tokens: UserPushToken[]): Promise<void> {
    const key = `push_tokens:user:${userId}`;
    await this.redis.setex(key, this.USER_TOKENS_TTL, JSON.stringify(tokens));
  }

  /**
   * Get cached user tokens
   */
  async getUserTokens(userId: string): Promise<UserPushToken[] | null> {
    const key = `push_tokens:user:${userId}`;
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    try {
      const tokens = JSON.parse(cached) as UserPushToken[];
      // Convert date strings back to Date objects
      return tokens.map((token) => ({
        ...token,
        createdAt: new Date(token.createdAt),
        updatedAt: new Date(token.updatedAt),
        lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : undefined,
      }));
    } catch (error) {
      console.error("Error parsing cached user tokens:", error);
      return null;
    }
  }

  /**
   * Invalidate user tokens cache
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    const key = `push_tokens:user:${userId}`;
    await this.redis.del(key);
  }

  /**
   * Cache push notification results
   */
  async setPushResults(
    jobId: string,
    results: PushNotificationResult[],
  ): Promise<void> {
    const key = `push_results:${jobId}`;
    await this.redis.setex(key, this.PUSH_RESULTS_TTL, JSON.stringify(results));
  }

  /**
   * Get cached push notification results
   */
  async getPushResults(
    jobId: string,
  ): Promise<PushNotificationResult[] | null> {
    const key = `push_results:${jobId}`;
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached);
    } catch (error) {
      console.error("Error parsing cached push results:", error);
      return null;
    }
  }

  /**
   * Invalidate push results cache
   */
  async invalidatePushResults(jobId: string): Promise<void> {
    const key = `push_results:${jobId}`;
    await this.redis.del(key);
  }
}

/**
 * Factory function to create a PushNotificationCacheService instance
 */
export function createPushNotificationCacheService(
  redis: Redis,
): PushNotificationCacheService {
  return new PushNotificationCacheServiceImpl(redis);
}
