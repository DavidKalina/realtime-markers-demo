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
    maxRequests: 10, // 10 requests per minute for event routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `events:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  })
);
eventsRouter.use("*", authMiddleware);

// Static/specific paths should come before dynamic ones
eventsRouter.get("/saved", handlers.getSavedEventsHandler);
eventsRouter.get("/discovered", handlers.getDiscoveredEventsHandler);
eventsRouter.get("/nearby", handlers.getNearbyEventsHandler);
eventsRouter.get("/categories", handlers.getCategoriesHandler);
eventsRouter.get("/by-categories", handlers.getEventsByCategoriesHandler);
eventsRouter.get("/search", handlers.searchEventsHandler);
eventsRouter.post("/process", handlers.processEventImageHandler);
eventsRouter.post("/clusters/names", handlers.generateClusterNamesHandler);
eventsRouter.post("/cluster-hub", handlers.getClusterHubDataHandler);
eventsRouter.get("/process/:jobId", handlers.getProcessingStatusHandler);
eventsRouter.post("/", handlers.createEventHandler);

// Dynamic routes with IDs
eventsRouter.delete("/:id", handlers.deleteEventHandler);
eventsRouter.post("/:id/save", handlers.toggleSaveEventHandler);
eventsRouter.get("/:id/saved", handlers.isEventSavedHandler);
eventsRouter.get("/:id", handlers.getEventByIdHandler);

// Add new cluster hub endpoint - changed to POST to accept event IDs
eventsRouter.post("/cluster/hub", handlers.getClusterHubDataHandler);

// Root path should be last to avoid catching other routes
eventsRouter.get("/", handlers.getAllEventsHandler);
