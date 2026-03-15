import type { Context } from "hono";
import type { AppContext } from "../types/context";
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

interface ProfileInsightsResponse {
  // Activity heatmap (last 16 weeks, daily)
  activityHeatmap: ActivityDay[];
  // Venue DNA (category breakdown from check-ins)
  venueDna: VenueCategory[];
  // Streak calendar (weekly activity for last 16 weeks)
  streakCalendar: WeekActivity[];
  // Adventure footprint
  footprint: {
    totalDistanceMiles: number;
    totalCheckins: number;
    totalCompletedItineraries: number;
    totalUniqueVenues: number;
    totalStopsVisited: number;
    avgStopsPerItinerary: number;
    cities: CityFootprint[];
  };
}

export const getProfileInsights = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const userId = user.userId || user.id;
  const redisService = c.get("redisService");
  const cacheKey = `profile-insights:${userId}`;

  const cached = await redisService.get<ProfileInsightsResponse>(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  try {
    const [
      heatmapRows,
      venueDnaRows,
      streakRows,
      distanceRows,
      summaryRows,
      cityRows,
    ] = await Promise.all([
      // 1. Activity heatmap — daily check-in counts for last 16 weeks
      AppDataSource.query(
        `SELECT DATE(checked_in_at) AS date, COUNT(*)::int AS count
         FROM itinerary_checkins
         WHERE user_id = $1
           AND checked_in_at >= NOW() - INTERVAL '16 weeks'
         GROUP BY DATE(checked_in_at)
         ORDER BY date`,
        [userId],
      ),

      // 2. Venue DNA — category breakdown from all check-ins
      AppDataSource.query(
        `SELECT
           ii.venue_category AS category,
           COUNT(*)::int AS count
         FROM itinerary_checkins ic
         JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
         WHERE ic.user_id = $1
           AND ii.venue_category IS NOT NULL
         GROUP BY ii.venue_category
         ORDER BY count DESC
         LIMIT 8`,
        [userId],
      ),

      // 3. Streak calendar — weekly check-in counts for last 16 weeks
      AppDataSource.query(
        `SELECT
           DATE_TRUNC('week', checked_in_at)::date AS week_start,
           COUNT(*)::int AS count
         FROM itinerary_checkins
         WHERE user_id = $1
           AND checked_in_at >= NOW() - INTERVAL '16 weeks'
         GROUP BY week_start
         ORDER BY week_start`,
        [userId],
      ),

      // 4a. Total distance (meters) using PostGIS on sequential checked-in stops
      AppDataSource.query(
        `SELECT COALESCE(SUM(distance_m), 0)::float AS total_meters FROM (
           SELECT
             ST_Distance(
               ST_SetSRID(ST_MakePoint(ii.longitude, ii.latitude), 4326)::geography,
               ST_SetSRID(ST_MakePoint(
                 LEAD(ii.longitude) OVER (PARTITION BY ii.itinerary_id ORDER BY ii.sort_order),
                 LEAD(ii.latitude) OVER (PARTITION BY ii.itinerary_id ORDER BY ii.sort_order)
               ), 4326)::geography
             ) AS distance_m
           FROM itinerary_items ii
           JOIN itineraries i ON i.id = ii.itinerary_id
           WHERE i.user_id = $1
             AND i.completed_at IS NOT NULL
             AND ii.checked_in_at IS NOT NULL
             AND ii.latitude IS NOT NULL
             AND ii.longitude IS NOT NULL
         ) sub
         WHERE distance_m IS NOT NULL`,
        [userId],
      ),

      // 4b. Summary stats
      AppDataSource.query(
        `SELECT
           COUNT(DISTINCT ic.id)::int AS total_checkins,
           COUNT(DISTINCT i.id)::int AS total_completed,
           COUNT(DISTINCT COALESCE(ii.google_place_id, LOWER(ii.venue_name)))::int AS unique_venues,
           COUNT(DISTINCT ic.itinerary_item_id)::int AS total_stops_visited
         FROM itinerary_checkins ic
         JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
         JOIN itineraries i ON i.id = ic.itinerary_id
         WHERE ic.user_id = $1
           AND i.completed_at IS NOT NULL`,
        [userId],
      ),

      // 4c. Per-city footprint
      AppDataSource.query(
        `SELECT
           i.city,
           COUNT(DISTINCT i.id)::int AS completed_count,
           COUNT(DISTINCT ic.id)::int AS checkin_count,
           COUNT(DISTINCT COALESCE(ii.google_place_id, LOWER(ii.venue_name)))::int AS unique_venues
         FROM itinerary_checkins ic
         JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
         JOIN itineraries i ON i.id = ic.itinerary_id
         WHERE ic.user_id = $1
           AND i.completed_at IS NOT NULL
         GROUP BY i.city
         ORDER BY completed_count DESC
         LIMIT 10`,
        [userId],
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
        totalCompletedItineraries: totalCompleted,
        totalUniqueVenues: (summary.unique_venues as number) || 0,
        totalStopsVisited,
        avgStopsPerItinerary:
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
  } catch (error) {
    console.error("Error fetching profile insights:", error);
    return c.json({ error: "Failed to fetch profile insights" }, 500);
  }
};
