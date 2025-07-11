import { Hono } from "hono";
import type { AppContext } from "../types/context";
import {
  getUserJobsHandler,
  getJobProgressContextHandler,
} from "../handlers/eventHandlers";
import { authMiddleware } from "../middleware/authMiddleware";

const jobsRouter = new Hono<AppContext>();

// Apply auth middleware to all job routes
jobsRouter.use("*", authMiddleware);

// Get all jobs for the current user (limited to 50 most recent jobs by default)
// Query parameters:
// - limit: number (optional, 1-1000, defaults to 50)
jobsRouter.get("/", getUserJobsHandler);

// Get job progress context
jobsRouter.get("/:jobId/progress", getJobProgressContextHandler);

export { jobsRouter };
