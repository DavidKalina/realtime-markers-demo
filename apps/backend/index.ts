import "reflect-metadata";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import Redis from "ioredis";
import { DataSource } from "typeorm";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { FlyerImage } from "./entities/FlyerImage";
import { EventService } from "./services/EventService";
import { EventProcessingService } from "./services/EventProcessingService";
import { OpenAI } from "openai";
import { ThirdSpace } from "./entities/ThirdSpace";

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
const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Event, Category, FlyerImage, ThirdSpace],
  synchronize: true,
  logging: true,
  connectTimeoutMS: 10000,
  ssl: false,
});

dataSource
  .initialize()
  .then(() => {
    console.log("Database connection established");
  })
  .catch((error) => {
    console.error("Database connection error:", error);
    process.exit(1);
  });

// Initialize Redis
const redisPub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Instantiate services using the established connection.
const eventService = new EventService(dataSource);
const eventProcessingService = new EventProcessingService(
  openai,
  dataSource.getRepository(Event),
  dataSource.getRepository(FlyerImage)
);

// === EVENT ROUTES ===
const events = new Hono();

// Get all events
events.get("/", async (c) => {
  try {
    const eventsData = await eventService.getEvents();
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

// Get event by id

// Mount event routes
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
