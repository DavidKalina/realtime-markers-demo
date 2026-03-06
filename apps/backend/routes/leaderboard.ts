import { Hono } from "hono";
import {
  getCityLeaderboard,
  getMyRank,
  getThirdSpaceScore,
  getThirdSpaceLeaderboard,
} from "../handlers/leaderboardHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

export const leaderboardRouter = new Hono<AppContext>();

// Public — no auth required
leaderboardRouter.get("/", getCityLeaderboard);

// Public — Third Space Score
leaderboardRouter.get("/third-space-score", getThirdSpaceScore);

// Public — Third Spaces leaderboard (all cities)
leaderboardRouter.get("/third-spaces", getThirdSpaceLeaderboard);

// Authenticated — user's own rank
leaderboardRouter.use("/my-rank", authMiddleware);
leaderboardRouter.get("/my-rank", getMyRank);
