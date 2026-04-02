import { Hono } from "hono";
import { updateLocationHandler } from "../handlers/userLocationHandler";
import { getUserStats } from "../handlers/userStatsHandler";
import { getProfileInsights } from "../handlers/profileInsightsHandler";
import { submitOnboardingProfile } from "../handlers/onboardingProfileHandler";
import { getCoverageHandler } from "../handlers/coverageHandler";
import { getPathways } from "../handlers/pathwayHandler";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const usersRouter = new Hono<AppContext>();

usersRouter.use("*", ip());
usersRouter.use(
  "*",
  rateLimit({
    maxRequests: 120, // Generous for background location updates
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `users:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

usersRouter.post("/location", authMiddleware, updateLocationHandler);

// Stats route (before /:userId to avoid param conflict)
usersRouter.get("/me/stats", authMiddleware, getUserStats);

usersRouter.get("/me/profile-insights", authMiddleware, getProfileInsights);
usersRouter.get("/me/coverage", authMiddleware, getCoverageHandler);
usersRouter.get("/me/pathways", authMiddleware, getPathways);
usersRouter.post(
  "/me/onboarding-profile",
  authMiddleware,
  submitOnboardingProfile,
);

