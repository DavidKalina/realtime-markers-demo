import { Hono } from "hono";
import type { AppContext } from "../types/context";
import AppDataSource from "../data-source";
import {
  Event,
  EventStatus,
  User,
  Category,
  UserEventDiscovery,
  UserEventRsvp,
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
} from "@realtime-markers/database";

export const dashboardRouter = new Hono<AppContext>();

// Dashboard Metrics Endpoint
dashboardRouter.get("/metrics", async (c) => {
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
      .where("event.end_date > :now", { now })
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
dashboardRouter.get("/activity", async (c) => {
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
        description: `Event was scanned by user ${scan.user.email}`,
        timestamp: scan.discoveredAt.toISOString(),
        user: {
          name: scan.user.email,
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
        description: `${user.email} joined the platform`,
        timestamp: user.createdAt.toISOString(),
        user: {
          name: user.email,
          avatar: user.avatarUrl,
        },
      });
    }

    // Get recent event creations (last 24 hours)
    const recentEvents = await eventRepository
      .createQueryBuilder("event")
      .where("event.created_at >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("event.created_at", "DESC")
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
      .where("category.created_at >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("category.created_at", "DESC")
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
dashboardRouter.get("/categories", async (c) => {
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
        "COUNT(DISTINCT CASE WHEN event.event_date >= :startOfMonth THEN event.id END) as events_this_month",
        "COUNT(DISTINCT CASE WHEN event.event_date >= :startOfWeek THEN event.id END) as events_this_week",
        "COUNT(DISTINCT discovery.id) as total_scans",
        "COUNT(DISTINCT CASE WHEN discovery.discoveredAt >= :thirtyDaysAgo THEN discovery.id END) as scans_last_30_days",
        "COUNT(DISTINCT save.id) as total_saves",
        "COUNT(DISTINCT view.id) as total_views",
        "AVG(event.scan_count) as avg_scan_count",
        "AVG(event.save_count) as avg_save_count",
        "AVG(event.view_count) as avg_view_count",
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
dashboardRouter.get("/category-trends", async (c) => {
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
        "DATE_TRUNC('week', event.created_at) as week_start",
        "COUNT(DISTINCT event.id) as events_created",
        "COUNT(DISTINCT CASE WHEN event.status = :verifiedStatus THEN event.id END) as events_verified",
      ])
      .where("event.created_at >= :startDate", { startDate: twelveWeeksAgo })
      .andWhere("category.id IS NOT NULL")
      .setParameter("verifiedStatus", EventStatus.VERIFIED)
      .groupBy(
        "category.name, category.icon, DATE_TRUNC('week', event.created_at)",
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
dashboardRouter.get("/busiest-times", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);

    // Get events from the last 30 days to analyze patterns
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const events = await eventRepository
      .createQueryBuilder("event")
      .select([
        "EXTRACT(DOW FROM event.event_date) as dayOfWeek",
        "EXTRACT(HOUR FROM event.event_date) as hour",
        "COUNT(*) as eventCount",
      ])
      .where("event.event_date >= :startDate", { startDate: thirtyDaysAgo })
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
dashboardRouter.get("/upcoming-events", async (c) => {
  try {
    const eventRepository = AppDataSource.getRepository(Event);

    // Get events starting in the next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const upcomingEvents = await eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "categories")
      .leftJoinAndSelect("event.rsvps", "rsvps")
      .where("event.event_date >= :startDate", { startDate: now })
      .andWhere("event.event_date <= :endDate", { endDate: thirtyDaysFromNow })
      .andWhere("event.status IN (:...statuses)", {
        statuses: ["VERIFIED", "PENDING"],
      })
      .orderBy("event.event_date", "ASC")
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

// Civic Engagement Metrics Endpoint
dashboardRouter.get("/civic-engagement/metrics", async (c) => {
  try {
    const civicEngagementRepository =
      AppDataSource.getRepository(CivicEngagement);

    // Get current date and calculate time ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Get total civic engagements
    const totalEngagements = await civicEngagementRepository.count();

    // Get engagements by type
    const engagementsByType = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select(["engagement.type as type", "COUNT(*) as count"])
      .groupBy("engagement.type")
      .getRawMany();

    // Get engagements by status
    const engagementsByStatus = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select(["engagement.status as status", "COUNT(*) as count"])
      .groupBy("engagement.status")
      .getRawMany();

    // Get engagements created this month
    const engagementsThisMonth = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .where("engagement.created_at >= :startOfMonth", { startOfMonth })
      .getCount();

    // Get engagements created this week
    const engagementsThisWeek = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .where("engagement.created_at >= :startOfWeek", { startOfWeek })
      .getCount();

    // Get implemented engagements (last 30 days)
    const implementedThisMonth = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .where("engagement.implemented_at >= :startOfMonth", { startOfMonth })
      .andWhere("engagement.status = :status", {
        status: CivicEngagementStatus.IMPLEMENTED,
      })
      .getCount();

    // Get unique users who created engagements
    const uniqueCreators = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select("COUNT(DISTINCT engagement.creator_id)", "count")
      .getRawOne();

    // Get engagements with location data
    const engagementsWithLocation = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .where("engagement.location IS NOT NULL")
      .getCount();

    // Get engagements with images
    const engagementsWithImages = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .where("engagement.image_urls IS NOT NULL")
      .andWhere("engagement.image_urls != '[]'")
      .getCount();

    return c.json({
      totalEngagements,
      engagementsByType: engagementsByType.reduce(
        (acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        },
        {} as Record<string, number>,
      ),
      engagementsByStatus: engagementsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentActivity: {
        thisMonth: engagementsThisMonth,
        thisWeek: engagementsThisWeek,
        implementedThisMonth: implementedThisMonth,
      },
      participation: {
        uniqueCreators: parseInt(uniqueCreators.count),
        withLocation: engagementsWithLocation,
        withImages: engagementsWithImages,
      },
      summary: {
        avgEngagementsPerMonth: Math.round(engagementsThisMonth),
        implementationRate:
          totalEngagements > 0
            ? Math.round((implementedThisMonth / totalEngagements) * 100)
            : 0,
        locationCoverage:
          totalEngagements > 0
            ? Math.round((engagementsWithLocation / totalEngagements) * 100)
            : 0,
        mediaCoverage:
          totalEngagements > 0
            ? Math.round((engagementsWithImages / totalEngagements) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching civic engagement metrics:", error);
    return c.json(
      {
        error: "Failed to fetch civic engagement metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Civic Engagement Trends Endpoint
dashboardRouter.get("/civic-engagement/trends", async (c) => {
  try {
    const civicEngagementRepository =
      AppDataSource.getRepository(CivicEngagement);

    // Get trends for the last 12 weeks
    const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

    // Get weekly engagement creation trends by type
    const weeklyEngagementTrends = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.type as engagement_type",
        "DATE_TRUNC('week', engagement.created_at) as week_start",
        "COUNT(DISTINCT engagement.id) as engagements_created",
        "COUNT(DISTINCT CASE WHEN engagement.status = :implementedStatus THEN engagement.id END) as engagements_implemented",
      ])
      .where("engagement.created_at >= :startDate", {
        startDate: twelveWeeksAgo,
      })
      .setParameter("implementedStatus", CivicEngagementStatus.IMPLEMENTED)
      .groupBy("engagement.type, DATE_TRUNC('week', engagement.created_at)")
      .orderBy("week_start", "ASC")
      .addOrderBy("engagements_created", "DESC")
      .getRawMany();

    // Get weekly engagement creation trends by status
    const weeklyStatusTrends = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.status as engagement_status",
        "DATE_TRUNC('week', engagement.created_at) as week_start",
        "COUNT(DISTINCT engagement.id) as engagements_count",
      ])
      .where("engagement.created_at >= :startDate", {
        startDate: twelveWeeksAgo,
      })
      .groupBy("engagement.status, DATE_TRUNC('week', engagement.created_at)")
      .orderBy("week_start", "ASC")
      .addOrderBy("engagements_count", "DESC")
      .getRawMany();

    // Process and organize the data
    const trends = {
      byType: weeklyEngagementTrends.reduce(
        (
          acc: Record<
            string,
            {
              type: string;
              weeklyData: Array<{
                week: string;
                engagementsCreated: number;
                engagementsImplemented: number;
              }>;
            }
          >,
          row: {
            engagement_type: string;
            week_start: string;
            engagements_created: string;
            engagements_implemented: string;
          },
        ) => {
          const engagementType = row.engagement_type;
          if (!acc[engagementType]) {
            acc[engagementType] = {
              type: engagementType,
              weeklyData: [],
            };
          }
          acc[engagementType].weeklyData.push({
            week: row.week_start,
            engagementsCreated: parseInt(row.engagements_created),
            engagementsImplemented: parseInt(row.engagements_implemented),
          });
          return acc;
        },
        {},
      ),
      byStatus: weeklyStatusTrends.reduce(
        (
          acc: Record<
            string,
            {
              status: string;
              weeklyData: Array<{
                week: string;
                engagementsCount: number;
              }>;
            }
          >,
          row: {
            engagement_status: string;
            week_start: string;
            engagements_count: string;
          },
        ) => {
          const engagementStatus = row.engagement_status;
          if (!acc[engagementStatus]) {
            acc[engagementStatus] = {
              status: engagementStatus,
              weeklyData: [],
            };
          }
          acc[engagementStatus].weeklyData.push({
            week: row.week_start,
            engagementsCount: parseInt(row.engagements_count),
          });
          return acc;
        },
        {},
      ),
    };

    // Calculate growth rates for each type
    const growthRates = Object.keys(trends.byType).map((engagementType) => {
      const typeData = trends.byType[engagementType].weeklyData;

      // Calculate engagement creation growth (comparing last 4 weeks to previous 4 weeks)
      const recentEngagements = typeData
        .slice(-4)
        .reduce(
          (sum: number, week: { engagementsCreated: number }) =>
            sum + week.engagementsCreated,
          0,
        );
      const previousEngagements = typeData
        .slice(-8, -4)
        .reduce(
          (sum: number, week: { engagementsCreated: number }) =>
            sum + week.engagementsCreated,
          0,
        );
      const engagementGrowthRate =
        previousEngagements > 0
          ? ((recentEngagements - previousEngagements) / previousEngagements) *
            100
          : 0;

      return {
        type: engagementType,
        engagementCreationGrowth: Math.round(engagementGrowthRate * 100) / 100,
        trend:
          engagementGrowthRate > 10
            ? "growing"
            : engagementGrowthRate < -10
              ? "declining"
              : "stable",
      };
    });

    return c.json({
      trends,
      growthRates: growthRates.sort(
        (a, b) => b.engagementCreationGrowth - a.engagementCreationGrowth,
      ),
      summary: {
        totalWeeks: 12,
        startDate: twelveWeeksAgo.toISOString(),
        endDate: new Date().toISOString(),
        typesTracked: Object.keys(trends.byType).length,
        statusesTracked: Object.keys(trends.byStatus).length,
      },
    });
  } catch (error) {
    console.error("Error fetching civic engagement trends:", error);
    return c.json(
      {
        error: "Failed to fetch civic engagement trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Civic Engagement Status Analysis Endpoint
dashboardRouter.get("/civic-engagement/status-analysis", async (c) => {
  try {
    const civicEngagementRepository =
      AppDataSource.getRepository(CivicEngagement);

    // Get detailed status analysis
    const statusAnalysis = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.status as status",
        "engagement.type as type",
        "COUNT(*) as count",
        "AVG(EXTRACT(EPOCH FROM (engagement.updated_at - engagement.created_at))/86400) as avg_days_to_update",
        "COUNT(CASE WHEN engagement.location IS NOT NULL THEN 1 END) as with_location",
        "COUNT(CASE WHEN engagement.image_urls IS NOT NULL AND engagement.image_urls != '[]' THEN 1 END) as with_images",
        "COUNT(CASE WHEN engagement.admin_notes IS NOT NULL THEN 1 END) as with_admin_notes",
      ])
      .groupBy("engagement.status, engagement.type")
      .orderBy("count", "DESC")
      .getRawMany();

    // Get implementation timeline analysis
    const implementationTimeline = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.type as type",
        "AVG(EXTRACT(EPOCH FROM (engagement.implemented_at - engagement.created_at))/86400) as avg_days_to_implement",
        "MIN(EXTRACT(EPOCH FROM (engagement.implemented_at - engagement.created_at))/86400) as min_days_to_implement",
        "MAX(EXTRACT(EPOCH FROM (engagement.implemented_at - engagement.created_at))/86400) as max_days_to_implement",
        "COUNT(*) as total_implemented",
      ])
      .where("engagement.status = :implementedStatus", {
        implementedStatus: CivicEngagementStatus.IMPLEMENTED,
      })
      .andWhere("engagement.implemented_at IS NOT NULL")
      .groupBy("engagement.type")
      .getRawMany();

    // Get status transition patterns
    const statusTransitions = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.status as current_status",
        "engagement.type as type",
        "COUNT(*) as count",
        "AVG(EXTRACT(EPOCH FROM (engagement.updated_at - engagement.created_at))/86400) as avg_age_days",
      ])
      .groupBy("engagement.status, engagement.type")
      .orderBy("count", "DESC")
      .getRawMany();

    return c.json({
      statusBreakdown: statusAnalysis.map(
        (item: {
          status: string;
          type: string;
          count: string;
          avg_days_to_update: string;
          with_location: string;
          with_images: string;
          with_admin_notes: string;
        }) => ({
          status: item.status,
          type: item.type,
          count: parseInt(item.count),
          avgDaysToUpdate: parseFloat(item.avg_days_to_update) || 0,
          withLocation: parseInt(item.with_location),
          withImages: parseInt(item.with_images),
          withAdminNotes: parseInt(item.with_admin_notes),
        }),
      ),
      implementationMetrics: implementationTimeline.map(
        (item: {
          type: string;
          avg_days_to_implement: string;
          min_days_to_implement: string;
          max_days_to_implement: string;
          total_implemented: string;
        }) => ({
          type: item.type,
          avgDaysToImplement: parseFloat(item.avg_days_to_implement) || 0,
          minDaysToImplement: parseFloat(item.min_days_to_implement) || 0,
          maxDaysToImplement: parseFloat(item.max_days_to_implement) || 0,
          totalImplemented: parseInt(item.total_implemented),
        }),
      ),
      statusTransitions: statusTransitions.map(
        (item: {
          current_status: string;
          type: string;
          count: string;
          avg_age_days: string;
        }) => ({
          status: item.current_status,
          type: item.type,
          count: parseInt(item.count),
          avgAgeDays: parseFloat(item.avg_age_days) || 0,
        }),
      ),
      summary: {
        totalStatuses: statusAnalysis.length,
        totalImplemented: implementationTimeline.reduce(
          (sum, item) => sum + parseInt(item.total_implemented),
          0,
        ),
        avgImplementationTime:
          implementationTimeline.length > 0
            ? Math.round(
                implementationTimeline.reduce(
                  (sum, item) => sum + parseFloat(item.avg_days_to_implement),
                  0,
                ) / implementationTimeline.length,
              )
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching civic engagement status analysis:", error);
    return c.json(
      {
        error: "Failed to fetch civic engagement status analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Civic Engagement Geographic Analysis Endpoint
dashboardRouter.get("/civic-engagement/geographic", async (c) => {
  try {
    const civicEngagementRepository =
      AppDataSource.getRepository(CivicEngagement);

    // Get engagements with location data
    const geographicData = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.type as type",
        "engagement.status as status",
        "engagement.address as address",
        "ST_X(engagement.location) as longitude",
        "ST_Y(engagement.location) as latitude",
        "engagement.location_notes as location_notes",
        "engagement.created_at as created_at",
      ])
      .where("engagement.location IS NOT NULL")
      .orderBy("engagement.created_at", "DESC")
      .getRawMany();

    // Get location density analysis
    const locationDensity = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.address as address",
        "COUNT(*) as engagement_count",
        "COUNT(CASE WHEN engagement.status = :implementedStatus THEN 1 END) as implemented_count",
        "COUNT(CASE WHEN engagement.type = :positiveType THEN 1 END) as positive_count",
        "COUNT(CASE WHEN engagement.type = :negativeType THEN 1 END) as negative_count",
        "COUNT(CASE WHEN engagement.type = :ideaType THEN 1 END) as idea_count",
      ])
      .where("engagement.location IS NOT NULL")
      .setParameter("implementedStatus", CivicEngagementStatus.IMPLEMENTED)
      .setParameter("positiveType", CivicEngagementType.POSITIVE_FEEDBACK)
      .setParameter("negativeType", CivicEngagementType.NEGATIVE_FEEDBACK)
      .setParameter("ideaType", CivicEngagementType.IDEA)
      .groupBy("engagement.address")
      .orderBy("engagement_count", "DESC")
      .limit(20)
      .getRawMany();

    // Get recent geographic activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentGeographicActivity = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .select([
        "engagement.address as address",
        "COUNT(*) as recent_count",
        "engagement.type as type",
        "engagement.status as status",
      ])
      .where("engagement.location IS NOT NULL")
      .andWhere("engagement.created_at >= :startDate", {
        startDate: thirtyDaysAgo,
      })
      .groupBy("engagement.address, engagement.type, engagement.status")
      .orderBy("recent_count", "DESC")
      .limit(10)
      .getRawMany();

    return c.json({
      geographicData: geographicData.map(
        (item: {
          type: string;
          status: string;
          address: string;
          longitude: string;
          latitude: string;
          location_notes: string;
          created_at: string;
        }) => ({
          type: item.type,
          status: item.status,
          address: item.address,
          coordinates: {
            longitude: parseFloat(item.longitude),
            latitude: parseFloat(item.latitude),
          },
          locationNotes: item.location_notes,
          createdAt: item.created_at,
        }),
      ),
      locationDensity: locationDensity.map(
        (item: {
          address: string;
          engagement_count: string;
          implemented_count: string;
          positive_count: string;
          negative_count: string;
          idea_count: string;
        }) => ({
          address: item.address,
          totalEngagements: parseInt(item.engagement_count),
          implementedCount: parseInt(item.implemented_count),
          byType: {
            positive: parseInt(item.positive_count),
            negative: parseInt(item.negative_count),
            ideas: parseInt(item.idea_count),
          },
          implementationRate:
            parseInt(item.engagement_count) > 0
              ? Math.round(
                  (parseInt(item.implemented_count) /
                    parseInt(item.engagement_count)) *
                    100,
                )
              : 0,
        }),
      ),
      recentActivity: recentGeographicActivity.map(
        (item: {
          address: string;
          recent_count: string;
          type: string;
          status: string;
        }) => ({
          address: item.address,
          recentCount: parseInt(item.recent_count),
          type: item.type,
          status: item.status,
        }),
      ),
      summary: {
        totalWithLocation: geographicData.length,
        topLocation:
          locationDensity.length > 0 ? locationDensity[0].address : null,
        mostActiveLocation:
          locationDensity.length > 0 ? locationDensity[0].address : null,
        recentActivityCount: recentGeographicActivity.reduce(
          (sum, item) => sum + parseInt(item.recent_count),
          0,
        ),
      },
    });
  } catch (error) {
    console.error(
      "Error fetching civic engagement geographic analysis:",
      error,
    );
    return c.json(
      {
        error: "Failed to fetch civic engagement geographic analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Civic Engagement Recent Activity Endpoint
dashboardRouter.get("/civic-engagement/activity", async (c) => {
  try {
    const civicEngagementRepository =
      AppDataSource.getRepository(CivicEngagement);

    const activities: Array<{
      id: string;
      type:
        | "engagement_created"
        | "engagement_updated"
        | "engagement_implemented";
      title: string;
      description: string;
      timestamp: string;
      user?: {
        name: string;
        avatar?: string;
      };
      metadata?: Record<string, string | number | boolean>;
    }> = [];

    // Get recent civic engagement creations (last 24 hours)
    const recentEngagements = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .leftJoinAndSelect("engagement.creator", "creator")
      .where("engagement.created_at >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .orderBy("engagement.created_at", "DESC")
      .limit(15)
      .getMany();

    for (const engagement of recentEngagements) {
      activities.push({
        id: `engagement_${engagement.id}`,
        type: "engagement_created",
        title: `New ${engagement.type.toLowerCase().replace("_", " ")}: '${engagement.title}'`,
        description: `Civic engagement created by ${engagement.creator.email}`,
        timestamp: engagement.createdAt.toISOString(),
        user: {
          name: engagement.creator.email,
          avatar: engagement.creator.avatarUrl,
        },
        metadata: {
          engagementId: engagement.id,
          engagementType: engagement.type,
          engagementStatus: engagement.status,
          hasLocation: !!engagement.location,
          hasImages: !!(
            engagement.imageUrls && engagement.imageUrls.length > 0
          ),
        },
      });
    }

    // Get recent status updates (last 24 hours)
    const recentUpdates = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .leftJoinAndSelect("engagement.creator", "creator")
      .where("engagement.updated_at >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .andWhere("engagement.updated_at != engagement.created_at")
      .orderBy("engagement.updated_at", "DESC")
      .limit(10)
      .getMany();

    for (const engagement of recentUpdates) {
      activities.push({
        id: `update_${engagement.id}`,
        type: "engagement_updated",
        title: `Engagement updated: '${engagement.title}'`,
        description: `Status: ${engagement.status}`,
        timestamp: engagement.updatedAt.toISOString(),
        user: {
          name: engagement.creator.email,
          avatar: engagement.creator.avatarUrl,
        },
        metadata: {
          engagementId: engagement.id,
          engagementType: engagement.type,
          engagementStatus: engagement.status,
          hasAdminNotes: !!engagement.adminNotes,
        },
      });
    }

    // Get recent implementations (last 24 hours)
    const recentImplementations = await civicEngagementRepository
      .createQueryBuilder("engagement")
      .leftJoinAndSelect("engagement.creator", "creator")
      .where("engagement.implemented_at >= :startDate", {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .andWhere("engagement.status = :implementedStatus", {
        implementedStatus: CivicEngagementStatus.IMPLEMENTED,
      })
      .orderBy("engagement.implemented_at", "DESC")
      .limit(5)
      .getMany();

    for (const engagement of recentImplementations) {
      activities.push({
        id: `implemented_${engagement.id}`,
        type: "engagement_implemented",
        title: `Engagement implemented: '${engagement.title}'`,
        description: `Successfully implemented!`,
        timestamp: engagement.implementedAt!.toISOString(),
        user: {
          name: engagement.creator.email,
          avatar: engagement.creator.avatarUrl,
        },
        metadata: {
          engagementId: engagement.id,
          engagementType: engagement.type,
          daysToImplement:
            engagement.implementedAt && engagement.createdAt
              ? Math.round(
                  (engagement.implementedAt.getTime() -
                    engagement.createdAt.getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : 0,
        },
      });
    }

    // Sort all activities by timestamp (most recent first) and limit to 25
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return c.json(activities.slice(0, 25));
  } catch (error) {
    console.error("Error fetching civic engagement activity:", error);
    return c.json(
      {
        error: "Failed to fetch civic engagement activity",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
