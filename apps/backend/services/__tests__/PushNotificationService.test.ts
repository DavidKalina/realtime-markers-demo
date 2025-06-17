import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataSource } from "typeorm";
import { createPushNotificationService } from "../PushNotificationService";
import { createPushNotificationCacheService } from "../shared/PushNotificationCacheService";
import { createRedisService } from "../shared/RedisService";
import { UserPushToken, DeviceType } from "../../entities/UserPushToken";
import { User } from "../../entities/User";
import { redisClient } from "../shared/redis";
import type { ExpoPushMessage } from "expo-server-sdk";

// Mock Expo SDK
const mockExpo = {
  isExpoPushToken: (token: string) => token.startsWith("ExponentPushToken["),
  sendPushNotificationsAsync: async (messages: ExpoPushMessage[]) => {
    return messages.map(() => ({ status: "ok" }));
  },
};

// Mock the expo-server-sdk module
jest.mock("expo-server-sdk", () => ({
  Expo: jest.fn().mockImplementation(() => mockExpo),
}));

describe("PushNotificationService", () => {
  let dataSource: DataSource;
  let pushNotificationService: ReturnType<typeof createPushNotificationService>;
  let redisService: ReturnType<typeof createRedisService>;
  let pushNotificationCacheService: ReturnType<
    typeof createPushNotificationCacheService
  >;

  beforeEach(async () => {
    // Create in-memory database for testing
    dataSource = new DataSource({
      type: "sqlite",
      database: ":memory:",
      entities: [UserPushToken, User],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    redisService = createRedisService(redisClient);
    pushNotificationCacheService =
      createPushNotificationCacheService(redisClient);

    pushNotificationService = createPushNotificationService({
      dataSource,
      redisService,
      pushNotificationCacheService,
    });
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe("registerToken", () => {
    it("should register a valid push token", async () => {
      const userId = "test-user-id";
      const token = "ExponentPushToken[test-token]";
      const deviceType = DeviceType.IOS;

      const result = await pushNotificationService.registerToken(
        userId,
        token,
        deviceType,
        "test-device-id",
        "1.0.0",
        "15.0",
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.token).toBe(token);
      expect(result.deviceType).toBe(deviceType);
      expect(result.isActive).toBe(true);
    });

    it("should throw error for invalid token", async () => {
      const userId = "test-user-id";
      const token = "invalid-token";
      const deviceType = DeviceType.IOS;

      await expect(
        pushNotificationService.registerToken(userId, token, deviceType),
      ).rejects.toThrow("Invalid Expo push token");
    });

    it("should update existing token", async () => {
      const userId = "test-user-id";
      const token = "ExponentPushToken[test-token]";
      const deviceType = DeviceType.IOS;

      // Register token first time
      const firstResult = await pushNotificationService.registerToken(
        userId,
        token,
        deviceType,
      );

      // Register same token again
      const secondResult = await pushNotificationService.registerToken(
        userId,
        token,
        DeviceType.ANDROID, // Different device type
      );

      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.deviceType).toBe(DeviceType.ANDROID);
    });
  });

  describe("getUserTokens", () => {
    it("should return user tokens", async () => {
      const userId = "test-user-id";
      const token = "ExponentPushToken[test-token]";
      const deviceType = DeviceType.IOS;

      await pushNotificationService.registerToken(userId, token, deviceType);

      const tokens = await pushNotificationService.getUserTokens(userId);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].token).toBe(token);
      expect(tokens[0].userId).toBe(userId);
    });

    it("should return empty array for user with no tokens", async () => {
      const tokens =
        await pushNotificationService.getUserTokens("non-existent-user");

      expect(tokens).toHaveLength(0);
    });
  });

  describe("unregisterToken", () => {
    it("should deactivate token", async () => {
      const userId = "test-user-id";
      const token = "ExponentPushToken[test-token]";
      const deviceType = DeviceType.IOS;

      await pushNotificationService.registerToken(userId, token, deviceType);
      await pushNotificationService.unregisterToken(token);

      const tokens = await pushNotificationService.getUserTokens(userId);
      expect(tokens).toHaveLength(0);
    });
  });

  describe("sendToUser", () => {
    it("should send notification to user", async () => {
      const userId = "test-user-id";
      const token = "ExponentPushToken[test-token]";
      const deviceType = DeviceType.IOS;

      await pushNotificationService.registerToken(userId, token, deviceType);

      const notification = {
        title: "Test Notification",
        body: "This is a test notification",
        data: { test: "data" },
      };

      const results = await pushNotificationService.sendToUser(
        userId,
        notification,
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].token).toBe(token);
    });

    it("should return empty array for user with no tokens", async () => {
      const notification = {
        title: "Test Notification",
        body: "This is a test notification",
      };

      const results = await pushNotificationService.sendToUser(
        "non-existent-user",
        notification,
      );

      expect(results).toHaveLength(0);
    });
  });

  describe("cleanupInvalidTokens", () => {
    it("should deactivate invalid tokens", async () => {
      const userId = "test-user-id";
      const validToken = "ExponentPushToken[valid-token]";
      const invalidToken = "ExponentPushToken[invalid-token]";
      const deviceType = DeviceType.IOS;

      await pushNotificationService.registerToken(
        userId,
        validToken,
        deviceType,
      );
      await pushNotificationService.registerToken(
        userId,
        invalidToken,
        deviceType,
      );

      const results = [
        { success: true, token: validToken },
        { success: false, token: invalidToken },
      ];

      await pushNotificationService.cleanupInvalidTokens(results);

      const tokens = await pushNotificationService.getUserTokens(userId);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].token).toBe(validToken);
    });
  });
});
