// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";
import "reflect-metadata";
import { DataSource } from "typeorm";
import AppDataSource from "./data-source";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { CacheService } from "./services/CacheService";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import { JobQueue } from "./services/JobQueue";
import { OpenAIService } from "./services/OpenAIService";

type AppVariables = {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  jobQueue: JobQueue;
  redisClient: Redis;
};

// Create Hono app with typed variables
const app = new Hono<{ Variables: AppVariables }>();

// Add global middleware first (before any routes)
app.use("*", logger());
app.use("*", cors());

// Trailing slash handler
app.use("*", async (c, next) => {
  const url = c.req.url;
  if (url !== "/" && url.endsWith("/")) {
    return c.redirect(url.slice(0, -1));
  }
  return next();
});

// Set up a basic health endpoint early for healthchecks
// This should work even if database initialization is still in progress
app.get("/api/health", (c) => {
  const isDbConnected = AppDataSource.isInitialized;

  // If the DB is required for "healthy" status, reflect that in the status code
  if (!isDbConnected) {
    return c.json(
      {
        status: "initializing",
        message: "Database connection in progress",
        timestamp: new Date().toISOString(),
        db_connection: isDbConnected ? "connected" : "connecting",
      },
      200
    ); // Still return 200 to not fail healthchecks during startup
  }

  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    db_connection: "connected",
  });
});

// Database initialization function
const initializeDatabase = async (retries = 5, delay = 2000): Promise<DataSource> => {
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

// Redis Configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    // Exponential backoff with max delay of 5s
    return Math.min(times * 500, 5000);
  },
};

// Redis client for pub/sub operations
const redisPub = new Redis(redisConfig);

// Initialize Redis for services
CacheService.initRedis({
  host: redisConfig.host,
  port: redisConfig.port,
});

// Initialize OpenAI service
const openai = OpenAIService.getInstance();

// Initialize job queue
const jobQueue = new JobQueue(redisPub);

// Services Initialization
async function initializeServices() {
  console.log("Initializing database connection...");
  const dataSource = await initializeDatabase();
  console.log("Database connection established, now initializing services");

  // Initialize repositories
  const categoryRepository = dataSource.getRepository(Category);
  const eventRepository = dataSource.getRepository(Event);

  // Initialize services
  const categoryProcessingService = new CategoryProcessingService(openai, categoryRepository);
  const eventService = new EventService(dataSource);
  const eventProcessingService = new EventProcessingService(
    openai,
    eventRepository,
    categoryProcessingService
  );

  console.log("Services initialized successfully");
  return {
    eventService,
    eventProcessingService,
    categoryProcessingService,
  };
}

// Initialize all services async
const servicesPromise = initializeServices();

// Wait for services to be initialized and then add them to context
app.use("*", async (c, next) => {
  // Skip the wait for health check endpoint
  if (c.req.path === "/api/health") {
    await next();
    return;
  }

  try {
    // Wait for services to be initialized
    const services = await servicesPromise;

    // Add services to context
    c.set("eventService", services.eventService);
    c.set("eventProcessingService", services.eventProcessingService);
    c.set("jobQueue", jobQueue);
    c.set("redisClient", redisPub);

    await next();
  } catch (error) {
    console.error("Error initializing services:", error);
    return c.json(
      {
        error: "Service initialization error",
        message: "The application is still starting up. Please try again in a moment.",
      },
      503
    ); // Service Unavailable
  }
});

// Wait for services to be initialized and then add them to context
app.use("*", async (c, next) => {
  // Skip the wait for health check endpoint
  if (c.req.path === "/api/health") {
    await next();
    return;
  }

  try {
    // Wait for services to be initialized
    const services = await servicesPromise;

    // Add services to context
    c.set("eventService", services.eventService);
    c.set("eventProcessingService", services.eventProcessingService);
    c.set("jobQueue", jobQueue);
    c.set("redisClient", redisPub);

    await next();
  } catch (error) {
    console.error("Error initializing services:", error);
    return c.json(
      {
        error: "Service initialization error",
        message: "The application is still starting up. Please try again in a moment.",
      },
      503
    ); // Service Unavailable
  }
});

// Routes - Events API
const events = new Hono<{ Variables: AppVariables }>();

// Get all events
events.get("/", async (c) => {
  try {
    const services = await servicesPromise;
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    const eventsData = await services.eventService.getEvents({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return c.json(eventsData);
  } catch (error) {
    console.error("Error fetching events:", error);
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

// Rest of events routes...
events.get("/nearby", async (c) => {
  try {
    const services = await servicesPromise;
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");
    const radius = c.req.query("radius");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (!lat || !lng) {
      return c.json({ error: "Missing required query parameters: lat and lng" }, 400);
    }

    const nearbyEvents = await services.eventService.getNearbyEvents(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return c.json(nearbyEvents);
  } catch (error) {
    console.error("Error fetching nearby events:", error);
    return c.json({ error: "Failed to fetch nearby events" }, 500);
  }
});

// ... rest of the event routes ...

// Register event routes
app.route("/api/events", events);

// Jobs API - Server-Sent Events
app.get("/api/jobs/:jobId/stream", async (c) => {
  const jobId = c.req.param("jobId");

  // Use Hono's streamSSE
  return streamSSE(c, async (stream) => {
    // Create a dedicated Redis subscriber client
    const redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    });

    try {
      // Send initial job state
      const initialData = await redisPub.get(`job:${jobId}`);

      if (initialData) {
        await stream.writeSSE({ data: initialData });
      } else {
        await stream.writeSSE({
          data: JSON.stringify({ id: jobId, status: "not_found" }),
        });
        stream.close();
        return;
      }

      // ... rest of the stream handler ...
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

// Error Handlers
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Export app
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
