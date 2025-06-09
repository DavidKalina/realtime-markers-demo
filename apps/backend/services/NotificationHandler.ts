import { Redis } from "ioredis";
import { NotificationService } from "./NotificationService";
import { Notification } from "../entities/Notification";
import { DataSource } from "typeorm";

export class NotificationHandler {
  private redis: Redis;
  private notificationService: NotificationService;
  private subscriber: Redis;
  private static instance: NotificationHandler;

  private constructor(redis: Redis, dataSource: DataSource) {
    this.redis = redis;
    this.notificationService = NotificationService.getInstance(
      redis,
      dataSource,
    );
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });
  }

  public static getInstance(
    redis: Redis,
    dataSource: DataSource,
  ): NotificationHandler {
    if (!NotificationHandler.instance) {
      NotificationHandler.instance = new NotificationHandler(redis, dataSource);
    }
    return NotificationHandler.instance;
  }

  /**
   * Start listening for notifications
   */
  public async start(): Promise<void> {
    console.log("Starting notification handler...");

    // Subscribe to the notifications channel
    await this.subscriber.subscribe("notifications");

    // Listen for messages
    this.subscriber.on("message", async (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);

        if (data.type === "NEW_NOTIFICATION") {
          await this.handleNewNotification(data.notification);
        }
      } catch (error) {
        console.error("Error processing notification:", error);
      }
    });

    console.log("Notification handler started successfully");
  }

  /**
   * Handle a new notification
   */
  private async handleNewNotification(
    notification: Notification,
  ): Promise<void> {
    try {
      // Here you can add custom logic for different notification types
      switch (notification.type) {
        case "EVENT_CREATED":
          await this.handleEventCreated(notification);
          break;
        case "EVENT_UPDATED":
          await this.handleEventUpdated(notification);
          break;
        case "EVENT_DELETED":
          await this.handleEventDeleted(notification);
          break;
        case "FRIEND_REQUEST":
          await this.handleFriendRequest(notification);
          break;
        case "FRIEND_ACCEPTED":
          await this.handleFriendAccepted(notification);
          break;
        case "LEVEL_UP":
          await this.handleLevelUp(notification);
          break;
        case "ACHIEVEMENT_UNLOCKED":
          await this.handleAchievementUnlocked(notification);
          break;
        case "SYSTEM":
          await this.handleSystemNotification(notification);
          break;
        default:
          console.log(`Unhandled notification type: ${notification.type}`);
      }
    } catch (error) {
      console.error(
        `Error handling notification ${notification?.id || "unknown"}:`,
        error,
      );
    }
  }

  private async handleEventCreated(notification: Notification): Promise<void> {
    // Add custom logic for event created notifications
    console.log(`Processing event created notification: ${notification.id}`);
  }

  private async handleEventUpdated(notification: Notification): Promise<void> {
    // Add custom logic for event updated notifications
    console.log(`Processing event updated notification: ${notification.id}`);
  }

  private async handleEventDeleted(notification: Notification): Promise<void> {
    // Add custom logic for event deleted notifications
    console.log(`Processing event deleted notification: ${notification.id}`);
  }

  private async handleFriendRequest(notification: Notification): Promise<void> {
    // Add custom logic for friend request notifications
    console.log(`Processing friend request notification: ${notification.id}`);
  }

  private async handleFriendAccepted(
    notification: Notification,
  ): Promise<void> {
    // Add custom logic for friend accepted notifications
    console.log(`Processing friend accepted notification: ${notification.id}`);
  }

  private async handleLevelUp(notification: Notification): Promise<void> {
    // Add custom logic for level up notifications
    console.log(`Processing level up notification: ${notification.id}`);
  }

  private async handleAchievementUnlocked(
    notification: Notification,
  ): Promise<void> {
    // Add custom logic for achievement unlocked notifications
    console.log(
      `Processing achievement unlocked notification: ${notification.id}`,
    );
  }

  private async handleSystemNotification(
    notification: Notification,
  ): Promise<void> {
    // Add custom logic for system notifications
    console.log(`Processing system notification: ${notification.id}`);
  }

  /**
   * Stop the notification handler
   */
  public async stop(): Promise<void> {
    console.log("Stopping notification handler...");
    await this.subscriber.unsubscribe("notifications");
    await this.subscriber.quit();
    console.log("Notification handler stopped successfully");
  }
}
