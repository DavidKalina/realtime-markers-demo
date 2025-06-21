import type { NotificationService } from "./NotificationService";
import { Notification } from "../entities/Notification";
import type { RedisService } from "./shared/RedisService";

export interface NotificationHandler {
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Define dependencies interface for cleaner constructor
export interface NotificationHandlerDependencies {
  redisService: RedisService;
  notificationService: NotificationService;
  // Add other services that the handler might need to call
  // friendshipService?: FriendshipService;
}

export class NotificationHandlerImpl implements NotificationHandler {
  private redisService: RedisService;
  private notificationService: NotificationService;
  private isRunning = false;

  constructor(private dependencies: NotificationHandlerDependencies) {
    this.redisService = dependencies.redisService;
    this.notificationService = dependencies.notificationService;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("NotificationHandler is already running");
      return;
    }

    console.log("Starting NotificationHandler...");

    try {
      // Note: The current RedisService doesn't support subscription with callbacks
      // This is a placeholder for when RedisService is enhanced to support subscriptions
      // For now, we'll just mark it as running
      console.log(
        "NotificationHandler subscription not yet implemented - RedisService needs enhancement",
      );

      this.isRunning = true;
      console.log("NotificationHandler started successfully");
    } catch (error) {
      console.error("Failed to start NotificationHandler:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("NotificationHandler is not running");
      return;
    }

    console.log("Stopping NotificationHandler...");

    try {
      // Note: The current RedisService doesn't support unsubscription
      // This is a placeholder for when RedisService is enhanced
      console.log(
        "NotificationHandler unsubscription not yet implemented - RedisService needs enhancement",
      );

      this.isRunning = false;
      console.log("NotificationHandler stopped successfully");
    } catch (error) {
      console.error("Failed to stop NotificationHandler:", error);
      throw error;
    }
  }

  private async handleNotification(message: string): Promise<void> {
    try {
      const notificationData = JSON.parse(message);

      if (notificationData.type === "NEW_NOTIFICATION") {
        const notification = notificationData.data as Notification;
        await this.processNotification(notification);
      }
    } catch (error) {
      console.error("Error handling notification:", error);
    }
  }

  private async processNotification(notification: Notification): Promise<void> {
    try {
      console.log(
        `Processing notification: ${notification.id} for user: ${notification.userId}`,
      );

      // Handle different notification types
      switch (notification.type) {
        case "FRIEND_REQUEST":
          await this.handleFriendRequest(notification);
          break;
        case "EVENT_CREATED":
          await this.handleEventCreated(notification);
          break;
        default:
          console.log(`Unknown notification type: ${notification.type}`);
      }
    } catch (error) {
      console.error(`Error processing notification ${notification.id}:`, error);
    }
  }

  private async handleFriendRequest(notification: Notification): Promise<void> {
    // Example: Call friendship service to handle the request
    // if (this.dependencies.friendshipService) {
    //   await this.dependencies.friendshipService.someAction(notification.data);
    // }
    console.log(`Processing friend request notification: ${notification.id}`);
  }

  private async handleEventCreated(notification: Notification): Promise<void> {
    // Example: Handle event created logic
    console.log(`Processing event created notification: ${notification.id}`);
  }
}

/**
 * Factory function to create a NotificationHandler instance
 */
export function createNotificationHandler(
  dependencies: NotificationHandlerDependencies,
): NotificationHandler {
  return new NotificationHandlerImpl(dependencies);
}
