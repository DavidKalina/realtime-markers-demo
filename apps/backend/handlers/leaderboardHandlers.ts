import type { Context } from "hono";
import type { AppContext } from "../types/context";

export const getCityLeaderboard = async (c: Context<AppContext>) => {
  const city = c.req.query("city");
  if (!city) {
    return c.json({ error: "city query parameter is required" }, 400);
  }

  const leaderboardService = c.get("leaderboardService");
  const leaderboard = await leaderboardService.getCityWeeklyLeaderboard(
    city,
    10,
  );

  return c.json(leaderboard);
};

export const getMyRank = async (c: Context<AppContext>) => {
  const city = c.req.query("city");
  if (!city) {
    return c.json({ error: "city query parameter is required" }, 400);
  }

  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const leaderboardService = c.get("leaderboardService");
  const rank = await leaderboardService.getUserCityRank(
    user.userId || user.id,
    city,
  );

  return c.json(rank);
};
