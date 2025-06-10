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

// Get all jobs for the current user
jobsRouter.get("/", getUserJobsHandler);

// Get job progress context
jobsRouter.get("/:jobId/progress", getJobProgressContextHandler);

export { jobsRouter };
