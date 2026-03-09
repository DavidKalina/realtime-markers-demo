import type { RedisService } from "./RedisService";

export interface Trail {
  id: number;
  name: string;
  surface: string;
  smoothness: string | null;
  highway: string;
  lit: boolean | null;
  incline: string | null;
  lengthMeters: number;
  geometry: [number, number][]; // [lng, lat] pairs
  center: [number, number]; // [lng, lat]
}

export interface OverpassService {
  fetchPavedTrails(
    lat: number,
    lng: number,
    radiusMeters?: number,
  ): Promise<Trail[]>;
}

interface OverpassServiceDeps {
  redisService: RedisService;
}

const CACHE_TTL = 60 * 60 * 24; // 24 hours — trail data doesn't change often
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Surfaces safe for longboarding
const GOOD_SURFACES = new Set([
  "asphalt",
  "concrete",
  "paved",
  "concrete:plates",
  "concrete:lanes",
]);

// Smoothness values that won't wreck your wheels
const GOOD_SMOOTHNESS = new Set(["excellent", "good", "intermediate"]);

class OverpassServiceImpl implements OverpassService {
  private redisService: RedisService;

  constructor(deps: OverpassServiceDeps) {
    this.redisService = deps.redisService;
  }

  async fetchPavedTrails(
    lat: number,
    lng: number,
    radiusMeters = 5000,
  ): Promise<Trail[]> {
    const cacheKey = `trails:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusMeters}`;
    const client = this.redisService.getClient();

    // Check cache
    const cached = await client.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Corrupted cache, refetch
      }
    }

    // Query Overpass for paved paths suitable for longboarding
    // highway types: cycleway, path, footway, pedestrian, living_street, track
    // surface: asphalt, concrete, paved
    const query = `
[out:json][timeout:15];
(
  way["highway"~"cycleway|path|footway|pedestrian|living_street"]["surface"~"asphalt|concrete|paved|concrete:plates|concrete:lanes"](around:${radiusMeters},${lat},${lng});
  way["highway"="track"]["surface"~"asphalt|concrete|paved"](around:${radiusMeters},${lat},${lng});
);
out geom;
`;

    let data: OverpassResponse;
    try {
      const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        console.error(`[OverpassService] API returned ${response.status}`);
        return [];
      }

      data = (await response.json()) as OverpassResponse;
    } catch (err) {
      console.error("[OverpassService] Fetch failed:", err);
      return [];
    }

    const trails = this.parseTrails(data);

    // Cache results
    if (trails.length > 0) {
      await client.setex(cacheKey, CACHE_TTL, JSON.stringify(trails));
    }

    console.log(
      `[OverpassService] Found ${trails.length} paved trails near ${lat.toFixed(3)},${lng.toFixed(3)}`,
    );

    return trails;
  }

  private parseTrails(data: OverpassResponse): Trail[] {
    const trails: Trail[] = [];

    for (const element of data.elements) {
      if (element.type !== "way" || !element.geometry) continue;

      const tags = element.tags || {};
      const surface = tags.surface || "";
      const smoothness = tags.smoothness || null;

      // Skip if surface isn't longboard-friendly
      if (!GOOD_SURFACES.has(surface)) continue;

      // Skip if explicitly marked as bad smoothness
      if (
        smoothness &&
        !GOOD_SMOOTHNESS.has(smoothness) &&
        smoothness !== "very_good"
      ) {
        continue;
      }

      const geometry: [number, number][] = element.geometry.map(
        (node: { lon: number; lat: number }) => [node.lon, node.lat],
      );

      if (geometry.length < 2) continue;

      const lengthMeters = this.calculatePathLength(geometry);

      // Skip very short segments (< 100m) — not useful as trail stops
      if (lengthMeters < 100) continue;

      // Calculate center point
      const midIdx = Math.floor(geometry.length / 2);
      const center: [number, number] = geometry[midIdx];

      const lit = tags.lit === "yes" ? true : tags.lit === "no" ? false : null;

      trails.push({
        id: element.id,
        name: tags.name || tags.ref || `Paved ${tags.highway}`,
        surface,
        smoothness,
        highway: tags.highway,
        lit,
        incline: tags.incline || null,
        lengthMeters: Math.round(lengthMeters),
        geometry,
        center,
      });
    }

    // Deduplicate by name (keep longest segment)
    const byName = new Map<string, Trail>();
    for (const trail of trails) {
      const key = trail.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing || trail.lengthMeters > existing.lengthMeters) {
        byName.set(key, trail);
      }
    }

    // Sort by length descending — best trails first
    return [...byName.values()]
      .sort((a, b) => b.lengthMeters - a.lengthMeters)
      .slice(0, 20);
  }

  private calculatePathLength(coords: [number, number][]): number {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      total += haversine(
        coords[i - 1][1],
        coords[i - 1][0],
        coords[i][1],
        coords[i][0],
      );
    }
    return total;
  }
}

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lon: number; lat: number }[];
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export function createOverpassService(
  deps: OverpassServiceDeps,
): OverpassService {
  return new OverpassServiceImpl(deps);
}
