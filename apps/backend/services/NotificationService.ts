import { Redis } from "ioredis";
import { DataSource, Repository } from "typeorm";
import { Notification } from "../entities/Notification";
import type { NotificationType } from "../entities/Notification";
import { createNotificationCacheService } from "./shared/NotificationCacheService";
import { createRedisService } from "./shared/RedisService";

export interface NotificationData {
  id: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
  read: boolean;
  readAt?: string;
}

export interface NotificationService {
  createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<Notification>;

  getUserNotifications(
    userId: string,
    options: {
      skip?: number;
      take?: number;
      read?: boolean;
      type?: NotificationType;
    },
  ): Promise<{ notifications: Notification[]; total: number }>;

  markAsRead(userId: string, notificationId: string): Promise<void>;

  deleteNotification(userId: string, notificationId: string): Promise<void>;

  clearAllNotifications(userId: string): Promise<void>;

  getUnreadCount(userId: string): Promise<number>;

  markAllAsRead(userId: string): Promise<void>;
}

export class NotificationServiceImpl implements NotificationService {
  private notificationRepository: Repository<Notification>;
  private redisService: ReturnType<typeof createRedisService>;
  private notificationCacheService: ReturnType<
    typeof createNotificationCacheService
  >;

  constructor(
    redis: Redis,
    dataSource: DataSource,
    redisService: ReturnType<typeof createRedisService>,
    notificationCacheService: ReturnType<typeof createNotificationCacheService>,
  ) {
    this.notificationRepository = dataSource.getRepository(Notification);
    this.redisService = redisService;
    this.notificationCacheService = notificationCacheService;
  }

  /**
   * Create and publish a new notification
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    // Create notification in database
    const notification = this.notificationRepository.create({
      type,
      userId,
      title,
      message,
      data,
      read: false,
    });

    await this.notificationRepository.save(notification);

    // Store in Redis for real-time access
    const notificationData: NotificationData = {
      id: notification.id,
      type: notification.type,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
    };

    await this.redisService.hset(
      `notifications:${userId}`,
      notification.id,
      notificationData,
    );

    // Invalidate cache
    await this.notificationCacheService.invalidateNotificationCache(userId);

    // Publish the notification to Redis
    await this.redisService.publish("notifications", {
      type: "NEW_NOTIFICATION",
      data: notificationData,
    });

    return notification;
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options: {
      skip?: number;
      take?: number;
      read?: boolean;
      type?: NotificationType;
    } = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    // Try to get from cache first if no filters are applied
    if (
      options.skip === undefined &&
      options.take === undefined &&
      options.read === undefined &&
      options.type === undefined
    ) {
      const cached =
        await this.notificationCacheService.getCachedNotifications(userId);
      if (cached) {
        return {
          notifications: cached.notifications,
          total: cached.total,
        };
      }
    }

    const queryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.userId = :userId", { userId });

    if (options.read !== undefined) {
      queryBuilder.andWhere("notification.read = :read", {
        read: options.read,
      });
    }

    if (options.type) {
      queryBuilder.andWhere("notification.type = :type", {
        type: options.type,
      });
    }

    const total = await queryBuilder.getCount();

    if (options.skip !== undefined) {
      queryBuilder.skip(options.skip);
    }

    if (options.take !== undefined) {
      queryBuilder.take(options.take);
    }

    queryBuilder.orderBy("notification.createdAt", "DESC");

    const notifications = await queryBuilder.getMany();

    // Cache the results if no filters are applied
    if (
      options.skip === undefined &&
      options.take === undefined &&
      options.read === undefined &&
      options.type === undefined
    ) {
      await this.notificationCacheService.setCachedNotifications(userId, {
        notifications,
        total,
      });
    }

    return { notifications, total };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    // Update in database
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { read: true, readAt: new Date() },
    );

    // Update in Redis
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (notification) {
      const notificationData: NotificationData = {
        id: notification.id,
        type: notification.type,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt.toISOString(),
        read: true,
        readAt: notification.readAt?.toISOString(),
      };

      await this.redisService.hset(
        `notifications:${userId}`,
        notificationId,
        notificationData,
      );

      // Invalidate cache
      await this.notificationCacheService.invalidateNotificationCache(userId);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    // Delete from database
    await this.notificationRepository.delete({ id: notificationId, userId });

    // Delete from Redis
    await this.redisService.hdel(`notifications:${userId}`, notificationId);

    // Invalidate cache
    await this.notificationCacheService.invalidateNotificationCache(userId);
  }

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string): Promise<void> {
    // Delete from database
    await this.notificationRepository.delete({ userId });

    // Delete from Redis
    await this.redisService.del(`notifications:${userId}`);

    // Invalidate cache
    await this.notificationCacheService.invalidateNotificationCache(userId);
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, read: false },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    // Update in database
    await this.notificationRepository.update(
      { userId, read: false },
      { read: true, readAt: new Date() },
    );

    // Update in Redis
    const notifications = await this.notificationRepository.find({
      where: { userId },
    });

    // Update each notification in Redis
    for (const notification of notifications) {
      const notificationData: NotificationData = {
        id: notification.id,
        type: notification.type,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt.toISOString(),
        read: true,
        readAt: notification.readAt?.toISOString(),
      };

      await this.redisService.hset(
        `notifications:${userId}`,
        notification.id,
        notificationData,
      );
    }

    // Invalidate cache
    await this.notificationCacheService.invalidateNotificationCache(userId);
  }
}

/**
 * Factory function to create a NotificationService instance
 */
export function createNotificationService(
  redis: Redis,
  dataSource: DataSource,
): NotificationService {
  const redisService = createRedisService(redis);
  const notificationCacheService = createNotificationCacheService(redis);

  return new NotificationServiceImpl(
    redis,
    dataSource,
    redisService,
    notificationCacheService,
  );
}
