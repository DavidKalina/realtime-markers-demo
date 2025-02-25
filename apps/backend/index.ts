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
import { compress } from "hono/compress";

// =============================================================================
// Define app context types
// =============================================================================
type AppVariables = {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  jobQueue: JobQueue;
  redisClient: Redis;
};

// Create Hono app with typed variables
const app = new Hono<{ Variables: AppVariables }>();

// =============================================================================
// App Configuration
// =============================================================================

// Add global middleware
app.use("*", logger());
app.use("*", cors());
app.use("*", compress());

// Trailing slash handler
app.use("*", async (c, next) => {
  const url = c.req.url;
  if (url !== "/" && url.endsWith("/")) {
    return c.redirect(url.slice(0, -1));
  }
  return next();
});

// =============================================================================
// Database Initialization
// =============================================================================

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

// =============================================================================
// Redis Configuration
// =============================================================================

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
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

// =============================================================================
// Services Initialization
// =============================================================================

async function initializeServices() {
  const dataSource = await initializeDatabase();

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

  return {
    eventService,
    eventProcessingService,
    categoryProcessingService,
  };
}

// Initialize all services async
const services = await initializeServices();

// Add services to context - now properly typed!
app.use("*", async (c, next) => {
  c.set("eventService", services.eventService);
  c.set("eventProcessingService", services.eventProcessingService);
  c.set("jobQueue", jobQueue);
  c.set("redisClient", redisPub);
  await next();
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// =============================================================================
// Routes - Events API
// =============================================================================

// Create sub-app with the same types
const events = new Hono<{ Variables: AppVariables }>();

// Get all events
events.get("/", async (c) => {
  try {
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

// Get nearby events
events.get("/nearby", async (c) => {
  try {
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

// Get all categories
events.get("/categories", async (c) => {
  try {
    const categories = await services.eventService.getAllCategories();
    return c.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return c.json({ error: "Failed to fetch categories" }, 500);
  }
});

// Get events by categories
events.get("/by-categories", async (c) => {
  try {
    const categoryIds = c.req.query("categories")?.split(",");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    if (!categoryIds || categoryIds.length === 0) {
      return c.json({ error: "Missing required query parameter: categories" }, 400);
    }

    const result = await services.eventService.getEventsByCategories(categoryIds, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return c.json(result);
  } catch (error) {
    console.error("Error fetching events by categories:", error);
    return c.json({ error: "Failed to fetch events by categories" }, 500);
  }
});

// Search events
events.get("/search", async (c) => {
  try {
    const query = c.req.query("q");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    if (!query) {
      return c.json({ error: "Missing required query parameter: q" }, 400);
    }

    const { results: searchResults, nextCursor } = await services.eventService.searchEvents(
      query,
      limit ? parseInt(limit) : undefined,
      cursor || undefined
    );

    return c.json({
      query,
      results: searchResults.map(({ event, score }) => ({
        ...event,
        _score: score,
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("Error searching events:", error);
    return c.json(
      {
        error: "Failed to search events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Process image - now properly typed!
events.post("/process", async (c) => {
  try {
    // Extract form data from the request
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");

    if (!imageEntry) {
      return c.json({ error: "Missing image file" }, 400);
    }

    // Ensure imageEntry is treated as a File object
    if (typeof imageEntry === "string") {
      return c.json({ error: "Invalid file upload" }, 400);
    }

    const file = imageEntry as File;

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type. Only JPEG and PNG files are allowed" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get job queue from context - properly typed!
    const jobQueue = c.get("jobQueue");

    // Create job with minimal metadata
    const jobId = await jobQueue.enqueue(
      "process_flyer",
      {
        filename: file.name,
        contentType: file.type,
        size: buffer.length,
      },
      {
        bufferData: buffer,
      }
    );

    // Return job ID immediately
    return c.json(
      {
        status: "processing",
        jobId,
        message: "Your image is being processed. Check status at /api/jobs/" + jobId,
        _links: {
          self: `/api/events/process/${jobId}`,
          status: `/api/jobs/${jobId}`,
          stream: `/api/jobs/${jobId}/stream`,
        },
      },
      202
    );
  } catch (error) {
    console.error("Error submitting flyer for processing:", error);
    return c.json({ error: "Failed to process flyer image" }, 500);
  }
});

// Get processing job status
events.get("/process/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const jobQueue = c.get("jobQueue");
  const eventService = c.get("eventService");

  // Get job status
  const job = await jobQueue.getJobStatus(jobId);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // If job is complete and has an event ID, fetch the event details
  if (job.status === "completed" && job.eventId) {
    const event = await eventService.getEventById(job.eventId);
    if (event) {
      return c.json({
        ...job,
        event: event,
      });
    }
  }

  // Otherwise just return the job status
  return c.json(job);
});

// Create a new event
events.post("/", async (c) => {
  try {
    const data = await c.req.json();

    // Validate input
    if (!data.title || !data.eventDate || !data.location?.coordinates) {
      return c.json({ error: "Missing required fields", receivedData: data }, 400);
    }

    // Ensure location is in GeoJSON format
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    const newEvent = await services.eventService.createEvent(data);

    // Publish to Redis for WebSocket service to broadcast
    await redisPub.publish(
      "event_changes",
      JSON.stringify({
        operation: "INSERT",
        record: newEvent,
      })
    );

    return c.json(newEvent);
  } catch (error) {
    console.error("Error creating event:", error);
    return c.json({ error: "Failed to create event" }, 500);
  }
});

// Delete event
events.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const event = await services.eventService.getEventById(id);
    const isSuccess = await services.eventService.deleteEvent(id);

    if (isSuccess && event) {
      await redisPub.publish(
        "event_changes",
        JSON.stringify({
          operation: "DELETE",
          record: {
            id: event.id,
            location: event.location,
          },
        })
      );
    }

    return c.json({ success: isSuccess });
  } catch (error) {
    console.error("Error deleting event:", error);
    return c.json({ error: "Failed to delete event" }, 500);
  }
});

// Get event by id
events.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const event = await services.eventService.getEventById(id);

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return c.json({ error: "Failed to fetch event" }, 500);
  }
});

// Register event routes
app.route("/api/events", events);

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
      // Instead of using 'comment', we'll use an empty event with the event type 'heartbeat'
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

// =============================================================================
// Error Handlers
// =============================================================================

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// =============================================================================
// Export app
// =============================================================================

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
