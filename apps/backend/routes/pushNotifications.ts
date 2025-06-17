import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AppContext } from "../types/context";
import {
  registerTokenHandler,
  unregisterTokenHandler,
  getUserTokensHandler,
  sendTestNotificationHandler,
  sendToUsersHandler,
} from "../handlers/pushNotificationHandlers";

const pushNotificationsRouter = new Hono<AppContext>();

// Apply auth middleware to all routes
pushNotificationsRouter.use("*", authMiddleware);

/**
 * Register a push token for the authenticated user
 * POST /api/push-notifications/register
 */
pushNotificationsRouter.post("/register", registerTokenHandler);

/**
 * Unregister a push token
 * DELETE /api/push-notifications/unregister
 */
pushNotificationsRouter.delete("/unregister", unregisterTokenHandler);

/**
 * Get all push tokens for the authenticated user
 * GET /api/push-notifications/tokens
 */
pushNotificationsRouter.get("/tokens", getUserTokensHandler);

/**
 * Send a test push notification to the authenticated user
 * POST /api/push-notifications/test
 */
pushNotificationsRouter.post("/test", sendTestNotificationHandler);

/**
 * Admin endpoint to send push notifications to multiple users
 * POST /api/push-notifications/send
 * Requires admin role
 */
pushNotificationsRouter.post("/send", sendToUsersHandler);

export { pushNotificationsRouter };
