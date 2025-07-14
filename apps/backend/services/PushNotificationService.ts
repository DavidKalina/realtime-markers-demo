import { Expo } from "expo-server-sdk";
import type { ExpoPushMessage } from "expo-server-sdk";
import { Repository, In } from "typeorm";
import { UserPushToken, User } from "@realtime-markers/database";
import AppDataSource from "../data-source";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  mutableContent?: boolean;
  priority?: "default" | "normal" | "high";
  subtitle?: string;
  ttl?: number;
}

export interface DeviceInfo {
  platform: "ios" | "android" | "web";
  version?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  [key: string]: unknown;
}

export class PushNotificationService {
  private expo: Expo;
  private userPushTokenRepository: Repository<UserPushToken>;
  private userRepository: Repository<User>;

  constructor() {
    this.expo = new Expo();
    this.userPushTokenRepository = AppDataSource.getRepository(UserPushToken);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Register a push token for a user
   */
  async registerToken(
    userId: string,
    token: string,
    deviceInfo?: DeviceInfo,
  ): Promise<UserPushToken> {
    try {
      // Check if token already exists for this user
      const existingToken = await this.userPushTokenRepository.findOne({
        where: { userId, token },
      });

      if (existingToken) {
        // Update existing token
        existingToken.deviceInfo = deviceInfo || existingToken.deviceInfo;
        existingToken.isActive = true;
        existingToken.lastUsedAt = new Date();
        return await this.userPushTokenRepository.save(existingToken);
      }

      // Create new token
      const newToken = this.userPushTokenRepository.create({
        userId,
        token,
        deviceInfo: deviceInfo as Record<string, unknown> | null,
        isActive: true,
        lastUsedAt: new Date(),
      });

      return await this.userPushTokenRepository.save(newToken);
    } catch (error) {
      console.error("Error registering push token:", error);
      throw new Error("Failed to register push token");
    }
  }

  /**
   * Unregister a push token (mark as inactive)
   */
  async unregisterToken(userId: string, token: string): Promise<void> {
    try {
      await this.userPushTokenRepository.update(
        { userId, token },
        { isActive: false },
      );
    } catch (error) {
      console.error("Error unregistering push token:", error);
      throw new Error("Failed to unregister push token");
    }
  }

  /**
   * Get all active tokens for a user
   */
  async getUserTokens(userId: string): Promise<UserPushToken[]> {
    try {
      return await this.userPushTokenRepository.find({
        where: { userId, isActive: true },
        order: { lastUsedAt: "DESC" },
      });
    } catch (error) {
      console.error("Error getting user tokens:", error);
      throw new Error("Failed to get user tokens");
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ success: number; failed: number }> {
    try {
      const tokens = await this.getUserTokens(userId);
      if (tokens.length === 0) {
        console.log(`No active tokens found for user ${userId}`);
        return { success: 0, failed: 0 };
      }

      const pushTokens = tokens.map((t) => t.token);
      return await this.sendToTokens(pushTokens, payload);
    } catch (error) {
      console.error("Error sending notification to user:", error);
      throw new Error("Failed to send notification to user");
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
  ): Promise<{ success: number; failed: number }> {
    try {
      const tokens = await this.userPushTokenRepository.find({
        where: {
          userId: In(userIds),
          isActive: true,
        },
      });

      if (tokens.length === 0) {
        console.log("No active tokens found for specified users");
        return { success: 0, failed: 0 };
      }

      const pushTokens = tokens.map((t) => t.token);
      return await this.sendToTokens(pushTokens, payload);
    } catch (error) {
      console.error("Error sending notification to users:", error);
      throw new Error("Failed to send notification to users");
    }
  }

  /**
   * Send notification to specific tokens
   */
  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ success: number; failed: number }> {
    try {
      // Validate tokens
      const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
      const invalidTokens = tokens.filter(
        (token) => !Expo.isExpoPushToken(token),
      );

      if (invalidTokens.length > 0) {
        console.warn("Invalid Expo push tokens:", invalidTokens);
      }

      if (validTokens.length === 0) {
        console.log("No valid tokens to send notifications to");
        return { success: 0, failed: 0 };
      }

      // Create messages
      const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token,
        ...payload,
      }));

      // Send messages in chunks
      const chunks = this.expo.chunkPushNotifications(messages);
      let successCount = 0;
      let failureCount = 0;

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);

          // Process tickets
          for (let i = 0; i < ticketChunk.length; i++) {
            const ticket = ticketChunk[i];
            if (ticket.status === "ok") {
              successCount++;
            } else {
              failureCount++;
              console.error("Push notification failed:", ticket.message);
            }
          }
        } catch (error) {
          console.error("Error sending push notification chunk:", error);
          failureCount += chunk.length;
        }
      }

      console.log(
        `Push notifications sent: ${successCount} success, ${failureCount} failed`,
      );
      return { success: successCount, failed: failureCount };
    } catch (error) {
      console.error("Error sending notifications to tokens:", error);
      throw new Error("Failed to send notifications");
    }
  }

  /**
   * Send notification to all users (use with caution)
   */
  async sendToAllUsers(
    payload: PushNotificationPayload,
  ): Promise<{ success: number; failed: number }> {
    try {
      const tokens = await this.userPushTokenRepository.find({
        where: { isActive: true },
      });

      if (tokens.length === 0) {
        console.log("No active tokens found");
        return { success: 0, failed: 0 };
      }

      const pushTokens = tokens.map((t) => t.token);
      return await this.sendToTokens(pushTokens, payload);
    } catch (error) {
      console.error("Error sending notification to all users:", error);
      throw new Error("Failed to send notification to all users");
    }
  }

  /**
   * Clean up invalid tokens
   */
  async cleanupInvalidTokens(): Promise<number> {
    try {
      const tokens = await this.userPushTokenRepository.find({
        where: { isActive: true },
      });

      const invalidTokens = tokens.filter(
        (token) => !Expo.isExpoPushToken(token.token),
      );

      if (invalidTokens.length > 0) {
        await this.userPushTokenRepository.update(
          { id: In(invalidTokens.map((t) => t.id)) },
          { isActive: false },
        );
        console.log(`Deactivated ${invalidTokens.length} invalid tokens`);
      }

      return invalidTokens.length;
    } catch (error) {
      console.error("Error cleaning up invalid tokens:", error);
      throw new Error("Failed to cleanup invalid tokens");
    }
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    usersWithTokens: number;
  }> {
    try {
      const [totalTokens, activeTokens, usersWithTokens] = await Promise.all([
        this.userPushTokenRepository.count(),
        this.userPushTokenRepository.count({ where: { isActive: true } }),
        this.userPushTokenRepository
          .createQueryBuilder("token")
          .select("COUNT(DISTINCT token.userId)", "count")
          .where("token.isActive = :isActive", { isActive: true })
          .getRawOne(),
      ]);

      return {
        totalTokens,
        activeTokens,
        usersWithTokens: parseInt(usersWithTokens?.count || "0"),
      };
    } catch (error) {
      console.error("Error getting push notification stats:", error);
      throw new Error("Failed to get push notification stats");
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
