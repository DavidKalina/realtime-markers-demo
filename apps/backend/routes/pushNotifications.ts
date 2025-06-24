import { Hono } from "hono";
import * as handlers from "../handlers/pushNotificationHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

// Create a router with the correct typing
export const pushNotificationRouter = new Hono<AppContext>();

// Apply IP and rate limiting middleware to all routes
pushNotificationRouter.use("*", ip());
pushNotificationRouter.use(
  "*",
  rateLimit({
    maxRequests: 50, // 50 requests per minute for push notification routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `push:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// Protected routes (session required)
pushNotificationRouter.post(
  "/register",
  authMiddleware,
  handlers.registerTokenHandler,
);
pushNotificationRouter.delete(
  "/unregister",
  authMiddleware,
  handlers.unregisterTokenHandler,
);
pushNotificationRouter.get(
  "/tokens",
  authMiddleware,
  handlers.getUserTokensHandler,
);

// Admin routes (admin session required)
pushNotificationRouter.post(
  "/send",
  authMiddleware,
  handlers.sendNotificationHandler,
);
pushNotificationRouter.post(
  "/send-to-users",
  authMiddleware,
  handlers.sendToUsersHandler,
);
pushNotificationRouter.get("/stats", authMiddleware, handlers.getStatsHandler);
pushNotificationRouter.post(
  "/cleanup",
  authMiddleware,
  handlers.cleanupTokensHandler,
);
