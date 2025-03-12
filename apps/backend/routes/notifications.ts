// routes/notificationRoutes.ts
import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";

export const notificationsRouter = new Hono();

// Register device token
notificationsRouter.post("/register-device", authMiddleware, async (c) => {
  const user = c.get("user");
  const { token, deviceName, deviceType } = await c.req.json();

  if (!user) {
    return c.json({ error: "User is required" }, 400);
  }
  const userId = user.userId;

  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  try {
    const notificationService = c.get("notificationService");
    const success = await notificationService.registerDeviceToken(
      userId,
      token,
      deviceName,
      deviceType
    );

    if (success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to register device token" }, 500);
    }
  } catch (error) {
    console.error("Error registering device token:", error);
    return c.json({ error: "Failed to register device token" }, 500);
  }
});

// Unregister device token
notificationsRouter.post("/unregister-device", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "User is required" }, 400);
  }

  const userId = user.userId;

  const { token } = await c.req.json();

  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  try {
    const notificationService = c.get("notificationService");
    const success = await notificationService.unregisterDeviceToken(userId, token);

    return c.json({ success });
  } catch (error) {
    console.error("Error unregistering device token:", error);
    return c.json({ error: "Failed to unregister device token" }, 500);
  }
});

// Get notification settings
notificationsRouter.get("/settings", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "User is required" }, 400);
  }

  const userId = user.userId;
  try {
    const notificationService = c.get("notificationService");
    const settings = await notificationService.getUserNotificationSettings(userId);

    if (settings) {
      return c.json(settings);
    } else {
      return c.json({ error: "Could not retrieve notification settings" }, 404);
    }
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

// Update notification settings
notificationsRouter.put("/settings", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "User is required" }, 400);
  }

  const userId = user.userId;
  const settings = await c.req.json();

  try {
    const notificationService = c.get("notificationService");
    const success = await notificationService.updateUserNotificationSettings(userId, settings);

    if (success) {
      // Get the updated settings to return
      const updatedSettings = await notificationService.getUserNotificationSettings(userId);
      return c.json({ success: true, settings: updatedSettings });
    } else {
      return c.json({ error: "Failed to update settings" }, 500);
    }
  } catch (error) {
    console.error("Error updating notification settings:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});
