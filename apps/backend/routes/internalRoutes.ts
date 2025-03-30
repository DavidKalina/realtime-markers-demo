// src/routes/internalRoutes.ts
import { Hono } from "hono";
import * as eventHandler from "../handlers/eventHandlers";
import * as filterHandler from "../handlers/filterHandlers";
import type { AppContext } from "../types/context";
import { ip } from "../middleware/ip";

// Create a router with the correct typing for internal service communication
export const internalRouter = new Hono<AppContext>();

// Apply IP middleware to all routes
internalRouter.use("*", ip());

// Add your internal routes without auth middleware
internalRouter.get("/events", eventHandler.getAllEventsHandler);
internalRouter.get("/filters", filterHandler.getInternalFiltersHandler);
