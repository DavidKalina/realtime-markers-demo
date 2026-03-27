import { withErrorHandling, type Handler } from "../utils/handlerUtils";
import type { AreaScanFilters } from "../services/AreaScanService";

export const areaScanHandler: Handler = withErrorHandling(async (c) => {
  const body = await c.req.json<{
    lat: number;
    lng: number;
    radius?: number;
  }>();
  const { lat, lng } = body;
  const radius = Math.min(body.radius ?? 16093, 16093);

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return c.json(
      { error: "Invalid coordinates. lat: -90 to 90, lng: -180 to 180" },
      400,
    );
  }

  const areaScanService = c.get("areaScanService");
  const redisService = c.get("redisService");
  const userPreferencesService = c.get("userPreferencesService");
  const user = c.get("user");

  // Resolve filters from the user's persisted active filters
  let filters: AreaScanFilters | undefined;
  if (user?.userId || user?.id) {
    const activeFilters = await userPreferencesService.getActiveFilters(
      user.userId || user.id,
    );
    if (activeFilters.length > 0) {
      // Merge date ranges from all active filters (use widest bounds)
      const dateRanges = activeFilters
        .map((f) => f.criteria?.dateRange)
        .filter(
          (dr): dr is { start?: string; end?: string } =>
            !!dr?.start && !!dr?.end,
        );

      if (dateRanges.length > 0) {
        const starts = dateRanges.map((d) => d.start!).sort();
        const ends = dateRanges
          .map((d) => d.end!)
          .sort()
          .reverse();
        filters = {
          dateRange: { start: starts[0], end: ends[0] },
        };
      }
    }
  }

  const result = await areaScanService.getAreaProfile(
    lat,
    lng,
    radius,
    filters,
  );

  const text = result.text || "No data available.";

  // Cache the result (if not already cached)
  if (!result.cached) {
    const geohash = encodeGeohashSimple(lat, lng);
    const hourBucket = Math.floor(Date.now() / (3600 * 1000));
    const filterHash = filters
      ? Buffer.from(JSON.stringify(filters)).toString("base64url").slice(0, 12)
      : "";
    const cacheKey = filterHash
      ? `area-scan:${geohash}:${hourBucket}:${radius}:${filterHash}`
      : `area-scan:${geohash}:${hourBucket}:${radius}`;
    await redisService.set(
      cacheKey,
      JSON.stringify({
        zoneStats: result.zoneStats,
        events: result.events,
        trails: result.trails,
        text,
      }),
      3600,
    );
  }

  return c.json({
    ...result.zoneStats,
    events: result.events,
    trails: result.trails,
    text,
    cached: result.cached,
  });
});

export const clusterProfileHandler: Handler = withErrorHandling(async (c) => {
  const body = await c.req.json<{
    eventIds: string[];
    lat: number;
    lng: number;
  }>();
  const { eventIds, lat, lng } = body;

  if (
    !Array.isArray(eventIds) ||
    eventIds.length === 0 ||
    eventIds.length > 500
  ) {
    return c.json(
      { error: "eventIds must be a non-empty array with at most 500 items" },
      400,
    );
  }

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return c.json(
      { error: "Invalid coordinates. lat: -90 to 90, lng: -180 to 180" },
      400,
    );
  }

  const areaScanService = c.get("areaScanService");

  const result = await areaScanService.getClusterProfile(eventIds, lat, lng);
  const text = result.text || "No data available.";

  return c.json({
    ...result.zoneStats,
    events: result.events,
    trails: result.trails,
    text,
    cached: result.cached,
  });
});

export const trailDetailHandler: Handler = withErrorHandling(async (c) => {
  const wayId = Number(c.req.param("id"));
  if (!wayId || isNaN(wayId)) {
    return c.json({ error: "Invalid trail ID" }, 400);
  }

  const overpassService = c.get("overpassService");
  const trail = await overpassService.fetchTrailById(wayId);

  if (!trail) {
    return c.json({ error: "Trail not found" }, 404);
  }

  return c.json(trail);
});

// Simple geohash for cache key (matches AreaScanService)
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function encodeGeohashSimple(lat: number, lng: number, precision = 6): string {
  let minLat = -90,
    maxLat = 90;
  let minLng = -180,
    maxLng = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
