import { Hono } from "hono";
import { adminRouter } from "../routes/admin";
import { authRouter } from "../routes/auth";
import { eventsRouter } from "../routes/events";
import { filterRouter } from "../routes/filters";
import { internalRouter } from "../routes/internalRoutes";
import { jobsRouter } from "../routes/jobs";
import { placesRouter } from "../routes/places";
import { categoriesRouter } from "../routes/categories";
import { jobStreamingRouter } from "../routes/jobStreaming";
import { civicEngagementRouter } from "../routes/civicEngagement";
import type { AppContext } from "../types/context";

/**
 * Setup all application routes
 */
export function setupRoutes(app: Hono<AppContext>): void {
  // Register all route modules
  app.route("/api/events", eventsRouter);
  app.route("/api/auth", authRouter);
  app.route("/api/admin", adminRouter);
  app.route("/api/filters", filterRouter);
  app.route("/api/internal", internalRouter);
  app.route("/api/places", placesRouter);
  app.route("/api/categories", categoriesRouter);
  app.route("/api/civic-engagements", civicEngagementRouter);

  // Job streaming routes (must be before jobs router)
  app.route("/api/jobs", jobStreamingRouter);
  app.route("/api/jobs", jobsRouter);
}
