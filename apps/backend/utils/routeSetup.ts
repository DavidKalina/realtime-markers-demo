import { Hono } from "hono";
import { adminRouter } from "../routes/admin";
import { authRouter } from "../routes/auth";
import { eventsRouter } from "../routes/events";
import { filterRouter } from "../routes/filters";
import { friendshipsRouter } from "../routes/friendships";
import { internalRouter } from "../routes/internalRoutes";
import { jobsRouter } from "../routes/jobs";
import plansRouter from "../routes/plans";
import { notificationsRouter } from "../routes/notifications";
import { placesRouter } from "../routes/places";
import { categoriesRouter } from "../routes/categories";
import { jobStreamingRouter } from "../routes/jobStreaming";
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
  app.route("/api/plans", plansRouter);
  app.route("/api/internal", internalRouter);
  app.route("/api/friendships", friendshipsRouter);
  app.route("/api/notifications", notificationsRouter);
  app.route("/api/places", placesRouter);
  app.route("/api/categories", categoriesRouter);

  // Job streaming routes (must be before jobs router)
  app.route("/api/jobs", jobStreamingRouter);
  app.route("/api/jobs", jobsRouter);
}
