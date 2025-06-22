// routes/admin.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import { UserRole } from "../entities/User";
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
import { dashboardRouter } from "./dashboard";

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

// Mount dashboard router under /dashboard path
adminRouter.route("/dashboard", dashboardRouter);

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

adminRouter.post("/users/admins", async (c) => {
  try {
    const { email, password } = await c.req.json();
    const currentUser = c.get("user");
    const emailService = c.get("emailService");

    // Validate required fields
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }

    // Validate password strength
    if (password.length < 8) {
      return c.json(
        { error: "Password must be at least 8 characters long" },
        400,
      );
    }

    const userService = new UserService(emailService);
    const newAdmin = await userService.createAdminUser(
      {
        email,
        password,
      },
      currentUser?.email || "Unknown",
    );

    // Return user data without password hash
    const userData = {
      id: newAdmin.id,
      email: newAdmin.email,
      avatarUrl: newAdmin.avatarUrl,
      role: newAdmin.role,
      isVerified: newAdmin.isVerified,
      discoveryCount: newAdmin.discoveryCount,
      scanCount: newAdmin.scanCount,
      saveCount: newAdmin.saveCount,
      viewCount: newAdmin.viewCount,
      createdAt: newAdmin.createdAt,
      updatedAt: newAdmin.updatedAt,
    };
    return c.json(userData, 201);
  } catch (error) {
    console.error("Error creating admin user:", error);
    return c.json(
      {
        error: "Failed to create admin user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

adminRouter.delete("/users/admins/:id", async (c) => {
  try {
    const adminId = c.req.param("id");
    const currentUser = c.get("user");

    if (!currentUser || !currentUser.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userService = new UserService();
    await userService.deleteAdminUser(adminId, currentUser.id);

    return c.json({
      success: true,
      message: "Admin user deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admin user:", error);
    return c.json(
      {
        error: "Failed to delete admin user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
