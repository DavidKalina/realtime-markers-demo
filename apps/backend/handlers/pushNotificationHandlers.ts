import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { DeviceInfo } from "../services/PushNotificationService";

// Register a push token for the current user
export const registerTokenHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const pushNotificationService = c.get("pushNotificationService");

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
});

// Unregister a push token for the current user
export const unregisterTokenHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const pushNotificationService = c.get("pushNotificationService");

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
});

// Get all tokens for the current user
export const getUserTokensHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const pushNotificationService = c.get("pushNotificationService");

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
});
