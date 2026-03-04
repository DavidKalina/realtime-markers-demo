import type { Context } from "hono";
import type { AppContext } from "../types/context";
import AppDataSource from "../data-source";

interface CategoryBreakdown {
  name: string;
  icon: string | null;
  count: number;
}

interface CityBreakdown {
  city: string;
  count: number;
}

interface UserStatsResponse {
  categoryBreakdown: CategoryBreakdown[];
  cityBreakdown: CityBreakdown[];
  globalRank: number;
  totalUsers: number;
}

export const getUserStats = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const userId = user.userId || user.id;
  const redisService = c.get("redisService");
  const cacheKey = `user-stats:${userId}`;

  const cached = await redisService.get<UserStatsResponse>(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  try {
    const [categoryRows, cityRows, rankRows] = await Promise.all([
      AppDataSource.query(
        `SELECT c.name, c.icon, COUNT(*)::int AS count
         FROM user_event_discoveries ued
         JOIN events e ON e.id = ued.event_id
         JOIN event_categories ec ON ec.event_id = e.id
         JOIN categories c ON c.id = ec.category_id
         WHERE ued.user_id = $1
         GROUP BY c.name, c.icon
         ORDER BY count DESC
         LIMIT 10`,
        [userId],
      ),
      AppDataSource.query(
        `SELECT e.city, COUNT(*)::int AS count
         FROM user_event_discoveries ued
         JOIN events e ON e.id = ued.event_id
         WHERE ued.user_id = $1 AND e.city IS NOT NULL
         GROUP BY e.city
         ORDER BY count DESC`,
        [userId],
      ),
      AppDataSource.query(
        `SELECT
           (SELECT COUNT(*)::int + 1 FROM users WHERE scan_count > (SELECT scan_count FROM users WHERE id = $1)) AS rank,
           (SELECT COUNT(*)::int FROM users) AS "totalUsers"`,
        [userId],
      ),
    ]);

    const stats: UserStatsResponse = {
      categoryBreakdown: categoryRows.map((r: Record<string, unknown>) => ({
        name: r.name as string,
        icon: (r.icon as string) || null,
        count: r.count as number,
      })),
      cityBreakdown: cityRows.map((r: Record<string, unknown>) => ({
        city: r.city as string,
        count: r.count as number,
      })),
      globalRank: (rankRows[0]?.rank as number) || 1,
      totalUsers: (rankRows[0]?.totalUsers as number) || 1,
    };

    await redisService.set(cacheKey, stats, 600);

    return c.json(stats);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return c.json({ error: "Failed to fetch user stats" }, 500);
  }
};
