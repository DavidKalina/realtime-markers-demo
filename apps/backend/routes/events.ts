// src/routes/events.ts
import { Hono } from "hono";
import * as handlers from "../handlers/eventHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

// Create a router with the correct typing
export const eventsRouter = new Hono<AppContext>();

// Apply auth middleware to all routes in this router
eventsRouter.use("*", authMiddleware);

// Now all our routes will be protected by authMiddleware
eventsRouter.get("/nearby", handlers.getNearbyEventsHandler);
eventsRouter.get("/categories", handlers.getCategoriesHandler);
eventsRouter.get("/by-categories", handlers.getEventsByCategoriesHandler);
eventsRouter.get("/search", handlers.searchEventsHandler);
eventsRouter.post("/process", handlers.processEventImageHandler);
eventsRouter.get("/process/:jobId", handlers.getProcessingStatusHandler);
eventsRouter.post("/", handlers.createEventHandler);
eventsRouter.delete("/:id", handlers.deleteEventHandler);
eventsRouter.get("/:id", handlers.getEventByIdHandler);
eventsRouter.get("/", handlers.getAllEventsHandler);
