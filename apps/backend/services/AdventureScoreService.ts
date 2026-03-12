import type { DataSource } from "typeorm";
import type { RedisService } from "./shared/RedisService";

export interface AdventureScoreServiceDeps {
  dataSource: DataSource;
  redisService: RedisService;
}

export interface AdventureScoreResponse {
  score: number;
  activityScore: number;
  consistencyScore: number;
  diversityScore: number;
  completionScore: number;
  discoveryScore: number;
  computedAt: string;
}

function sigmoid(raw: number, k: number): number {
  return Math.round(100 * (1 - Math.exp(-raw / k)));
}

export class AdventureScoreService {
  private dataSource: DataSource;
  private redisService: RedisService;

  constructor(deps: AdventureScoreServiceDeps) {
    this.dataSource = deps.dataSource;
    this.redisService = deps.redisService;
  }

  async getScore(userId: string): Promise<AdventureScoreResponse> {
    const cacheKey = `adventure-score:${userId}`;
    const cached =
      await this.redisService.get<AdventureScoreResponse>(cacheKey);
    if (cached) return cached;

    const score = await this.compute(userId);
    await this.redisService.set(cacheKey, score, 900); // 15-min TTL
    return score;
  }

  private async compute(userId: string): Promise<AdventureScoreResponse> {
    const [
      activityRaw,
      consistencyRaw,
      diversityRaw,
      completionRaw,
      discoveryRaw,
    ] = await Promise.all([
      this.computeActivity(userId),
      this.computeConsistency(userId),
      this.computeDiversity(userId),
      this.computeCompletion(userId),
      this.computeDiscovery(userId),
    ]);

    // Normalize via sigmoid with tuned k values
    const activityScore = sigmoid(activityRaw, 15);
    const consistencyScore = sigmoid(consistencyRaw, 8);
    const diversityScore = sigmoid(diversityRaw, 1.5);
    const completionScore = sigmoid(completionRaw, 0.5);
    const discoveryScore = sigmoid(discoveryRaw, 10);

    // Weighted composite
    const score = Math.round(
      activityScore * 0.3 +
        consistencyScore * 0.25 +
        diversityScore * 0.2 +
        completionScore * 0.15 +
        discoveryScore * 0.1,
    );

    return {
      score,
      activityScore,
      consistencyScore,
      diversityScore,
      completionScore,
      discoveryScore,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Activity (30%): check-ins in last 30 days, weighted by recency.
   * Last 7 days = 1.0, 7-14 days = 0.5, 14-30 days = 0.25.
   */
  private async computeActivity(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COALESCE(SUM(
        CASE
          WHEN checked_in_at >= NOW() - INTERVAL '7 days' THEN 1.0
          WHEN checked_in_at >= NOW() - INTERVAL '14 days' THEN 0.5
          WHEN checked_in_at >= NOW() - INTERVAL '30 days' THEN 0.25
          ELSE 0
        END
      ), 0) AS raw
      FROM itinerary_checkins
      WHERE user_id = $1
        AND checked_in_at >= NOW() - INTERVAL '30 days'`,
      [userId],
    );
    return parseFloat(result[0]?.raw ?? "0");
  }

  /**
   * Consistency (25%): current streak + longest streak / 4 (rewards history).
   */
  private async computeConsistency(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT current_streak, longest_streak FROM users WHERE id = $1`,
      [userId],
    );
    const current = Number(result[0]?.current_streak ?? 0);
    const longest = Number(result[0]?.longest_streak ?? 0);
    return current + longest / 4;
  }

  /**
   * Diversity (20%): Shannon entropy of venue categories from all check-ins.
   */
  private async computeDiversity(userId: string): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT LOWER(ii.venue_category) AS cat, COUNT(*)::int AS cnt
       FROM itinerary_checkins ic
       JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
       WHERE ic.user_id = $1
         AND ii.venue_category IS NOT NULL
       GROUP BY LOWER(ii.venue_category)`,
      [userId],
    );
    if (rows.length === 0) return 0;
    const total = rows.reduce(
      (sum: number, r: { cnt: number }) => sum + r.cnt,
      0,
    );
    return rows.reduce((entropy: number, r: { cnt: number }) => {
      const p = r.cnt / total;
      return entropy - p * Math.log(p);
    }, 0);
  }

  /**
   * Completion (15%): completed itineraries / total itineraries ratio.
   */
  private async computeCompletion(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(completed_at)::int AS completed
       FROM itineraries
       WHERE user_id = $1`,
      [userId],
    );
    const total = Number(result[0]?.total ?? 0);
    const completed = Number(result[0]?.completed ?? 0);
    if (total === 0) return 0;
    return completed / total;
  }

  /**
   * Discovery (10%): unique venue names visited via check-ins.
   */
  private async computeDiscovery(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(DISTINCT ii.venue_name)::int AS cnt
       FROM itinerary_checkins ic
       JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
       WHERE ic.user_id = $1
         AND ii.venue_name IS NOT NULL`,
      [userId],
    );
    return Number(result[0]?.cnt ?? 0);
  }
}

export function createAdventureScoreService(
  deps: AdventureScoreServiceDeps,
): AdventureScoreService {
  return new AdventureScoreService(deps);
}
