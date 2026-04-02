import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import AppDataSource from "../data-source";

interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
}

interface VenueCategory {
  category: string;
  count: number;
  pct: number;
}

interface WeekActivity {
  weekStart: string; // YYYY-MM-DD (Monday)
  count: number;
}

interface CityFootprint {
  city: string;
  completedCount: number;
  checkinCount: number;
  uniqueVenues: number;
}

interface VibeCount {
  vibe: string;
  count: number;
  pct: number;
}

interface IntentionCount {
  intention: string;
  count: number;
  pct: number;
}

interface ProfileInsightsResponse {
  // Activity heatmap (last 16 weeks, daily)
  activityHeatmap: ActivityDay[];
  // Venue DNA (category breakdown from check-ins)
  venueDna: VenueCategory[];
  // Vibe DNA (activity type breakdown from completed sidequests)
  vibeDna: VibeCount[];
  // Intention DNA (intention breakdown from completed sidequests)
  intentionDna: IntentionCount[];
  // Streak calendar (weekly activity for last 16 weeks)
  streakCalendar: WeekActivity[];
  // Social growth (social context distribution + ordered timeline)
  socialGrowth: { context: string; count: number }[];
  socialTimeline: string[];
  // Adventure footprint
  footprint: {
    totalDistanceMiles: number;
    totalCheckins: number;
    totalCompletedSidequests: number;
    totalUniqueVenues: number;
    totalStopsVisited: number;
    avgStopsPerSidequest: number;
    cities: CityFootprint[];
  };
}

export const getProfileInsights: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const redisService = c.get("redisService");
  const cacheKey = `profile-insights:${user.id}`;

  const cached = await redisService.get<ProfileInsightsResponse>(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const [
    heatmapRows,
    venueDnaRows,
    streakRows,
    distanceRows,
    summaryRows,
    cityRows,
    vibeDnaRows,
    intentionDnaRows,
    socialGrowthRows,
    socialTimelineRows,
  ] = await Promise.all([
    // 1. Activity heatmap — daily check-in counts for last 16 weeks
    AppDataSource.query(
      `SELECT DATE(checked_in_at) AS date, COUNT(*)::int AS count
       FROM objective_checkins
       WHERE user_id = $1
         AND checked_in_at >= NOW() - INTERVAL '16 weeks'
       GROUP BY DATE(checked_in_at)
       ORDER BY date`,
      [user.id],
    ),

    // 2. Venue DNA — category breakdown from all check-ins
    AppDataSource.query(
      `SELECT
         o.venue_category AS category,
         COUNT(*)::int AS count
       FROM objective_checkins oc
       JOIN objectives o ON o.id = oc.objective_id
       WHERE oc.user_id = $1
         AND o.venue_category IS NOT NULL
       GROUP BY o.venue_category
       ORDER BY count DESC
       LIMIT 8`,
      [user.id],
    ),

    // 3. Streak calendar — weekly check-in counts for last 16 weeks
    AppDataSource.query(
      `SELECT
         DATE_TRUNC('week', checked_in_at)::date AS week_start,
         COUNT(*)::int AS count
       FROM objective_checkins
       WHERE user_id = $1
         AND checked_in_at >= NOW() - INTERVAL '16 weeks'
       GROUP BY week_start
       ORDER BY week_start`,
      [user.id],
    ),

    // 4a. Total distance (meters) using PostGIS on sequential checked-in stops
    AppDataSource.query(
      `SELECT COALESCE(SUM(distance_m), 0)::float AS total_meters FROM (
         SELECT
           ST_Distance(
             ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography,
             ST_SetSRID(ST_MakePoint(
               LEAD(o.longitude) OVER (PARTITION BY o.sidequest_id ORDER BY o.sort_order),
               LEAD(o.latitude) OVER (PARTITION BY o.sidequest_id ORDER BY o.sort_order)
             ), 4326)::geography
           ) AS distance_m
         FROM objectives o
         JOIN sidequests s ON s.id = o.sidequest_id
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND o.checked_in_at IS NOT NULL
           AND o.latitude IS NOT NULL
           AND o.longitude IS NOT NULL
       ) sub
       WHERE distance_m IS NOT NULL`,
      [user.id],
    ),

    // 4b. Summary stats
    AppDataSource.query(
      `SELECT
         COUNT(DISTINCT oc.id)::int AS total_checkins,
         COUNT(DISTINCT s.id)::int AS total_completed,
         COUNT(DISTINCT LOWER(o.venue_name))::int AS unique_venues,
         COUNT(DISTINCT oc.objective_id)::int AS total_stops_visited
       FROM objective_checkins oc
       JOIN objectives o ON o.id = oc.objective_id
       JOIN sidequests s ON s.id = oc.sidequest_id
       WHERE oc.user_id = $1
         AND s.completed_at IS NOT NULL`,
      [user.id],
    ),

    // 4c. Per-city footprint
    AppDataSource.query(
      `SELECT
         s.city,
         COUNT(DISTINCT s.id)::int AS completed_count,
         COUNT(DISTINCT oc.id)::int AS checkin_count,
         COUNT(DISTINCT LOWER(o.venue_name))::int AS unique_venues
       FROM objective_checkins oc
       JOIN objectives o ON o.id = oc.objective_id
       JOIN sidequests s ON s.id = oc.sidequest_id
       WHERE oc.user_id = $1
         AND s.completed_at IS NOT NULL
       GROUP BY s.city
       ORDER BY completed_count DESC
       LIMIT 10`,
      [user.id],
    ),

    // 5. Vibe DNA — activity type breakdown from completed sidequests
    AppDataSource.query(
      `SELECT vibe, COUNT(*)::int AS count
       FROM (
         SELECT UNNEST(activity_types) AS vibe
         FROM sidequests
         WHERE user_id = $1
           AND completed_at IS NOT NULL
           AND deleted_at IS NULL
           AND CARDINALITY(activity_types) > 0
       ) sub
       GROUP BY vibe
       ORDER BY count DESC
       LIMIT 10`,
      [user.id],
    ),

    // 6. Intention DNA — intention breakdown from completed sidequests
    AppDataSource.query(
      `SELECT intention, COUNT(*)::int AS count
       FROM sidequests
       WHERE user_id = $1
         AND completed_at IS NOT NULL
         AND deleted_at IS NULL
         AND intention IS NOT NULL
       GROUP BY intention
       ORDER BY count DESC
       LIMIT 8`,
      [user.id],
    ),

    // 7a. Social growth — aggregated counts
    AppDataSource.query(
      `SELECT o.social_context AS context, COUNT(*)::int AS count
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.social_context IS NOT NULL
       GROUP BY o.social_context
       ORDER BY count DESC`,
      [user.id],
    ),

    // 7b. Social growth — ordered timeline (for river chart)
    AppDataSource.query(
      `SELECT o.social_context AS context
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.social_context IS NOT NULL
       ORDER BY s.completed_at ASC`,
      [user.id],
    ),
  ]);

  // Build venue DNA with percentages
  const totalVenueCheckins = venueDnaRows.reduce(
    (sum: number, r: Record<string, unknown>) => sum + (r.count as number),
    0,
  );
  const venueDna: VenueCategory[] = venueDnaRows.map(
    (r: Record<string, unknown>) => ({
      category: r.category as string,
      count: r.count as number,
      pct:
        totalVenueCheckins > 0
          ? Math.round(((r.count as number) / totalVenueCheckins) * 100)
          : 0,
    }),
  );

  // Build vibe DNA with percentages
  const totalVibes = vibeDnaRows.reduce(
    (sum: number, r: Record<string, unknown>) => sum + (r.count as number),
    0,
  );
  const vibeDna: VibeCount[] = vibeDnaRows.map(
    (r: Record<string, unknown>) => ({
      vibe: r.vibe as string,
      count: r.count as number,
      pct:
        totalVibes > 0
          ? Math.round(((r.count as number) / totalVibes) * 100)
          : 0,
    }),
  );

  // Build intention DNA with percentages
  const totalIntentions = intentionDnaRows.reduce(
    (sum: number, r: Record<string, unknown>) => sum + (r.count as number),
    0,
  );
  const intentionDna: IntentionCount[] = intentionDnaRows.map(
    (r: Record<string, unknown>) => ({
      intention: r.intention as string,
      count: r.count as number,
      pct:
        totalIntentions > 0
          ? Math.round(((r.count as number) / totalIntentions) * 100)
          : 0,
    }),
  );

  // Compute summary
  const summary = summaryRows[0] || {};
  const totalCompleted = (summary.total_completed as number) || 0;
  const totalStopsVisited = (summary.total_stops_visited as number) || 0;
  const totalMeters = (distanceRows[0]?.total_meters as number) || 0;

  const response: ProfileInsightsResponse = {
    activityHeatmap: heatmapRows.map((r: Record<string, unknown>) => ({
      date:
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date),
      count: r.count as number,
    })),
    venueDna,
    vibeDna,
    intentionDna,
    socialGrowth: (socialGrowthRows as { context: string; count: number }[]).map((r) => ({
      context: r.context,
      count: r.count,
    })),
    socialTimeline: (socialTimelineRows as { context: string }[]).map((r) => r.context),
    streakCalendar: streakRows.map((r: Record<string, unknown>) => ({
      weekStart:
        r.week_start instanceof Date
          ? r.week_start.toISOString().slice(0, 10)
          : String(r.week_start),
      count: r.count as number,
    })),
    footprint: {
      totalDistanceMiles: Math.round((totalMeters / 1609.34) * 10) / 10,
      totalCheckins: (summary.total_checkins as number) || 0,
      totalCompletedSidequests: totalCompleted,
      totalUniqueVenues: (summary.unique_venues as number) || 0,
      totalStopsVisited,
      avgStopsPerSidequest:
        totalCompleted > 0
          ? Math.round((totalStopsVisited / totalCompleted) * 10) / 10
          : 0,
      cities: cityRows.map((r: Record<string, unknown>) => ({
        city: r.city as string,
        completedCount: r.completed_count as number,
        checkinCount: r.checkin_count as number,
        uniqueVenues: r.unique_venues as number,
      })),
    },
  };

  await redisService.set(cacheKey, response, 600); // 10 min cache

  return c.json(response);
});
