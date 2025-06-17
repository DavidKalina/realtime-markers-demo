// routes/admin.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import AppDataSource from "../data-source";
import { Event } from "../entities/Event";
import { User } from "../entities/User";
import { Category } from "../entities/Category";
import { UserEventDiscovery } from "../entities/UserEventDiscovery";
import { UserEventRsvp } from "../entities/UserEventRsvp";

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
      .andWhere("event.status = :status", { status: "VERIFIED" })
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

    // Get all categories with event counts
    const categoriesWithCounts = await categoryRepository
      .createQueryBuilder("category")
      .leftJoin("category.events", "event")
      .select([
        "category.id",
        "category.name",
        "category.icon",
        "COUNT(event.id) as eventCount",
      ])
      .groupBy("category.id")
      .orderBy("eventCount", "DESC")
      .limit(10)
      .getRawMany();

    // Calculate total events for percentage calculation
    const totalEvents = await eventRepository.count();

    const categoryStats = categoriesWithCounts.map(
      (cat: {
        category_name: string;
        category_icon: string;
        eventCount: string;
      }) => ({
        name: cat.category_name,
        count: parseInt(cat.eventCount),
        percentage:
          totalEvents > 0
            ? Math.round((parseInt(cat.eventCount) / totalEvents) * 100)
            : 0,
        emoji: cat.category_icon || "📅",
      }),
    );

    return c.json(categoryStats);
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
      .andWhere("event.status = :status", { status: "VERIFIED" })
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
