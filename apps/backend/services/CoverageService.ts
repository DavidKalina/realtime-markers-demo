import type { DataSource } from "typeorm";
import {
  CoverageCluster,
  CoverageSnapshot,
  User,
} from "@realtime-markers/database";

const SHADE_DECAY_RATE = 0.5;
const SNAPSHOT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_CLUSTERS_FOR_VORONOI = 3;
const GAP_THRESHOLD_DEG = 45; // Gaps wider than 45 degrees are significant
const BUFFER_METERS = 500; // Padding around convex hull for Voronoi clipping

// 8 compass directions for human-readable gap labels
const COMPASS_DIRECTIONS: { label: string; angle: number }[] = [
  { label: "north", angle: 0 },
  { label: "northeast", angle: 45 },
  { label: "east", angle: 90 },
  { label: "southeast", angle: 135 },
  { label: "south", angle: 180 },
  { label: "southwest", angle: 225 },
  { label: "west", angle: 270 },
  { label: "northwest", angle: 315 },
];

function computeShade(visitCount: number): number {
  return Math.round((1 - Math.exp(-SHADE_DECAY_RATE * visitCount)) * 1000) / 1000;
}

function bearingFromTo(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

function nearestCompassLabel(angleDeg: number): string {
  let best = COMPASS_DIRECTIONS[0].label;
  let bestDist = 360;
  for (const dir of COMPASS_DIRECTIONS) {
    let dist = Math.abs(angleDeg - dir.angle);
    if (dist > 180) dist = 360 - dist;
    if (dist < bestDist) {
      bestDist = dist;
      best = dir.label;
    }
  }
  return best;
}

export interface DirectionalGap {
  direction: string;
  angleDeg: number;
  gapWidthDeg: number;
}

export interface CoverageSummary {
  clusters: Array<{
    latitude: number;
    longitude: number;
    visitCount: number;
    shade: number;
    venueCategories: string[];
  }>;
  stats: {
    coveragePct: number;
    territorySqMiles: number;
    avgDensity: number;
    frontierMiles: number;
    clusterCount: number;
  };
  directionalGaps: DirectionalGap[];
  homeLatitude: number | null;
  homeLongitude: number | null;
}

export interface CoverageService {
  upsertCluster(
    userId: string,
    latitude: number,
    longitude: number,
    venueCategory?: string,
  ): Promise<CoverageCluster>;
  getClusters(userId: string): Promise<CoverageCluster[]>;
  getCoverageSummary(userId: string): Promise<CoverageSummary>;
  recomputeSnapshot(userId: string): Promise<CoverageSnapshot>;
  buildLLMCoverageContext(userId: string): Promise<string>;
  isInCoverageGap(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<boolean>;
}

interface CoverageServiceDeps {
  dataSource: DataSource;
}

class CoverageServiceImpl implements CoverageService {
  private dataSource: DataSource;

  constructor(deps: CoverageServiceDeps) {
    this.dataSource = deps.dataSource;
  }

  async upsertCluster(
    userId: string,
    latitude: number,
    longitude: number,
    venueCategory?: string,
  ): Promise<CoverageCluster> {
    const roundedLat = Math.round(latitude * 1000) / 1000;
    const roundedLng = Math.round(longitude * 1000) / 1000;

    // Try to find existing cluster at rounded coordinates
    const existing: CoverageCluster[] = await this.dataSource.query(
      `SELECT * FROM coverage_clusters
       WHERE user_id = $1
         AND round(latitude::numeric, 3) = $2
         AND round(longitude::numeric, 3) = $3
       LIMIT 1`,
      [userId, roundedLat, roundedLng],
    );

    if (existing.length > 0) {
      const row = existing[0] as unknown as Record<string, unknown>;
      const clusterId = (row.id as string);
      const currentVisitCount = Number(row.visit_count ?? 1);
      const newVisitCount = currentVisitCount + 1;
      const newShade = computeShade(newVisitCount);

      // Append venue category if new
      let categoryUpdate = "";
      const params: unknown[] = [newVisitCount, newShade, clusterId];
      if (venueCategory) {
        categoryUpdate = `, venue_categories = CASE
          WHEN $4 = ANY(venue_categories) THEN venue_categories
          ELSE array_append(venue_categories, $4)
        END`;
        params.push(venueCategory);
      }

      await this.dataSource.query(
        `UPDATE coverage_clusters
         SET visit_count = $1,
             shade = $2,
             last_visited_at = now(),
             updated_at = now()
             ${categoryUpdate}
         WHERE id = $3`,
        params,
      );

      return await this.dataSource
        .getRepository(CoverageCluster)
        .findOneOrFail({ where: { id: clusterId } });
    }

    // Create new cluster
    const newShade = computeShade(1);
    const repo = this.dataSource.getRepository(CoverageCluster);
    const cluster = repo.create({
      userId,
      latitude,
      longitude,
      visitCount: 1,
      shade: newShade,
      venueCategories: venueCategory ? [venueCategory] : [],
      lastVisitedAt: new Date(),
    });
    await repo.save(cluster);

    console.log(
      `[Coverage] New cluster for user ${userId} at (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
    );
    return cluster;
  }

  async getClusters(userId: string): Promise<CoverageCluster[]> {
    return this.dataSource.getRepository(CoverageCluster).find({
      where: { userId },
      order: { visitCount: "DESC" },
    });
  }

  async getCoverageSummary(userId: string): Promise<CoverageSummary> {
    // Check for fresh snapshot
    const snapshotRepo = this.dataSource.getRepository(CoverageSnapshot);
    const existing = await snapshotRepo.findOne({ where: { userId } });

    if (
      existing &&
      Date.now() - new Date(existing.computedAt).getTime() < SNAPSHOT_TTL_MS
    ) {
      const clusters = await this.getClusters(userId);
      const user = await this.getHomeAnchor(userId);
      return {
        clusters: clusters.map((c) => ({
          latitude: Number(c.latitude),
          longitude: Number(c.longitude),
          visitCount: Number(c.visitCount),
          shade: Number(c.shade),
          venueCategories: c.venueCategories ?? [],
        })),
        stats: {
          coveragePct: Number(existing.coveragePct),
          territorySqMiles: Number(existing.territorySqMiles),
          avgDensity: Number(existing.avgDensity),
          frontierMiles: Number(existing.frontierMiles),
          clusterCount: Number(existing.clusterCount),
        },
        directionalGaps: (existing.directionalGaps as DirectionalGap[]) ?? [],
        homeLatitude: user.homeLatitude,
        homeLongitude: user.homeLongitude,
      };
    }

    // Recompute
    const snapshot = await this.recomputeSnapshot(userId);
    const clusters = await this.getClusters(userId);
    const user = await this.getHomeAnchor(userId);

    return {
      clusters: clusters.map((c) => ({
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        visitCount: Number(c.visitCount),
        shade: Number(c.shade),
        venueCategories: c.venueCategories ?? [],
      })),
      stats: {
        coveragePct: Number(snapshot.coveragePct),
        territorySqMiles: Number(snapshot.territorySqMiles),
        avgDensity: Number(snapshot.avgDensity),
        frontierMiles: Number(snapshot.frontierMiles),
        clusterCount: Number(snapshot.clusterCount),
      },
      directionalGaps: (snapshot.directionalGaps as DirectionalGap[]) ?? [],
      homeLatitude: user.homeLatitude,
      homeLongitude: user.homeLongitude,
    };
  }

  async recomputeSnapshot(userId: string): Promise<CoverageSnapshot> {
    const clusters = await this.getClusters(userId);
    const user = await this.getHomeAnchor(userId);

    const clusterCount = clusters.length;

    // Compute directional gaps from home
    const directionalGaps = this.computeDirectionalGaps(
      user.homeLatitude,
      user.homeLongitude,
      clusters,
    );

    // Compute average density
    const avgDensity =
      clusterCount > 0
        ? clusters.reduce((sum, c) => sum + Number(c.shade), 0) / clusterCount
        : 0;

    // Compute territory and frontier via PostGIS if enough points
    let territorySqMiles = 0;
    let frontierMiles = 0;
    let coveragePct = 0;
    let cellsGeojson: Record<string, unknown> | undefined;
    let canvasGeojson: Record<string, unknown> | undefined;

    if (clusterCount >= MIN_CLUSTERS_FOR_VORONOI) {
      const spatialResult = await this.computeSpatialMetrics(userId);
      territorySqMiles = spatialResult.territorySqMiles;
      frontierMiles = spatialResult.frontierMiles;
      cellsGeojson = spatialResult.cellsGeojson;
      canvasGeojson = spatialResult.canvasGeojson;

      // Coverage = shade-weighted area / total canvas area
      if (spatialResult.canvasAreaSqMiles > 0) {
        // Approximate: avgDensity * territory / canvas
        coveragePct = Math.min(
          100,
          (avgDensity * territorySqMiles * 100) /
            spatialResult.canvasAreaSqMiles,
        );
      }
    } else if (clusterCount > 0) {
      // Degenerate case: just compute convex hull area
      const hullResult: { area_sq_miles: number }[] =
        await this.dataSource.query(
          `SELECT COALESCE(
            CASE WHEN COUNT(*) < 3 THEN 0
            ELSE ST_Area(
              ST_ConvexHull(
                ST_Collect(
                  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                )::geometry
              )::geography
            ) / 2589988.11
            END, 0
          ) AS area_sq_miles
          FROM coverage_clusters
          WHERE user_id = $1`,
          [userId],
        );
      territorySqMiles = Number(hullResult[0]?.area_sq_miles ?? 0);
    }

    // Upsert snapshot
    const snapshotRepo = this.dataSource.getRepository(CoverageSnapshot);
    const existing = await snapshotRepo.findOne({ where: { userId } });

    // Non-punitive: never shrink territory
    if (existing) {
      territorySqMiles = Math.max(
        Number(existing.territorySqMiles),
        territorySqMiles,
      );
    }

    const snapshotData = {
      userId,
      cellsGeojson: cellsGeojson ?? undefined,
      canvasGeojson: canvasGeojson ?? undefined,
      coveragePct: Math.round(coveragePct * 100) / 100,
      territorySqMiles: Math.round(territorySqMiles * 1000) / 1000,
      avgDensity: Math.round(avgDensity * 1000) / 1000,
      frontierMiles: Math.round(frontierMiles * 1000) / 1000,
      clusterCount,
      directionalGaps,
      computedAt: new Date(),
    };

    if (existing) {
      await snapshotRepo.update({ id: existing.id }, snapshotData as Record<string, unknown>);
      return snapshotRepo.findOneOrFail({ where: { id: existing.id } });
    }

    const snapshot = snapshotRepo.create(snapshotData);
    return await snapshotRepo.save(snapshot);
  }

  async buildLLMCoverageContext(userId: string): Promise<string> {
    const clusters = await this.getClusters(userId);
    if (clusters.length === 0) {
      return "COVERAGE MAP: No exploration data yet. This is their first quest.";
    }

    const user = await this.getHomeAnchor(userId);
    const summary = await this.getCoverageSummary(userId);

    const lines: string[] = [
      `COVERAGE MAP (${summary.stats.clusterCount} explored zones):`,
    ];

    // Territory stats
    if (summary.stats.territorySqMiles > 0) {
      lines.push(
        `- Territory: ${summary.stats.territorySqMiles.toFixed(1)} sq miles covered, ${(summary.stats.avgDensity * 100).toFixed(0)}% avg density`,
      );
    }

    // Hotspots (top 5 most visited)
    const hotspots = clusters
      .slice(0, 5)
      .filter((c) => Number(c.visitCount) > 1);
    if (hotspots.length > 0) {
      const hotspotList = hotspots
        .map(
          (c) =>
            `${(c.venueCategories ?? []).join("/") || "misc"} area (${Number(c.visitCount)} visits, shade ${Number(c.shade).toFixed(2)})`,
        )
        .join(", ");
      lines.push(`- Hotspots: ${hotspotList}`);
    }

    // Directional gaps
    if (summary.directionalGaps.length > 0) {
      const gapDescs = summary.directionalGaps
        .sort((a, b) => b.gapWidthDeg - a.gapWidthDeg)
        .slice(0, 3)
        .map(
          (g) =>
            `${g.direction.toUpperCase()} (${g.gapWidthDeg.toFixed(0)}deg gap)`,
        );
      lines.push(`- Directional gaps: ${gapDescs.join(", ")}`);
      lines.push(
        `- Suggestion: The ${summary.directionalGaps[0].direction} direction is the least explored.`,
      );
    }

    // Under-explored clusters (low shade, only 1 visit)
    const underExplored = clusters.filter((c) => Number(c.visitCount) === 1);
    if (underExplored.length > 0) {
      lines.push(
        `- ${underExplored.length} zone${underExplored.length > 1 ? "s" : ""} visited only once (light coverage)`,
      );
    }

    // Fully saturated clusters
    const saturated = clusters.filter((c) => Number(c.shade) > 0.9);
    if (saturated.length > 0) {
      lines.push(
        `- ${saturated.length} zone${saturated.length > 1 ? "s" : ""} fully explored (diminishing returns on revisits)`,
      );
    }

    return lines.join("\n");
  }

  async isInCoverageGap(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    const user = await this.getHomeAnchor(userId);
    if (user.homeLatitude == null || user.homeLongitude == null) return false;

    const bearing = bearingFromTo(
      user.homeLatitude,
      user.homeLongitude,
      latitude,
      longitude,
    );

    const snapshotRepo = this.dataSource.getRepository(CoverageSnapshot);
    const snapshot = await snapshotRepo.findOne({ where: { userId } });
    if (!snapshot?.directionalGaps) return false;

    const gaps = snapshot.directionalGaps as DirectionalGap[];
    for (const gap of gaps) {
      const gapStart = ((gap.angleDeg - gap.gapWidthDeg / 2) % 360 + 360) % 360;
      const gapEnd = (gap.angleDeg + gap.gapWidthDeg / 2) % 360;

      // Check if bearing falls within this gap
      if (gapStart < gapEnd) {
        if (bearing >= gapStart && bearing <= gapEnd) return true;
      } else {
        // Wraps around 0/360
        if (bearing >= gapStart || bearing <= gapEnd) return true;
      }
    }

    return false;
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async getHomeAnchor(
    userId: string,
  ): Promise<{ homeLatitude: number | null; homeLongitude: number | null }> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "homeLatitude", "homeLongitude"],
    });
    return {
      homeLatitude: user?.homeLatitude ? Number(user.homeLatitude) : null,
      homeLongitude: user?.homeLongitude ? Number(user.homeLongitude) : null,
    };
  }

  private computeDirectionalGaps(
    homeLat: number | null,
    homeLng: number | null,
    clusters: CoverageCluster[],
  ): DirectionalGap[] {
    if (homeLat == null || homeLng == null || clusters.length === 0) return [];

    // Compute bearing from home to each cluster
    const bearings = clusters
      .map((c) =>
        bearingFromTo(homeLat, homeLng, Number(c.latitude), Number(c.longitude)),
      )
      .sort((a, b) => a - b);

    if (bearings.length === 0) return [];

    // Find angular gaps between consecutive bearings
    const gaps: DirectionalGap[] = [];

    for (let i = 0; i < bearings.length; i++) {
      const current = bearings[i];
      const next = bearings[(i + 1) % bearings.length];
      const gapWidth =
        i === bearings.length - 1
          ? 360 - current + next // Wrap around
          : next - current;

      if (gapWidth >= GAP_THRESHOLD_DEG) {
        const midAngle = (current + gapWidth / 2) % 360;
        gaps.push({
          direction: nearestCompassLabel(midAngle),
          angleDeg: Math.round(midAngle * 10) / 10,
          gapWidthDeg: Math.round(gapWidth * 10) / 10,
        });
      }
    }

    return gaps.sort((a, b) => b.gapWidthDeg - a.gapWidthDeg);
  }

  private async computeSpatialMetrics(userId: string): Promise<{
    territorySqMiles: number;
    frontierMiles: number;
    canvasAreaSqMiles: number;
    cellsGeojson: Record<string, unknown> | undefined;
    canvasGeojson: Record<string, unknown> | undefined;
  }> {
    // Compute Voronoi cells clipped to buffered convex hull, plus area/perimeter
    const result: {
      territory_sq_miles: number;
      frontier_miles: number;
      canvas_area_sq_miles: number;
      cells_geojson: Record<string, unknown> | null;
      canvas_geojson: Record<string, unknown> | null;
    }[] = await this.dataSource.query(
      `WITH points AS (
        SELECT
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geom,
          id, shade, visit_count
        FROM coverage_clusters
        WHERE user_id = $1
      ),
      collected AS (
        SELECT ST_Collect(geom) AS geom_collection FROM points
      ),
      hull AS (
        SELECT ST_Buffer(
          ST_ConvexHull(geom_collection)::geography,
          $2
        )::geometry AS canvas
        FROM collected
      ),
      voronoi AS (
        SELECT ST_VoronoiPolygons(geom_collection, 0.0, canvas) AS vor_collection
        FROM collected, hull
      ),
      voronoi_cells AS (
        SELECT (ST_Dump(vor_collection)).geom AS cell
        FROM voronoi
      ),
      clipped_cells AS (
        SELECT ST_Intersection(vc.cell, h.canvas) AS cell
        FROM voronoi_cells vc, hull h
      )
      SELECT
        COALESCE(ST_Area(ST_Union(cc.cell)::geography) / 2589988.11, 0) AS territory_sq_miles,
        COALESCE(ST_Perimeter(ST_Union(cc.cell)::geography) / 1609.344, 0) AS frontier_miles,
        COALESCE(ST_Area(h.canvas::geography) / 2589988.11, 0) AS canvas_area_sq_miles,
        ST_AsGeoJSON(ST_Collect(cc.cell))::jsonb AS cells_geojson,
        ST_AsGeoJSON(h.canvas)::jsonb AS canvas_geojson
      FROM clipped_cells cc, hull h
      GROUP BY h.canvas`,
      [userId, BUFFER_METERS],
    );

    if (!result.length || !result[0]) {
      return {
        territorySqMiles: 0,
        frontierMiles: 0,
        canvasAreaSqMiles: 0,
        cellsGeojson: undefined,
        canvasGeojson: undefined,
      };
    }

    return {
      territorySqMiles: Number(result[0].territory_sq_miles),
      frontierMiles: Number(result[0].frontier_miles),
      canvasAreaSqMiles: Number(result[0].canvas_area_sq_miles),
      cellsGeojson: result[0].cells_geojson ?? undefined,
      canvasGeojson: result[0].canvas_geojson ?? undefined,
    };
  }
}

export function createCoverageService(
  deps: CoverageServiceDeps,
): CoverageService {
  return new CoverageServiceImpl(deps);
}
