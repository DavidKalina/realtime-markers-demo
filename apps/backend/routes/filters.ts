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
    maxRequests: 40,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `filters:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
filterRouter.use("*", authMiddleware);

// Category preference endpoints (before parameterized routes)
filterRouter.get(
  "/category-preferences",
  handlers.getCategoryPreferencesHandler,
);
filterRouter.put(
  "/category-preferences",
  handlers.setCategoryPreferencesHandler,
);

// Filter CRUD endpoints
filterRouter.get("/", handlers.getFiltersHandler);
filterRouter.get("/active", handlers.getActiveFiltersHandler);
filterRouter.post("/generate-emoji", handlers.generateFilterEmojiHandler);
filterRouter.post("/", handlers.createFilterHandler);
filterRouter.post("/apply", handlers.applyFiltersHandler);
filterRouter.delete("/clear", handlers.clearFiltersHandler);

// Parameterized routes (must come after specific routes)
filterRouter.get("/:id", handlers.getFilterByIdHandler);
filterRouter.put("/:id", handlers.updateFilterHandler);
filterRouter.patch("/:id", handlers.updateFilterHandler);
filterRouter.post("/:id/toggle", handlers.toggleFilterHandler);
filterRouter.delete("/:id", handlers.deleteFilterHandler);
