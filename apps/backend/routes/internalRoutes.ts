/// <reference types="node" />
// src/routes/internalRoutes.ts
import { Hono } from "hono";
import * as eventHandler from "../handlers/eventHandlers";
import * as filterHandler from "../handlers/filterHandlers";
import * as civicEngagementHandler from "../handlers/civicEngagementHandlers";
import type { AppContext } from "../types/context";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import type { Context, Next } from "hono";

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

// Require internal shared secret header for all internal routes
const requireInternalSecret = () => {
  return async (c: Context<AppContext>, next: Next) => {
    const expected = process.env.INTERNAL_API_SECRET?.trim();
    if (!expected) {
      // If not configured, deny by default
      return c.json({ error: "Internal API not configured" }, 503);
    }

    const providedRaw = c.req.header("x-internal-secret");
    const provided = providedRaw?.trim();

    if (!provided) {
      return c.json({ error: "Missing x-internal-secret header" }, 403);
    }

    if (provided !== expected) {
      return c.json({ error: "Invalid internal secret" }, 403);
    }

    return next();
  };
};

internalRouter.use("*", requireInternalSecret());

// Add your internal routes without auth middleware
internalRouter.get("/events", eventHandler.getAllEventsHandler);
internalRouter.get("/filters", filterHandler.getInternalFiltersHandler);
internalRouter.get(
  "/civic-engagements",
  civicEngagementHandler.getAllCivicEngagementsHandler,
);

// Award XP to a user

export default internalRouter;
