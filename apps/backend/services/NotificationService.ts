// services/NotificationService.ts
import Redis from "ioredis";
import { Expo } from "expo-server-sdk";
import { DataSource, Repository, Between } from "typeorm";
import { Event, EventStatus } from "../entities/Event";
import { UserEventSave } from "../entities/UserEventSave";
import { User } from "../entities/User";
import { UserDeviceToken } from "../entities/UserDeviceToken";

export class NotificationService {
  private eventRepository: Repository<Event>;
  private userEventSaveRepository: Repository<UserEventSave>;
  private userRepository: Repository<User>;
  private userDeviceTokenRepository: Repository<UserDeviceToken>;
  private expo: Expo;

  constructor(
    private dataSource: DataSource,
    private redisClient: Redis,
    expoAccessToken?: string
  ) {
    // Initialize repositories
    this.eventRepository = this.dataSource.getRepository(Event);
    this.userEventSaveRepository = this.dataSource.getRepository(UserEventSave);
    this.userRepository = this.dataSource.getRepository(User);
    this.userDeviceTokenRepository = this.dataSource.getRepository(UserDeviceToken);

    // Initialize Expo SDK
    this.expo = new Expo({
      accessToken: expoAccessToken,
    });

    console.log("Notification Service initialized");
  }

  /**
   * Track a saved event for future notifications
   */
  async trackSavedEvent(eventId: string, userId: string): Promise<void> {
    try {
      const event = await this.eventRepository.findOneBy({ id: eventId });

      if (!event) {
        console.warn(`Event ${eventId} not found for tracking`);
        return;
      }

      // Store this relationship for quick lookup
      const key = `user_saved_event:${userId}:${eventId}`;
      await this.redisClient.set(
        key,
        JSON.stringify({
          userId,
          eventId,
          eventDate: event.eventDate,
          title: event.title,
          savedAt: new Date(),
        }),
        "EX",
        // Set expiry to 1 day after event date or 7 days, whichever is longer
        Math.max(
          Math.floor((new Date(event.eventDate).getTime() - Date.now()) / 1000 + 86400),
          7 * 86400
        )
      );

      // Publish event.saved message to Redis for notification worker
      await this.redisClient.publish(
        "event.saved",
        JSON.stringify({
          eventId,
          userId,
          eventDate: event.eventDate,
          title: event.title,
        })
      );

      console.log(`Tracked saved event ${eventId} for user ${userId}`);
    } catch (error) {
      console.error(`Error tracking saved event ${eventId} for user ${userId}:`, error);
    }
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    deviceName?: string,
    deviceType?: string
  ): Promise<boolean> {
    try {
      // Check if token exists
      let deviceToken = await this.userDeviceTokenRepository.findOne({
        where: { token },
      });

      if (deviceToken) {
        // Update existing token
        deviceToken.userId = userId;
        deviceToken.isActive = true;
        deviceToken.lastUsed = new Date();
        deviceToken.deviceName = deviceName || deviceToken.deviceName;
        deviceToken.deviceType = deviceType || deviceToken.deviceType;

        await this.userDeviceTokenRepository.save(deviceToken);
      } else {
        // Create new token
        deviceToken = this.userDeviceTokenRepository.create({
          userId,
          token,
          deviceName,
          deviceType,
          isActive: true,
          lastUsed: new Date(),
        });

        await this.userDeviceTokenRepository.save(deviceToken);
      }

      // Cache in Redis for faster lookups
      await this.redisClient.sadd(`user:${userId}:device_tokens`, token);

      return true;
    } catch (error) {
      console.error(`Error registering device token for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(userId: string, token: string): Promise<boolean> {
    try {
      // Find the token
      const deviceToken = await this.userDeviceTokenRepository.findOne({
        where: { token, userId },
      });

      if (deviceToken) {
        // Deactivate the token
        deviceToken.isActive = false;
        await this.userDeviceTokenRepository.save(deviceToken);

        // Remove from Redis
        await this.redisClient.srem(`user:${userId}:device_tokens`, token);
      }

      return true;
    } catch (error) {
      console.error(`Error unregistering device token for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get user notification settings
   */
  async getUserNotificationSettings(userId: string): Promise<any> {
    try {
      const user = await this.userRepository.findOneBy({ id: userId });

      if (!user) {
        return null;
      }

      return {
        notificationsEnabled: user.notificationsEnabled,
        eventNotificationsEnabled: user.eventNotificationsEnabled,
        notificationLeadTimeMinutes: user.notificationLeadTimeMinutes,
      };
    } catch (error) {
      console.error(`Error getting notification settings for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update user notification settings
   */
  async updateUserNotificationSettings(
    userId: string,
    settings: {
      notificationsEnabled?: boolean;
      eventNotificationsEnabled?: boolean;
      notificationLeadTimeMinutes?: number;
    }
  ): Promise<boolean> {
    try {
      const updates: any = {};

      if (typeof settings.notificationsEnabled === "boolean") {
        updates.notificationsEnabled = settings.notificationsEnabled;
      }

      if (typeof settings.eventNotificationsEnabled === "boolean") {
        updates.eventNotificationsEnabled = settings.eventNotificationsEnabled;
      }

      if (settings.notificationLeadTimeMinutes) {
        // Ensure reasonable bounds (15 min to 24 hours)
        updates.notificationLeadTimeMinutes = Math.max(
          15,
          Math.min(24 * 60, settings.notificationLeadTimeMinutes)
        );
      }

      if (Object.keys(updates).length > 0) {
        await this.userRepository.update(userId, updates);
      }

      return true;
    } catch (error) {
      console.error(`Error updating notification settings for user ${userId}:`, error);
      return false;
    }
  }
}
