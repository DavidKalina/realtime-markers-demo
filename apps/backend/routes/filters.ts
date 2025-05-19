// This would be added to the backend service as src/routes/filters.ts
import { Hono } from "hono";
import * as handlers from "../handlers/filterHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

// Create a router with the correct typing
export const filterRouter = new Hono<AppContext>();

// Apply IP, rate limiting, and auth middleware to all routes in this router
filterRouter.use("*", ip());
filterRouter.use(
  "*",
  rateLimit({
    maxRequests: 20, // 20 requests per minute for filter routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `filters:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
filterRouter.use("*", authMiddleware);

// Filter CRUD endpoints

// Filter application endpoints
filterRouter.post("/apply", handlers.applyFiltersHandler);
filterRouter.delete("/clear", handlers.clearFiltersHandler);

filterRouter.put("/:id", handlers.updateFilterHandler);
filterRouter.delete("/:id", handlers.deleteFilterHandler);
filterRouter.post("/", handlers.createFilterHandler);
filterRouter.get("/", handlers.getFiltersHandler);
