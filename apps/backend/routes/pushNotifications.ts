import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { withErrorHandling, requireAuth } from "../utils/handlerUtils";
import type { DeviceInfo } from "../services/PushNotificationService";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const pushNotificationRouter = new Hono<AppContext>();

pushNotificationRouter.use("*", ip());
pushNotificationRouter.use(
  "*",
  rateLimit({
    maxRequests: 50,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `push:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

pushNotificationRouter.post("/register", authMiddleware, withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const pushNotificationService = c.get("pushNotificationService");
  const body = await c.req.json();
  const { token, deviceInfo } = body;

  if (!token || typeof token !== "string") {
    return c.json({ error: "Token is required and must be a string" }, 400);
  }

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
}));

pushNotificationRouter.delete("/unregister", authMiddleware, withErrorHandling(async (c) => {
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
}));

pushNotificationRouter.get("/tokens", authMiddleware, withErrorHandling(async (c) => {
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
}));
