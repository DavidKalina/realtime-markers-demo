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

export interface BrowseItinerary {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  durationHours: number;
  rating: number | null;
  timesAdopted: number;
  itemCount: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: { emoji: string | null; title: string; venueName: string | null }[];
}

export interface DistrictMomentum {
  momentum: "rising" | "steady" | "cooling";
  weeklyNewItineraries: number;
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
  itineraryCount: number;
  avgRating: number | null;
  totalAdoptions: number;
  activityTags: string[];
  distanceMiles: number;
  previewItineraries: BrowseItinerary[];
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
    itineraryCount: number;
    avgRating: number | null;
    totalAdoptions: number;
    activityTags: string[];
    momentum: DistrictMomentum | null;
    vitalityScore: number;
  };
  itineraries: BrowseItinerary[];
  nextCursor: string | null;
  activityDna: ActivityDnaEntry[];
  activityHeatmap: ActivityDayEntry[];
  bestMatch: BrowseItinerary | null;
}

export interface CoverageResult {
  total: number;
  explored: number;
  districts: { id: string; name: string; explored: boolean }[];
}

interface ItineraryRow {
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
const DBSCAN_MIN_POINTS = parseInt(process.env.DBSCAN_MIN_POINTS || "3");
const CENTROID_MATCH_THRESHOLD = parseFloat(
  process.env.DISTRICT_MATCH_THRESHOLD || "0.85",
);
const DEBOUNCE_TTL_SECONDS = 3600;
const PREVIEW_COUNT = 3;

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

    const itineraries: ItineraryRow[] = await this.dataSource.query(
      `SELECT
        i.id, i.title, i.summary, i.city, i.intention,
        i.embedding, i.entry_latitude, i.entry_longitude,
        i.activity_types, i.categories, i.rating, i.times_adopted
      FROM itineraries i
      WHERE i.status = 'READY'
        AND i.entry_latitude IS NOT NULL
        AND i.entry_longitude IS NOT NULL
        AND i.deleted_at IS NULL
        AND i.entry_latitude BETWEEN $1 AND $2
        AND i.entry_longitude BETWEEN $3 AND $4`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
    );

    // Filter to only itineraries with embeddings
    const embeddable = itineraries.filter((it) => it.embedding);

    if (embeddable.length < DBSCAN_MIN_POINTS) {
      console.log(
        `[DistrictService] Only ${embeddable.length} embeddable itineraries (${itineraries.length} total) in region ${geohash}, skipping`,
      );
      return;
    }

    // Only debounce after confirming we have itineraries to cluster
    await this.redisService.set(debounceKey, "1", DEBOUNCE_TTL_SECONDS);

    // Parse embeddings
    const embeddings = embeddable.map((it) =>
      this.embeddingService.parseSqlEmbedding(it.embedding),
    );

    // Run DBSCAN with cosine distance
    const dbscan = new DBSCAN();
    const clusters: number[][] = dbscan.run(
      embeddings,
      DBSCAN_EPSILON,
      DBSCAN_MIN_POINTS,
      (a: number[], b: number[]) =>
        1 - this.embeddingService.calculateSimilarity(a, b),
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
      const memberItineraries = clusterIndices.map((i) => embeddable[i]);
      const memberEmbeddings = clusterIndices.map((i) => embeddings[i]);

      // Compute centroid embedding (element-wise mean)
      const centroidEmbedding = this.computeCentroid(memberEmbeddings);
      const centroidLat =
        memberItineraries.reduce((s, it) => s + Number(it.entry_latitude), 0) /
        memberItineraries.length;
      const centroidLng =
        memberItineraries.reduce((s, it) => s + Number(it.entry_longitude), 0) /
        memberItineraries.length;
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
      const activityTags = this.aggregateActivityTags(memberItineraries);
      const avgRating = this.computeAvgRating(memberItineraries);
      const totalAdoptions = memberItineraries.reduce(
        (s, it) => s + Number(it.times_adopted),
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
          memberItineraries.length,
          avgRating,
          totalAdoptions,
          clusterGeohash,
          matchedDistrict.id,
        ];

        if (shouldRename) {
          const { name, description } =
            await this.nameDistrict(memberItineraries);
          nameUpdate = ", name = $10, description = $11";
          params.push(name, description);
          console.log(
            `[DistrictService] Renamed district "${matchedDistrict.name}" → "${name}"`,
          );
        }

        await this.dataSource.query(
          `UPDATE districts SET
            centroid_lat = $1, centroid_lng = $2,
            embedding_centroid = $3, activity_tags = $4,
            itinerary_count = $5, avg_rating = $6,
            total_adoptions = $7, geohash = $8,
            last_clustered_at = NOW(), updated_at = NOW()
            ${nameUpdate}
          WHERE id = $9`,
          params,
        );

        // Replace membership
        await this.dataSource.query(
          `DELETE FROM district_itineraries WHERE district_id = $1`,
          [matchedDistrict.id],
        );

        await this.insertMembership(
          matchedDistrict.id,
          memberItineraries,
          centroidEmbedding,
          memberEmbeddings,
        );
      } else {
        // Create new district
        const { name, description } =
          await this.nameDistrict(memberItineraries);

        const [newDistrict] = await this.dataSource.query(
          `INSERT INTO districts
            (name, description, geohash, centroid_lat, centroid_lng,
             embedding_centroid, activity_tags, itinerary_count,
             avg_rating, total_adoptions, last_clustered_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          RETURNING id`,
          [
            name,
            description,
            clusterGeohash,
            centroidLat,
            centroidLng,
            centroidSql,
            activityTags,
            memberItineraries.length,
            avgRating,
            totalAdoptions,
          ],
        );

        await this.insertMembership(
          newDistrict.id,
          memberItineraries,
          centroidEmbedding,
          memberEmbeddings,
        );

        console.log(
          `[DistrictService] Created district "${name}" with ${memberItineraries.length} itineraries`,
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
      await this.dataSource.query(
        `DELETE FROM district_itineraries
         WHERE district_id IN (${orphanPlaceholders})`,
        orphanedIds,
      );
      console.log(
        `[DistrictService] Archived ${orphanedIds.length} orphaned districts`,
      );
    }

    console.log(
      `[DistrictService] Clustered region ${geohash}: ${clusters.length} clusters from ${embeddable.length} itineraries`,
    );
  }

  async clusterAllRegions(): Promise<void> {
    const coords: { entry_latitude: number; entry_longitude: number }[] =
      await this.dataSource.query(
        `SELECT DISTINCT entry_latitude, entry_longitude
         FROM itineraries
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
      itinerary_count: number;
      avg_rating: number;
      total_adoptions: number;
      activity_tags: string[];
    }[] = await this.dataSource.query(
      `SELECT id, name, description, centroid_lat, centroid_lng,
              itinerary_count, avg_rating, total_adoptions, activity_tags
       FROM districts
       WHERE centroid_lat BETWEEN $1 AND $2
         AND centroid_lng BETWEEN $3 AND $4
         AND status = 'active'
         AND itinerary_count >= ${DBSCAN_MIN_POINTS}
       ORDER BY itinerary_count DESC`,
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

      // Load preview itineraries + momentum
      const [previews, momentum] = await Promise.all([
        this.loadPreviewItineraries(d.id, PREVIEW_COUNT),
        this.getDistrictMomentum(d.id),
      ]);

      results.push({
        id: d.id,
        name: d.name,
        description: d.description,
        centroidLat: Number(d.centroid_lat),
        centroidLng: Number(d.centroid_lng),
        itineraryCount: d.itinerary_count,
        avgRating: Number(d.avg_rating) || null,
        totalAdoptions: d.total_adoptions,
        activityTags: d.activity_tags || [],
        distanceMiles: distMeters / 1609.34,
        previewItineraries: previews,
        momentum,
      });
    }

    // Sort by itinerary count descending, cap at 15
    results.sort((a, b) => b.itineraryCount - a.itineraryCount);

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
              itinerary_count, avg_rating, total_adoptions, activity_tags
       FROM districts WHERE id = $1`,
      [districtId],
    );

    if (!district) {
      throw new Error("District not found");
    }

    let orderClause: string;
    switch (sort) {
      case "recent":
        orderClause = "i.created_at DESC, i.id DESC";
        break;
      case "top_rated":
        orderClause =
          "COALESCE(i.rating, 0) DESC, i.created_at DESC, i.id DESC";
        break;
      case "popular":
      default:
        orderClause =
          "(i.times_adopted * 2 + COALESCE(i.rating, 0)) DESC, i.created_at DESC, i.id DESC";
        break;
    }

    let cursorClause = "";
    const params: unknown[] = [districtId, limit + 1];

    if (cursor) {
      const [cursorDate, cursorId] = cursor.split("|");
      cursorClause = `AND (i.completed_at < $3 OR (i.completed_at = $3 AND i.id < $4))`;
      params.push(cursorDate, cursorId);
    }

    const rows = await this.dataSource.query(
      `SELECT
        i.id, i.title, i.summary, i.city, i.intention,
        i.duration_hours, i.rating, i.times_adopted,
        i.completed_at, u.first_name AS creator_first_name,
        (SELECT COUNT(*) FROM itinerary_items ii WHERE ii.itinerary_id = i.id) AS item_count
      FROM district_itineraries di
      JOIN itineraries i ON i.id = di.itinerary_id
      JOIN users u ON u.id = i.user_id
      WHERE di.district_id = $1
        AND i.status = 'READY'
        AND i.deleted_at IS NULL
        ${cursorClause}
      ORDER BY ${orderClause}
      LIMIT $2`,
      params,
    );

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    // Load items for each itinerary
    const itineraries: BrowseItinerary[] = [];
    for (const row of resultRows) {
      const items = await this.dataSource.query(
        `SELECT emoji, title, venue_name
         FROM itinerary_items
         WHERE itinerary_id = $1
         ORDER BY sort_order ASC
         LIMIT 3`,
        [row.id],
      );

      itineraries.push({
        id: row.id,
        title: row.title,
        summary: row.summary,
        city: row.city,
        intention: row.intention,
        durationHours: Number(row.duration_hours),
        rating: row.rating ? Number(row.rating) : null,
        timesAdopted: Number(row.times_adopted),
        itemCount: Number(row.item_count),
        creatorFirstName: row.creator_first_name,
        completedAt: row.completed_at?.toISOString?.() || row.completed_at,
        items: items.map(
          (item: { emoji: string; title: string; venue_name: string }) => ({
            emoji: item.emoji,
            title: item.title,
            venueName: item.venue_name,
          }),
        ),
      });
    }

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
      itineraryCount: district.itinerary_count,
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
        itineraryCount: district.itinerary_count,
        avgRating: Number(district.avg_rating) || null,
        totalAdoptions: district.total_adoptions,
        activityTags: district.activity_tags || [],
        momentum,
        vitalityScore,
      },
      itineraries,
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
         AND status = 'active'
         AND itinerary_count >= ${DBSCAN_MIN_POINTS}`,
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

    // Check which districts user has completed itineraries in
    const districtIds = nearbyDistricts.map((d) => d.id);
    const districtPlaceholders = districtIds
      .map((_, i) => `$${i + 2}`)
      .join(", ");

    const explored: { district_id: string }[] = await this.dataSource.query(
      `SELECT DISTINCT di.district_id
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id IN (${districtPlaceholders})
         AND i.user_id = $1
         AND i.completed_at IS NOT NULL
         AND i.deleted_at IS NULL`,
      [userId, ...districtIds],
    );

    const exploredSet = new Set(explored.map((e) => e.district_id));

    return {
      total: nearbyDistricts.length,
      explored: exploredSet.size,
      districts: nearbyDistricts.map((d) => ({
        id: d.id,
        name: d.name,
        explored: exploredSet.has(d.id),
      })),
    };
  }

  // ───── Helpers ─────

  private async nameDistrict(
    members: ItineraryRow[],
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

    const prompt = `You are naming a themed district for an adventure app. The district groups similar itineraries by vibe.

Activity types: ${allActivityTypes.join(", ")}
Category tags: ${allCategories.join(", ")}
Sample itinerary titles: ${sampleTitles.join("; ")}
Cities represented: ${cities.join(", ")}

Create a creative, memorable 2-4 word district name and a one-sentence description (under 80 chars).

Good examples: "Boards & Brews", "Sunset Escapades", "Art Walk Alley", "Trail Mix", "Night Owl Circuit", "Savory Symphony"
Bad examples: "Coffee and Activities", "Outdoor Fun District", "Food Area", "Mixed Activities Zone"

Respond with ONLY valid JSON: {"name": "...", "description": "..."}`;

    try {
      const completion = await this.openAIService.executeChatCompletion(
        {
          model: OpenAIModel.GPT4OMini,
          messages: [
            {
              role: "system",
              content:
                "You generate creative, concise district names for an adventure app. Respond with ONLY valid JSON, no markdown fences.",
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

  private aggregateActivityTags(members: ItineraryRow[]): string[] {
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

  private computeAvgRating(members: ItineraryRow[]): number {
    const rated = members.filter((m) => m.rating != null);
    if (rated.length === 0) return 0;
    return rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length;
  }

  private async insertMembership(
    districtId: string,
    members: ItineraryRow[],
    centroidEmbedding: number[],
    memberEmbeddings: number[][],
  ): Promise<void> {
    for (let i = 0; i < members.length; i++) {
      const similarity = this.embeddingService.calculateSimilarity(
        memberEmbeddings[i],
        centroidEmbedding,
      );
      await this.dataSource.query(
        `INSERT INTO district_itineraries (district_id, itinerary_id, similarity)
         VALUES ($1, $2, $3)
         ON CONFLICT (district_id, itinerary_id) DO UPDATE SET similarity = $3`,
        [districtId, members[i].id, similarity],
      );
    }
  }

  private async loadPreviewItineraries(
    districtId: string,
    count: number,
  ): Promise<BrowseItinerary[]> {
    const rows = await this.dataSource.query(
      `SELECT
        i.id, i.title, i.summary, i.city, i.intention,
        i.duration_hours, i.rating, i.times_adopted,
        i.completed_at, u.first_name AS creator_first_name,
        (SELECT COUNT(*) FROM itinerary_items ii WHERE ii.itinerary_id = i.id) AS item_count
      FROM district_itineraries di
      JOIN itineraries i ON i.id = di.itinerary_id
      JOIN users u ON u.id = i.user_id
      WHERE di.district_id = $1
        AND i.status = 'READY'
        AND i.deleted_at IS NULL
      ORDER BY (i.times_adopted * 2 + COALESCE(i.rating, 0)) DESC
      LIMIT $2`,
      [districtId, count],
    );

    const previews: BrowseItinerary[] = [];
    for (const row of rows) {
      const items = await this.dataSource.query(
        `SELECT emoji, title, venue_name
         FROM itinerary_items
         WHERE itinerary_id = $1
         ORDER BY sort_order ASC
         LIMIT 3`,
        [row.id],
      );

      previews.push({
        id: row.id,
        title: row.title,
        summary: row.summary,
        city: row.city,
        intention: row.intention,
        durationHours: Number(row.duration_hours),
        rating: row.rating ? Number(row.rating) : null,
        timesAdopted: Number(row.times_adopted),
        itemCount: Number(row.item_count),
        creatorFirstName: row.creator_first_name,
        completedAt: row.completed_at?.toISOString?.() || row.completed_at,
        items: items.map(
          (item: { emoji: string; title: string; venue_name: string }) => ({
            emoji: item.emoji,
            title: item.title,
            venueName: item.venue_name,
          }),
        ),
      });
    }

    return previews;
  }

  // ───── Best Match ─────

  private async getBestMatch(
    districtId: string,
    userId?: string,
  ): Promise<BrowseItinerary | null> {
    if (!userId) return null;

    // Get user's preference embedding
    const [user] = await this.dataSource.query(
      `SELECT preference_embedding FROM users WHERE id = $1`,
      [userId],
    );

    if (!user?.preference_embedding) return null;

    // Find the itinerary in this district with highest embedding similarity
    const rows = await this.dataSource.query(
      `SELECT
        i.id, i.title, i.summary, i.city, i.intention,
        i.duration_hours, i.rating, i.times_adopted,
        i.completed_at, u.first_name AS creator_first_name,
        (SELECT COUNT(*) FROM itinerary_items ii WHERE ii.itinerary_id = i.id) AS item_count,
        1 - (i.embedding::vector <=> $2::vector) AS similarity
      FROM district_itineraries di
      JOIN itineraries i ON i.id = di.itinerary_id
      JOIN users u ON u.id = i.user_id
      WHERE di.district_id = $1
        AND i.status = 'READY'
        AND i.deleted_at IS NULL
        AND i.embedding IS NOT NULL
      ORDER BY i.embedding::vector <=> $2::vector ASC
      LIMIT 1`,
      [districtId, user.preference_embedding],
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // Load items for preview
    const items = await this.dataSource.query(
      `SELECT emoji, title, venue_name
       FROM itinerary_items
       WHERE itinerary_id = $1
       ORDER BY sort_order ASC
       LIMIT 3`,
      [row.id],
    );

    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      city: row.city,
      intention: row.intention,
      durationHours: Number(row.duration_hours),
      rating: row.rating ? Number(row.rating) : null,
      timesAdopted: Number(row.times_adopted),
      itemCount: Number(row.item_count),
      creatorFirstName: row.creator_first_name,
      completedAt: row.completed_at?.toISOString?.() || row.completed_at,
      items: items.map(
        (item: { emoji: string; title: string; venue_name: string }) => ({
          emoji: item.emoji,
          title: item.title,
          venueName: item.venue_name,
        }),
      ),
    };
  }

  // ───── District Analytics ─────

  private async getDistrictActivityDna(
    districtId: string,
  ): Promise<ActivityDnaEntry[]> {
    // Unnest activity_types from all itineraries in the district, count occurrences
    const rows: { activity: string; count: number }[] =
      await this.dataSource.query(
        `SELECT unnest(i.activity_types) AS activity, COUNT(*)::int AS count
         FROM district_itineraries di
         JOIN itineraries i ON i.id = di.itinerary_id
         WHERE di.district_id = $1
           AND i.status = 'READY'
           AND i.deleted_at IS NULL
           AND i.activity_types IS NOT NULL
         GROUP BY activity
         ORDER BY count DESC
         LIMIT 10`,
        [districtId],
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
    // Count itinerary activity per day over the last 16 weeks (~112 days)
    const rows: { date: string; count: number }[] = await this.dataSource.query(
      `SELECT TO_CHAR(i.created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
         FROM district_itineraries di
         JOIN itineraries i ON i.id = di.itinerary_id
         WHERE di.district_id = $1
           AND i.status = 'READY'
           AND i.deleted_at IS NULL
           AND i.created_at >= NOW() - INTERVAL '112 days'
         GROUP BY TO_CHAR(i.created_at, 'YYYY-MM-DD')
         ORDER BY date ASC`,
      [districtId],
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

    // Current itinerary count
    const [{ count: itineraryCount }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id = $1
         AND i.status = 'READY'
         AND i.deleted_at IS NULL`,
      [districtId],
    );

    // Unique explorers (users with completed itineraries in this district)
    const [{ count: uniqueExplorers }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT i.user_id)::int AS count
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id = $1
         AND i.completed_at IS NOT NULL
         AND i.deleted_at IS NULL`,
      [districtId],
    );

    // Weekly adoptions
    const [{ count: weeklyAdoptions }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id = $1
         AND i.source_itinerary_id IS NOT NULL
         AND i.created_at >= $2
         AND i.deleted_at IS NULL`,
      [districtId, weekAgo.toISOString()],
    );

    // Weekly new itineraries
    const [{ count: weeklyNewItineraries }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id = $1
         AND i.created_at >= $2
         AND i.deleted_at IS NULL`,
      [districtId, weekAgo.toISOString()],
    );

    // Average rating
    const [{ avg: avgRating }] = await this.dataSource.query(
      `SELECT COALESCE(AVG(i.rating), 0)::numeric(3,2) AS avg
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id = $1
         AND i.rating IS NOT NULL
         AND i.deleted_at IS NULL`,
      [districtId],
    );

    await this.dataSource.query(
      `INSERT INTO district_snapshots
        (district_id, itinerary_count, unique_explorers,
         weekly_adoptions, weekly_new_itineraries, avg_rating)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        districtId,
        itineraryCount,
        uniqueExplorers,
        weeklyAdoptions,
        weeklyNewItineraries,
        avgRating,
      ],
    );
  }

  async getDistrictMomentum(
    districtId: string,
  ): Promise<DistrictMomentum | null> {
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
      weeklyNewItineraries: latest.weekly_new_itineraries,
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
  itineraryCount: number;
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

  // Volume (15%) — log scale, 50 itineraries ≈ 100
  const volumeNorm = Math.min(
    100,
    (Math.log(input.itineraryCount + 1) / Math.log(51)) * 100,
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
