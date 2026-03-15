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

  // Always use Overpass + reverse geocode for closest cities.
  // DB only has cities with Third Space Score snapshots — a tiny subset.
  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const METERS_PER_MILE = 1609.344;
    const now = new Date().toISOString();

    // Fetch current city and nearby cities in parallel
    const [currentCity, nearbyCities] = await Promise.all([
      c
        .get("geocodingService")
        .reverseGeocodeCityState(userLat, userLng)
        .catch(() => null),
      c
        .get("overpassService")
        .fetchNearbyCities(userLat, userLng, 60000, 18)
        .catch((err) => {
          console.error(
            "[leaderboardHandlers] Overpass city fetch failed:",
            err,
          );
          return [] as Awaited<
            ReturnType<
              ReturnType<typeof c.get<"overpassService">>["fetchNearbyCities"]
            >
          >;
        }),
    ]);

    const closestCities = [];

    // Current city always first (0 distance)
    if (currentCity) {
      closestCities.push({
        city: currentCity,
        score: 0,
        momentum: "steady" as const,
        delta24h: 0,
        adventureCount: 0,
        centroid: { lat: userLat, lng: userLng },
        distanceMiles: 0,
        computedAt: now,
      });
    }

    // Add Overpass cities, deduplicating against current city.
    // Compare just the city name (before comma) to handle
    // "Frederick, Colorado" vs "Frederick, CO" mismatches.
    const currentCityName = currentCity
      ?.split(",")[0]
      .trim()
      .toLowerCase();
    for (const city of nearbyCities) {
      const overpassName = city.name.split(",")[0].trim().toLowerCase();
      if (currentCityName && overpassName === currentCityName) {
        continue;
      }
      closestCities.push({
        city: city.name,
        score: 0,
        momentum: "steady" as const,
        delta24h: 0,
        adventureCount: 0,
        centroid: { lat: city.lat, lng: city.lng },
        distanceMiles: Math.round(city.distanceMeters / METERS_PER_MILE),
        computedAt: now,
      });
    }

    result.closestCities = closestCities;
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
