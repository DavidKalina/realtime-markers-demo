// This would be added to the backend service as src/routes/filters.ts
import { Hono } from "hono";
import * as handlers from "../handlers/filterHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

// Create a router with the correct typing
export const filterRouter = new Hono<AppContext>();

// Apply auth middleware to all routes in this router
filterRouter.use("*", authMiddleware);

// Filter CRUD endpoints

// Filter application endpoints
filterRouter.post("/apply", handlers.applyFiltersHandler);
filterRouter.delete("/clear", handlers.clearFiltersHandler);

filterRouter.put("/:id", handlers.updateFilterHandler);
filterRouter.delete("/:id", handlers.deleteFilterHandler);
filterRouter.post("/", handlers.createFilterHandler);
filterRouter.get("/", handlers.getFiltersHandler);
