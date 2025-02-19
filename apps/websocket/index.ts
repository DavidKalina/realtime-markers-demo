import Redis from "ioredis";
import RBush from "rbush";
import type { Server, ServerWebSocket } from "bun";

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

// Initialize RBush
const tree = new RBush<MarkerData>();
const pendingUpdates = new Map<string, Set<MarkerData>>();
const clients = new Map<string, ServerWebSocket<WebSocketData>>();

// Create Redis client
const redisSub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Batch updates every 50ms
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

// Handle Redis messages
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

    // Remove old marker position if it's an update
    if (operation === "UPDATE") {
      tree.remove(markerData, (a, b) => a.id === b.id);
    }

    // Insert new marker position
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

// Bulk load initial data if needed
function bulkLoadMarkers(markers: MarkerData[]) {
  tree.load(markers);
}

// Properly type the WebSocket server
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
      const clientId = Math.random().toString(36).substr(2, 9);
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

// Example usage:
/*
// Initialize with some markers
bulkLoadMarkers([
  {
    id: 'marker1',
    minX: -0.15,  // longitude
    minY: 51.5,   // latitude
    maxX: -0.15,
    maxY: 51.5,
    data: { type: 'store', name: 'Shop 1' }
  }
  // ... more markers
]);

// Client viewport update
ws.send(JSON.stringify({
  type: 'viewport_update',
  viewport: {
    north: 51.5,
    south: 51.4,
    east: -0.1,
    west: -0.2
  }
}));

// Publish marker update
redisClient.publish('marker_changes', JSON.stringify({
  id: 'marker1',
  lat: 51.5,
  lng: -0.15,
  type: 'update',
  data: { type: 'store', name: 'Shop 1' }
}));
*/
