import { Expo } from "expo-server-sdk";
import type { ExpoPushMessage } from "expo-server-sdk";
import { DataSource, Repository, In } from "typeorm";
import { UserPushToken, DeviceType } from "../entities/UserPushToken";
import type { RedisService } from "./shared/RedisService";
import type { PushNotificationCacheService } from "./shared/PushNotificationCacheService";

export interface PushNotificationData {
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

export interface PushNotificationResult {
  success: boolean;
  token: string;
  error?: string;
  status?: "ok" | "error";
  message?: string;
}

export interface PushNotificationService {
  /**
   * Register a push token for a user
   */
  registerToken(
    userId: string,
    token: string,
    deviceType: DeviceType,
    deviceId?: string,
    appVersion?: string,
    osVersion?: string,
  ): Promise<UserPushToken>;

  /**
   * Unregister a push token
   */
  unregisterToken(token: string): Promise<void>;

  /**
   * Get all active tokens for a user
   */
  getUserTokens(userId: string): Promise<UserPushToken[]>;

  /**
   * Send a push notification to a single user
   */
  sendToUser(
    userId: string,
    notification: PushNotificationData,
  ): Promise<PushNotificationResult[]>;

  /**
   * Send a push notification to multiple users
   */
  sendToUsers(
    userIds: string[],
    notification: PushNotificationData,
  ): Promise<PushNotificationResult[]>;

  /**
   * Send a push notification to specific tokens
   */
  sendToTokens(
    tokens: string[],
    notification: PushNotificationData,
  ): Promise<PushNotificationResult[]>;

  /**
   * Clean up invalid tokens
   */
  cleanupInvalidTokens(results: PushNotificationResult[]): Promise<void>;

  /**
   * Update token last used timestamp
   */
  updateTokenUsage(token: string): Promise<void>;
}

// Define dependencies interface for cleaner constructor
export interface PushNotificationServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
  pushNotificationCacheService: PushNotificationCacheService;
}

export class PushNotificationServiceImpl implements PushNotificationService {
  private pushTokenRepository: Repository<UserPushToken>;
  private redisService: RedisService;
  private pushNotificationCacheService: PushNotificationCacheService;
  private expo: Expo;

  constructor(private dependencies: PushNotificationServiceDependencies) {
    this.pushTokenRepository =
      dependencies.dataSource.getRepository(UserPushToken);
    this.redisService = dependencies.redisService;
    this.pushNotificationCacheService =
      dependencies.pushNotificationCacheService;
    this.expo = new Expo();
  }

  /**
   * Register a push token for a user
   */
  async registerToken(
    userId: string,
    token: string,
    deviceType: DeviceType,
    deviceId?: string,
    appVersion?: string,
    osVersion?: string,
  ): Promise<UserPushToken> {
    // Check if token is valid
    if (!Expo.isExpoPushToken(token)) {
      throw new Error("Invalid Expo push token");
    }

    // Check if token already exists
    const existingToken = await this.pushTokenRepository.findOne({
      where: { token },
    });

    if (existingToken) {
      // Update existing token
      existingToken.userId = userId;
      existingToken.deviceType = deviceType;
      existingToken.deviceId = deviceId;
      existingToken.appVersion = appVersion;
      existingToken.osVersion = osVersion;
      existingToken.isActive = true;
      existingToken.lastUsedAt = new Date();

      await this.pushTokenRepository.save(existingToken);

      // Invalidate cache
      await this.pushNotificationCacheService.invalidateUserTokens(userId);

      return existingToken;
    }

    // Create new token
    const pushToken = this.pushTokenRepository.create({
      userId,
      token,
      deviceType,
      deviceId,
      appVersion,
      osVersion,
      isActive: true,
      lastUsedAt: new Date(),
    });

    await this.pushTokenRepository.save(pushToken);

    // Invalidate cache
    await this.pushNotificationCacheService.invalidateUserTokens(userId);

    return pushToken;
  }

  /**
   * Unregister a push token
   */
  async unregisterToken(token: string): Promise<void> {
    const tokenRecord = await this.pushTokenRepository.findOne({
      where: { token },
    });

    if (tokenRecord) {
      await this.pushTokenRepository.update(
        { token },
        { isActive: false, lastUsedAt: new Date() },
      );

      // Invalidate cache for the user
      await this.pushNotificationCacheService.invalidateUserTokens(
        tokenRecord.userId,
      );
    }
  }

  /**
   * Get all active tokens for a user
   */
  async getUserTokens(userId: string): Promise<UserPushToken[]> {
    // Try to get from cache first
    const cached =
      await this.pushNotificationCacheService.getUserTokens(userId);
    if (cached) {
      return cached;
    }

    // Get from database
    const tokens = await this.pushTokenRepository.find({
      where: { userId, isActive: true },
      order: { lastUsedAt: "DESC" },
    });

    // Cache the results
    await this.pushNotificationCacheService.setUserTokens(userId, tokens);

    return tokens;
  }

  /**
   * Send a push notification to a single user
   */
  async sendToUser(
    userId: string,
    notification: PushNotificationData,
  ): Promise<PushNotificationResult[]> {
    const tokens = await this.getUserTokens(userId);
    const tokenStrings = tokens.map((t) => t.token);
    return await this.sendToTokens(tokenStrings, notification);
  }

  /**
   * Send a push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: PushNotificationData,
  ): Promise<PushNotificationResult[]> {
    const allTokens: string[] = [];

    for (const userId of userIds) {
      const tokens = await this.getUserTokens(userId);
      allTokens.push(...tokens.map((t) => t.token));
    }

    return await this.sendToTokens(allTokens, notification);
  }

  /**
   * Send a push notification to specific tokens
   */
  async sendToTokens(
    tokens: string[],
    notification: PushNotificationData,
  ): Promise<PushNotificationResult[]> {
    if (tokens.length === 0) {
      return [];
    }

    // Filter out invalid tokens
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    const invalidTokens = tokens.filter(
      (token) => !Expo.isExpoPushToken(token),
    );

    const results: PushNotificationResult[] = [];

    // Add results for invalid tokens
    for (const token of invalidTokens) {
      results.push({
        success: false,
        token,
        error: "Invalid Expo push token",
        status: "error",
      });
    }

    if (validTokens.length === 0) {
      return results;
    }

    // Create messages for valid tokens
    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: notification.sound,
      badge: notification.badge,
      channelId: notification.channelId,
      categoryId: notification.categoryId,
      mutableContent: notification.mutableContent,
      priority: notification.priority,
      subtitle: notification.subtitle,
      ttl: notification.ttl,
    }));

    // Send messages in chunks (Expo recommends max 100 per request)
    const chunkSize = 100;
    const chunks = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const chunkResults = await this.expo.sendPushNotificationsAsync(chunk);

      for (let i = 0; i < chunk.length; i++) {
        const message = chunk[i];
        const result = chunkResults[i];

        if (result.status === "ok") {
          results.push({
            success: true,
            token: message.to as string,
            status: "ok",
          });

          // Update token usage
          await this.updateTokenUsage(message.to as string);
        } else {
          results.push({
            success: false,
            token: message.to as string,
            error: result.message,
            status: "error",
          });
        }
      }
    }

    return results;
  }

  /**
   * Clean up invalid tokens based on push results
   */
  async cleanupInvalidTokens(results: PushNotificationResult[]): Promise<void> {
    const invalidTokens = results
      .filter((result) => !result.success)
      .map((result) => result.token);

    if (invalidTokens.length > 0) {
      await this.pushTokenRepository.update(
        { token: In(invalidTokens) },
        { isActive: false },
      );
    }
  }

  /**
   * Update token last used timestamp
   */
  async updateTokenUsage(token: string): Promise<void> {
    await this.pushTokenRepository.update(
      { token },
      { lastUsedAt: new Date() },
    );
  }
}

/**
 * Factory function to create a PushNotificationService instance
 */
export function createPushNotificationService(
  dependencies: PushNotificationServiceDependencies,
): PushNotificationService {
  return new PushNotificationServiceImpl(dependencies);
}
