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
import { eventsRouter } from "./routes/events";
import type { AppContext } from "./types/context";

// Create the app with proper typing
const app = new Hono<AppContext>();

app.use("*", logger());
app.use("*", cors());

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
      },
      200
    );
  }

  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    db_connection: "connected",
  });
});

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

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
};

const redisPub = new Redis(redisConfig);

CacheService.initRedis({
  host: redisConfig.host,
  port: redisConfig.port,
});

const openai = OpenAIService.getInstance();

const jobQueue = new JobQueue(redisPub);

async function initializeServices() {
  console.log("Initializing database connection...");
  const dataSource = await initializeDatabase();
  console.log("Database connection established, now initializing services");

  const categoryRepository = dataSource.getRepository(Category);
  const eventRepository = dataSource.getRepository(Event);

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
const services = await initializeServices();

// Add services to context - properly typed
app.use("*", async (c, next) => {
  c.set("eventService", services.eventService);
  c.set("eventProcessingService", services.eventProcessingService);
  c.set("jobQueue", jobQueue);
  c.set("redisClient", redisPub);
  await next();
});

// Register event routes using the router from routes/events.ts
app.route("/api/events", eventsRouter);

// =============================================================================
// Jobs API - Server-Sent Events
// =============================================================================

// Job status streaming endpoint
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
