import { Notification } from "../../entities/Notification";
import { createCacheService } from "./CacheService";
import { Redis } from "ioredis";

interface NotificationCacheData {
  notifications: Notification[];
  total: number;
}

export interface NotificationCacheService {
  getCachedNotifications(userId: string): Promise<NotificationCacheData | null>;
  setCachedNotifications(
    userId: string,
    data: NotificationCacheData,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateNotificationCache(userId: string): Promise<void>;
  invalidateNotificationCaches(userIds: string[]): Promise<void>;
  invalidateAllNotificationCaches(): Promise<void>;
}

export class NotificationCacheServiceImpl implements NotificationCacheService {
  private static readonly NOTIFICATION_PREFIX = "notification:";
  private static readonly NOTIFICATION_TTL = 300; // 5 minutes
  private cacheService: ReturnType<typeof createCacheService>;

  constructor(cacheService: ReturnType<typeof createCacheService>) {
    this.cacheService = cacheService;
  }

  /**
   * Get cached notifications for a user
   */
  async getCachedNotifications(
    userId: string,
  ): Promise<NotificationCacheData | null> {
    return this.cacheService.get<NotificationCacheData>(
      `${NotificationCacheServiceImpl.NOTIFICATION_PREFIX}${userId}`,
      {
        useMemoryCache: true,
        ttlSeconds: NotificationCacheServiceImpl.NOTIFICATION_TTL,
      },
    );
  }

  /**
   * Set cached notifications for a user
   */
  async setCachedNotifications(
    userId: string,
    data: NotificationCacheData,
    ttlSeconds: number = NotificationCacheServiceImpl.NOTIFICATION_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${NotificationCacheServiceImpl.NOTIFICATION_PREFIX}${userId}`,
      data,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  /**
   * Invalidate notification cache for a user
   */
  async invalidateNotificationCache(userId: string): Promise<void> {
    await this.cacheService.invalidate(
      `${NotificationCacheServiceImpl.NOTIFICATION_PREFIX}${userId}`,
    );
  }

  /**
   * Invalidate notification caches for multiple users
   */
  async invalidateNotificationCaches(userIds: string[]): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.invalidateNotificationCache(userId)),
    );
  }

  /**
   * Invalidate all notification caches
   */
  async invalidateAllNotificationCaches(): Promise<void> {
    await this.cacheService.invalidateByPattern(
      `${NotificationCacheServiceImpl.NOTIFICATION_PREFIX}*`,
    );
  }
}

/**
 * Factory function to create a NotificationCacheService instance
 */
export function createNotificationCacheService(
  redis?: Redis,
): NotificationCacheService {
  const cacheService = createCacheService(redis);
  return new NotificationCacheServiceImpl(cacheService);
}
