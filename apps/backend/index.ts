import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import Redis from "ioredis";
import { OpenAI } from "openai";
import "reflect-metadata";
import { DataSource } from "typeorm";
import AppDataSource from "./data-source";
import { Event } from "./entities/Event";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { Category } from "./entities/Category";

// Create Hono app
const app = new Hono();

app.use("*", async (c, next) => {
  const url = c.req.url;
  if (url !== "/" && url.endsWith("/")) {
    // Redirect to URL without trailing slash
    return c.redirect(url.slice(0, -1));
  }
  return next();
});

// Apply middleware
app.use("*", logger());
app.use("*", cors());

// Create and initialize the database connection.
// Since migrations and seeding are handled externally,
// we set synchronize to false.

// Add these near the top of your file with other imports
let eventService: EventService;
let eventProcessingService: EventProcessingService;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create and initialize the database connection.
// Create and initialize the database connection.
// index.ts

// Remove the DataSource configuration here and just use:
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

const initializedDataSource = await initializeDatabase();

const categoryProcessingService = new CategoryProcessingService(
  openai,
  initializedDataSource.getRepository(Category)
);

// Initialize services after database is ready
eventService = new EventService(initializedDataSource);
eventProcessingService = new EventProcessingService(
  openai,
  initializedDataSource.getRepository(Event),
  categoryProcessingService
);
// Initialize Redis
const redisPub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
});

// Initialize OpenAI

// Instantiate services using the established connection.

// === EVENT ROUTES ===
const events = new Hono();

// Get all events
// Get all events
events.get("/", async (c) => {
  try {
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    const eventsData = await eventService.getEvents({
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

    const nearbyEvents = await eventService.getNearbyEvents(
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

events.get("/categories", async (c) => {
  try {
    const categories = await eventService.getAllCategories();
    return c.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return c.json({ error: "Failed to fetch categories" }, 500);
  }
});

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

    const result = await eventService.getEventsByCategories(categoryIds, {
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

// Updated search route with cursor-based pagination
events.get("/search", async (c) => {
  try {
    const query = c.req.query("q");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor"); // Use cursor instead of offset

    if (!query) {
      return c.json({ error: "Missing required query parameter: q" }, 400);
    }

    const { results: searchResults, nextCursor } = await eventService.searchEvents(
      query,
      limit ? parseInt(limit) : undefined,
      cursor || undefined
    );

    return c.json({
      query,
      results: searchResults.map(({ event, score }) => ({
        ...event,
        _score: score, // Add similarity score to each result
      })),
      nextCursor, // Include the cursor for the next page
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

    // Process the image directly using the EventProcessingService
    const scanResult = await eventProcessingService.processFlyerFromImage(buffer);

    // Define a minimum confidence threshold before creating an event
    const MIN_CONFIDENCE = 0.75; // You might want to adjust this threshold
    if (scanResult.confidence < MIN_CONFIDENCE) {
      return c.json(
        {
          error: "Low confidence in extracted information",
          confidence: scanResult.confidence,
          threshold: MIN_CONFIDENCE,
        },
        400
      );
    }

    // Map the extracted event details to your Event entity fields.
    const eventDetails = scanResult.eventDetails;
    const newEvent = await eventService.createEvent({
      emoji: eventDetails.emoji,
      title: eventDetails.title,
      eventDate: new Date(eventDetails.date),
      location: eventDetails.location,
      description: eventDetails.description,
      confidenceScore: scanResult.confidence,
      address: eventDetails.address,
      categoryIds: eventDetails.categories?.map((cat) => cat.id),
    });

    await redisPub.publish(
      "event_changes",
      JSON.stringify({
        operation: "INSERT",
        record: newEvent,
      })
    );

    return c.json(newEvent, 201);
  } catch (error) {
    console.error("Error processing flyer image:", error);
    return c.json({ error: "Failed to process flyer image" }, 500);
  }
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

    const newEvent = await eventService.createEvent(data);

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

events.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const event = await eventService.getEventById(id); // Get the event before deletion
    const isSuccess = await eventService.deleteEvent(id);

    if (isSuccess && event) {
      await redisPub.publish(
        "event_changes",
        JSON.stringify({
          operation: "DELETE",
          record: {
            id: event.id,
            location: event.location, // Include location for reference
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
    const event = await eventService.getEventById(id);

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return c.json({ error: "Failed to fetch event" }, 500);
  }
});

app.route("/api/events", events);

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
