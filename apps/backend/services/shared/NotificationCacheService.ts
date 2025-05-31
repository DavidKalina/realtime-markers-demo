import { Notification } from "../../entities/Notification";
import { CacheService } from "./CacheService";

interface NotificationCacheData {
  notifications: Notification[];
  total: number;
}

export class NotificationCacheService extends CacheService {
  private static readonly NOTIFICATION_PREFIX = "notification:";
  private static readonly NOTIFICATION_TTL = 300; // 5 minutes

  /**
   * Get cached notifications for a user
   */
  static async getCachedNotifications(
    userId: string,
  ): Promise<NotificationCacheData | null> {
    return this.get<NotificationCacheData>(
      `${this.NOTIFICATION_PREFIX}${userId}`,
      {
        useMemoryCache: true,
        ttlSeconds: this.NOTIFICATION_TTL,
      },
    );
  }

  /**
   * Set cached notifications for a user
   */
  static async setCachedNotifications(
    userId: string,
    data: NotificationCacheData,
    ttlSeconds: number = this.NOTIFICATION_TTL,
  ): Promise<void> {
    await this.set(`${this.NOTIFICATION_PREFIX}${userId}`, data, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  /**
   * Invalidate notification cache for a user
   */
  static async invalidateNotificationCache(userId: string): Promise<void> {
    await this.invalidate(`${this.NOTIFICATION_PREFIX}${userId}`);
  }

  /**
   * Invalidate notification caches for multiple users
   */
  static async invalidateNotificationCaches(userIds: string[]): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.invalidateNotificationCache(userId)),
    );
  }

  /**
   * Invalidate all notification caches
   */
  static async invalidateAllNotificationCaches(): Promise<void> {
    await this.invalidateByPattern(`${this.NOTIFICATION_PREFIX}*`);
  }
}
