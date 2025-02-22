// index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import Redis from "ioredis";
import * as MarkerController from "./lib/markers-controllers";

// Initialize Redis client for publishing
const redisPub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Create Hono app
const app = new Hono();

// Apply middleware
app.use("*", logger());
app.use("*", cors());

// === MARKER ROUTES ===
const markers = new Hono();

// Get all markers
markers.get("/", async (c) => {
  try {
    const markers = await MarkerController.getMarkers();
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

    const newMarker = await MarkerController.createMarker(data);

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
    const marker = await MarkerController.getMarkerById(id);

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
    const marker = await MarkerController.getMarkerById(id);

    if (!marker) {
      return c.json({ error: "Marker not found" }, 404);
    }

    // Ensure location is in GeoJSON format if provided
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    const updatedMarker = await MarkerController.updateMarker(id, data);

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
    const marker = await MarkerController.getMarkerById(id);

    if (!marker) {
      return c.json({ error: "Marker not found" }, 404);
    }

    const deletedMarker = await MarkerController.deleteMarker(id);

    // Publish to Redis for WebSocket service to broadcast
    await redisPub.publish(
      "marker_changes",
      JSON.stringify({
        operation: "DELETE",
        record: { id },
      })
    );

    return c.json(deletedMarker);
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

    const markers = await MarkerController.getNearbyMarkers(
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

// Special case for nearby markers (comes before /:id to avoid route conflicts)
app.get("/api/markers/nearby", async (c) => {
  try {
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");
    const radius = c.req.query("radius");

    if (!lat || !lng) {
      return c.json({ error: "Missing required query parameters: lat and lng" }, 400);
    }

    const markers = await MarkerController.getNearbyMarkers(
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

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Initialize PostGIS if needed (optional)
import { setupPostGIS } from "./lib/postgis-utils";
setupPostGIS().catch(console.error);

// Start server
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
