// routes/admin.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import AppDataSource from "../data-source";
import { Event, EventStatus } from "../entities/Event";
import { User, UserRole } from "../entities/User";
import { Category } from "../entities/Category";
import { UserEventDiscovery } from "../entities/UserEventDiscovery";
import { UserEventRsvp } from "../entities/UserEventRsvp";
import {
  getQueryInsightsHandler,
  getPopularQueriesHandler,
  getLowHitRateQueriesHandler,
  getZeroResultQueriesHandler,
  getQueryStatsHandler,
  updateQueryFlagsHandler,
  getQueryClustersHandler,
  findSimilarQueriesHandler,
} from "../handlers/queryAnalyticsHandlers";
import { UserService } from "../services/UserService";

export const adminRouter = new Hono<AppContext>();

// Apply IP, rate limiting, auth, and admin middleware to all routes
adminRouter.use("*", ip());
adminRouter.use(
  "*",
  rateLimit({
    maxRequests: 30, // 30 requests per minute for admin routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `admin:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
adminRouter.use("*", authMiddleware);
adminRouter.use("*", adminAuthMiddleware);

adminRouter.get("/images/:id/image", async (c) => {
  try {
    const id = c.req.param("id");
    const eventService = c.get("eventService");
    const storageService = c.get("storageService"); // Make sure this is available in context

    const event = await eventService.getEventById(id);

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    if (!event.originalImageUrl) {
      return c.json(
        { error: "No original image available for this event" },
        404,
      );
    }

    // Generate a signed URL that expires in 1 hour
    const signedUrl = await storageService.getSignedUrl(
      event.originalImageUrl,
      3600,
    );

    return c.json({
      eventId: event.id,
      originalImageUrl: signedUrl,
    });
  } catch (error) {
    console.error("Error fetching original image:", error);
    return c.json({ error: "Failed to fetch original image" }, 500);
  }
});

adminRouter.get("/cache/health", async (c) => {
  try {
    const redisClient = c.get("redisClient");

    // Check Redis connection
    const redisStatus = redisClient
      ? (await redisClient.ping()) === "PONG"
      : false;

    return c.json({
      status: "healthy",
      redis: {
        connected: redisStatus,
        memory: redisClient ? await redisClient.info("memory") : null,
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
      },
    });
  } catch (error) {
    console.error("Error checking cache health:", error);
    return c.json({ error: "Failed to check cache health" }, 500);
  }
});

// Get system health and stats
adminRouter.get("/health", async (c) => {
  try {
    const redisClient = c.get("redisClient");

    // Check Redis connection
    const redisStatus = redisClient
      ? (await redisClient.ping()) === "PONG"
      : false;

    return c.json({
      status: "healthy",
      redis: {
        connected: redisStatus,
        memory: redisClient ? await redisClient.info("memory") : null,
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
      },
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Error checking system health:", error);
    return c.json({ error: "Failed to check system health" }, 500);
  }
});

// Recalculate scan and save counts
adminRouter.post("/recalculate-counts", async (c) => {
  try {
    const eventService = c.get("eventService");
    const result = await eventService.recalculateCounts();

    return c.json({
      success: true,
      message: "Counts recalculated successfully",
      result,
    });
  } catch (error) {
    console.error("Error recalculating counts:", error);
    return c.json(
      {
        success: false,
        error: "Failed to recalculate counts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Dashboard Metrics Endpoint
adminRouter.get("/dashboard/metrics", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);
    const userRepository = AppDataSource.getRepository(User);
    const userEventDiscoveryRepository =
      AppDataSource.getRepository(UserEventDiscovery);

    // Get current date and calculate time ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Get total active events (events that haven't ended yet)
    const totalActiveEvents = await eventRepository
      .createQueryBuilder("event")
      .where("event.endDate > :now", { now })
      .andWhere("event.status IN (:...statuses)", {
        statuses: ["VERIFIED", "PENDING"],
      })
      .getCount();

    // Get users registered this month
    const usersThisMonth = await userRepository
      .createQueryBuilder("user")
      .where("user.createdAt >= :startOfMonth", { startOfMonth })
      .getCount();

    // Get events scanned this week (from UserEventDiscovery)
    const eventsScannedThisWeek = await userEventDiscoveryRepository
      .createQueryBuilder("discovery")
      .where("discovery.discoveredAt >= :startOfWeek", { startOfWeek })
      .getCount();

    return c.json({
      totalActiveEvents,
      usersThisMonth,
      eventsScannedThisWeek,
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return c.json(
      {
        error: "Failed to fetch dashboard metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Recent Activity Feed Endpoint
adminRouter.get("/dashboard/activity", async (c) => {
  try {
    const userEventDiscoveryRepository =
      AppDataSource.getRepository(UserEventDiscovery);
    const userRepository = AppDataSource.getRepository(User);
    const eventRepository = AppDataSource.getRepository(Event);
    const categoryRepository = AppDataSource.getRepository(Category);

    const activities: Array<{
      id: string;
      type:
        | "event_scanned"
        | "user_registered"
        | "event_created"
        | "category_added";
      title: string;
      description: string;
      timestamp: string;
      user?: {
        name: string;
        avatar?: string;
      };
      metadata?: Record<string, string | number | boolean>;
    }> = [];

    // Get recent event scans (last 24 hours)
    const recentScans = await userEventDiscoveryRepository
      .createQueryBuilder("discovery")
      .leftJoinAndSelect("discovery.user", "user")
      .leftJoinAndSelect("discovery.event", "event")
      .where("discovery.discoveredAt >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("discovery.discoveredAt", "DESC")
      .limit(10)
      .getMany();

    for (const scan of recentScans) {
      activities.push({
        id: `scan_${scan.id}`,
        type: "event_scanned",
        title: `New event scanned: '${scan.event.title}'`,
        description: `Event was scanned by user ${scan.user.displayName || scan.user.email}`,
        timestamp: scan.discoveredAt.toISOString(),
        user: {
          name: scan.user.displayName || scan.user.email,
          avatar: scan.user.avatarUrl,
        },
        metadata: {
          eventId: scan.event.id,
          eventTitle: scan.event.title,
        },
      });
    }

    // Get recent user registrations (last 24 hours)
    const recentUsers = await userRepository
      .createQueryBuilder("user")
      .where("user.createdAt >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("user.createdAt", "DESC")
      .limit(5)
      .getMany();

    for (const user of recentUsers) {
      activities.push({
        id: `user_${user.id}`,
        type: "user_registered",
        title: "New user registered",
        description: `${user.displayName || user.email} joined the platform`,
        timestamp: user.createdAt.toISOString(),
        user: {
          name: user.displayName || user.email,
          avatar: user.avatarUrl,
        },
      });
    }

    // Get recent event creations (last 24 hours)
    const recentEvents = await eventRepository
      .createQueryBuilder("event")
      .where("event.createdAt >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("event.createdAt", "DESC")
      .limit(5)
      .getMany();

    for (const event of recentEvents) {
      activities.push({
        id: `event_${event.id}`,
        type: "event_created",
        title: `Event created: '${event.title}'`,
        description: "New event added to the platform",
        timestamp: event.createdAt.toISOString(),
        metadata: {
          eventId: event.id,
          eventTitle: event.title,
        },
      });
    }

    // Get recent category additions (last 24 hours)
    const recentCategories = await categoryRepository
      .createQueryBuilder("category")
      .where("category.createdAt >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("category.createdAt", "DESC")
      .limit(3)
      .getMany();

    for (const category of recentCategories) {
      activities.push({
        id: `category_${category.id}`,
        type: "category_added",
        title: `New category added: '${category.name}'`,
        description: "Category created by admin",
        timestamp: category.createdAt.toISOString(),
        metadata: {
          categoryId: category.id,
          categoryName: category.name,
        },
      });
    }

    // Sort all activities by timestamp (most recent first) and limit to 20
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return c.json(activities.slice(0, 20));
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return c.json(
      {
        error: "Failed to fetch recent activity",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Popular Categories Endpoint
adminRouter.get("/dashboard/categories", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);
    const categoryRepository = AppDataSource.getRepository(Category);
    const userEventDiscoveryRepository =
      AppDataSource.getRepository(UserEventDiscovery);

    // Get current date for time-based calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Enhanced query with multiple metrics
    const categoriesWithMetrics = await categoryRepository
      .createQueryBuilder("category")
      .leftJoin("category.events", "event")
      .leftJoin("event.discoveries", "discovery")
      .leftJoin("event.saves", "save")
      .leftJoin("event.views", "view")
      .select([
        "category.id as category_id",
        "category.name as category_name",
        "category.icon as category_icon",
        "COUNT(DISTINCT event.id) as total_events",
        "COUNT(DISTINCT CASE WHEN event.status = 'VERIFIED' THEN event.id END) as verified_events",
        "COUNT(DISTINCT CASE WHEN event.eventDate >= :startOfMonth THEN event.id END) as events_this_month",
        "COUNT(DISTINCT CASE WHEN event.eventDate >= :startOfWeek THEN event.id END) as events_this_week",
        "COUNT(DISTINCT discovery.id) as total_scans",
        "COUNT(DISTINCT CASE WHEN discovery.discoveredAt >= :thirtyDaysAgo THEN discovery.id END) as scans_last_30_days",
        "COUNT(DISTINCT save.id) as total_saves",
        "COUNT(DISTINCT view.id) as total_views",
        "AVG(event.scanCount) as avg_scan_count",
        "AVG(event.saveCount) as avg_save_count",
        "AVG(event.viewCount) as avg_view_count",
      ])
      .setParameters({
        startOfMonth,
        startOfWeek,
        thirtyDaysAgo,
      })
      .groupBy("category.id, category.name, category.icon")
      .orderBy("total_events", "DESC")
      .limit(15)
      .getRawMany();

    // Get total counts for percentage calculations
    const totalEvents = await eventRepository.count();
    const totalVerifiedEvents = await eventRepository.count({
      where: { status: EventStatus.VERIFIED },
    });
    const totalScans = await userEventDiscoveryRepository.count();
    const totalScansLast30Days = await userEventDiscoveryRepository
      .createQueryBuilder("discovery")
      .where("discovery.discoveredAt >= :thirtyDaysAgo", { thirtyDaysAgo })
      .getCount();

    // Calculate engagement scores and percentages
    const categoryStats = categoriesWithMetrics.map(
      (cat: {
        category_id: string;
        category_name: string;
        category_icon: string;
        total_events: string;
        verified_events: string;
        events_this_month: string;
        events_this_week: string;
        total_scans: string;
        scans_last_30_days: string;
        total_saves: string;
        total_views: string;
        avg_scan_count: string;
        avg_save_count: string;
        avg_view_count: string;
      }) => {
        const totalEventsCount = parseInt(cat.total_events);
        const verifiedEventsCount = parseInt(cat.verified_events);
        const eventsThisMonthCount = parseInt(cat.events_this_month);
        const eventsThisWeekCount = parseInt(cat.events_this_week);
        const totalScansCount = parseInt(cat.total_scans);
        const scansLast30DaysCount = parseInt(cat.scans_last_30_days);
        const totalSavesCount = parseInt(cat.total_saves);
        const totalViewsCount = parseInt(cat.total_views);

        // Calculate percentages
        const eventPercentage =
          totalEvents > 0 ? (totalEventsCount / totalEvents) * 100 : 0;
        const verifiedEventPercentage =
          totalVerifiedEvents > 0
            ? (verifiedEventsCount / totalVerifiedEvents) * 100
            : 0;
        const scanPercentage =
          totalScans > 0 ? (totalScansCount / totalScans) * 100 : 0;
        const recentScanPercentage =
          totalScansLast30Days > 0
            ? (scansLast30DaysCount / totalScansLast30Days) * 100
            : 0;

        // Calculate engagement score (weighted combination of scans, saves, views)
        const engagementScore = Math.round(
          totalScansCount * 0.5 + totalSavesCount * 0.3 + totalViewsCount * 0.2,
        );

        // Calculate average engagement per event
        const avgEngagementPerEvent =
          totalEventsCount > 0
            ? Math.round(engagementScore / totalEventsCount)
            : 0;

        return {
          id: cat.category_id,
          name: cat.category_name,
          emoji: cat.category_icon || "📅",
          metrics: {
            totalEvents: totalEventsCount,
            verifiedEvents: verifiedEventsCount,
            eventsThisMonth: eventsThisMonthCount,
            eventsThisWeek: eventsThisWeekCount,
            totalScans: totalScansCount,
            scansLast30Days: scansLast30DaysCount,
            totalSaves: totalSavesCount,
            totalViews: totalViewsCount,
            avgScanCount: parseFloat(cat.avg_scan_count) || 0,
            avgSaveCount: parseFloat(cat.avg_save_count) || 0,
            avgViewCount: parseFloat(cat.avg_view_count) || 0,
          },
          percentages: {
            ofTotalEvents: Math.round(eventPercentage * 100) / 100,
            ofVerifiedEvents: Math.round(verifiedEventPercentage * 100) / 100,
            ofTotalScans: Math.round(scanPercentage * 100) / 100,
            ofRecentScans: Math.round(recentScanPercentage * 100) / 100,
          },
          engagement: {
            score: engagementScore,
            avgPerEvent: avgEngagementPerEvent,
            trend: eventsThisWeekCount > 0 ? "trending" : "stable",
          },
        };
      },
    );

    // Add summary statistics
    const summary = {
      totalCategories: categoryStats.length,
      totalEvents,
      totalVerifiedEvents,
      totalScans,
      totalScansLast30Days,
      averageEventsPerCategory:
        categoryStats.length > 0
          ? Math.round(totalEvents / categoryStats.length)
          : 0,
      mostEngagedCategory:
        categoryStats.length > 0
          ? categoryStats.reduce((max, cat) =>
              cat.engagement.score > max.engagement.score ? cat : max,
            )
          : null,
      fastestGrowingCategory:
        categoryStats.length > 0
          ? categoryStats.reduce((max, cat) =>
              cat.metrics.eventsThisWeek > max.metrics.eventsThisWeek
                ? cat
                : max,
            )
          : null,
    };

    return c.json({
      categories: categoryStats,
      summary,
    });
  } catch (error) {
    console.error("Error fetching popular categories:", error);
    return c.json(
      {
        error: "Failed to fetch popular categories",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Category Trends Endpoint - Get category performance over time
adminRouter.get("/dashboard/category-trends", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);
    const userEventDiscoveryRepository =
      AppDataSource.getRepository(UserEventDiscovery);

    // Get trends for the last 12 weeks
    const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

    // Get weekly event creation trends by category
    const weeklyEventTrends = await eventRepository
      .createQueryBuilder("event")
      .leftJoin("event.categories", "category")
      .select([
        "category.name as category_name",
        "category.icon as category_icon",
        "DATE_TRUNC('week', event.createdAt) as week_start",
        "COUNT(DISTINCT event.id) as events_created",
        "COUNT(DISTINCT CASE WHEN event.status = :verifiedStatus THEN event.id END) as events_verified",
      ])
      .where("event.createdAt >= :startDate", { startDate: twelveWeeksAgo })
      .andWhere("category.id IS NOT NULL")
      .setParameter("verifiedStatus", EventStatus.VERIFIED)
      .groupBy(
        "category.name, category.icon, DATE_TRUNC('week', event.createdAt)",
      )
      .orderBy("week_start", "ASC")
      .addOrderBy("events_created", "DESC")
      .getRawMany();

    // Get weekly scan trends by category
    const weeklyScanTrends = await userEventDiscoveryRepository
      .createQueryBuilder("discovery")
      .leftJoin("discovery.event", "event")
      .leftJoin("event.categories", "category")
      .select([
        "category.name as category_name",
        "category.icon as category_icon",
        "DATE_TRUNC('week', discovery.discoveredAt) as week_start",
        "COUNT(DISTINCT discovery.id) as scans_count",
        "COUNT(DISTINCT discovery.userId) as unique_users",
      ])
      .where("discovery.discoveredAt >= :startDate", {
        startDate: twelveWeeksAgo,
      })
      .andWhere("category.id IS NOT NULL")
      .groupBy(
        "category.name, category.icon, DATE_TRUNC('week', discovery.discoveredAt)",
      )
      .orderBy("week_start", "ASC")
      .addOrderBy("scans_count", "DESC")
      .getRawMany();

    // Process and organize the data
    const trends = {
      eventCreation: weeklyEventTrends.reduce(
        (
          acc: Record<
            string,
            {
              name: string;
              emoji: string;
              weeklyData: Array<{
                week: string;
                eventsCreated: number;
                eventsVerified: number;
              }>;
            }
          >,
          row: {
            category_name: string;
            category_icon: string;
            week_start: string;
            events_created: string;
            events_verified: string;
          },
        ) => {
          const categoryName = row.category_name;
          if (!acc[categoryName]) {
            acc[categoryName] = {
              name: categoryName,
              emoji: row.category_icon || "📅",
              weeklyData: [],
            };
          }
          acc[categoryName].weeklyData.push({
            week: row.week_start,
            eventsCreated: parseInt(row.events_created),
            eventsVerified: parseInt(row.events_verified),
          });
          return acc;
        },
        {},
      ),
      scans: weeklyScanTrends.reduce(
        (
          acc: Record<
            string,
            {
              name: string;
              emoji: string;
              weeklyData: Array<{
                week: string;
                scansCount: number;
                uniqueUsers: number;
              }>;
            }
          >,
          row: {
            category_name: string;
            category_icon: string;
            week_start: string;
            scans_count: string;
            unique_users: string;
          },
        ) => {
          const categoryName = row.category_name;
          if (!acc[categoryName]) {
            acc[categoryName] = {
              name: categoryName,
              emoji: row.category_icon || "📅",
              weeklyData: [],
            };
          }
          acc[categoryName].weeklyData.push({
            week: row.week_start,
            scansCount: parseInt(row.scans_count),
            uniqueUsers: parseInt(row.unique_users),
          });
          return acc;
        },
        {},
      ),
    };

    // Calculate growth rates for each category
    const growthRates = Object.keys(trends.eventCreation).map(
      (categoryName) => {
        const eventData = trends.eventCreation[categoryName].weeklyData;
        const scanData = trends.scans[categoryName]?.weeklyData || [];

        // Calculate event creation growth (comparing last 4 weeks to previous 4 weeks)
        const recentEvents = eventData
          .slice(-4)
          .reduce(
            (sum: number, week: { eventsCreated: number }) =>
              sum + week.eventsCreated,
            0,
          );
        const previousEvents = eventData
          .slice(-8, -4)
          .reduce(
            (sum: number, week: { eventsCreated: number }) =>
              sum + week.eventsCreated,
            0,
          );
        const eventGrowthRate =
          previousEvents > 0
            ? ((recentEvents - previousEvents) / previousEvents) * 100
            : 0;

        // Calculate scan growth
        const recentScans = scanData
          .slice(-4)
          .reduce(
            (sum: number, week: { scansCount: number }) =>
              sum + week.scansCount,
            0,
          );
        const previousScans = scanData
          .slice(-8, -4)
          .reduce(
            (sum: number, week: { scansCount: number }) =>
              sum + week.scansCount,
            0,
          );
        const scanGrowthRate =
          previousScans > 0
            ? ((recentScans - previousScans) / previousScans) * 100
            : 0;

        return {
          categoryName,
          emoji: trends.eventCreation[categoryName].emoji,
          eventCreationGrowth: Math.round(eventGrowthRate * 100) / 100,
          scanGrowth: Math.round(scanGrowthRate * 100) / 100,
          trend:
            eventGrowthRate > 10
              ? "growing"
              : eventGrowthRate < -10
                ? "declining"
                : "stable",
        };
      },
    );

    return c.json({
      trends,
      growthRates: growthRates.sort(
        (a, b) => b.eventCreationGrowth - a.eventCreationGrowth,
      ),
      summary: {
        totalWeeks: 12,
        startDate: twelveWeeksAgo.toISOString(),
        endDate: new Date().toISOString(),
        categoriesTracked: Object.keys(trends.eventCreation).length,
      },
    });
  } catch (error) {
    console.error("Error fetching category trends:", error);
    return c.json(
      {
        error: "Failed to fetch category trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Busiest Times Endpoint
adminRouter.get("/dashboard/busiest-times", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);

    // Get events from the last 30 days to analyze patterns
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const events = await eventRepository
      .createQueryBuilder("event")
      .select([
        "EXTRACT(DOW FROM event.eventDate) as dayOfWeek",
        "EXTRACT(HOUR FROM event.eventDate) as hour",
        "COUNT(*) as eventCount",
      ])
      .where("event.eventDate >= :startDate", { startDate: thirtyDaysAgo })
      .groupBy("dayOfWeek, hour")
      .orderBy("eventCount", "DESC")
      .limit(10)
      .getRawMany();

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const timeStats = events.map(
      (event: { dayOfWeek: string; hour: string; eventCount: string }) => {
        const dayName = dayNames[parseInt(event.dayOfWeek)];
        const hour = parseInt(event.hour);
        const timeRange = `${hour}:00 ${hour < 12 ? "AM" : "PM"} - ${hour + 2}:00 ${hour + 2 < 12 ? "AM" : "PM"}`;

        return {
          day: dayName,
          time: timeRange,
          count: parseInt(event.eventCount),
        };
      },
    );

    return c.json(timeStats);
  } catch (error) {
    console.error("Error fetching busiest times:", error);
    return c.json(
      {
        error: "Failed to fetch busiest times",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Upcoming Events Endpoint
adminRouter.get("/dashboard/upcoming-events", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);

    // Get events starting in the next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const upcomingEvents = await eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "categories")
      .leftJoinAndSelect("event.rsvps", "rsvps")
      .where("event.eventDate >= :startDate", { startDate: now })
      .andWhere("event.eventDate <= :endDate", { endDate: thirtyDaysFromNow })
      .andWhere("event.status IN (:...statuses)", {
        statuses: ["VERIFIED", "PENDING"],
      })
      .orderBy("event.eventDate", "ASC")
      .limit(10)
      .getMany();

    const events = upcomingEvents.map((event) => {
      // Count RSVPs
      const attendeeCount =
        event.rsvps?.filter((rsvp: UserEventRsvp) => rsvp.status === "GOING")
          .length || 0;

      // Get primary category
      const primaryCategory = event.categories?.[0] || {
        name: "General",
        icon: "📅",
      };

      return {
        id: event.id,
        title: event.title,
        description: event.description || "No description available",
        startDate: event.eventDate.toISOString(),
        endDate: event.endDate?.toISOString() || event.eventDate.toISOString(),
        location: event.address || "Location TBD",
        category: {
          name: primaryCategory.name,
          emoji: primaryCategory.icon || "📅",
        },
        attendees: attendeeCount,
        maxAttendees: undefined, // Not currently tracked in the model
      };
    });

    return c.json(events);
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    return c.json(
      {
        error: "Failed to fetch upcoming events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Query Analytics Endpoints
adminRouter.get("/analytics/queries/insights", getQueryInsightsHandler);
adminRouter.get("/analytics/queries/popular", getPopularQueriesHandler);
adminRouter.get("/analytics/queries/low-hit-rate", getLowHitRateQueriesHandler);
adminRouter.get("/analytics/queries/zero-results", getZeroResultQueriesHandler);
adminRouter.get("/analytics/queries/:query/stats", getQueryStatsHandler);
adminRouter.post("/analytics/queries/update-flags", updateQueryFlagsHandler);
adminRouter.get("/analytics/queries/clusters", getQueryClustersHandler);
adminRouter.get("/analytics/queries/:query/similar", findSimilarQueriesHandler);

// User Management Endpoints
adminRouter.get("/users", async (c) => {
  try {
    const userService = new UserService();
    const { page, limit, search, role } = c.req.query();

    const params = {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search: search || undefined,
      role: role && role !== "" ? (role as UserRole) : undefined,
    };

    const result = await userService.getUsers(params);
    return c.json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json(
      {
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

adminRouter.get("/users/stats", async (c) => {
  try {
    const userService = new UserService();
    const stats = await userService.getUserStats();
    return c.json(stats);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return c.json(
      {
        error: "Failed to fetch user stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

adminRouter.get("/users/admins", async (c) => {
  try {
    const userService = new UserService();
    const adminUsers = await userService.getAdminUsers();
    return c.json(adminUsers);
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return c.json(
      {
        error: "Failed to fetch admin users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

adminRouter.get("/users/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const userService = new UserService();

    const user = await userService.getUserById(userId);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json(
      {
        error: "Failed to fetch user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

adminRouter.patch("/users/:id/role", async (c) => {
  try {
    const userId = c.req.param("id");
    const { role } = await c.req.json();

    if (!role || !["USER", "MODERATOR", "ADMIN"].includes(role)) {
      return c.json({ error: "Invalid role" }, 400);
    }

    const userService = new UserService();
    const updatedUser = await userService.updateUserRole({ userId, role });

    return c.json(updatedUser);
  } catch (error) {
    console.error("Error updating user role:", error);
    return c.json(
      {
        error: "Failed to update user role",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
