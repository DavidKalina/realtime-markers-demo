// src/routes/internalRoutes.ts
import { Hono } from "hono";
import * as eventHandler from "../handlers/eventHandlers";
import * as filterHandler from "../handlers/filterHandlers";
import * as civicEngagementHandler from "../handlers/civicEngagementHandlers";
import type { AppContext } from "../types/context";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

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
internalRouter.get(
  "/civic-engagements",
  civicEngagementHandler.getAllCivicEngagementsHandler,
);

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

// Award XP to a user

export default internalRouter;
