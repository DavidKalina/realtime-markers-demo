import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import * as civicEngagementHandlers from "../handlers/civicEngagementHandlers";

export const civicEngagementRouter = new Hono<AppContext>();

// Apply IP and rate limiting middleware to all routes
civicEngagementRouter.use("*", ip());
civicEngagementRouter.use(
  "*",
  rateLimit({
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `civic_engagement:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// Public routes
civicEngagementRouter.get(
  "/",
  civicEngagementHandlers.getCivicEngagementsHandler,
);
civicEngagementRouter.get(
  "/stats",
  civicEngagementHandlers.getCivicEngagementStatsHandler,
);
civicEngagementRouter.get(
  "/nearby",
  civicEngagementHandlers.getNearbyCivicEngagementsHandler,
);
civicEngagementRouter.get(
  "/:id",
  civicEngagementHandlers.getCivicEngagementByIdHandler,
);

// Authenticated routes
civicEngagementRouter.post(
  "/",
  authMiddleware,
  civicEngagementHandlers.createCivicEngagementHandler,
);

// Admin routes
civicEngagementRouter.put(
  "/:id",
  adminAuthMiddleware,
  civicEngagementHandlers.updateCivicEngagementHandler,
);
civicEngagementRouter.delete(
  "/:id",
  adminAuthMiddleware,
  civicEngagementHandlers.deleteCivicEngagementHandler,
);
