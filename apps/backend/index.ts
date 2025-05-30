// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import "reflect-metadata";
import { DataSource } from "typeorm";
import AppDataSource from "./data-source";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { performanceMonitor } from "./middleware/performanceMonitor";
import { requestLimiter } from "./middleware/requestLimiter";
import { securityHeaders } from "./middleware/securityHeaders";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { eventsRouter } from "./routes/events";
import { filterRouter } from "./routes/filters";
import { friendshipsRouter } from "./routes/friendships";
import { internalRouter } from "./routes/internalRoutes";
import plansRouter from "./routes/plans";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { EventExtractionService } from "./services/event-processing/EventExtractionService";
import { EventSimilarityService } from "./services/event-processing/EventSimilarityService";
import { ImageProcessingService } from "./services/event-processing/ImageProcessingService";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import { FriendshipService } from "./services/FriendshipService";
import { JobQueue } from "./services/JobQueue";
import { LevelingService } from "./services/LevelingService";
import { PlanService } from "./services/PlanService";
import { CacheService } from "./services/shared/CacheService";
import { ConfigService } from "./services/shared/ConfigService";
import { GoogleGeocodingService } from "./services/shared/GoogleGeocodingService";
import { OpenAIService } from "./services/shared/OpenAIService";
import { RateLimitService } from "./services/shared/RateLimitService";
import { StorageService } from "./services/shared/StorageService";
import { UserPreferencesService } from "./services/UserPreferences";
import type { AppContext } from "./types/context";
import { NotificationService } from "./services/NotificationService";
import { NotificationHandler } from "./services/NotificationHandler";
import { notificationsRouter } from "./routes/notifications";
import { groupsRouter } from "./routes/groups";
import { placesRouter } from "./routes/places";
import { categoriesRouter } from "./routes/categories";
import { redisService, redisClient } from "./services/shared/redis";
import { Redis } from "ioredis";
import { RedisService } from "./services/shared/RedisService";
import { GroupService } from "./services/GroupService";
import { AuthService } from "./services/AuthService";
import { User } from "./entities/User";

// Create the app with proper typing
const app = new Hono<AppContext>();

// Add a global error handler for unhandled Redis errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Add a connection test function
async function testRedisConnection() {
  try {
    console.log("Testing Redis connection...");
    const result = await redisClient.ping();
    console.log("Redis connection test successful:", result);
    return true;
  } catch (error) {
    console.error("Redis connection test failed:", error);
    return false;
  }
}

// Test connection after a short delay to allow for initialization
setTimeout(() => {
  testRedisConnection();
}, 5000);

// Apply global middlewares
app.use("*", logger());
app.use("*", cors());
app.use("*", securityHeaders());
app.use(
  "*",
  requestLimiter({
    maxBodySize: 5 * 1024 * 1024, // 5MB for file uploads
    maxUrlLength: 2048,
    maxHeadersSize: 8192,
  }),
);

// Initialize rate limit service
RateLimitService.getInstance().initRedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
});

// Add performance monitoring after Redis initialization
app.use("*", performanceMonitor(redisClient));

app.use("*", async (c, next) => {
  const url = c.req.url;
  if (url !== "/" && url.endsWith("/")) {
    return c.redirect(url.slice(0, -1));
  }
  return next();
});

app.get("/api/health", (c) => {
  const isDbConnected = AppDataSource.isInitialized;

  if (!isDbConnected) {
    return c.json(
      {
        status: "initializing",
        message: "Database connection in progress",
        timestamp: new Date().toISOString(),
        db_connection: isDbConnected ? "connected" : "connecting",
        storage: {
          configured:
            !!process.env.DO_SPACE_ACCESS_KEY &&
            !!process.env.DO_SPACE_SECRET_KEY,
        },
      },
      200,
    );
  }

  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    db_connection: "connected",
  });
});

// src/index.ts (updated section)

// Update your initialization function
const initializeDatabase = async (
  retries = 5,
  delay = 2000,
): Promise<DataSource> => {
  for (let i = 0; i < retries; i++) {
    try {
      await AppDataSource.initialize();
      console.log("Database connection established");
      return AppDataSource;
    } catch (error) {
      console.error(`Database initialization attempt ${i + 1} failed:`, error);

      if (i === retries - 1) {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Failed to initialize database after all retries");
};

// Initialize OpenAI service with Redis for rate limiting
OpenAIService.initRedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
});

const jobQueue = new JobQueue(redisClient);

CacheService.initRedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD ?? "",
});

// Initialize services
async function initializeServices() {
  console.log("Initializing database connection...");
  const dataSource = await initializeDatabase();
  console.log("Database connection established, now initializing services");

  // Initialize config service
  const configService = ConfigService.getInstance();

  const categoryRepository = dataSource.getRepository(Category);
  const eventRepository = dataSource.getRepository(Event);

  const categoryProcessingService = new CategoryProcessingService(
    categoryRepository,
  );

  // Create RedisService instance
  const redisService = RedisService.getInstance(redisClient);

  // Initialize EventService with RedisService
  const eventService = new EventService(dataSource, redisService);

  // Create the event similarity service
  const eventSimilarityService = new EventSimilarityService(
    eventRepository,
    configService,
  );

  // Create the image processing service
  const imageProcessingService = new ImageProcessingService();

  StorageService.getInstance();

  // Create the event extraction service
  const eventExtractionService = new EventExtractionService(
    categoryProcessingService,
    GoogleGeocodingService.getInstance(),
  );

  // Create event processing service with all dependencies
  const eventProcessingService = new EventProcessingService({
    categoryProcessingService,
    eventSimilarityService,
    locationResolutionService: GoogleGeocodingService.getInstance(),
    imageProcessingService,
    configService,
    eventExtractionService,
  });

  // Initialize the UserPreferencesService
  const userPreferencesService = new UserPreferencesService(
    dataSource,
    redisService,
  );

  const storageService = StorageService.getInstance();

  // Initialize the PlanService
  const planService = new PlanService(dataSource);

  // Initialize the LevelingService
  const levelingService = new LevelingService(dataSource, redisService);

  // Initialize the FriendshipService
  const friendshipService = new FriendshipService(dataSource);

  // Initialize the NotificationService
  const notificationService = NotificationService.getInstance(
    redisClient,
    dataSource,
  );

  // Initialize the GroupService
  const groupService = new GroupService(dataSource);

  // Initialize the AuthService
  const authService = new AuthService(
    dataSource.getRepository(User),
    userPreferencesService,
    levelingService,
    dataSource,
  );

  // Initialize and start the NotificationHandler
  const notificationHandler = NotificationHandler.getInstance(
    redisClient,
    dataSource,
  );
  await notificationHandler.start();

  function setupCleanupSchedule() {
    const CLEANUP_HOUR = 3;
    const BATCH_SIZE = 100;
    let lastRunDate = ""; // Track the date of the last run

    setInterval(() => {
      const now = new Date();
      const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

      // Run if it's between 3:00-3:15 AM and we haven't run today
      if (
        now.getHours() === CLEANUP_HOUR &&
        now.getMinutes() >= 0 &&
        now.getMinutes() <= 15 &&
        lastRunDate !== today
      ) {
        console.log("Scheduling daily event cleanup");
        jobQueue.enqueueCleanupJob(BATCH_SIZE);
        lastRunDate = today;
      }
    }, 60 * 1000);
  }

  console.log("Services initialized successfully");

  setupCleanupSchedule();

  return {
    eventService,
    eventProcessingService,
    categoryProcessingService,
    userPreferencesService,
    storageService,
    planService,
    levelingService,
    friendshipService,
    notificationService,
    notificationHandler,
    groupService,
    authService,
  };
}

// Initialize all services async
const services = await initializeServices();

app.use("*", async (c, next) => {
  c.set("eventService", services.eventService);
  c.set("eventProcessingService", services.eventProcessingService);
  c.set("jobQueue", jobQueue);
  c.set("redisClient", redisClient);
  c.set("redisService", redisService);
  c.set("userPreferencesService", services.userPreferencesService);
  c.set("storageService", services.storageService);
  c.set("planService", services.planService);
  c.set("levelingService", services.levelingService);
  c.set("friendshipService", services.friendshipService);
  c.set("notificationService", services.notificationService);
  c.set("groupService", services.groupService);
  c.set("authService", services.authService);
  await next();
});

// Register event routes using the router from routes/events.ts
app.route("/api/events", eventsRouter);
app.route("/api/auth", authRouter);
app.route("/api/admin", adminRouter);
app.route("/api/filters", filterRouter);
app.route("/api/plans", plansRouter);
app.route("/api/internal", internalRouter);
app.route("/api/friendships", friendshipsRouter);
app.route("/api/notifications", notificationsRouter);
app.route("/api/groups", groupsRouter);
app.route("/api/places", placesRouter);
app.route("/api/categories", categoriesRouter);
// =============================================================================
// Jobs API - Server-Sent Events
// =============================================================================

// Job status streaming endpoint
app.get("/api/jobs/:jobId/stream", async (c) => {
  const jobId = c.req.param("jobId");

  // Use Hono's streamSSE
  return streamSSE(c, async (stream) => {
    // Create a dedicated Redis subscriber client for streaming
    // Note: We keep direct Redis usage here since it's for streaming
    const redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    try {
      // Send initial job state
      const initialData = await redisService.get(`job:${jobId}`);

      if (initialData) {
        await stream.writeSSE({ data: JSON.stringify(initialData) });
      } else {
        await stream.writeSSE({
          data: JSON.stringify({ id: jobId, status: "not_found" }),
        });
        stream.close();
        return;
      }

      // Subscribe to job update channel
      await redisSubscriber.subscribe(`job:${jobId}:updates`);

      // Set up message handler
      const messageHandler = async (_channel: string, message: string) => {
        await stream.writeSSE({ data: message });

        try {
          const data = JSON.parse(message);
          if (data.status === "completed" || data.status === "failed") {
            setTimeout(() => {
              redisSubscriber.quit();
              stream.close();
            }, 100);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      };

      redisSubscriber.on("message", messageHandler);

      // Clean up when the stream is closed
      c.req.raw.signal.addEventListener("abort", () => {
        redisSubscriber.off("message", messageHandler);
        redisSubscriber.quit();
      });

      // Keep the connection alive with a heartbeat
      const heartbeatInterval = setInterval(async () => {
        await stream.writeSSE({
          event: "heartbeat",
          data: "", // Empty data for a heartbeat
        });
      }, 30000);

      // Clean up the heartbeat when the stream is closed
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
      });
    } catch (error) {
      console.error("Error in SSE stream:", error);
      await stream.writeSSE({
        data: JSON.stringify({ error: "Stream error" }),
      });
      redisSubscriber.quit();
      stream.close();
    }
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
