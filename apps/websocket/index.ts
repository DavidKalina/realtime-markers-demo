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
    emoji: string;
    color: string;
    created_at: string;
    updated_at: string;
  };
}

interface WebSocketData {
  clientId: string;
  viewport?: BBox;
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

// Subscribe to the "marker_changes" channel immediately
redisSub.subscribe("marker_changes").catch((err) => {
  console.error("Failed to subscribe to marker_changes channel:", err);
});

// --- State Initialization ---
// Loads existing markers from the backend API on startup
async function initializeState() {
  try {
    const res = await fetch("http://backend:3000/api/markers");
    const markers = await res.json();
    const markerDataArray = markers.map((record: any) => {
      const [lng, lat] = record.location.coordinates;
      return {
        id: record.id,
        minX: lng,
        minY: lat,
        maxX: lng,
        maxY: lat,
        data: {
          emoji: record.emoji,
          color: record.color,
          created_at: record.created_at,
          updated_at: record.updated_at,
        },
      } as MarkerData;
    });
    tree.load(markerDataArray);
    console.log("RBush index initialized with markers");
  } catch (error) {
    console.error("Failed to initialize state:", error);
  }
}

// Call the initialization function on startup
initializeState();

// --- Process Redis Messages ---
redisSub.on("message", (channel, message) => {
  try {
    const { operation, record } = JSON.parse(message);
    const [lng, lat] = record.location.coordinates;

    const markerData: MarkerData = {
      id: record.id,
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      data: {
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
  port: 8080,
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
      ws.data = { clientId };
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
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "viewport_update") {
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
Bun.serve<WebSocketData>(server);

/* Example usage:
bulkLoadMarkers([
  {
    id: 'marker1',
    minX: -0.15,
    minY: 51.5,
    maxX: -0.15,
    maxY: 51.5,
    data: { emoji: '🏬', color: 'red', created_at: '...', updated_at: '...' }
  }
]);

ws.send(JSON.stringify({
  type: 'viewport_update',
  viewport: {
    north: 51.5,
    south: 51.4,
    east: -0.1,
    west: -0.2
  }
}));

redisClient.publish('marker_changes', JSON.stringify({
  operation: 'INSERT',
  record: {
    id: 'marker1',
    location: { coordinates: [-0.15, 51.5] },
    emoji: '🏬',
    color: 'red',
    created_at: '...',
    updated_at: '...'
  }
}));
*/
