// index.ts
import "reflect-metadata";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import Redis from "ioredis";
import { DataSource } from "typeorm";
import { Marker } from "./entities/Marker";
import { Category } from "./entities/Category";
import { FlyerImage } from "./entities/FlyerImage";
import { MarkerService } from "./services/markerService";
import { seedDatabase } from "./seeds";

// Initialize Redis client for publishing
const redisPub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Initialize TypeORM connection
const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Marker, Category, FlyerImage],
  synchronize: true, // Set to true only in development
  logging: true,
});

// Create Hono app
const app = new Hono();

// Apply middleware
app.use("*", logger());
app.use("*", cors());

// Initialize the data source and create marker service
let markerService: MarkerService;

// Initialize function
async function initialize() {
  try {
    await dataSource.initialize();

    await dataSource.query("CREATE EXTENSION IF NOT EXISTS postgis");

    await dataSource.synchronize();
    console.log("Database schema synchronized");

    // Check if database needs seeding (you can add more sophisticated checks)
    markerService = new MarkerService(dataSource);
    const markerCount = (await markerService.getMarkers()).length;

    if (markerCount === 0) {
      console.log("Seeding database...");
      await seedDatabase(dataSource);
    }
    console.log("Data Source has been initialized!");
  } catch (error) {}
}

// Call initialize
initialize().catch((error) => {
  console.error("Error during initialization:", error);
  process.exit(1);
});

// === MARKER ROUTES ===
const markers = new Hono();

// Get all markers
markers.get("/", async (c) => {
  try {
    const markers = await markerService.getMarkers();
    return c.json(markers);
  } catch (error) {
    console.error("Error fetching markers:", error);
    return c.json({ error: "Failed to fetch markers" }, 500);
  }
});

// Create a new marker
markers.post("/", async (c) => {
  try {
    const data = await c.req.json();

    // Validate input
    if (!data.location?.coordinates || !data.emoji || !data.color) {
      return c.json({ error: "Missing required fields", receivedData: data }, 400);
    }

    // Ensure location is in GeoJSON format
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    const [lng, lat] = data.location.coordinates;
    const newMarker = await markerService.createMarker(lat, lng, data.emoji, data.color);

    // Publish to Redis for WebSocket service to broadcast
    await redisPub.publish(
      "marker_changes",
      JSON.stringify({
        operation: "INSERT",
        record: newMarker,
      })
    );

    return c.json(newMarker);
  } catch (error) {
    console.error("Error creating marker:", error);
    return c.json({ error: "Failed to create marker" }, 500);
  }
});

// Get marker by ID
markers.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const marker = await markerService.getMarkerById(id);

    if (!marker) {
      return c.json({ error: "Marker not found" }, 404);
    }

    return c.json(marker);
  } catch (error) {
    console.error("Error fetching marker:", error);
    return c.json({ error: "Failed to fetch marker" }, 500);
  }
});

// Update marker
markers.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await c.req.json();

    // Check if marker exists
    const existingMarker = await markerService.getMarkerById(id);

    if (!existingMarker) {
      return c.json({ error: "Marker not found" }, 404);
    }

    // Ensure location is in GeoJSON format if provided
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    const updatedMarker = await markerService.updateMarker(id, data);

    // Publish to Redis for WebSocket service to broadcast
    await redisPub.publish(
      "marker_changes",
      JSON.stringify({
        operation: "UPDATE",
        record: updatedMarker,
      })
    );

    return c.json(updatedMarker);
  } catch (error) {
    console.error("Error updating marker:", error);
    return c.json({ error: "Failed to update marker" }, 500);
  }
});

// Delete marker
markers.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Check if marker exists
    const marker = await markerService.getMarkerById(id);

    if (!marker) {
      return c.json({ error: "Marker not found" }, 404);
    }

    await markerService.deleteMarker(id);

    // Publish to Redis for WebSocket service to broadcast
    await redisPub.publish(
      "marker_changes",
      JSON.stringify({
        operation: "DELETE",
        record: { id },
      })
    );

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting marker:", error);
    return c.json({ error: "Failed to delete marker" }, 500);
  }
});

// Get nearby markers
markers.get("/nearby", async (c) => {
  try {
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");
    const radius = c.req.query("radius");

    if (!lat || !lng) {
      return c.json({ error: "Missing required query parameters: lat and lng" }, 400);
    }

    const markers = await markerService.getNearbyMarkers(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : undefined
    );

    return c.json(markers);
  } catch (error) {
    console.error("Error fetching nearby markers:", error);
    return c.json({ error: "Failed to fetch nearby markers" }, 500);
  }
});

// Mount the marker routes
app.route("/api/markers", markers);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Start server
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
