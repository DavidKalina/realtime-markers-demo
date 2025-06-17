// src/handlers/pushNotificationHandlers.ts

import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { DeviceType } from "../entities/UserPushToken";
import type { PushNotificationData } from "../services/PushNotificationService";

export type PushNotificationHandler = (
  c: Context<AppContext>,
) => Promise<Response> | Response;

// Helper function to get services from context
function getServices(c: Context<AppContext>) {
  const pushNotificationService = c.get("pushNotificationService");
  const user = c.get("user");

  if (!user) {
    throw new Error("User not authenticated");
  }

  return {
    pushNotificationService,
    user,
  };
}

/**
 * Register a push token for the authenticated user
 */
export const registerTokenHandler: PushNotificationHandler = async (c) => {
  try {
    const { pushNotificationService, user } = getServices(c);
    const body = await c.req.json();

    const { token, deviceType, deviceId, appVersion, osVersion } = body;

    if (!token) {
      return c.json({ error: "Token is required" }, 400);
    }

    if (!deviceType || !Object.values(DeviceType).includes(deviceType)) {
      return c.json({ error: "Valid device type is required" }, 400);
    }

    const pushToken = await pushNotificationService.registerToken(
      user.userId || user.id,
      token,
      deviceType,
      deviceId,
      appVersion,
      osVersion,
    );

    return c.json({
      success: true,
      data: {
        id: pushToken.id,
        token: pushToken.token,
        deviceType: pushToken.deviceType,
        isActive: pushToken.isActive,
        createdAt: pushToken.createdAt,
      },
    });
  } catch (error) {
    console.error("Error registering push token:", error);

    if (error instanceof Error && error.message === "Invalid Expo push token") {
      return c.json({ error: "Invalid push token format" }, 400);
    }

    if (error instanceof Error && error.message === "User not authenticated") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
};

/**
 * Unregister a push token
 */
export const unregisterTokenHandler: PushNotificationHandler = async (c) => {
  try {
    const { pushNotificationService } = getServices(c);
    const body = await c.req.json();

    const { token } = body;

    if (!token) {
      return c.json({ error: "Token is required" }, 400);
    }

    await pushNotificationService.unregisterToken(token);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error unregistering push token:", error);

    if (error instanceof Error && error.message === "User not authenticated") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
};

/**
 * Get all push tokens for the authenticated user
 */
export const getUserTokensHandler: PushNotificationHandler = async (c) => {
  try {
    const { pushNotificationService, user } = getServices(c);

    const tokens = await pushNotificationService.getUserTokens(
      user.userId || user.id,
    );

    return c.json({
      success: true,
      data: tokens.map((token) => ({
        id: token.id,
        token: token.token,
        deviceType: token.deviceType,
        deviceId: token.deviceId,
        appVersion: token.appVersion,
        osVersion: token.osVersion,
        isActive: token.isActive,
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error getting user tokens:", error);

    if (error instanceof Error && error.message === "User not authenticated") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
};

/**
 * Send a test push notification to the authenticated user
 */
export const sendTestNotificationHandler: PushNotificationHandler = async (
  c,
) => {
  try {
    const { pushNotificationService, user } = getServices(c);
    const body = await c.req.json();

    const { title, body: messageBody, data } = body;

    if (!title || !messageBody) {
      return c.json({ error: "Title and body are required" }, 400);
    }

    const notification: PushNotificationData = {
      title,
      body: messageBody,
      data,
      sound: "default",
      priority: "high",
    };

    const results = await pushNotificationService.sendToUser(
      user.userId || user.id,
      notification,
    );

    // Clean up invalid tokens
    await pushNotificationService.cleanupInvalidTokens(results);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return c.json({
      success: true,
      data: {
        sent: successCount,
        failed: failureCount,
        results,
      },
    });
  } catch (error) {
    console.error("Error sending test push notification:", error);

    if (error instanceof Error && error.message === "User not authenticated") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
};

/**
 * Admin endpoint to send push notifications to multiple users
 */
export const sendToUsersHandler: PushNotificationHandler = async (c) => {
  try {
    const { pushNotificationService, user } = getServices(c);

    // Check if user is admin
    if (user.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const body = await c.req.json();

    const { userIds, title, body: messageBody, data } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ error: "User IDs array is required" }, 400);
    }

    if (!title || !messageBody) {
      return c.json({ error: "Title and body are required" }, 400);
    }

    const notification: PushNotificationData = {
      title,
      body: messageBody,
      data,
      sound: "default",
      priority: "high",
    };

    const results = await pushNotificationService.sendToUsers(
      userIds,
      notification,
    );

    // Clean up invalid tokens
    await pushNotificationService.cleanupInvalidTokens(results);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return c.json({
      success: true,
      data: {
        sent: successCount,
        failed: failureCount,
        totalUsers: userIds.length,
        results,
      },
    });
  } catch (error) {
    console.error("Error sending push notifications:", error);

    if (error instanceof Error && error.message === "User not authenticated") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
};
