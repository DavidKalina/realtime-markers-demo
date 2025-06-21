// src/routes/events.ts
import { Hono } from "hono";
import * as handlers from "../handlers/eventHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

// Create a router with the correct typing
export const eventsRouter = new Hono<AppContext>();

// Apply IP, rate limiting, and auth middleware to all routes in this router
eventsRouter.use("*", ip());
eventsRouter.use(
  "*",
  rateLimit({
    maxRequests: 20, // 10 requests per minute for event routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `events:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
eventsRouter.use("*", authMiddleware);

// Static/specific paths should come before dynamic ones
eventsRouter.get("/saved", handlers.getSavedEventsHandler);
eventsRouter.get("/discovered", handlers.getDiscoveredEventsHandler);
eventsRouter.get("/nearby", handlers.getNearbyEventsHandler);
eventsRouter.get("/categories", handlers.getCategoriesHandler);
eventsRouter.get("/by-categories", handlers.getEventsByCategoriesHandler);
eventsRouter.get("/category/:categoryId", handlers.getEventsByCategoryHandler);
eventsRouter.get("/search", handlers.searchEventsHandler);
eventsRouter.get("/landing", handlers.getLandingPageDataHandler);
eventsRouter.post("/process", handlers.processEventImageHandler);
eventsRouter.get("/process/:jobId", handlers.getProcessingStatusHandler);
eventsRouter.post("/private", handlers.createPrivateEventHandler);
eventsRouter.post("/", handlers.createEventHandler);

// Dynamic routes with IDs
eventsRouter.delete("/:id", handlers.deleteEventHandler);
eventsRouter.put("/:id", handlers.updateEventHandler);
eventsRouter.post("/:id/save", handlers.toggleSaveEventHandler);
eventsRouter.post("/:id/rsvp", handlers.toggleRsvpEventHandler);
eventsRouter.get("/:id/rsvped", handlers.isEventRsvpedHandler);
eventsRouter.get("/:id/saved", handlers.isEventSavedHandler);
eventsRouter.get("/:id/engagement", handlers.getEventEngagementHandler);
eventsRouter.post("/:id/view", handlers.trackEventViewHandler);
eventsRouter.get("/:id/shares", handlers.getEventSharesHandler);
eventsRouter.get("/:id", handlers.getEventByIdHandler);

// Root path should be last to avoid catching other routes
eventsRouter.get("/", handlers.getAllEventsHandler);
