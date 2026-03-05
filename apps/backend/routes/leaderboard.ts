import { Hono } from "hono";
import {
  getCityLeaderboard,
  getMyRank,
  getThirdSpaceScore,
} from "../handlers/leaderboardHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

export const leaderboardRouter = new Hono<AppContext>();

// Public — no auth required
leaderboardRouter.get("/", getCityLeaderboard);

// Public — Third Space Score
leaderboardRouter.get("/third-space-score", getThirdSpaceScore);

// Authenticated — user's own rank
leaderboardRouter.use("/my-rank", authMiddleware);
leaderboardRouter.get("/my-rank", getMyRank);
