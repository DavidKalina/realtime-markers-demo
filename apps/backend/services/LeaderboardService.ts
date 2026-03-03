import { DataSource } from "typeorm";
import type { RedisService } from "./shared/RedisService";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  currentTier: string;
  scanCount: number;
}

export interface LeaderboardServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
}

function getWeekStartUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  // Monday = 1, Sunday = 0. Shift so Monday is start of week.
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export class LeaderboardService {
  private dataSource: DataSource;
  private redisService: RedisService;

  constructor(dependencies: LeaderboardServiceDependencies) {
    this.dataSource = dependencies.dataSource;
    this.redisService = dependencies.redisService;
  }

  async getCityWeeklyLeaderboard(
    city: string,
    limit: number = 10,
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `leaderboard:weekly:${city.toLowerCase()}`;

    const cached = await this.redisService.get<LeaderboardEntry[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const weekStart = getWeekStartUTC();

    // resolvedCity is "City, State" format but events.city may store just "City"
    // Match on just the city portion (before the comma) as well as the full string
    const cityName = city.includes(",") ? city.split(",")[0].trim() : city;

    const rows = await this.dataSource.query(
      `SELECT
        u.id AS "userId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.avatar_url AS "avatarUrl",
        u.current_tier AS "currentTier",
        COUNT(ued.id)::int AS "scanCount"
      FROM user_event_discoveries ued
      JOIN events e ON e.id = ued.event_id
      JOIN users u ON u.id = ued.user_id
      WHERE (LOWER(e.city) = LOWER($1) OR LOWER(e.city) = LOWER($4))
        AND ued.discovered_at >= $2
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url, u.current_tier
      ORDER BY "scanCount" DESC, u.first_name ASC
      LIMIT $3`,
      [city, weekStart.toISOString(), limit, cityName],
    );

    const leaderboard: LeaderboardEntry[] = rows.map(
      (row: Record<string, unknown>, index: number) => ({
        rank: index + 1,
        userId: row.userId as string,
        firstName: (row.firstName as string) || null,
        lastName: (row.lastName as string) || null,
        avatarUrl: (row.avatarUrl as string) || null,
        currentTier: (row.currentTier as string) || "Explorer",
        scanCount: row.scanCount as number,
      }),
    );

    await this.redisService.set(cacheKey, leaderboard, 300);

    return leaderboard;
  }

  async getUserCityRank(
    userId: string,
    city: string,
  ): Promise<{ rank: number; scanCount: number } | null> {
    const leaderboard = await this.getCityWeeklyLeaderboard(city, 100);
    const entry = leaderboard.find((e) => e.userId === userId);
    if (!entry) {
      return null;
    }
    return { rank: entry.rank, scanCount: entry.scanCount };
  }
}

export function createLeaderboardService(
  dependencies: LeaderboardServiceDependencies,
): LeaderboardService {
  return new LeaderboardService(dependencies);
}
