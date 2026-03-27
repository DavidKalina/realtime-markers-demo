import { DataSource } from "typeorm";
import pgvector from "pgvector";
import ngeohash from "ngeohash";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DBSCAN = require("density-clustering").DBSCAN;
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";

// --- Types ---

export interface DistrictServiceDependencies {
  dataSource: DataSource;
  embeddingService: IEmbeddingService;
  openAIService: OpenAIService;
  redisService: RedisService;
}

export interface BrowseSidequest {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  entryLatitude: number | null;
  entryLongitude: number | null;
  rating: number | null;
  timesAdopted: number;
  itemCount: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: {
    emoji: string | null;
    title: string;
    venueName: string | null;
    latitude: number | null;
    longitude: number | null;
  }[];
}

export interface DistrictMomentum {
  momentum: "rising" | "steady" | "cooling";
  weeklyNewSidequests: number;
  weeklyAdoptions: number;
  uniqueExplorers: number;
  history: { itineraryCount: number; computedAt: string }[];
}

export interface DistrictBrowseResult {
  id: string;
  name: string;
  description: string | null;
  centroidLat: number;
  centroidLng: number;
  sidequestCount: number;
  avgRating: number | null;
  totalAdoptions: number;
  activityTags: string[];
  distanceMiles: number;
  previewSidequests: BrowseSidequest[];
  momentum: DistrictMomentum | null;
}

export interface ActivityDnaEntry {
  activity: string;
  pct: number;
}

export interface ActivityDayEntry {
  date: string;
  count: number;
}

export interface DistrictDetailResult {
  district: {
    id: string;
    name: string;
    description: string | null;
    centroidLat: number;
    centroidLng: number;
    sidequestCount: number;
    avgRating: number | null;
    totalAdoptions: number;
    activityTags: string[];
    momentum: DistrictMomentum | null;
    vitalityScore: number;
  };
  sidequests: BrowseSidequest[];
  nextCursor: string | null;
  activityDna: ActivityDnaEntry[];
  activityHeatmap: ActivityDayEntry[];
  bestMatch: BrowseSidequest | null;
}

export interface CoverageResult {
  total: number;
  explored: number;
  districts: {
    id: string;
    name: string;
    explored: boolean;
    completedCount: number;
  }[];
}

interface SidequestRow {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  embedding: string;
  entry_latitude: number;
  entry_longitude: number;
  activity_types: string[];
  categories: string[];
  rating: number | null;
  times_adopted: number;
}

// --- Constants ---

const GEOHASH_PRECISION = 4;
const DBSCAN_EPSILON = parseFloat(process.env.DBSCAN_EPSILON || "0.18");
const DBSCAN_MIN_POINTS = parseInt(process.env.DBSCAN_MIN_POINTS || "6");
const CENTROID_MATCH_THRESHOLD = parseFloat(
  process.env.DISTRICT_MATCH_THRESHOLD || "0.85",
);
const GEO_WEIGHT = parseFloat(process.env.DISTRICT_GEO_WEIGHT || "0.4");
const GEO_MAX_METERS = 5000; // distances beyond 5km are clamped to 1.0
const DEBOUNCE_TTL_SECONDS = 3600;
const PREVIEW_COUNT = 6;

// --- Service ---

export class DistrictService {
  private dataSource: DataSource;
  private embeddingService: IEmbeddingService;
  private openAIService: OpenAIService;
  private redisService: RedisService;

  constructor(deps: DistrictServiceDependencies) {
    this.dataSource = deps.dataSource;
    this.embeddingService = deps.embeddingService;
    this.openAIService = deps.openAIService;
    this.redisService = deps.redisService;
  }

  // ───── Clustering ─────

  async clusterRegion(geohash: string): Promise<void> {
    const debounceKey = `district:debounce:${geohash}`;
    const debounced = await this.redisService.get<string>(debounceKey);
    if (debounced) {
      console.log(
        `[DistrictService] Skipping cluster for ${geohash} (debounced)`,
      );
      return;
    }

    // Get geohash cell + 8 neighbors, compute bounding box
    const neighbors = ngeohash.neighbors(geohash);
    const cells = [geohash, ...Object.values(neighbors)];
    const bbox = geohashCellsBoundingBox(cells);

    const sidequests: SidequestRow[] = await this.dataSource.query(
      `SELECT
        s.id, s.title, s.summary, s.city, s.intention,
        s.embedding, s.entry_latitude, s.entry_longitude,
        s.activity_types, s.categories, s.rating, s.times_adopted
      FROM sidequests s
      WHERE s.status = 'READY'
        AND s.is_published = true
        AND s.completed_at IS NOT NULL
        AND s.entry_latitude IS NOT NULL
        AND s.entry_longitude IS NOT NULL
        AND s.deleted_at IS NULL
        AND s.entry_latitude BETWEEN $1 AND $2
        AND s.entry_longitude BETWEEN $3 AND $4`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
    );

    // Filter to only sidequests with embeddings
    const embeddable = sidequests.filter((sq) => sq.embedding);

    if (embeddable.length < DBSCAN_MIN_POINTS) {
      console.log(
        `[DistrictService] Only ${embeddable.length} embeddable sidequests (${sidequests.length} total) in region ${geohash}, skipping`,
      );
      return;
    }

    // Only debounce after confirming we have sidequests to cluster
    await this.redisService.set(debounceKey, "1", DEBOUNCE_TTL_SECONDS);

    // Parse embeddings
    const embeddings = embeddable.map((sq) =>
      this.embeddingService.parseSqlEmbedding(sq.embedding),
    );

    // Build index-based dataset for DBSCAN so the distance function
    // can access both embeddings and coordinates for each point.
    const indices = embeddable.map((_, i) => [i]);

    // Run DBSCAN with hybrid distance: thematic (cosine) + geographic
    const dbscan = new DBSCAN();
    const clusters: number[][] = dbscan.run(
      indices,
      DBSCAN_EPSILON,
      DBSCAN_MIN_POINTS,
      (a: number[], b: number[]) => {
        const i = a[0];
        const j = b[0];

        // Thematic distance: cosine distance on embeddings
        const cosineDist =
          1 - this.embeddingService.calculateSimilarity(embeddings[i], embeddings[j]);

        // Geographic distance: haversine normalized to [0, 1]
        const meters = haversineMeters(
          Number(embeddable[i].entry_latitude),
          Number(embeddable[i].entry_longitude),
          Number(embeddable[j].entry_latitude),
          Number(embeddable[j].entry_longitude),
        );
        const geoDist = Math.min(meters / GEO_MAX_METERS, 1);

        // Blend: primarily thematic, with geographic penalty
        return (1 - GEO_WEIGHT) * cosineDist + GEO_WEIGHT * geoDist;
      },
    );

    // Load existing active districts in this region
    const existingDistricts: {
      id: string;
      name: string;
      description: string;
      embedding_centroid: string;
      activity_tags: string[];
    }[] = await this.dataSource.query(
      `SELECT id, name, description, embedding_centroid, activity_tags
       FROM districts
       WHERE centroid_lat BETWEEN $1 AND $2
         AND centroid_lng BETWEEN $3 AND $4
         AND status = 'active'`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
    );

    const matchedDistrictIds = new Set<string>();

    for (const clusterIndices of clusters) {
      const memberSidequests = clusterIndices.map((i) => embeddable[i]);
      const memberEmbeddings = clusterIndices.map((i) => embeddings[i]);

      // Compute centroid embedding (element-wise mean)
      const centroidEmbedding = this.computeCentroid(memberEmbeddings);
      const centroidLat =
        memberSidequests.reduce((s, sq) => s + Number(sq.entry_latitude), 0) /
        memberSidequests.length;
      const centroidLng =
        memberSidequests.reduce((s, sq) => s + Number(sq.entry_longitude), 0) /
        memberSidequests.length;
      const clusterGeohash = ngeohash.encode(
        centroidLat,
        centroidLng,
        GEOHASH_PRECISION,
      );

      // Try to match against existing district
      let matchedDistrict: {
        id: string;
        name: string;
        description: string;
        activity_tags: string[];
      } | null = null;
      let bestSimilarity = 0;

      for (const existing of existingDistricts) {
        if (!existing.embedding_centroid) continue;
        const existingCentroid = this.embeddingService.parseSqlEmbedding(
          existing.embedding_centroid,
        );
        const similarity = this.embeddingService.calculateSimilarity(
          centroidEmbedding,
          existingCentroid,
        );
        if (
          similarity >= CENTROID_MATCH_THRESHOLD &&
          similarity > bestSimilarity
        ) {
          bestSimilarity = similarity;
          matchedDistrict = existing;
        }
      }

      // Compute aggregated stats
      const activityTags = this.aggregateActivityTags(memberSidequests);
      const avgRating = this.computeAvgRating(memberSidequests);
      const totalAdoptions = memberSidequests.reduce(
        (s, sq) => s + Number(sq.times_adopted),
        0,
      );
      const centroidSql = pgvector.toSql(centroidEmbedding);

      if (matchedDistrict) {
        // Update existing district
        matchedDistrictIds.add(matchedDistrict.id);

        // Re-name if the activity composition has shifted significantly
        const oldTags = new Set(matchedDistrict.activity_tags || []);
        const newTags = new Set(activityTags);
        const overlap = activityTags.filter((t) => oldTags.has(t)).length;
        const maxTags = Math.max(oldTags.size, newTags.size, 1);
        const shouldRename = overlap / maxTags < 0.5;

        let nameUpdate = "";
        const params: unknown[] = [
          centroidLat,
          centroidLng,
          centroidSql,
          activityTags,
          avgRating,
          totalAdoptions,
          clusterGeohash,
          matchedDistrict.id,
        ];

        if (shouldRename) {
          const { name, description } =
            await this.nameDistrict(memberSidequests);
          nameUpdate = ", name = $9, description = $10";
          params.push(name, description);
          console.log(
            `[DistrictService] Renamed district "${matchedDistrict.name}" → "${name}"`,
          );
        }

        await this.dataSource.query(
          `UPDATE districts SET
            centroid_lat = $1, centroid_lng = $2,
            embedding_centroid = $3, activity_tags = $4,
            avg_rating = $5,
            total_adoptions = $6, geohash = $7,
            last_clustered_at = NOW(), updated_at = NOW()
            ${nameUpdate}
          WHERE id = $8`,
          params,
        );

        console.log(
          `[DistrictService] Updated district "${matchedDistrict.name}" with ${memberSidequests.length} sidequests`,
        );
      } else {
        // Create new district
        const { name, description } =
          await this.nameDistrict(memberSidequests);

        await this.dataSource.query(
          `INSERT INTO districts
            (name, description, geohash, centroid_lat, centroid_lng,
             embedding_centroid, activity_tags,
             avg_rating, total_adoptions, last_clustered_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING id`,
          [
            name,
            description,
            clusterGeohash,
            centroidLat,
            centroidLng,
            centroidSql,
            activityTags,
            avgRating,
            totalAdoptions,
          ],
        );

        console.log(
          `[DistrictService] Created district "${name}" with ${memberSidequests.length} sidequests`,
        );
      }
    }

    // Archive orphaned districts
    const orphanedIds = existingDistricts
      .filter((d) => !matchedDistrictIds.has(d.id))
      .map((d) => d.id);

    if (orphanedIds.length > 0) {
      const orphanPlaceholders = orphanedIds
        .map((_, i) => `$${i + 1}`)
        .join(", ");
      await this.dataSource.query(
        `UPDATE districts SET status = 'archived', updated_at = NOW()
         WHERE id IN (${orphanPlaceholders})`,
        orphanedIds,
      );
      console.log(
        `[DistrictService] Archived ${orphanedIds.length} orphaned districts`,
      );
    }

    console.log(
      `[DistrictService] Clustered region ${geohash}: ${clusters.length} clusters from ${embeddable.length} sidequests`,
    );
  }

  async clusterAllRegions(): Promise<void> {
    const coords: { entry_latitude: number; entry_longitude: number }[] =
      await this.dataSource.query(
        `SELECT DISTINCT entry_latitude, entry_longitude
         FROM sidequests
         WHERE status = 'READY'
           AND embedding IS NOT NULL
           AND entry_latitude IS NOT NULL
           AND deleted_at IS NULL`,
      );

    const geohashSet = new Set<string>();
    for (const c of coords) {
      geohashSet.add(
        ngeohash.encode(
          Number(c.entry_latitude),
          Number(c.entry_longitude),
          GEOHASH_PRECISION,
        ),
      );
    }
    const rows = [...geohashSet].map((gh) => ({ gh }));

    console.log(`[DistrictService] Clustering ${rows.length} geohash regions`);

    for (const { gh } of rows) {
      try {
        await this.clusterRegion(gh);
      } catch (err) {
        console.error(`[DistrictService] Failed to cluster region ${gh}:`, err);
      }
    }
  }

  // ───── Browse / Query ─────

  async browseDistricts(
    lat: number,
    lng: number,
    radiusMiles: number = 25,
  ): Promise<DistrictBrowseResult[]> {
    const userGeohash = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
    const neighborCells = ngeohash.neighbors(userGeohash);
    const cells = [userGeohash, ...Object.values(neighborCells)];
    const bbox = geohashCellsBoundingBox(cells);

    const districts: {
      id: string;
      name: string;
      description: string | null;
      centroid_lat: number;
      centroid_lng: number;
      avg_rating: number;
      total_adoptions: number;
      activity_tags: string[];
    }[] = await this.dataSource.query(
      `SELECT id, name, description, centroid_lat, centroid_lng,
              avg_rating, total_adoptions, activity_tags
       FROM districts
       WHERE centroid_lat BETWEEN $1 AND $2
         AND centroid_lng BETWEEN $3 AND $4
         AND status = 'active'
       ORDER BY total_adoptions DESC`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
    );

    const radiusMeters = radiusMiles * 1609.34;
    const results: DistrictBrowseResult[] = [];

    for (const d of districts) {
      const distMeters = haversineMeters(
        lat,
        lng,
        Number(d.centroid_lat),
        Number(d.centroid_lng),
      );
      if (distMeters > radiusMeters) continue;

      // Load preview sidequests + momentum
      const [previews, momentum] = await Promise.all([
        this.loadPreviewSidequests(d.id, PREVIEW_COUNT),
        this.getDistrictMomentum(d.id),
      ]);

      const sidequestCount = previews.length;

      results.push({
        id: d.id,
        name: d.name,
        description: d.description,
        centroidLat: Number(d.centroid_lat),
        centroidLng: Number(d.centroid_lng),
        sidequestCount,
        avgRating: Number(d.avg_rating) || null,
        totalAdoptions: d.total_adoptions,
        activityTags: d.activity_tags || [],
        distanceMiles: distMeters / 1609.34,
        previewSidequests: previews,
        momentum,
      });
    }

    // Sort by sidequest count descending, cap at 15
    results.sort((a, b) => b.sidequestCount - a.sidequestCount);

    return results.slice(0, 15);
  }

  async getDistrictDetail(
    districtId: string,
    sort: string = "popular",
    limit: number = 20,
    cursor?: string,
    userId?: string,
  ): Promise<DistrictDetailResult> {
    const [district] = await this.dataSource.query(
      `SELECT id, name, description, centroid_lat, centroid_lng,
              avg_rating, total_adoptions, activity_tags
       FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) {
      throw new Error("District not found");
    }

    // TODO: Without the district_itineraries junction table, we query sidequests
    // by proximity to the district centroid. This is a simplified approach.
    let orderClause: string;
    switch (sort) {
      case "recent":
        orderClause = "s.created_at DESC, s.id DESC";
        break;
      case "top_rated":
        orderClause =
          "COALESCE(s.rating, 0) DESC, s.created_at DESC, s.id DESC";
        break;
      case "popular":
      default:
        orderClause =
          "(s.times_adopted * 2 + COALESCE(s.rating, 0)) DESC, s.created_at DESC, s.id DESC";
        break;
    }

    let cursorClause = "";
    const proximityRadiusKm = 5;
    const params: unknown[] = [
      Number(district.centroid_lat),
      Number(district.centroid_lng),
      proximityRadiusKm * 1000,
      limit + 1,
    ];

    if (cursor) {
      const [cursorDate, cursorId] = cursor.split("|");
      cursorClause = `AND (s.completed_at < $5 OR (s.completed_at = $5 AND s.id < $6))`;
      params.push(cursorDate, cursorId);
    }

    const rows = await this.dataSource.query(
      `SELECT
        s.id, s.title, s.summary, s.city, s.intention,
        s.entry_latitude, s.entry_longitude,
        s.rating, s.times_adopted,
        s.completed_at, u.first_name AS creator_first_name,
        (SELECT COUNT(*) FROM objectives o WHERE o.sidequest_id = s.id) AS item_count
      FROM sidequests s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'READY'
        AND s.is_published = true
        AND s.deleted_at IS NULL
        AND s.entry_latitude IS NOT NULL
        AND s.entry_longitude IS NOT NULL
        AND (
          6371000 * acos(
            cos(radians($1)) * cos(radians(s.entry_latitude))
            * cos(radians(s.entry_longitude) - radians($2))
            + sin(radians($1)) * sin(radians(s.entry_latitude))
          )
        ) <= $3
        ${cursorClause}
      ORDER BY ${orderClause}
      LIMIT $4`,
      params,
    );

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const sidequests = await this.batchLoadBrowseSidequests(resultRows);

    const lastRow = resultRows[resultRows.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? `${lastRow.completed_at?.toISOString?.() || lastRow.completed_at}|${lastRow.id}`
        : null;

    const [momentum, activityDna, activityHeatmap, bestMatch] =
      await Promise.all([
        this.getDistrictMomentum(districtId),
        this.getDistrictActivityDna(districtId),
        this.getDistrictActivityHeatmap(districtId),
        this.getBestMatch(districtId, userId),
      ]);

    const vitalityScore = computeVitalityScore({
      sidequestCount: sidequests.length,
      avgRating: Number(district.avg_rating) || 0,
      totalAdoptions: district.total_adoptions,
      varietyCount: new Set(activityDna.map((d) => d.activity)).size,
      momentum,
    });

    return {
      district: {
        id: district.id,
        name: district.name,
        description: district.description,
        centroidLat: Number(district.centroid_lat),
        centroidLng: Number(district.centroid_lng),
        sidequestCount: sidequests.length,
        avgRating: Number(district.avg_rating) || null,
        totalAdoptions: district.total_adoptions,
        activityTags: district.activity_tags || [],
        momentum,
        vitalityScore,
      },
      sidequests,
      nextCursor,
      activityDna,
      activityHeatmap,
      bestMatch,
    };
  }

  async getPersonalCoverage(
    userId: string,
    lat: number,
    lng: number,
    radiusMiles: number = 25,
  ): Promise<CoverageResult> {
    const userGeohash = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
    const neighborCells = ngeohash.neighbors(userGeohash);
    const cells = [userGeohash, ...Object.values(neighborCells)];
    const bbox = geohashCellsBoundingBox(cells);

    const districts: {
      id: string;
      name: string;
      centroid_lat: number;
      centroid_lng: number;
    }[] = await this.dataSource.query(
      `SELECT id, name, centroid_lat, centroid_lng
       FROM districts
       WHERE centroid_lat BETWEEN $1 AND $2
         AND centroid_lng BETWEEN $3 AND $4
         AND status = 'active'`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
    );

    const radiusMeters = radiusMiles * 1609.34;
    const nearbyDistricts = districts.filter(
      (d) =>
        haversineMeters(
          lat,
          lng,
          Number(d.centroid_lat),
          Number(d.centroid_lng),
        ) <= radiusMeters,
    );

    if (nearbyDistricts.length === 0) {
      return { total: 0, explored: 0, districts: [] };
    }

    // Check which districts user has completed sidequests near (by proximity to centroid)
    // TODO: Without junction table, we approximate by checking if user has completed
    // sidequests within proximity of each district centroid
    const exploredMap = new Map<string, number>();
    for (const d of nearbyDistricts) {
      const [result] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count
         FROM sidequests s
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND s.entry_latitude IS NOT NULL
           AND s.entry_longitude IS NOT NULL
           AND (
             6371000 * acos(
               cos(radians($2)) * cos(radians(s.entry_latitude))
               * cos(radians(s.entry_longitude) - radians($3))
               + sin(radians($2)) * sin(radians(s.entry_latitude))
             )
           ) <= 5000`,
        [userId, Number(d.centroid_lat), Number(d.centroid_lng)],
      );
      if (result.count > 0) {
        exploredMap.set(d.id, result.count);
      }
    }

    return {
      total: nearbyDistricts.length,
      explored: exploredMap.size,
      districts: nearbyDistricts.map((d) => ({
        id: d.id,
        name: d.name,
        explored: exploredMap.has(d.id),
        completedCount: exploredMap.get(d.id) ?? 0,
      })),
    };
  }

  // ───── Helpers ─────

  private async nameDistrict(
    members: SidequestRow[],
  ): Promise<{ name: string; description: string }> {
    const allActivityTypes = [
      ...new Set(members.flatMap((m) => m.activity_types || [])),
    ];
    const allCategories = [
      ...new Set(members.flatMap((m) => m.categories || [])),
    ];
    const sampleTitles = members
      .slice(0, 5)
      .map((m) => m.title)
      .filter(Boolean);
    const cities = [...new Set(members.map((m) => m.city))];

    const prompt = `You are naming a quest district for a sidequest app. Each district is a zone on the quest board — a cluster of similar sidequests grouped by vibe and theme.

Activity types: ${allActivityTypes.join(", ")}
Category tags: ${allCategories.join(", ")}
Sample sidequest titles: ${sampleTitles.join("; ")}
Cities represented: ${cities.join(", ")}

Create a creative, memorable 2-4 word district name and a one-sentence description (under 80 chars). The name MUST incorporate the dominant activity — make it obvious what kind of sidequests live here. Think RPG zone names that tell you what you'll be doing.

Good examples: "Shred City" (boarding), "Brew Halls" (coffee/beer), "Trail Trials" (hiking), "Canvas Quarter" (art), "The Noodle Mile" (food), "Iron Yard" (fitness), "Vinyl Row" (music), "Night Owl Circuit" (nightlife)
Bad examples: "Sunset Escapades" (too vague), "Outdoor Fun District" (generic), "Mixed Activities Zone" (boring), "The Grind Path" (unclear activity)

Respond with ONLY valid JSON: {"name": "...", "description": "..."}`;

    try {
      const completion = await this.openAIService.executeChatCompletion(
        {
          model: OpenAIModel.GPT4OMini,
          messages: [
            {
              role: "system",
              content:
                "You generate creative district names for a sidequest app. Names must incorporate the dominant activity so it's obvious what kind of quests live there (e.g. 'Brew Halls' for coffee, 'Shred City' for boarding). Respond with ONLY valid JSON, no markdown fences.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 150,
          response_format: { type: "json_object" },
        },
        "district-naming",
      );

      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || "Unnamed District",
        description: parsed.description || null,
      };
    } catch (err) {
      console.error(
        "[DistrictService] Failed to name district:",
        err instanceof Error ? err.message : err,
        "| activities:",
        allActivityTypes.join(", "),
        "| titles:",
        sampleTitles.join("; "),
      );
      // Fallback: use top activity types
      const fallbackName =
        allActivityTypes.slice(0, 2).join(" & ") || "New District";
      return { name: fallbackName, description: null };
    }
  }

  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      centroid[i] /= embeddings.length;
    }
    return centroid;
  }

  private aggregateActivityTags(members: SidequestRow[]): string[] {
    const counts = new Map<string, number>();
    for (const m of members) {
      for (const tag of m.activity_types || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }

  private computeAvgRating(members: SidequestRow[]): number {
    const rated = members.filter((m) => m.rating != null);
    if (rated.length === 0) return 0;
    return rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length;
  }

  private async batchLoadBrowseSidequests(
    rows: Record<string, unknown>[],
  ): Promise<BrowseSidequest[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id as string);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

    // Single query: top 3 objectives per sidequest using LATERAL join
    const itemRows: {
      sidequest_id: string;
      emoji: string | null;
      title: string;
      venue_name: string | null;
      latitude: string | null;
      longitude: string | null;
    }[] = await this.dataSource.query(
      `SELECT sub.sidequest_id, sub.emoji, sub.title, sub.venue_name, sub.latitude, sub.longitude
       FROM unnest(ARRAY[${placeholders}]::uuid[]) WITH ORDINALITY AS t(id, ord)
       CROSS JOIN LATERAL (
         SELECT o.sidequest_id, o.emoji, o.title, o.venue_name, o.sort_order, o.latitude, o.longitude
         FROM objectives o
         WHERE o.sidequest_id = t.id
         ORDER BY o.sort_order ASC
         LIMIT 3
       ) sub
       ORDER BY t.ord, sub.sort_order`,
      ids,
    );

    // Group items by sidequest id
    const itemsBySidequest = new Map<
      string,
      {
        emoji: string | null;
        title: string;
        venueName: string | null;
        latitude: number | null;
        longitude: number | null;
      }[]
    >();
    for (const item of itemRows) {
      let list = itemsBySidequest.get(item.sidequest_id);
      if (!list) {
        list = [];
        itemsBySidequest.set(item.sidequest_id, list);
      }
      list.push({
        emoji: item.emoji,
        title: item.title,
        venueName: item.venue_name,
        latitude: item.latitude ? Number(item.latitude) : null,
        longitude: item.longitude ? Number(item.longitude) : null,
      });
    }

    return rows.map((row) => ({
      id: row.id as string,
      title: row.title as string | null,
      summary: row.summary as string | null,
      city: row.city as string,
      intention: row.intention as string | null,
      entryLatitude: row.entry_latitude ? Number(row.entry_latitude) : null,
      entryLongitude: row.entry_longitude ? Number(row.entry_longitude) : null,
      rating: row.rating ? Number(row.rating) : null,
      timesAdopted: Number(row.times_adopted),
      itemCount: Number(row.item_count),
      creatorFirstName: row.creator_first_name as string | null,
      completedAt:
        (row.completed_at as Date)?.toISOString?.() ||
        (row.completed_at as string),
      items: itemsBySidequest.get(row.id as string) || [],
    }));
  }

  private async loadPreviewSidequests(
    districtId: string,
    count: number,
  ): Promise<BrowseSidequest[]> {
    // Query sidequests by proximity to district centroid since junction table is removed
    const [district] = await this.dataSource.query(
      `SELECT centroid_lat, centroid_lng FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) return [];

    const rows = await this.dataSource.query(
      `SELECT
        s.id, s.title, s.summary, s.city, s.intention,
        s.entry_latitude, s.entry_longitude,
        s.rating, s.times_adopted,
        s.completed_at, u.first_name AS creator_first_name,
        (SELECT COUNT(*) FROM objectives o WHERE o.sidequest_id = s.id) AS item_count
      FROM sidequests s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'READY'
        AND s.is_published = true
        AND s.deleted_at IS NULL
        AND s.entry_latitude IS NOT NULL
        AND s.entry_longitude IS NOT NULL
        AND (
          6371000 * acos(
            cos(radians($1)) * cos(radians(s.entry_latitude))
            * cos(radians(s.entry_longitude) - radians($2))
            + sin(radians($1)) * sin(radians(s.entry_latitude))
          )
        ) <= 5000
      ORDER BY (s.times_adopted * 2 + COALESCE(s.rating, 0)) DESC
      LIMIT $3`,
      [Number(district.centroid_lat), Number(district.centroid_lng), count],
    );

    return this.batchLoadBrowseSidequests(rows);
  }

  // ───── Best Match ─────

  private async getBestMatch(
    districtId: string,
    userId?: string,
  ): Promise<BrowseSidequest | null> {
    if (!userId) return null;

    // Get user's preference embedding
    const [user] = await this.dataSource.query(
      `SELECT preference_embedding FROM users WHERE id = $1`,
      [userId],
    );

    if (!user?.preference_embedding) return null;

    // Get district centroid for proximity filter
    const [district] = await this.dataSource.query(
      `SELECT centroid_lat, centroid_lng FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) return null;

    // Find the sidequest near this district with highest embedding similarity
    const rows = await this.dataSource.query(
      `SELECT
        s.id, s.title, s.summary, s.city, s.intention,
        s.entry_latitude, s.entry_longitude,
        s.rating, s.times_adopted,
        s.completed_at, u.first_name AS creator_first_name,
        (SELECT COUNT(*) FROM objectives o WHERE o.sidequest_id = s.id) AS item_count,
        1 - (s.embedding::vector <=> $3::vector) AS similarity
      FROM sidequests s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'READY'
        AND s.is_published = true
        AND s.deleted_at IS NULL
        AND s.embedding IS NOT NULL
        AND s.entry_latitude IS NOT NULL
        AND s.entry_longitude IS NOT NULL
        AND (
          6371000 * acos(
            cos(radians($1)) * cos(radians(s.entry_latitude))
            * cos(radians(s.entry_longitude) - radians($2))
            + sin(radians($1)) * sin(radians(s.entry_latitude))
          )
        ) <= 5000
      ORDER BY s.embedding::vector <=> $3::vector ASC
      LIMIT 1`,
      [Number(district.centroid_lat), Number(district.centroid_lng), user.preference_embedding],
    );

    if (rows.length === 0) return null;

    const [result] = await this.batchLoadBrowseSidequests([rows[0]]);
    return result ?? null;
  }

  // ───── District Analytics ─────

  private async getDistrictActivityDna(
    districtId: string,
  ): Promise<ActivityDnaEntry[]> {
    // Get district centroid for proximity filter
    const [district] = await this.dataSource.query(
      `SELECT centroid_lat, centroid_lng FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) return [];

    // Unnest activity_types from all sidequests near the district centroid
    const rows: { activity: string; count: number }[] =
      await this.dataSource.query(
        `SELECT unnest(s.activity_types) AS activity, COUNT(*)::int AS count
         FROM sidequests s
         WHERE s.status = 'READY'
           AND s.deleted_at IS NULL
           AND s.activity_types IS NOT NULL
           AND s.entry_latitude IS NOT NULL
           AND s.entry_longitude IS NOT NULL
           AND (
             6371000 * acos(
               cos(radians($1)) * cos(radians(s.entry_latitude))
               * cos(radians(s.entry_longitude) - radians($2))
               + sin(radians($1)) * sin(radians(s.entry_latitude))
             )
           ) <= 5000
         GROUP BY activity
         ORDER BY count DESC
         LIMIT 10`,
        [Number(district.centroid_lat), Number(district.centroid_lng)],
      );

    if (rows.length === 0) return [];

    const total = rows.reduce((s, r) => s + r.count, 0);
    return rows.map((r) => ({
      activity: r.activity,
      pct: Math.round((r.count / total) * 100),
    }));
  }

  private async getDistrictActivityHeatmap(
    districtId: string,
  ): Promise<ActivityDayEntry[]> {
    // Get district centroid for proximity filter
    const [district] = await this.dataSource.query(
      `SELECT centroid_lat, centroid_lng FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) return [];

    // Count sidequest activity per day over the last 16 weeks (~112 days)
    const rows: { date: string; count: number }[] = await this.dataSource.query(
      `SELECT TO_CHAR(s.created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
         FROM sidequests s
         WHERE s.status = 'READY'
           AND s.deleted_at IS NULL
           AND s.created_at >= NOW() - INTERVAL '112 days'
           AND s.entry_latitude IS NOT NULL
           AND s.entry_longitude IS NOT NULL
           AND (
             6371000 * acos(
               cos(radians($1)) * cos(radians(s.entry_latitude))
               * cos(radians(s.entry_longitude) - radians($2))
               + sin(radians($1)) * sin(radians(s.entry_latitude))
             )
           ) <= 5000
         GROUP BY TO_CHAR(s.created_at, 'YYYY-MM-DD')
         ORDER BY date ASC`,
      [Number(district.centroid_lat), Number(district.centroid_lng)],
    );

    return rows.map((r) => ({ date: r.date, count: r.count }));
  }

  // ───── Snapshots ─────

  async computeAllSnapshots(): Promise<void> {
    const districts: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM districts WHERE status = 'active'`,
    );

    console.log(
      `[DistrictService] Computing snapshots for ${districts.length} districts`,
    );

    for (const { id } of districts) {
      try {
        await this.computeSnapshot(id);
      } catch (err) {
        console.error(
          `[DistrictService] Failed to compute snapshot for ${id}:`,
          err,
        );
      }
    }

    // Cleanup old snapshots (keep last 30 per district)
    await this.dataSource.query(`
      DELETE FROM district_snapshots ds
      WHERE ds.id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY district_id ORDER BY computed_at DESC
          ) AS rn
          FROM district_snapshots
        ) ranked
        WHERE ranked.rn <= 30
      )
    `);
  }

  private async computeSnapshot(districtId: string): Promise<void> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get district centroid for proximity-based counting
    const [district] = await this.dataSource.query(
      `SELECT centroid_lat, centroid_lng FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) return;

    const centroidLat = Number(district.centroid_lat);
    const centroidLng = Number(district.centroid_lng);

    // Current sidequest count (by proximity)
    const [{ count: sidequestCount }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM sidequests s
       WHERE s.status = 'READY'
         AND s.deleted_at IS NULL
         AND s.entry_latitude IS NOT NULL
         AND s.entry_longitude IS NOT NULL
         AND (
           6371000 * acos(
             cos(radians($1)) * cos(radians(s.entry_latitude))
             * cos(radians(s.entry_longitude) - radians($2))
             + sin(radians($1)) * sin(radians(s.entry_latitude))
           )
         ) <= 5000`,
      [centroidLat, centroidLng],
    );

    // Unique explorers (users with completed sidequests near this district)
    const [{ count: uniqueExplorers }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT s.user_id)::int AS count
       FROM sidequests s
       WHERE s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND s.entry_latitude IS NOT NULL
         AND s.entry_longitude IS NOT NULL
         AND (
           6371000 * acos(
             cos(radians($1)) * cos(radians(s.entry_latitude))
             * cos(radians(s.entry_longitude) - radians($2))
             + sin(radians($1)) * sin(radians(s.entry_latitude))
           )
         ) <= 5000`,
      [centroidLat, centroidLng],
    );

    // Weekly adoptions — simplified: count sidequests with times_adopted > 0 created this week
    const [{ count: weeklyAdoptions }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM sidequests s
       WHERE s.times_adopted > 0
         AND s.created_at >= $3
         AND s.deleted_at IS NULL
         AND s.entry_latitude IS NOT NULL
         AND s.entry_longitude IS NOT NULL
         AND (
           6371000 * acos(
             cos(radians($1)) * cos(radians(s.entry_latitude))
             * cos(radians(s.entry_longitude) - radians($2))
             + sin(radians($1)) * sin(radians(s.entry_latitude))
           )
         ) <= 5000`,
      [centroidLat, centroidLng, weekAgo.toISOString()],
    );

    // Weekly new sidequests
    const [{ count: weeklyNewSidequests }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM sidequests s
       WHERE s.created_at >= $3
         AND s.deleted_at IS NULL
         AND s.entry_latitude IS NOT NULL
         AND s.entry_longitude IS NOT NULL
         AND (
           6371000 * acos(
             cos(radians($1)) * cos(radians(s.entry_latitude))
             * cos(radians(s.entry_longitude) - radians($2))
             + sin(radians($1)) * sin(radians(s.entry_latitude))
           )
         ) <= 5000`,
      [centroidLat, centroidLng, weekAgo.toISOString()],
    );

    // Average rating
    const [{ avg: avgRating }] = await this.dataSource.query(
      `SELECT COALESCE(AVG(s.rating), 0)::numeric(3,2) AS avg
       FROM sidequests s
       WHERE s.rating IS NOT NULL
         AND s.deleted_at IS NULL
         AND s.entry_latitude IS NOT NULL
         AND s.entry_longitude IS NOT NULL
         AND (
           6371000 * acos(
             cos(radians($1)) * cos(radians(s.entry_latitude))
             * cos(radians(s.entry_longitude) - radians($2))
             + sin(radians($1)) * sin(radians(s.entry_latitude))
           )
         ) <= 5000`,
      [centroidLat, centroidLng],
    );

    // Note: district_snapshots table still uses itinerary_count column name (not yet renamed)
    await this.dataSource.query(
      `INSERT INTO district_snapshots
        (district_id, itinerary_count, unique_explorers,
         weekly_adoptions, weekly_new_itineraries, avg_rating)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        districtId,
        sidequestCount,
        uniqueExplorers,
        weeklyAdoptions,
        weeklyNewSidequests,
        avgRating,
      ],
    );
  }

  async getDistrictMomentum(
    districtId: string,
  ): Promise<DistrictMomentum | null> {
    // Note: district_snapshots table still uses old column names (itinerary_count, weekly_new_itineraries)
    const snapshots: {
      itinerary_count: number;
      unique_explorers: number;
      weekly_adoptions: number;
      weekly_new_itineraries: number;
      computed_at: Date;
    }[] = await this.dataSource.query(
      `SELECT itinerary_count, unique_explorers, weekly_adoptions,
              weekly_new_itineraries, computed_at
       FROM district_snapshots
       WHERE district_id = $1
       ORDER BY computed_at DESC
       LIMIT 10`,
      [districtId],
    );

    if (snapshots.length === 0) return null;

    const latest = snapshots[0];
    const previous = snapshots.length > 1 ? snapshots[1] : null;

    let momentum: "rising" | "steady" | "cooling" = "steady";
    if (previous) {
      const countDelta = latest.itinerary_count - previous.itinerary_count;
      const adoptionDelta = latest.weekly_adoptions - previous.weekly_adoptions;
      const score = countDelta * 2 + adoptionDelta;
      if (score > 0) momentum = "rising";
      else if (score < 0) momentum = "cooling";
    }

    return {
      momentum,
      weeklyNewSidequests: latest.weekly_new_itineraries,
      weeklyAdoptions: latest.weekly_adoptions,
      uniqueExplorers: latest.unique_explorers,
      history: snapshots.reverse().map((s) => ({
        itineraryCount: s.itinerary_count,
        computedAt: s.computed_at?.toISOString?.() || String(s.computed_at),
      })),
    };
  }
}

// ───── Vitality Score ─────

function computeVitalityScore(input: {
  sidequestCount: number;
  avgRating: number;
  totalAdoptions: number;
  varietyCount: number;
  momentum: DistrictMomentum | null;
}): number {
  // Adoption rate (30%) — log scale, 50 adoptions ≈ 100
  const adoptionNorm = Math.min(
    100,
    (Math.log(input.totalAdoptions + 1) / Math.log(51)) * 100,
  );

  // Avg rating (25%) — 0-5 → 0-100
  const ratingNorm = (input.avgRating / 5) * 100;

  // Variety (20%) — 7 unique categories ≈ 100
  const varietyNorm = Math.min(100, (input.varietyCount / 7) * 100);

  // Volume (15%) — log scale, 50 sidequests ≈ 100
  const volumeNorm = Math.min(
    100,
    (Math.log(input.sidequestCount + 1) / Math.log(51)) * 100,
  );

  // Momentum (10%) — rising=100, steady=50, cooling=20, unknown=40
  let momentumNorm = 40;
  if (input.momentum) {
    const m = input.momentum.momentum;
    momentumNorm = m === "rising" ? 100 : m === "steady" ? 50 : 20;
  }

  const raw =
    adoptionNorm * 0.3 +
    ratingNorm * 0.25 +
    varietyNorm * 0.2 +
    volumeNorm * 0.15 +
    momentumNorm * 0.1;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ───── Utilities ─────

function geohashCellsBoundingBox(cells: string[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;
  for (const cell of cells) {
    const [minla, minlo, maxla, maxlo] = ngeohash.decode_bbox(cell);
    if (minla < minLat) minLat = minla;
    if (maxla > maxLat) maxLat = maxla;
    if (minlo < minLng) minLng = minlo;
    if (maxlo > maxLng) maxLng = maxlo;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ───── Factory ─────

export function createDistrictService(
  deps: DistrictServiceDependencies,
): DistrictService {
  return new DistrictService(deps);
}
