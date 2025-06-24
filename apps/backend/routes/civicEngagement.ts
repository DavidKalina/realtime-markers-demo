import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
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
  "/search/:query",
  civicEngagementHandlers.searchCivicEngagementsHandler,
);
civicEngagementRouter.get(
  "/recent",
  civicEngagementHandlers.getRecentCivicEngagementsHandler,
);
civicEngagementRouter.get(
  "/type/:type",
  civicEngagementHandlers.getCivicEngagementsByTypeHandler,
);
civicEngagementRouter.get(
  "/status/:status",
  civicEngagementHandlers.getCivicEngagementsByStatusHandler,
);
civicEngagementRouter.get(
  "/creator/:creatorId",
  civicEngagementHandlers.getCivicEngagementsByCreatorHandler,
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

// Creator/Admin routes (creators can modify their own, admins can modify any)
civicEngagementRouter.put(
  "/:id",
  authMiddleware,
  civicEngagementHandlers.updateCivicEngagementHandler,
);
civicEngagementRouter.delete(
  "/:id",
  authMiddleware,
  civicEngagementHandlers.deleteCivicEngagementHandler,
);

// Admin-only routes
civicEngagementRouter.patch(
  "/:id/status",
  authMiddleware,
  civicEngagementHandlers.adminUpdateCivicEngagementStatusHandler,
);
civicEngagementRouter.patch(
  "/admin/bulk-status",
  authMiddleware,
  civicEngagementHandlers.adminBulkUpdateCivicEngagementStatusHandler,
);
civicEngagementRouter.get(
  "/admin/all",
  authMiddleware,
  civicEngagementHandlers.getAllCivicEngagementsHandler,
);
civicEngagementRouter.get(
  "/admin/stats",
  authMiddleware,
  civicEngagementHandlers.getCivicEngagementStatsHandler,
);
