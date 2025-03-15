// src/routes/events.ts
import { Hono } from "hono";
import * as handlers from "../handlers/eventHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

// Create a router with the correct typing
export const eventsRouter = new Hono<AppContext>();

// Apply auth middleware to all routes in this router
eventsRouter.use("*", authMiddleware);

// Static/specific paths should come before dynamic ones
eventsRouter.get("/saved", handlers.getSavedEventsHandler);
eventsRouter.get("/nearby", handlers.getNearbyEventsHandler);
eventsRouter.get("/categories", handlers.getCategoriesHandler);
eventsRouter.get("/by-categories", handlers.getEventsByCategoriesHandler);
eventsRouter.get("/search", handlers.searchEventsHandler);
eventsRouter.post("/process", handlers.processEventImageHandler);
eventsRouter.post("/clusters/names", handlers.generateClusterNamesHandler);
eventsRouter.get("/process/:jobId", handlers.getProcessingStatusHandler);
eventsRouter.post("/", handlers.createEventHandler);

// Dynamic routes with IDs
eventsRouter.delete("/:id", handlers.deleteEventHandler);
eventsRouter.post("/:id/save", handlers.toggleSaveEventHandler);
eventsRouter.get("/:id/saved", handlers.isEventSavedHandler);
eventsRouter.get("/:id", handlers.getEventByIdHandler);

// Root path should be last to avoid catching other routes
eventsRouter.get("/", handlers.getAllEventsHandler);
