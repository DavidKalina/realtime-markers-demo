import { DataSource } from "typeorm";
import type { RedisService } from "./shared/RedisService";

export interface ThirdSpaceScoreServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
}

interface ScoreSnapshot {
  city: string;
  score: number;
  vitalityScore: number;
  discoveryScore: number;
  diversityScore: number;
  engagementScore: number;
  rootednessScore: number;
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
  scanCount: number;
  label: string;
}

export interface ThirdSpaceScoreResponse {
  current: ScoreSnapshot;
  previous: { score: number; computedAt: string } | null;
  history: { score: number; computedAt: string }[];
  delta24h: number;
  momentum: "rising" | "steady" | "cooling";
  contributors: ContributorEntry[];
}

function sigmoid(raw: number, k: number): number {
  return Math.round(100 * (1 - Math.exp(-raw / k)));
}

function getWeekStartUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function assignLabel(
  scanCount: number,
  uniqueCategories: number,
  recurringEvents: number,
): string {
  if (recurringEvents >= 3) return "Community Anchor";
  if (uniqueCategories >= 5) return "Category Pioneer";
  if (scanCount >= 10) return "Top Explorer";
  if (scanCount >= 5) return "Active Scanner";
  return "Contributor";
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
    const cacheKey = `tss:city:${city.toLowerCase()}`;
    const cached =
      await this.redisService.get<ThirdSpaceScoreResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check DB for recent snapshot (< 4h old)
    const recentSnapshot = await this.dataSource.query(
      `SELECT * FROM third_space_score_snapshots
       WHERE LOWER(city) = LOWER($1) AND computed_at > NOW() - INTERVAL '4 hours'
       ORDER BY computed_at DESC LIMIT 1`,
      [city],
    );

    if (recentSnapshot.length > 0) {
      const response = await this.buildResponse(city, contributorLimit);
      await this.redisService.set(cacheKey, response, 14400); // 4h TTL
      return response;
    }

    // Compute on-demand if no recent snapshot
    await this.computeAndStoreScore(city);
    const response = await this.buildResponse(city, contributorLimit);
    await this.redisService.set(cacheKey, response, 14400);
    return response;
  }

  async computeAndStoreScore(city: string): Promise<void> {
    const cityName = city.includes(",") ? city.split(",")[0].trim() : city;

    // 1. Vitality: Active events weighted by recency
    const vitalityRows = await this.dataSource.query(
      `SELECT COALESCE(SUM(
        CASE
          WHEN e.event_date >= NOW() - INTERVAL '7 days' THEN 1.0
          WHEN e.event_date >= NOW() - INTERVAL '14 days' THEN 0.5
          WHEN e.event_date >= NOW() - INTERVAL '30 days' THEN 0.25
          ELSE 0
        END
      ), 0) AS raw
      FROM events e
      WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($2))
        AND e.status = 'VERIFIED'
        AND e.event_date >= NOW() - INTERVAL '30 days'`,
      [city, cityName],
    );
    const vitalityRaw = parseFloat(vitalityRows[0]?.raw || "0");

    // 2. Discovery: Scan count this week
    const weekStart = getWeekStartUTC();
    const discoveryRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS raw
      FROM user_event_discoveries ued
      JOIN events e ON e.id = ued.event_id
      WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($3))
        AND ued.discovered_at >= $2`,
      [city, weekStart.toISOString(), cityName],
    );
    const discoveryRaw = parseInt(discoveryRows[0]?.raw || "0");

    // 3. Diversity: Shannon entropy of category distribution
    const diversityRows = await this.dataSource.query(
      `SELECT c.name, COUNT(*)::int AS cnt
      FROM events e
      JOIN event_categories ec ON ec.event_id = e.id
      JOIN categories c ON c.id = ec.category_id
      WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($2))
        AND e.status = 'VERIFIED'
        AND e.event_date >= NOW() - INTERVAL '30 days'
      GROUP BY c.name`,
      [city, cityName],
    );
    let diversityRaw = 0;
    if (diversityRows.length > 0) {
      const total = diversityRows.reduce(
        (sum: number, r: { cnt: number }) => sum + r.cnt,
        0,
      );
      diversityRaw = diversityRows.reduce(
        (entropy: number, r: { cnt: number }) => {
          const p = r.cnt / total;
          return entropy - p * Math.log(p);
        },
        0,
      );
    }

    // 4. Engagement: saves + going + views*0.1 last 30 days
    const engagementRows = await this.dataSource.query(
      `SELECT COALESCE(SUM(e.save_count + e.view_count * 0.1), 0) AS raw
      FROM events e
      WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($2))
        AND e.status = 'VERIFIED'
        AND e.event_date >= NOW() - INTERVAL '30 days'`,
      [city, cityName],
    );
    const engagementRaw = parseFloat(engagementRows[0]?.raw || "0");

    // 5. Rootedness: recurring events + high-tier active users
    const rootednessRows = await this.dataSource.query(
      `SELECT (
        (SELECT COUNT(*)::int FROM events e
         WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($2))
           AND e.status = 'VERIFIED'
           AND e.recurrence_frequency IS NOT NULL
           )
        +
        (SELECT COUNT(DISTINCT u.id)::int FROM users u
         JOIN user_event_discoveries ued ON ued.user_id = u.id
         JOIN events e ON e.id = ued.event_id
         WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($2))
           AND u.current_tier IN ('Curator', 'Ambassador')
           AND ued.discovered_at >= NOW() - INTERVAL '30 days')
      ) AS raw`,
      [city, cityName],
    );
    const rootednessRaw = parseInt(rootednessRows[0]?.raw || "0");

    // Normalize via sigmoid
    const vitalityScore = sigmoid(vitalityRaw, 50);
    const discoveryScore = sigmoid(discoveryRaw, 30);
    const diversityScore = sigmoid(diversityRaw, 1.5);
    const engagementScore = sigmoid(engagementRaw, 200);
    const rootednessScore = sigmoid(rootednessRaw, 15);

    // Weighted composite
    const score = Math.round(
      vitalityScore * 0.3 +
        discoveryScore * 0.25 +
        diversityScore * 0.15 +
        engagementScore * 0.2 +
        rootednessScore * 0.1,
    );

    const rawData = {
      vitality: vitalityRaw,
      discovery: discoveryRaw,
      diversity: diversityRaw,
      engagement: engagementRaw,
      rootedness: rootednessRaw,
    };

    await this.dataSource.query(
      `INSERT INTO third_space_score_snapshots
        (city, score, vitality_score, discovery_score, diversity_score, engagement_score, rootedness_score, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        city,
        score,
        vitalityScore,
        discoveryScore,
        diversityScore,
        engagementScore,
        rootednessScore,
        JSON.stringify(rawData),
      ],
    );

    // Invalidate cache
    const cacheKey = `tss:city:${city.toLowerCase()}`;
    await this.redisService.del(cacheKey);
  }

  async computeAllCities(): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND status = 'VERIFIED'`,
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
      `SELECT city, score, vitality_score AS "vitalityScore",
              discovery_score AS "discoveryScore", diversity_score AS "diversityScore",
              engagement_score AS "engagementScore", rootedness_score AS "rootednessScore",
              computed_at AS "computedAt"
       FROM third_space_score_snapshots
       WHERE LOWER(city) = LOWER($1)
       ORDER BY computed_at DESC LIMIT 1`,
      [city],
    );

    const current = currentRows[0] || {
      city,
      score: 0,
      vitalityScore: 0,
      discoveryScore: 0,
      diversityScore: 0,
      engagementScore: 0,
      rootednessScore: 0,
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

    return {
      current: {
        city: current.city,
        score: current.score,
        vitalityScore: current.vitalityScore,
        discoveryScore: current.discoveryScore,
        diversityScore: current.diversityScore,
        engagementScore: current.engagementScore,
        rootednessScore: current.rootednessScore,
        computedAt: current.computedAt,
      },
      previous,
      history: historyRows.reverse(),
      delta24h,
      momentum,
      contributors,
    };
  }

  private async getContributors(
    city: string,
    limit: number,
  ): Promise<ContributorEntry[]> {
    const cityName = city.includes(",") ? city.split(",")[0].trim() : city;
    const weekStart = getWeekStartUTC();

    const rows = await this.dataSource.query(
      `SELECT
        u.id AS "userId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.avatar_url AS "avatarUrl",
        u.current_tier AS "currentTier",
        COUNT(ued.id)::int AS "scanCount",
        COUNT(DISTINCT ec.category_id)::int AS "uniqueCategories",
        COUNT(DISTINCT CASE WHEN e.recurrence_frequency IS NOT NULL  THEN e.id END)::int AS "recurringEvents"
      FROM user_event_discoveries ued
      JOIN events e ON e.id = ued.event_id
      JOIN users u ON u.id = ued.user_id
      LEFT JOIN event_categories ec ON ec.event_id = e.id
      WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($3))
        AND ued.discovered_at >= $2
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url, u.current_tier
      ORDER BY (COUNT(ued.id) * 2 + COUNT(DISTINCT ec.category_id) * 5 + COUNT(DISTINCT CASE WHEN e.recurrence_frequency IS NOT NULL  THEN e.id END) * 3) DESC
      LIMIT $4`,
      [city, weekStart.toISOString(), cityName, limit],
    );

    return rows.map(
      (row: Record<string, unknown>, index: number): ContributorEntry => {
        const scanCount = row.scanCount as number;
        const uniqueCategories = row.uniqueCategories as number;
        const recurringEvents = row.recurringEvents as number;
        const contribution =
          scanCount * 2 + uniqueCategories * 5 + recurringEvents * 3;

        return {
          rank: index + 1,
          userId: row.userId as string,
          firstName: (row.firstName as string) || null,
          lastName: (row.lastName as string) || null,
          avatarUrl: (row.avatarUrl as string) || null,
          currentTier: (row.currentTier as string) || "Explorer",
          contribution,
          scanCount,
          label: assignLabel(scanCount, uniqueCategories, recurringEvents),
        };
      },
    );
  }
}

export function createThirdSpaceScoreService(
  dependencies: ThirdSpaceScoreServiceDependencies,
): ThirdSpaceScoreService {
  return new ThirdSpaceScoreService(dependencies);
}
