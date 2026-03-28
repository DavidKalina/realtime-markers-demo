import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { withErrorHandling, requireAuth, type Handler } from "../utils/handlerUtils";

const jobsRouter = new Hono<AppContext>();

// Apply auth middleware to all job routes
jobsRouter.use("*", authMiddleware);

const getUserJobsHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1000) : 50;

  const jobQueue = c.get("jobQueue");
  const jobs = await jobQueue.getUserJobs(user.id, limit);

  return c.json({ data: jobs });
});

const getJobProgressContextHandler: Handler = withErrorHandling(async (c) => {
  requireAuth(c);
  const jobId = c.req.param("jobId");
  if (!jobId) {
    return c.json({ error: "jobId is required" }, 400);
  }

  const jobQueue = c.get("jobQueue");
  const job = await jobQueue.getJobStatus(jobId);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  return c.json(job);
});

// Get all jobs for the current user (limited to 50 most recent jobs by default)
// Query parameters:
// - limit: number (optional, 1-1000, defaults to 50)
jobsRouter.get("/", getUserJobsHandler);

// Get job progress context
jobsRouter.get("/:jobId/progress", getJobProgressContextHandler);

export { jobsRouter };
