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
import { pushNotificationRouter } from "../routes/pushNotifications";
import { areaScanRouter } from "../routes/areaScan";
import { publicEventsRouter } from "../routes/publicEvents";
import { usersRouter } from "../routes/users";
import type { AppContext } from "../types/context";

/**
 * Setup all application routes
 */
export function setupRoutes(app: Hono<AppContext>): void {
  // Public routes (no auth required) — must come before authenticated routes
  app.route("/api/public/events", publicEventsRouter);

  // Register all route modules
  app.route("/api/events", eventsRouter);
  app.route("/api/auth", authRouter);
  app.route("/api/admin", adminRouter);
  app.route("/api/filters", filterRouter);
  app.route("/api/internal", internalRouter);
  app.route("/api/places", placesRouter);
  app.route("/api/categories", categoriesRouter);
  app.route("/api/push-notifications", pushNotificationRouter);
  app.route("/api/area-scan", areaScanRouter);
  app.route("/api/users", usersRouter);

  // Job streaming routes (must be before jobs router)
  app.route("/api/jobs", jobStreamingRouter);
  app.route("/api/jobs", jobsRouter);
}
