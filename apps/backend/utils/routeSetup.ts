import { Hono } from "hono";
import { adminRouter } from "../routes/admin";
import { authRouter } from "../routes/auth";
import { jobsRouter } from "../routes/jobs";
import { jobStreamingRouter } from "../routes/jobStreaming";
import { pushNotificationRouter } from "../routes/pushNotifications";
import { usersRouter } from "../routes/users";
import { sidequestRouter, publicSidequestRouter } from "../routes/sidequests";
import type { AppContext } from "../types/context";

/**
 * Setup all application routes
 */
export function setupRoutes(app: Hono<AppContext>): void {
  // Public routes (no auth required) — must come before authenticated routes
  app.route("/api/public/sidequests", publicSidequestRouter);

  // Register all route modules
  app.route("/api/auth", authRouter);
  app.route("/api/admin", adminRouter);
  app.route("/api/push-notifications", pushNotificationRouter);
  app.route("/api/users", usersRouter);
  app.route("/api/sidequests", sidequestRouter);

  // Job streaming routes (must be before jobs router)
  app.route("/api/jobs", jobStreamingRouter);
  app.route("/api/jobs", jobsRouter);
}
