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

export const getThirdSpaceScore = async (c: Context<AppContext>) => {
  const city = c.req.query("city");
  if (!city) {
    return c.json({ error: "city query parameter is required" }, 400);
  }

  const thirdSpaceScoreService = c.get("thirdSpaceScoreService");
  const score = await thirdSpaceScoreService.getCityScore(city);

  return c.json(score);
};

export const getThirdSpaceLeaderboard = async (c: Context<AppContext>) => {
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");

  const thirdSpaceScoreService = c.get("thirdSpaceScoreService");
  const result = await thirdSpaceScoreService.getLeaderboard(
    lat ? parseFloat(lat) : undefined,
    lng ? parseFloat(lng) : undefined,
  );

  // If no close cities from DB and we have user coords, fall back to Overpass
  if (
    lat &&
    lng &&
    (!result.closestCities || result.closestCities.length === 0)
  ) {
    try {
      const overpassService = c.get("overpassService");
      const nearbyCities = await overpassService.fetchNearbyCities(
        parseFloat(lat),
        parseFloat(lng),
      );

      if (nearbyCities.length > 0) {
        const METERS_PER_MILE = 1609.344;
        result.closestCities = nearbyCities.map((city) => ({
          city: city.name,
          score: 0,
          momentum: "steady" as const,
          delta24h: 0,
          adventureCount: 0,
          centroid: { lat: city.lat, lng: city.lng },
          distanceMiles: Math.round(city.distanceMeters / METERS_PER_MILE),
          computedAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error(
        "[leaderboardHandlers] Overpass city fallback failed:",
        err,
      );
    }
  }

  return c.json(result);
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
