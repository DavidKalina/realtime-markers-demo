import { Hono } from "hono";
import { updateLocationHandler } from "../handlers/userLocationHandler";
import { getUserStats } from "../handlers/userStatsHandler";
import { getProfileInsights } from "../handlers/profileInsightsHandler";
import { submitOnboardingProfile } from "../handlers/onboardingProfileHandler";
import { getGrowthDashboard } from "../handlers/growthDashboardHandler";
import { withErrorHandling, requireAuth } from "../utils/handlerUtils";
import type { AppContext } from "../types/context";
import type { CoverageService } from "../services/CoverageService";
import type { PathwayService } from "../services/PathwayService";
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

usersRouter.get("/me/coverage", authMiddleware, withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const coverageService = c.get("coverageService") as CoverageService;
  const summary = await coverageService.getCoverageSummary(user.id);
  return c.json(summary);
}));

usersRouter.get("/me/pathways", authMiddleware, withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const pathwayService = c.get("pathwayService") as PathwayService;
  const phaseContext = await pathwayService.getUserPhaseContext(user.id);
  return c.json(phaseContext);
}));

usersRouter.get("/me/growth-dashboard", authMiddleware, getGrowthDashboard);
usersRouter.post(
  "/me/onboarding-profile",
  authMiddleware,
  submitOnboardingProfile,
);

