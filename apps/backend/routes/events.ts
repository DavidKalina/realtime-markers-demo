// src/routes/events.ts
import { Hono } from "hono";
import * as handlers from "../handlers/eventHandlers";
import type { AppContext } from "../types/context";

// Create a router with the correct typing
export const eventsRouter = new Hono<AppContext>();

// Now all our routes will have properly typed context
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
