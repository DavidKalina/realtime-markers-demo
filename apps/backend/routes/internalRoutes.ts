// src/routes/internalRoutes.ts
import { Hono } from "hono";
import * as handlers from "../handlers/eventHandlers";
import type { AppContext } from "../types/context";

// Create a router with the correct typing for internal service communication
export const internalRouter = new Hono<AppContext>();

// Add your internal routes without auth middleware
internalRouter.get("/events", handlers.getAllEventsHandler);
