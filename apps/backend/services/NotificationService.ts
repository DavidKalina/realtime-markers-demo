import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";

export type NotificationType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "LEVEL_UP"
  | "ACHIEVEMENT_UNLOCKED"
  | "SYSTEM";

export interface Notification {
  id: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  createdAt: string;
  read: boolean;
}

export class NotificationService {
  private redis: Redis;
  private static instance: NotificationService;

  private constructor(redis: Redis) {
    this.redis = redis;
  }

  public static getInstance(redis: Redis): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(redis);
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
    data?: Record<string, any>
  ): Promise<Notification> {
    const notification: Notification = {
      id: uuidv4(),
      type,
      userId,
      title,
      message,
      data,
      createdAt: new Date().toISOString(),
      read: false,
    };

    // Store the notification in Redis
    await this.redis.hset(`notifications:${userId}`, notification.id, JSON.stringify(notification));

    // Publish the notification to Redis
    await this.redis.publish(
      "notifications",
      JSON.stringify({
        type: "NEW_NOTIFICATION",
        notification,
      })
    );

    return notification;
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const notifications = await this.redis.hgetall(`notifications:${userId}`);
    return Object.values(notifications).map((n) => JSON.parse(n));
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.redis.hget(`notifications:${userId}`, notificationId);
    if (notification) {
      const parsedNotification = JSON.parse(notification);
      parsedNotification.read = true;
      await this.redis.hset(
        `notifications:${userId}`,
        notificationId,
        JSON.stringify(parsedNotification)
      );
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await this.redis.hdel(`notifications:${userId}`, notificationId);
  }

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string): Promise<void> {
    await this.redis.del(`notifications:${userId}`);
  }
}
