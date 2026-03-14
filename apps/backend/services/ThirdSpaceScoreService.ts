import { DataSource } from "typeorm";
import type { RedisService } from "./shared/RedisService";

export interface ThirdSpaceScoreServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
}

interface ScoreSnapshot {
  city: string;
  score: number;
  activityScore: number;
  followThroughScore: number;
  varietyScore: number;
  satisfactionScore: number;
  communityScore: number;
  computedAt: string;
}

export interface ContributorEntry {
  rank: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  currentTier: string;
  contribution: number;
  completionCount: number;
  label: string;
}

export interface ThirdSpaceScoreResponse {
  current: ScoreSnapshot;
  previous: { score: number; computedAt: string } | null;
  history: { score: number; computedAt: string }[];
  delta24h: number;
  momentum: "rising" | "steady" | "cooling";
  contributors: ContributorEntry[];
  centroid: { lat: number; lng: number } | null;
}

export interface ThirdSpaceSummary {
  city: string;
  score: number;
  momentum: "rising" | "steady" | "cooling";
  delta24h: number;
  adventureCount: number;
  centroid: { lat: number; lng: number };
  distanceMiles?: number;
  computedAt: string;
}

export interface ThirdSpacesResponse {
  topCities: ThirdSpaceSummary[];
  closestCities?: ThirdSpaceSummary[];
}

function sigmoid(raw: number, k: number): number {
  return Math.round(100 * (1 - Math.exp(-raw / k)));
}

function normalizeCity(city: string): string {
  const parts = city.split(",").map((p) => p.trim());
  const normalized = parts.map((part) => {
    if (part.length <= 2) return part.toUpperCase();
    return part.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  });
  return normalized.join(", ");
}

function assignLabel(
  completionCount: number,
  streakWeeks: number,
  intentionCount: number,
  completionRate: number,
): string {
  if (streakWeeks >= 12) return "Streak Legend";
  if (completionRate >= 90 && completionCount >= 5) return "Completionist";
  if (intentionCount >= 5) return "Versatile Explorer";
  if (completionCount >= 10) return "Top Adventurer";
  if (completionCount >= 5) return "Active Adventurer";
  if (completionCount >= 1) return "Adventurer";
  return "Planner";
}

export class ThirdSpaceScoreService {
  private dataSource: DataSource;
  private redisService: RedisService;

  constructor(dependencies: ThirdSpaceScoreServiceDependencies) {
    this.dataSource = dependencies.dataSource;
    this.redisService = dependencies.redisService;
  }

  async getCityScore(
    city: string,
    contributorLimit: number = 10,
  ): Promise<ThirdSpaceScoreResponse> {
    city = normalizeCity(city);
    const cacheKey = `tss:city:${city.toLowerCase()}`;
    const cached =
      await this.redisService.get<ThirdSpaceScoreResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const recentSnapshot = await this.dataSource.query(
      `SELECT 1 FROM third_space_score_snapshots
       WHERE LOWER(city) = LOWER($1) AND computed_at > NOW() - INTERVAL '4 hours'
       LIMIT 1`,
      [city],
    );

    if (recentSnapshot.length === 0) {
      await this.computeAndStoreScore(city);
    }

    const response = await this.buildResponse(city, contributorLimit);
    await this.redisService.set(cacheKey, response, 900);
    return response;
  }

  async computeAndStoreScore(city: string): Promise<void> {
    city = normalizeCity(city);

    // 1. Activity: Completed itineraries in 30d, recency-weighted
    const activityRows = await this.dataSource.query(
      `SELECT COALESCE(SUM(
        CASE
          WHEN completed_at >= NOW() - INTERVAL '7 days' THEN 1.0
          WHEN completed_at >= NOW() - INTERVAL '14 days' THEN 0.5
          WHEN completed_at >= NOW() - INTERVAL '30 days' THEN 0.25
          ELSE 0
        END
      ), 0) AS raw
      FROM itineraries
      WHERE LOWER(city) = LOWER($1)
        AND completed_at IS NOT NULL
        AND completed_at >= NOW() - INTERVAL '30 days'`,
      [city],
    );
    const activityRaw = parseFloat(activityRows[0]?.raw || "0");

    // 2. Follow-Through: completion rate + avg check-in rate
    const completionRateRows = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::float AS completed,
        COUNT(*)::float AS total
      FROM itineraries
      WHERE LOWER(city) = LOWER($1)
        AND created_at >= NOW() - INTERVAL '30 days'`,
      [city],
    );
    const completed = parseFloat(completionRateRows[0]?.completed || "0");
    const total = parseFloat(completionRateRows[0]?.total || "0");
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const checkinRateRows = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE ii.checked_in_at IS NOT NULL)::float AS checked_in,
        COUNT(*)::float AS total_items
      FROM itinerary_items ii
      JOIN itineraries i ON i.id = ii.itinerary_id
      WHERE LOWER(i.city) = LOWER($1)
        AND i.completed_at IS NOT NULL
        AND i.completed_at >= NOW() - INTERVAL '30 days'`,
      [city],
    );
    const checkedIn = parseFloat(checkinRateRows[0]?.checked_in || "0");
    const totalItems = parseFloat(checkinRateRows[0]?.total_items || "0");
    const checkinRate = totalItems > 0 ? (checkedIn / totalItems) * 100 : 0;

    const followThroughRaw = (completionRate + checkinRate) / 2;

    // 3. Satisfaction: avg rating of completed itineraries, normalized 0-100
    const satisfactionRows = await this.dataSource.query(
      `SELECT AVG(rating) AS avg_rating
      FROM itineraries
      WHERE LOWER(city) = LOWER($1)
        AND completed_at IS NOT NULL
        AND rating IS NOT NULL`,
      [city],
    );
    const avgRating = parseFloat(satisfactionRows[0]?.avg_rating || "0");
    // Normalize from 1-5 scale to 0-100
    const satisfactionRaw = avgRating > 0 ? ((avgRating - 1) / 4) * 100 : 0;

    // 4. Variety: Shannon entropy of intentions + activity types
    const varietyRows = await this.dataSource.query(
      `SELECT label, COUNT(*)::int AS cnt FROM (
        SELECT intention AS label FROM itineraries
        WHERE LOWER(city) = LOWER($1)
          AND completed_at IS NOT NULL
          AND completed_at >= NOW() - INTERVAL '30 days'
          AND intention IS NOT NULL
        UNION ALL
        SELECT UNNEST(activity_types) AS label FROM itineraries
        WHERE LOWER(city) = LOWER($1)
          AND completed_at IS NOT NULL
          AND completed_at >= NOW() - INTERVAL '30 days'
          AND activity_types IS NOT NULL
          AND array_length(activity_types, 1) > 0
      ) sub
      GROUP BY label`,
      [city],
    );
    let varietyRaw = 0;
    if (varietyRows.length > 0) {
      const varietyTotal = varietyRows.reduce(
        (sum: number, r: { cnt: number }) => sum + r.cnt,
        0,
      );
      varietyRaw = varietyRows.reduce((entropy: number, r: { cnt: number }) => {
        const p = r.cnt / varietyTotal;
        return entropy - p * Math.log(p);
      }, 0);
    }

    // 5. Community: unique users with itineraries in 30d
    const communityRows = await this.dataSource.query(
      `SELECT COUNT(DISTINCT user_id)::int AS raw
      FROM itineraries
      WHERE LOWER(city) = LOWER($1)
        AND created_at >= NOW() - INTERVAL '30 days'`,
      [city],
    );
    const communityRaw = parseInt(communityRows[0]?.raw || "0");

    // Normalize via sigmoid
    const activityScore = sigmoid(activityRaw, 15);
    const followThroughScore = sigmoid(followThroughRaw, 60);
    const satisfactionScore = sigmoid(satisfactionRaw, 70);
    const varietyScore = sigmoid(varietyRaw, 1.2);
    const communityScore = sigmoid(communityRaw, 8);

    // Weighted composite
    const score = Math.round(
      activityScore * 0.35 +
        followThroughScore * 0.25 +
        satisfactionScore * 0.15 +
        varietyScore * 0.15 +
        communityScore * 0.1,
    );

    const rawData = {
      activity: activityRaw,
      followThrough: followThroughRaw,
      satisfaction: satisfactionRaw,
      variety: varietyRaw,
      community: communityRaw,
    };

    await this.dataSource.query(
      `INSERT INTO third_space_score_snapshots
        (city, score, activity_score, follow_through_score, variety_score, satisfaction_score, community_score, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        city,
        score,
        activityScore,
        followThroughScore,
        varietyScore,
        satisfactionScore,
        communityScore,
        JSON.stringify(rawData),
      ],
    );

    // Invalidate cache
    const cacheKey = `tss:city:${city.toLowerCase()}`;
    await this.redisService.del(cacheKey);
  }

  async refreshCityScore(city: string): Promise<void> {
    city = normalizeCity(city);
    const debounceKey = `tss:debounce:${city.toLowerCase()}`;
    const alreadyQueued = await this.redisService.get(debounceKey);
    if (alreadyQueued) return;
    await this.redisService.set(debounceKey, "1", 60);

    const cacheKey = `tss:city:${city.toLowerCase()}`;
    await this.redisService.del(cacheKey);

    await this.computeAndStoreScore(city);
  }

  async computeAllCities(): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT city FROM itineraries WHERE city IS NOT NULL`,
    );
    for (const row of rows) {
      try {
        await this.computeAndStoreScore(row.city);
      } catch (err) {
        console.error(
          `Failed to compute Third Space Score for ${row.city}:`,
          err,
        );
      }
    }
    console.log(
      `Third Space Score computation complete for ${rows.length} cities`,
    );
  }

  async cleanupOldSnapshots(): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM third_space_score_snapshots WHERE computed_at < NOW() - INTERVAL '90 days'`,
    );
  }

  private async buildResponse(
    city: string,
    contributorLimit: number,
  ): Promise<ThirdSpaceScoreResponse> {
    // Current snapshot
    const currentRows = await this.dataSource.query(
      `SELECT city, score, activity_score AS "activityScore",
              follow_through_score AS "followThroughScore", variety_score AS "varietyScore",
              satisfaction_score AS "satisfactionScore", community_score AS "communityScore",
              computed_at AS "computedAt"
       FROM third_space_score_snapshots
       WHERE LOWER(city) = LOWER($1)
       ORDER BY computed_at DESC LIMIT 1`,
      [city],
    );

    const current = currentRows[0] || {
      city,
      score: 0,
      activityScore: 0,
      followThroughScore: 0,
      varietyScore: 0,
      satisfactionScore: 0,
      communityScore: 0,
      computedAt: new Date().toISOString(),
    };

    // Previous snapshot (~24h ago)
    const previousRows = await this.dataSource.query(
      `SELECT score, computed_at AS "computedAt"
       FROM third_space_score_snapshots
       WHERE LOWER(city) = LOWER($1) AND computed_at < NOW() - INTERVAL '20 hours'
       ORDER BY computed_at DESC LIMIT 1`,
      [city],
    );
    const previous = previousRows[0] || null;

    // History (last 7 days, one per day approx)
    const historyRows = await this.dataSource.query(
      `SELECT DISTINCT ON (DATE(computed_at)) score, computed_at AS "computedAt"
       FROM third_space_score_snapshots
       WHERE LOWER(city) = LOWER($1) AND computed_at >= NOW() - INTERVAL '7 days'
       ORDER BY DATE(computed_at) DESC, computed_at DESC`,
      [city],
    );

    const delta24h = previous ? current.score - previous.score : 0;
    const momentum: "rising" | "steady" | "cooling" =
      delta24h >= 3 ? "rising" : delta24h <= -3 ? "cooling" : "steady";

    // Contributors
    const contributors = await this.getContributors(city, contributorLimit);

    // Centroid from itinerary items with coordinates
    const centroidRows = await this.dataSource.query(
      `SELECT AVG(ii.latitude) AS lat, AVG(ii.longitude) AS lng
       FROM itinerary_items ii
       JOIN itineraries i ON i.id = ii.itinerary_id
       WHERE LOWER(i.city) = LOWER($1)
         AND i.created_at >= NOW() - INTERVAL '30 days'
         AND ii.latitude IS NOT NULL
         AND ii.longitude IS NOT NULL`,
      [city],
    );
    const centroid = centroidRows[0]?.lat
      ? {
          lat: parseFloat(centroidRows[0].lat),
          lng: parseFloat(centroidRows[0].lng),
        }
      : null;

    return {
      current: {
        city: current.city,
        score: current.score,
        activityScore: current.activityScore,
        followThroughScore: current.followThroughScore,
        varietyScore: current.varietyScore,
        satisfactionScore: current.satisfactionScore,
        communityScore: current.communityScore,
        computedAt: current.computedAt,
      },
      previous,
      history: historyRows.reverse(),
      delta24h,
      momentum,
      contributors,
      centroid,
    };
  }

  private async getContributors(
    city: string,
    limit: number,
  ): Promise<ContributorEntry[]> {
    const rows = await this.dataSource.query(
      `SELECT
        u.id AS "userId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.avatar_url AS "avatarUrl",
        u.current_tier AS "currentTier",
        u.current_streak AS "streakWeeks",
        COUNT(*) FILTER (WHERE i.completed_at IS NOT NULL)::int AS "completionCount",
        COUNT(*)::int AS "totalCount",
        COUNT(DISTINCT i.intention) FILTER (WHERE i.intention IS NOT NULL)::int AS "intentionCount"
      FROM itineraries i
      JOIN users u ON u.id = i.user_id
      WHERE LOWER(i.city) = LOWER($1)
        AND i.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url, u.current_tier, u.current_streak
      ORDER BY COUNT(*) FILTER (WHERE i.completed_at IS NOT NULL) DESC,
               COUNT(DISTINCT i.intention) DESC
      LIMIT $2`,
      [city, limit],
    );

    return rows.map(
      (row: Record<string, unknown>, index: number): ContributorEntry => {
        const completionCount = row.completionCount as number;
        const totalCount = row.totalCount as number;
        const streakWeeks = (row.streakWeeks as number) || 0;
        const intentionCount = row.intentionCount as number;
        const completionRate =
          totalCount > 0 ? (completionCount / totalCount) * 100 : 0;
        const contribution =
          completionCount * 10 + streakWeeks * 5 + intentionCount * 3;

        return {
          rank: index + 1,
          userId: row.userId as string,
          firstName: (row.firstName as string) || null,
          lastName: (row.lastName as string) || null,
          avatarUrl: (row.avatarUrl as string) || null,
          currentTier: (row.currentTier as string) || "Explorer",
          contribution,
          completionCount,
          label: assignLabel(
            completionCount,
            streakWeeks,
            intentionCount,
            completionRate,
          ),
        };
      },
    );
  }

  async getLeaderboard(
    lat?: number,
    lng?: number,
  ): Promise<ThirdSpacesResponse> {
    const cacheKey =
      lat && lng
        ? `tss:leaderboard:${Math.round(lat * 10)}:${Math.round(lng * 10)}`
        : "tss:leaderboard:global";
    const cached = await this.redisService.get<ThirdSpacesResponse>(cacheKey);
    if (cached) return cached;

    // Latest snapshot per city
    const snapshots = await this.dataSource.query(
      `SELECT DISTINCT ON (LOWER(city))
        city, score,
        activity_score AS "activityScore",
        follow_through_score AS "followThroughScore",
        variety_score AS "varietyScore",
        satisfaction_score AS "satisfactionScore",
        community_score AS "communityScore",
        computed_at AS "computedAt"
       FROM third_space_score_snapshots
       ORDER BY LOWER(city), computed_at DESC`,
    );

    // Adventure count + centroid per city from itineraries
    const adventureStats = await this.dataSource.query(
      `SELECT LOWER(i.city) AS city_key,
              COUNT(*) FILTER (WHERE i.completed_at IS NOT NULL)::int AS adventure_count,
              AVG(ii.latitude) AS centroid_lat,
              AVG(ii.longitude) AS centroid_lng
       FROM itineraries i
       LEFT JOIN itinerary_items ii ON ii.itinerary_id = i.id
         AND ii.latitude IS NOT NULL AND ii.longitude IS NOT NULL
       WHERE i.city IS NOT NULL
         AND i.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY LOWER(i.city)`,
    );
    const statsMap = new Map<
      string,
      { adventureCount: number; centroidLat: number; centroidLng: number }
    >();
    for (const row of adventureStats) {
      statsMap.set(row.city_key, {
        adventureCount: row.adventure_count,
        centroidLat: parseFloat(row.centroid_lat),
        centroidLng: parseFloat(row.centroid_lng),
      });
    }

    // Previous snapshots (~24h ago) for momentum
    const previousSnapshots = await this.dataSource.query(
      `SELECT DISTINCT ON (LOWER(city))
        city, score
       FROM third_space_score_snapshots
       WHERE computed_at < NOW() - INTERVAL '20 hours'
       ORDER BY LOWER(city), computed_at DESC`,
    );
    const prevMap = new Map<string, number>();
    for (const row of previousSnapshots) {
      prevMap.set(row.city.toLowerCase(), row.score);
    }

    const summaries: ThirdSpaceSummary[] = [];
    for (const snap of snapshots) {
      const key = snap.city.toLowerCase();
      const stats = statsMap.get(key);

      const prevScore = prevMap.get(key);
      const delta24h = prevScore !== undefined ? snap.score - prevScore : 0;
      const momentum: "rising" | "steady" | "cooling" =
        delta24h >= 3 ? "rising" : delta24h <= -3 ? "cooling" : "steady";

      const summary: ThirdSpaceSummary = {
        city: snap.city,
        score: snap.score,
        momentum,
        delta24h,
        adventureCount: stats?.adventureCount || 0,
        centroid: stats?.centroidLat
          ? { lat: stats.centroidLat, lng: stats.centroidLng }
          : { lat: 0, lng: 0 },
        computedAt: snap.computedAt,
      };

      if (lat !== undefined && lng !== undefined && stats?.centroidLat) {
        summary.distanceMiles = haversineDistance(
          lat,
          lng,
          stats.centroidLat,
          stats.centroidLng,
        );
      }

      summaries.push(summary);
    }

    const topCities = [...summaries].sort((a, b) => b.score - a.score);

    const result: ThirdSpacesResponse = { topCities };

    if (lat !== undefined && lng !== undefined) {
      result.closestCities = [...summaries]
        .sort(
          (a, b) =>
            (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity),
        )
        .slice(0, 10);
    }

    await this.redisService.set(cacheKey, result, 900);
    return result;
  }
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function createThirdSpaceScoreService(
  dependencies: ThirdSpaceScoreServiceDependencies,
): ThirdSpaceScoreService {
  return new ThirdSpaceScoreService(dependencies);
}
