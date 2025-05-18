// src/routes/internalRoutes.ts
import { Hono } from "hono";
import * as eventHandler from "../handlers/eventHandlers";
import * as filterHandler from "../handlers/filterHandlers";
import type { AppContext } from "../types/context";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import { z } from "zod";

// Create a router with the correct typing for internal service communication
export const internalRouter = new Hono<AppContext>();

// Apply IP and rate limiting middleware to all routes
internalRouter.use("*", ip());
internalRouter.use(
  "*",
  rateLimit({
    maxRequests: 50, // 50 requests per minute for internal routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `internal:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// Add your internal routes without auth middleware
internalRouter.get("/events", eventHandler.getAllEventsHandler);
internalRouter.get("/filters", filterHandler.getInternalFiltersHandler);

// Add endpoint for fetching event shares in batch
internalRouter.post("/events/shares/batch", async (c) => {
  try {
    const { eventIds } = await c.req.json();
    if (!Array.isArray(eventIds)) {
      return c.json({ error: "eventIds must be an array" }, 400);
    }

    const eventService = c.get("eventService");
    const shares = await Promise.all(
      eventIds.map(async (eventId) => {
        const eventShares = await eventService.getEventShares(eventId);
        return eventShares.map((share) => ({
          eventId,
          sharedWithId: share.sharedWithId,
          sharedById: share.sharedById,
        }));
      }),
    );

    // Flatten the array of arrays
    const flattenedShares = shares.flat();
    return c.json(flattenedShares);
  } catch (error) {
    console.error("Error fetching event shares batch:", error);
    return c.json({ error: "Failed to fetch event shares batch" }, 500);
  }
});

// Schema for XP award request
const awardXpSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["DISCOVERY", "SAVE", "CREATION", "LOGIN"]),
  amount: z.number().int().positive(),
});

// Award XP to a user
internalRouter.post("/xp/award", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, amount } = awardXpSchema.parse(body);

    const levelingService = c.get("levelingService");
    await levelingService.awardXp(userId, amount);

    return c.json({ success: true, message: "XP awarded successfully" });
  } catch (error) {
    console.error("Error awarding XP:", error);
    return c.json({ success: false, error: "Failed to award XP" }, 500);
  }
});

// Get user's level information
internalRouter.get("/xp/user/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const levelingService = c.get("levelingService");

    const levelInfo = await levelingService.getUserLevelInfo(userId);
    return c.json(levelInfo);
  } catch (error) {
    console.error("Error getting user level info:", error);
    return c.json(
      { success: false, error: "Failed to get user level info" },
      500,
    );
  }
});

// Reset user's XP (admin only)
internalRouter.post("/xp/reset/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const user = c.get("user");

    // Check if user is admin
    if (user?.role !== "ADMIN") {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }

    const levelingService = c.get("levelingService");
    await levelingService.resetUserXp(userId);

    return c.json({ success: true, message: "User XP reset successfully" });
  } catch (error) {
    console.error("Error resetting user XP:", error);
    return c.json({ success: false, error: "Failed to reset user XP" }, 500);
  }
});

export default internalRouter;
