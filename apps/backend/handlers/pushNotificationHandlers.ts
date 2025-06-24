import type { Context } from "hono";
import { pushNotificationService } from "../services/PushNotificationService";
import type { AppContext } from "../types/context";
import type { DeviceInfo } from "../services/PushNotificationService";
import { UserRole } from "../entities/User";

// Register a push token for the current user
export const registerTokenHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { token, deviceInfo } = body;

    if (!token || typeof token !== "string") {
      return c.json({ error: "Token is required and must be a string" }, 400);
    }

    // Validate device info if provided
    if (deviceInfo && typeof deviceInfo !== "object") {
      return c.json({ error: "Device info must be an object" }, 400);
    }

    const userToken = await pushNotificationService.registerToken(
      user.id,
      token,
      deviceInfo as DeviceInfo,
    );

    return c.json({
      success: true,
      message: "Push token registered successfully",
      token: {
        id: userToken.id,
        token: userToken.token,
        deviceInfo: userToken.deviceInfo,
        isActive: userToken.isActive,
        createdAt: userToken.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in registerTokenHandler:", error);
    return c.json({ error: "Failed to register push token" }, 500);
  }
};

// Unregister a push token for the current user
export const unregisterTokenHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return c.json({ error: "Token is required and must be a string" }, 400);
    }

    await pushNotificationService.unregisterToken(user.id, token);

    return c.json({
      success: true,
      message: "Push token unregistered successfully",
    });
  } catch (error) {
    console.error("Error in unregisterTokenHandler:", error);
    return c.json({ error: "Failed to unregister push token" }, 500);
  }
};

// Get all tokens for the current user
export const getUserTokensHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const tokens = await pushNotificationService.getUserTokens(user.id);

    return c.json({
      success: true,
      tokens: tokens.map((token) => ({
        id: token.id,
        token: token.token,
        deviceInfo: token.deviceInfo,
        isActive: token.isActive,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
      })),
    });
  } catch (error) {
    console.error("Error in getUserTokensHandler:", error);
    return c.json({ error: "Failed to get user tokens" }, 500);
  }
};

// Send notification to a specific user (admin only)
export const sendNotificationHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    if (user.role !== UserRole.ADMIN) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const body = await c.req.json();
    const {
      userId,
      title,
      body: messageBody,
      data,
      sound,
      badge,
      priority,
    } = body;

    if (!userId || !title || !messageBody) {
      return c.json(
        {
          error: "userId, title, and body are required",
        },
        400,
      );
    }

    const result = await pushNotificationService.sendToUser(userId, {
      title,
      body: messageBody,
      data,
      sound,
      badge,
      priority,
    });

    return c.json({
      success: true,
      message: "Notification sent successfully",
      result,
    });
  } catch (error) {
    console.error("Error in sendNotificationHandler:", error);
    return c.json({ error: "Failed to send notification" }, 500);
  }
};

// Send notification to multiple users (admin only)
export const sendToUsersHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    if (user.role !== UserRole.ADMIN) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const body = await c.req.json();
    const {
      userIds,
      title,
      body: messageBody,
      data,
      sound,
      badge,
      priority,
    } = body;

    if (!userIds || !Array.isArray(userIds) || !title || !messageBody) {
      return c.json(
        {
          error: "userIds (array), title, and body are required",
        },
        400,
      );
    }

    const result = await pushNotificationService.sendToUsers(userIds, {
      title,
      body: messageBody,
      data,
      sound,
      badge,
      priority,
    });

    return c.json({
      success: true,
      message: "Notifications sent successfully",
      result,
    });
  } catch (error) {
    console.error("Error in sendToUsersHandler:", error);
    return c.json({ error: "Failed to send notifications" }, 500);
  }
};

// Get push notification statistics (admin only)
export const getStatsHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    if (user.role !== UserRole.ADMIN) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const stats = await pushNotificationService.getStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error in getStatsHandler:", error);
    return c.json({ error: "Failed to get statistics" }, 500);
  }
};

// Clean up invalid tokens (admin only)
export const cleanupTokensHandler = async (c: Context<AppContext>) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    if (user.role !== UserRole.ADMIN) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const cleanedCount = await pushNotificationService.cleanupInvalidTokens();

    return c.json({
      success: true,
      message: `Cleaned up ${cleanedCount} invalid tokens`,
      cleanedCount,
    });
  } catch (error) {
    console.error("Error in cleanupTokensHandler:", error);
    return c.json({ error: "Failed to cleanup tokens" }, 500);
  }
};
