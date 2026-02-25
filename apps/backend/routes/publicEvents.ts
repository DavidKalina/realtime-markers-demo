import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const publicEventsRouter = new Hono<AppContext>();

// Apply IP and rate limiting — NO auth middleware
publicEventsRouter.use("*", ip());
publicEventsRouter.use(
  "*",
  rateLimit({
    maxRequests: 30,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `public-events:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

publicEventsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const eventService = c.get("eventService");

  const event = await eventService.getEventById(id);

  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  // Strip sensitive fields and limit creator info
  const {
    embedding,
    confidenceScore,
    qrCodeData,
    qrImagePath,
    detectedQrData,
    creatorId,
    ...safeEvent
  } = event as any;

  // Limit creator to public profile info only
  if (safeEvent.creator) {
    safeEvent.creator = {
      firstName: safeEvent.creator.firstName,
      avatarUrl: safeEvent.creator.avatarUrl,
      currentTier: safeEvent.creator.currentTier,
    };
  }

  return c.json(safeEvent);
});
