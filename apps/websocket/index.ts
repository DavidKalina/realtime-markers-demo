import Redis from "ioredis";
import RBush from "rbush";
import type { Server, ServerWebSocket } from "bun";

// --- Type Definitions ---
interface MarkerData {
  id: string;
  minX: number; // longitude
  minY: number; // latitude
  maxX: number; // longitude
  maxY: number; // latitude
  data: {
    title: string;
    emoji: string;
    color: string;
    created_at: string;
    updated_at: string;
  };
}

interface WebSocketData {
  clientId: string;
  viewport?: BBox;
  lastActivity?: number; // Add this field to track last activity timestamp
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// --- In-Memory State ---
const tree = new RBush<MarkerData>();
const pendingUpdates = new Map<string, Set<MarkerData>>();
const clients = new Map<string, ServerWebSocket<WebSocketData>>();

// --- Create Redis Subscriber ---
const redisSub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Subscribe to the "event_changes" channel immediately
redisSub.subscribe("event_changes").catch((err) => {
  console.error("Failed to subscribe to event_changes channel:", err);
});

async function initializeState() {
  const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Init] Attempt ${attempt}/${maxRetries} - Fetching events from API at ${backendUrl}/api/events`
      );
      const res = await fetch(`${backendUrl}/api/events`);

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const events = await res.json();
      console.log(`[Init] Received ${events.length} events from API`);

      const markerDataArray = events
        .map((event: any) => {
          if (!event.location?.coordinates) {
            console.warn(`[Init] Event ${event.id} missing coordinates:`, event);
            return null;
          }

          const [lng, lat] = event.location.coordinates;
          return {
            id: event.id,
            minX: lng,
            minY: lat,
            maxX: lng,
            maxY: lat,
            data: {
              title: event.title,
              emoji: event.emoji,
              color: "red",
              created_at: event.created_at,
              updated_at: event.updated_at,
            },
          } as MarkerData;
        })
        .filter(Boolean);

      console.log(`[Init] Loading ${markerDataArray.length} events into RBush tree`);
      tree.clear(); // Clear any existing data
      tree.load(markerDataArray);
      console.log("[Init] RBush tree initialized successfully");

      // Log a sample of coordinates to verify data
      if (markerDataArray.length > 0) {
        console.log("[Init] Sample coordinates:", {
          lng: markerDataArray[0].minX,
          lat: markerDataArray[0].minY,
        });
      }

      return; // Success - exit the retry loop
    } catch (error) {
      console.error(`[Init] Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        console.error("[Init] Max retries reached, giving up");
        throw error;
      }

      console.log(`[Init] Waiting ${retryDelay}ms before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

redisSub.on("message", (channel, message) => {
  try {
    const { operation, record } = JSON.parse(message);

    if (operation === "DELETE") {
      // Find and remove the marker from the R-tree
      const markerToDelete = tree.all().find((marker) => marker.id === record.id);
      if (markerToDelete) {
        tree.remove(markerToDelete, (a, b) => a.id === b.id);

        // Send immediate delete notification to all clients
        const deletePayload = JSON.stringify({
          type: "marker_delete",
          data: {
            id: record.id,
            timestamp: new Date().toISOString(),
          },
        });

        clients.forEach((client) => {
          try {
            client.send(deletePayload);
          } catch (error) {
            console.error(`Failed to send delete event to client ${client.data.clientId}:`, error);
          }
        });
      }
      return;
    }

    const [lng, lat] = record.location.coordinates;

    const markerData: MarkerData = {
      id: record.id,
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      data: {
        title: record.title,
        emoji: record.emoji,
        color: record.color,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
    };

    // If it's an update, remove the old marker first
    if (operation === "UPDATE") {
      tree.remove(markerData, (a, b) => a.id === b.id);
    }

    // Insert the new marker position
    tree.insert(markerData);

    // Add to pending updates
    let updates = pendingUpdates.get(record.id);
    if (!updates) {
      updates = new Set();
      pendingUpdates.set(record.id, updates);
    }
    updates.add(markerData);

    // Send debug event to all connected clients
    const debugPayload = JSON.stringify({
      type: "debug_event",
      data: {
        operation,
        eventId: record.id,
        timestamp: new Date().toISOString(),
        coordinates: [lng, lat],
        details: record,
      },
    });

    clients.forEach((client) => {
      try {
        client.send(debugPayload);
      } catch (error) {
        console.error(`Failed to send debug event to client ${client.data.clientId}:`, error);
      }
    });
  } catch (error) {
    console.error("Error processing Redis message:", error);
  }
});

// --- Batch Update Routine ---
setInterval(() => {
  clients.forEach((client, clientId) => {
    if (!client.data.viewport) return;

    // Get all markers in client's viewport
    const markersInView = tree.search(client.data.viewport);
    const relevantUpdates = new Set<MarkerData>();

    markersInView.forEach((marker) => {
      const updates = pendingUpdates.get(marker.id);
      if (updates) {
        updates.forEach((update) => relevantUpdates.add(update));
      }
    });

    if (relevantUpdates.size > 0) {
      const payload = JSON.stringify({
        type: "marker_updates_batch",
        data: Array.from(relevantUpdates),
        timestamp: Date.now(),
      });

      try {
        client.send(payload);
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
      }
    }
  });

  pendingUpdates.clear();
}, 50);

// --- WebSocket Server Definition ---
const server = {
  port: 8081,
  fetch(req: Request, server: Server): Response | Promise<Response> {
    if (server.upgrade(req)) {
      return new Response();
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      // Use crypto.randomUUID() if available for a more robust client ID
      const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substr(2, 9);
      ws.data = {
        clientId,
        lastActivity: Date.now(), // Initialize with current timestamp
      };
      clients.set(clientId, ws);

      ws.send(
        JSON.stringify({
          type: "connection_established",
          clientId,
          instanceId: process.env.HOSTNAME,
        })
      );
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) {
      ws.data.lastActivity = Date.now();

      try {
        const data = JSON.parse(message.toString());
        if (data.type === "viewport_update") {
          console.log(`[Viewport Update] Client ${ws.data.clientId}:`, {
            timestamp: new Date().toISOString(),
            viewport: data.viewport,
            currentMarkersInView: tree.search({
              minX: data.viewport.west,
              minY: data.viewport.south,
              maxX: data.viewport.east,
              maxY: data.viewport.north,
            }).length,
          });
          // Convert viewport to RBush format
          ws.data.viewport = {
            minX: data.viewport.west,
            minY: data.viewport.south,
            maxX: data.viewport.east,
            maxY: data.viewport.north,
          };

          // Send initial markers in viewport
          const markersInView = tree.search(ws.data.viewport);
          if (markersInView.length > 0) {
            ws.send(
              JSON.stringify({
                type: "initial_markers",
                data: markersInView,
              })
            );
          }
        }
      } catch (error) {
        console.error(`Error processing message from ${ws.data.clientId}:`, error);
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      clients.delete(ws.data.clientId);
    },
  },
};

console.log(`WebSocket server started on port 8080`);

// Start the server with proper typing
async function startServer() {
  try {
    // Initialize state first
    await initializeState();

    // Log the tree state after initialization
    console.log(`[Startup] RBush tree contains ${tree.all().length} items`);
    if (tree.all().length > 0) {
      console.log("[Startup] Sample item:", tree.all()[0]);
    }

    // Start the server after initialization is complete
    Bun.serve(server);
    console.log(`WebSocket server started on port ${server.port}`);
  } catch (error) {
    console.error("[Startup] Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
