import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import type { NotificationType } from "../entities/Notification";

export const notificationsRouter = new Hono<AppContext>();

// Apply IP, rate limiting, and auth middleware to all routes
notificationsRouter.use("*", ip());
notificationsRouter.use(
  "*",
  rateLimit({
    maxRequests: 30,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `notifications:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
notificationsRouter.use("*", authMiddleware);

// Mark all notifications as read - must be before other routes to avoid conflicts
notificationsRouter.post("/read/all", async (c) => {
  const notificationService = c.get("notificationService");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await notificationService.markAllAsRead(user.userId);
  return c.json({ success: true });
});

// Get all notifications for the authenticated user
notificationsRouter.get("/", async (c) => {
  const notificationService = c.get("notificationService");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { skip, take, read, type } = c.req.query();

  console.log("Fetching notifications for user:", {
    userId: user.userId,
    skip,
    take,
    read,
    type,
  });

  const options = {
    skip: skip ? parseInt(skip) : undefined,
    take: take ? parseInt(take) : undefined,
    read: read ? read === "true" : undefined,
    type: type as NotificationType,
  };

  console.log("Notification options:", options);

  const result = await notificationService.getUserNotifications(
    user.userId,
    options,
  );
  console.log("Notification service result:", result);

  return c.json(result);
});

// Get unread notification count
notificationsRouter.get("/unread/count", async (c) => {
  const notificationService = c.get("notificationService");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const count = await notificationService.getUnreadCount(user.userId);
  return c.json({ count });
});

// Mark a notification as read
notificationsRouter.post("/:id/read", async (c) => {
  const notificationService = c.get("notificationService");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const notificationId = c.req.param("id");

  await notificationService.markAsRead(user.userId, notificationId);
  return c.json({ success: true });
});

// Delete a notification
notificationsRouter.delete("/:id", async (c) => {
  const notificationService = c.get("notificationService");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const notificationId = c.req.param("id");

  await notificationService.deleteNotification(user.userId, notificationId);
  return c.json({ success: true });
});

// Clear all notifications
notificationsRouter.delete("/", async (c) => {
  const notificationService = c.get("notificationService");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await notificationService.clearAllNotifications(user.userId);
  return c.json({ success: true });
});
