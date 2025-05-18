import { Redis } from "ioredis";
import { DataSource, Repository } from "typeorm";
import { Notification } from "../entities/Notification";
import type { NotificationType } from "../entities/Notification";
import { CacheService } from "./shared/CacheService";

export interface NotificationData {
  id: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  createdAt: string;
  read: boolean;
  readAt?: string;
}

export class NotificationService {
  private redis: Redis;
  private notificationRepository: Repository<Notification>;
  private static instance: NotificationService;

  private constructor(redis: Redis, dataSource: DataSource) {
    this.redis = redis;
    this.notificationRepository = dataSource.getRepository(Notification);
  }

  public static getInstance(
    redis: Redis,
    dataSource: DataSource,
  ): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(redis, dataSource);
    }
    return NotificationService.instance;
  }

  /**
   * Create and publish a new notification
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
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

    await this.redis.hset(
      `notifications:${userId}`,
      notification.id,
      JSON.stringify(notificationData),
    );

    // Invalidate cache
    await CacheService.invalidateNotificationCache(userId);

    // Publish the notification to Redis
    await this.redis.publish(
      "notifications",
      JSON.stringify({
        type: "NEW_NOTIFICATION",
        notification: notificationData,
      }),
    );

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
      const cached = await CacheService.getCachedNotifications(userId);
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
      await CacheService.setCachedNotifications(userId, {
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

      await this.redis.hset(
        `notifications:${userId}`,
        notificationId,
        JSON.stringify(notificationData),
      );

      // Invalidate cache
      await CacheService.invalidateNotificationCache(userId);
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
    await this.redis.hdel(`notifications:${userId}`, notificationId);

    // Invalidate cache
    await CacheService.invalidateNotificationCache(userId);
  }

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string): Promise<void> {
    // Delete from database
    await this.notificationRepository.delete({ userId });

    // Delete from Redis
    await this.redis.del(`notifications:${userId}`);

    // Invalidate cache
    await CacheService.invalidateNotificationCache(userId);
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, read: false },
    });
  }
}
