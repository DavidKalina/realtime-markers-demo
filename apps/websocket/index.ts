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
  lastActivity?: number;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Define clear message types to keep code consistent
const MessageTypes = {
  // Connection messages
  CONNECTION_ESTABLISHED: "connection_established",

  // Viewport-related (what's visible to the user)
  VIEWPORT_UPDATE: "viewport_update",
  INITIAL_MARKERS: "initial_markers",

  // Real-time updates (actual data changes)
  MARKER_CREATED: "marker_created",
  MARKER_UPDATED: "marker_updated",
  MARKER_DELETED: "marker_deleted",

  // Existing message types (for compatibility)
  MARKER_DELETE: "marker_delete",
  MARKER_UPDATES_BATCH: "marker_updates_batch",
  DEBUG_EVENT: "debug_event",
};

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

// Helper function to check if a marker is in viewport
function isMarkerInViewport(marker: MarkerData, viewport: BBox): boolean {
  return (
    marker.minX >= viewport.minX &&
    marker.minX <= viewport.maxX &&
    marker.minY >= viewport.minY &&
    marker.minY <= viewport.maxY
  );
}

// IMPORTANT: This is where we handle real-time updates from Redis
redisSub.on("message", (channel, message) => {
  try {
    const { operation, record } = JSON.parse(message);

    // --- DELETION HANDLING ---
    if (operation === "DELETE") {
      // Find and remove the marker from the R-tree
      const markerToDelete = tree.all().find((marker) => marker.id === record.id);
      if (markerToDelete) {
        tree.remove(markerToDelete, (a, b) => a.id === b.id);

        // Send real-time deletion notification to all clients
        const deletePayload = JSON.stringify({
          type: MessageTypes.MARKER_DELETED, // New message type
          data: {
            id: record.id,
            timestamp: new Date().toISOString(),
          },
        });

        // Also send legacy message type for backward compatibility
        const legacyDeletePayload = JSON.stringify({
          type: MessageTypes.MARKER_DELETE, // Original message type
          data: {
            id: record.id,
            timestamp: new Date().toISOString(),
          },
        });

        clients.forEach((client) => {
          try {
            // Send both new and legacy message types
            client.send(deletePayload);
            client.send(legacyDeletePayload);
          } catch (error) {
            console.error(`Failed to send delete event to client ${client.data.clientId}:`, error);
          }
        });
      }
      return;
    }

    // --- CREATION/UPDATE HANDLING ---
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

    // Determine if this is a new marker or an update
    const isUpdate = operation === "UPDATE";
    const isCreate = operation === "CREATE" || operation === "INSERT";

    // If it's an update, remove the old marker first
    if (isUpdate) {
      tree.remove(markerData, (a, b) => a.id === b.id);
    }

    // Insert the new marker position
    tree.insert(markerData);

    // Add to pending updates for batch system (existing functionality)
    let updates = pendingUpdates.get(record.id);
    if (!updates) {
      updates = new Set();
      pendingUpdates.set(record.id, updates);
    }
    updates.add(markerData);

    // IMPORTANT NEW FEATURE: Send real-time marker created/updated notifications
    // This is separate from the viewport update system
    const realTimePayload = JSON.stringify({
      type: isCreate ? MessageTypes.MARKER_CREATED : MessageTypes.MARKER_UPDATED,
      data: markerData,
      timestamp: new Date().toISOString(),
    });

    // Send notifications to clients that have this marker in viewport
    clients.forEach((client) => {
      if (client.data.viewport && isMarkerInViewport(markerData, client.data.viewport)) {
        try {
          client.send(realTimePayload);
          console.log(
            `[Real-time] Sent ${isCreate ? "creation" : "update"} for marker ${
              markerData.id
            } to client ${client.data.clientId}`
          );
        } catch (error) {
          console.error(
            `Failed to send real-time update to client ${client.data.clientId}:`,
            error
          );
        }
      }
    });

    // Send debug event to all connected clients (existing functionality)
    const debugPayload = JSON.stringify({
      type: MessageTypes.DEBUG_EVENT,
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
// This is kept for compatibility with existing system
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
        type: MessageTypes.MARKER_UPDATES_BATCH,
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
          type: MessageTypes.CONNECTION_ESTABLISHED,
          clientId,
          instanceId: process.env.HOSTNAME,
        })
      );
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) {
      ws.data.lastActivity = Date.now();

      try {
        const data = JSON.parse(message.toString());

        // Handle viewport updates
        if (data.type === MessageTypes.VIEWPORT_UPDATE) {
          // First, create the viewport object
          const viewportBounds = {
            minX: data.viewport.west,
            minY: data.viewport.south,
            maxX: data.viewport.east,
            maxY: data.viewport.north,
          };

          // Store it
          ws.data.viewport = viewportBounds;

          // Do a single search with the same object
          const markersInView = tree.search(viewportBounds);

          // Log comprehensive details
          console.log(`[Viewport Update] Client ${ws.data.clientId}:`, {
            timestamp: new Date().toISOString(),
            viewport: data.viewport,
            currentMarkersInView: markersInView.length,
          });

          // Send markers only if there are any in the viewport
          if (markersInView.length > 0) {
            console.log(
              `[Send] Sending ${markersInView.length} markers to client ${ws.data.clientId}`
            );
            ws.send(
              JSON.stringify({
                type: MessageTypes.INITIAL_MARKERS,
                data: markersInView,
              })
            );
          } else {
            // Send an empty markers update to clear any existing markers
            console.log(`[Send] Sending empty markers array to client ${ws.data.clientId}`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.INITIAL_MARKERS,
                data: [],
              })
            );
          }
        }

        // Handle test events
        else if (data.type === "test_event") {
          console.log(`[TEST] Received test event command: ${data.command}`);

          if (data.command === "add_marker") {
            // Create a test marker
            const testMarker = {
              id: `test-${Date.now()}`,
              minX: (ws.data.viewport?.minX || 0) + 0.001,
              minY: (ws.data.viewport?.minY || 0) + 0.001,
              maxX: (ws.data.viewport?.minX || 0) + 0.001,
              maxY: (ws.data.viewport?.minY || 0) + 0.001,
              data: {
                title: "Test Marker",
                emoji: "🧪",
                color: "blue",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            };

            // Add to the tree
            tree.insert(testMarker);

            // Only send if viewport exists
            if (ws.data.viewport) {
              console.log(`[TEST] Sending test marker_created message`);
              ws.send(
                JSON.stringify({
                  type: MessageTypes.MARKER_CREATED,
                  data: testMarker,
                  count: 1,
                  timestamp: Date.now(),
                })
              );
            }
          }

          if (data.command === "remove_marker" && ws.data.viewport) {
            // Get markers in viewport
            const markersInView = tree.search(ws.data.viewport);

            if (markersInView.length > 0) {
              // Take the first marker to remove
              const markerToRemove = markersInView[0];

              // Remove from the tree
              tree.remove(markerToRemove, (a, b) => a.id === b.id);

              console.log(`[TEST] Sending test marker_deleted message for ${markerToRemove.id}`);
              ws.send(
                JSON.stringify({
                  type: MessageTypes.MARKER_DELETED,
                  data: {
                    id: markerToRemove.id,
                    timestamp: new Date().toISOString(),
                  },
                  count: 1,
                  timestamp: Date.now(),
                })
              );
            }
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

console.log(`WebSocket server started on port 8081`);

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
