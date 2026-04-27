import { normalizeCity, stateCodeFromCoords } from "./geo/cityUtils";
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

export interface NearbyCity {
  name: string;
  lat: number;
  lng: number;
  population: number | null;
  distanceMeters: number;
}

interface OverpassServiceDeps {
  redisService: RedisService;
}

const CACHE_TTL = 60 * 60 * 24; // 24 hours — trail data doesn't change often
/**
 * Endpoint order matters. The canonical overpass-api.de is the most reliable
 * and goes first; mirrors are fallbacks for when it rate-limits us. The old
 * `maps.mail.ru/osm/tools/overpass` mirror was kept as fallback #2 but has
 * been returning 403 on every request (it now requires API keys / has changed
 * policy), so it's removed entirely.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
let currentEndpointIdx = 0;

function getOverpassUrl(): string {
  return OVERPASS_ENDPOINTS[currentEndpointIdx];
}

function rotateEndpoint(): void {
  currentEndpointIdx = (currentEndpointIdx + 1) % OVERPASS_ENDPOINTS.length;
  console.log(`[OverpassService] Rotating to ${OVERPASS_ENDPOINTS[currentEndpointIdx]}`);
}

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

// Surfaces suitable for hiking/walking (broader than boarding)
const HIKING_SURFACES = new Set([
  ...GOOD_SURFACES,
  "gravel",
  "fine_gravel",
  "compacted",
  "dirt",
  "earth",
  "ground",
  "grass",
  "sand",
  "wood",
  "unpaved",
]);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;
const MIN_REQUEST_GAP_MS = 1200; // minimum gap between Overpass requests

export class OverpassService {
  private redisService: RedisService;
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;

  constructor(deps: OverpassServiceDeps) {
    this.redisService = deps.redisService;
  }

  /** Serialize all Overpass requests so only one runs at a time with a minimum gap. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.requestQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < MIN_REQUEST_GAP_MS) {
        await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - elapsed));
      }
      this.lastRequestTime = Date.now();
      return fn();
    });
    // Keep the queue chain alive but don't let errors break it
    this.requestQueue = task.then(
      () => {},
      () => {},
    );
    return task;
  }

  private async fetchWithRetry(
    query: string,
    timeoutMs: number,
  ): Promise<OverpassResponse | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const url = getOverpassUrl();
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ThirdPlace/1.0 (trail-search; contact@thirdplace.app)",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          return (await response.json()) as OverpassResponse;
        }

        // Rotate on ANY non-2xx, not just 429/504. Mirrors return 403 / 410 /
        // other status codes when they go offline or change policy, and the
        // old code would `return null` instead of advancing to the next mirror.
        const status = response.status;
        rotateEndpoint();
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
          console.warn(
            `[OverpassService] Got ${status} from ${url}, rotating & retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        console.error(`[OverpassService] API returned ${status} from ${url}`);
        return null;
      } catch (err) {
        rotateEndpoint();
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
          console.warn(
            `[OverpassService] Fetch error from ${url}, rotating & retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
            (err as Error).message,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        console.error("[OverpassService] Fetch failed after retries:", err);
        return null;
      }
    }
    return null;
  }

  async fetchPavedTrails(
    lat: number,
    lng: number,
    radiusMeters = 5000,
    maxResults = 20,
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

    const data = await this.enqueue(() => this.fetchWithRetry(query, 20000));
    if (!data) return [];

    const trails = this.parseTrails(data, maxResults);

    // Cache results
    if (trails.length > 0) {
      await client.setex(cacheKey, CACHE_TTL, JSON.stringify(trails));
    }

    console.log(
      `[OverpassService] Found ${trails.length} paved trails near ${lat.toFixed(3)},${lng.toFixed(3)}`,
    );

    return trails;
  }

  async fetchHikingTrails(
    lat: number,
    lng: number,
    radiusMeters = 8000,
    maxResults = 20,
  ): Promise<Trail[]> {
    const cacheKey = `hiking-trails:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusMeters}`;
    const client = this.redisService.getClient();

    const cached = await client.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Corrupted cache, refetch
      }
    }

    // Query Overpass for hiking/walking paths — broader surface types and includes named paths/tracks
    const query = `
[out:json][timeout:15];
(
  way["highway"~"path|footway|track|bridleway"]["sac_scale"](around:${radiusMeters},${lat},${lng});
  way["highway"~"path|footway|track"]["name"]["surface"](around:${radiusMeters},${lat},${lng});
  way["highway"~"cycleway|path|footway|pedestrian"]["surface"~"gravel|fine_gravel|compacted|dirt|earth|ground|unpaved|wood"](around:${radiusMeters},${lat},${lng});
);
out geom;
`;

    const data = await this.enqueue(() => this.fetchWithRetry(query, 20000));
    if (!data) return [];

    const trails = this.parseTrails(data, maxResults, HIKING_SURFACES, false);

    if (trails.length > 0) {
      await client.setex(cacheKey, CACHE_TTL, JSON.stringify(trails));
    }

    console.log(
      `[OverpassService] Found ${trails.length} hiking trails near ${lat.toFixed(3)},${lng.toFixed(3)}`,
    );

    return trails;
  }

  private parseTrails(
    data: OverpassResponse,
    maxResults: number,
    allowedSurfaces: Set<string> = GOOD_SURFACES,
    requireSmooth = true,
  ): Trail[] {
    const trails: Trail[] = [];

    for (const element of data.elements) {
      if (element.type !== "way" || !element.geometry) continue;

      const tags = element.tags || {};
      const surface = tags.surface || "";
      const smoothness = tags.smoothness || null;

      // Skip if surface isn't in the allowed set (allow missing surface for hiking trails)
      if (surface && !allowedSurfaces.has(surface)) continue;

      // Skip if explicitly marked as bad smoothness (only enforced for boarding trails)
      if (
        requireSmooth &&
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
      .slice(0, maxResults);
  }

  async fetchTrailById(wayId: number): Promise<Trail | null> {
    const cacheKey = `trail:${wayId}`;
    const client = this.redisService.getClient();

    const cached = await client.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Corrupted cache, refetch
      }
    }

    const query = `[out:json][timeout:10];way(${wayId});out geom;`;

    try {
      const data = await this.enqueue(() => this.fetchWithRetry(query, 15000));
      if (!data) return null;

      const element = data.elements.find(
        (e) => e.type === "way" && e.id === wayId,
      );
      if (!element || !element.geometry || element.geometry.length < 2)
        return null;

      const tags = element.tags || {};
      const geometry: [number, number][] = element.geometry.map(
        (node: { lon: number; lat: number }) => [node.lon, node.lat],
      );
      const lengthMeters = this.calculatePathLength(geometry);
      const midIdx = Math.floor(geometry.length / 2);

      const trail: Trail = {
        id: element.id,
        name: tags.name || tags.ref || `Paved ${tags.highway || "path"}`,
        surface: tags.surface || "paved",
        smoothness: tags.smoothness || null,
        highway: tags.highway || "path",
        lit: tags.lit === "yes" ? true : tags.lit === "no" ? false : null,
        incline: tags.incline || null,
        lengthMeters: Math.round(lengthMeters),
        geometry,
        center: geometry[midIdx],
      };

      await client.setex(cacheKey, CACHE_TTL, JSON.stringify(trail));
      return trail;
    } catch (err) {
      console.error(
        `[OverpassService] fetchTrailById failed for ${wayId}:`,
        err,
      );
      return null;
    }
  }

  async fetchNearbyCities(
    lat: number,
    lng: number,
    radiusMeters = 60000,
    maxResults = 10,
  ): Promise<NearbyCity[]> {
    const cacheKey = `nearby-cities:${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusMeters}`;
    const client = this.redisService.getClient();

    const cached = await client.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Corrupted cache, refetch
      }
    }

    // Query Overpass for place nodes (city, town, village) near coordinates
    const query = `
[out:json][timeout:15];
(
  node["place"="city"](around:${radiusMeters},${lat},${lng});
  node["place"="town"](around:${radiusMeters},${lat},${lng});
  node["place"="village"](around:${Math.min(radiusMeters, 20000)},${lat},${lng});
);
out body;
`;

    const data = await this.enqueue(() => this.fetchWithRetry(query, 20000));
    if (!data) return [];

    const cities: NearbyCity[] = [];
    const seen = new Set<string>();

    for (const element of data.elements) {
      if (element.type !== "node") continue;
      const tags = element.tags || {};
      const name = tags.name;
      if (!name) continue;

      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const nodeLat = (element as OverpassNodeElement).lat;
      const nodeLon = (element as OverpassNodeElement).lon;
      if (nodeLat == null || nodeLon == null) continue;

      const dist = haversine(lat, lng, nodeLat, nodeLon);
      const population = tags.population
        ? parseInt(tags.population, 10)
        : null;

      // Build a "City, State" label — try Overpass tags first, fall back to coords
      const state = tags["is_in:state"] || tags["is_in"] || "";
      let rawName: string;
      if (state) {
        rawName = `${name}, ${state.split(",")[0].trim()}`;
      } else {
        const stateCode = stateCodeFromCoords(nodeLat, nodeLon);
        rawName = stateCode ? `${name}, ${stateCode}` : name;
      }
      const fullName = normalizeCity(rawName);

      cities.push({
        name: fullName,
        lat: nodeLat,
        lng: nodeLon,
        population: Number.isNaN(population) ? null : population,
        distanceMeters: Math.round(dist),
      });
    }

    // Top 3 nearest towns/cities, then larger cities (pop >= 50k) from full radius.
    const NEARBY_RADIUS = 15000;
    const LARGE_CITY_POP = 50000;
    const MAX_NEARBY = 3;
    const nearby = cities
      .filter((c) => c.distanceMeters <= NEARBY_RADIUS)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, MAX_NEARBY);
    const nearbyNames = new Set(nearby.map((c) => c.name.toLowerCase()));
    const larger = cities
      .filter(
        (c) =>
          !nearbyNames.has(c.name.toLowerCase()) &&
          (c.population ?? 0) >= LARGE_CITY_POP,
      )
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    const result = [...nearby, ...larger].slice(0, maxResults);

    if (result.length > 0) {
      await client.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    }

    console.log(
      `[OverpassService] Found ${result.length} cities near ${lat.toFixed(3)},${lng.toFixed(3)}`,
    );

    return result;
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

interface OverpassNodeElement extends OverpassElement {
  lat: number;
  lon: number;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

