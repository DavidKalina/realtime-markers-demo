import type { Context } from "hono";
import type { AppContext } from "../types/context";

export async function updateLocationHandler(c: Context<AppContext>) {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { lng, lat } = body;

  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return c.json({ error: "Invalid coordinates" }, 400);
  }

  const redisService = c.get("redisService");
  await redisService.storeDeviceLocation(user.id, lng, lat);

  // Fire-and-forget: check for nearby events and send push notification
  c.get("proximityNotificationService")
    .checkAndNotify(user.id, lat, lng)
    .catch((err: unknown) =>
      console.error("[ProximityNotification] check failed:", err),
    );

  return c.json({ success: true });
}
