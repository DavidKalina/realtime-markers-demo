import { Hono } from "hono";
import { updateLocationHandler } from "../handlers/userLocationHandler";
import {
  toggleFollowHandler,
  isFollowingHandler,
  getFollowersHandler,
  getFollowingHandler,
} from "../handlers/followHandlers";
import { getUserStats } from "../handlers/userStatsHandler";
import { getUserBadges } from "../handlers/badgeHandlers";
import { getAdventureScore } from "../handlers/adventureScoreHandler";
import { getProfileInsights } from "../handlers/profileInsightsHandler";
import { submitOnboardingProfile } from "../handlers/onboardingProfileHandler";
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
usersRouter.get("/me/badges", authMiddleware, getUserBadges);
usersRouter.get("/me/adventure-score", authMiddleware, getAdventureScore);
usersRouter.get("/me/profile-insights", authMiddleware, getProfileInsights);
usersRouter.post(
  "/me/onboarding-profile",
  authMiddleware,
  submitOnboardingProfile,
);

// Follow routes
usersRouter.post("/:userId/follow", authMiddleware, toggleFollowHandler);
usersRouter.get("/:userId/is-following", authMiddleware, isFollowingHandler);
usersRouter.get("/:userId/followers", getFollowersHandler);
usersRouter.get("/:userId/following", getFollowingHandler);
