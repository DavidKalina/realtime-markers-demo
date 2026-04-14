import { Hono } from "hono";
import { getUserStats } from "../handlers/userStatsHandler";
import { getProfileInsights } from "../handlers/profileInsightsHandler";
import { getGrowthDashboard } from "../handlers/growthDashboardHandler";
import { withErrorHandling, requireAuth } from "../utils/handlerUtils";
import { ValidationError } from "../utils/errors";
import { User } from "../entities";
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

usersRouter.post("/location", authMiddleware, withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { lng, lat } = body;

  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return c.json({ error: "Invalid coordinates" }, 400);
  }

  const redisService = c.get("redisService");
  const geocodingService = c.get("geocodingService");

  // Reverse-geocode to city name instead of storing exact coordinates
  const cityState = await geocodingService.reverseGeocodeCityState(lat, lng);
  if (cityState) {
    await redisService.storeUserCity(user.id, cityState);
  }

  // Fire-and-forget: check for objective proximity and auto-checkin
  c.get("sidequestCheckinService")
    .checkAndNotify(user.id, lat, lng)
    .catch((err: unknown) =>
      console.error("[SidequestCheckin] check failed:", err),
    );

  return c.json({ success: true });
}));

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

const VALID_PACES = ["chill", "balanced", "send_it"];

usersRouter.post("/me/onboarding-profile", authMiddleware, withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { activities, pace } = body;

  if (!Array.isArray(activities) || activities.length < 3) {
    throw new ValidationError("At least 3 activities are required");
  }

  if (!pace || !VALID_PACES.includes(pace)) {
    throw new ValidationError(
      `Invalid pace. Must be one of: ${VALID_PACES.join(", ")}`,
    );
  }

  const dataSource = c.get("dataSource");
  const userRepo = dataSource.getRepository(User);
  await userRepo.update(user.id, {
    onboardingProfile: { activities: activities as string[], pace },
  });

  return c.json({ success: true });
}));

