import { Hono } from "hono";
import * as eventHandlers from "../handlers/eventHandlers";
import type { AppContext } from "../types/context";
import { ip } from "../middleware/ip";
import { rateLimit } from "../index";

// Create a router with the correct typing
export const categoriesRouter = new Hono<AppContext>();

// Apply IP and rate limiting middleware to all routes in this router
categoriesRouter.use("*", ip());
categoriesRouter.use(
  "*",
  rateLimit({
    maxRequests: 30, // 30 requests per minute for category routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `categories:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// Get all categories
categoriesRouter.get("/", eventHandlers.getCategoriesHandler);

// Search categories
categoriesRouter.get("/search", eventHandlers.getCategoriesHandler);
