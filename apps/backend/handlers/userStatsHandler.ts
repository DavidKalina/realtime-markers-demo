import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

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

export const getUserStats: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const dataSource = c.get("dataSource");
  const redisService = c.get("redisService");
  const cacheKey = `user-stats:${user.id}`;

  const cached = await redisService.get<UserStatsResponse>(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const [categoryRows, cityRows, rankRows] = await Promise.all([
    // Category breakdown from itinerary item venue categories
    dataSource.query(
      `SELECT o.venue_category AS name, NULL AS icon, COUNT(*)::int AS count
       FROM objective_checkins oc
       JOIN objectives o ON o.id = oc.objective_id
       WHERE oc.user_id = $1 AND o.venue_category IS NOT NULL
       GROUP BY o.venue_category
       ORDER BY count DESC
       LIMIT 10`,
      [user.id],
    ),
    // City breakdown from completed itineraries
    dataSource.query(
      `SELECT s.city, COUNT(*)::int AS count
       FROM sidequests s
       WHERE s.user_id = $1 AND s.city IS NOT NULL AND s.completed_at IS NOT NULL
       GROUP BY s.city
       ORDER BY count DESC`,
      [user.id],
    ),
    // Global rank by total XP
    dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int + 1 FROM users WHERE total_xp > (SELECT total_xp FROM users WHERE id = $1)) AS rank,
         (SELECT COUNT(*)::int FROM users) AS "totalUsers"`,
      [user.id],
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
});
