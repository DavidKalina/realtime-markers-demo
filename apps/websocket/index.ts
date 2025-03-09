// Enhanced WebSocket server with session management and health check
import Redis from "ioredis";
import RBush from "rbush";
import type { Server, ServerWebSocket } from "bun";
import { SessionManager } from "./SessionManager";
import { EventProcessor } from "./EventProcessor";
import { FilterEvaluator } from "./FilterEvaluator";
import { SpatialIndex } from "./SpatialIndex";
import { SubscriptionManager } from "./SubscriptionManager";
import { ViewportManager } from "./ViewportManager";
import { MessageTypes } from "./messageTypes";

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
    categories: string[];
  };
}

interface WebSocketData {
  clientId: string;
  viewport?: BBox;
  lastActivity?: number;
  sessionId?: string; // Added for session management
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

// --- Create Redis Client ---
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

// --- Create Redis Subscriber ---
const redisSub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

// --- Initialize Session Manager ---
const sessionManager = new SessionManager(redis);
// --- Initialize Filtering System Services ---
const spatialIndex = new SpatialIndex();
const subscriptionManager = new SubscriptionManager(redis);
const viewportManager = new ViewportManager(spatialIndex);
const filterEvaluator = new FilterEvaluator(subscriptionManager, viewportManager);
const eventProcessor = new EventProcessor(
  subscriptionManager,
  viewportManager,
  filterEvaluator,
  spatialIndex
);

// System health state
const systemHealth = {
  backendConnected: false,
  redisConnected: false,
  lastBackendCheck: 0,
  lastRedisCheck: 0,
};

// Subscribe to the "event_changes" channel immediately
redisSub.subscribe("event_changes").catch((err) => {
  console.error("Failed to subscribe to event_changes channel:", err);
});

// Function to check Redis connection
async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    systemHealth.redisConnected = pong === "PONG";
    systemHealth.lastRedisCheck = Date.now();
    return systemHealth.redisConnected;
  } catch (error) {
    systemHealth.redisConnected = false;
    systemHealth.lastRedisCheck = Date.now();
    console.error("Redis connection check failed:", error);
    return false;
  }
}

// Function to check backend connection
async function checkBackendConnection(): Promise<boolean> {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${backendUrl}/api/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    systemHealth.backendConnected = response.status === 200;
    systemHealth.lastBackendCheck = Date.now();
    return systemHealth.backendConnected;
  } catch (error) {
    systemHealth.backendConnected = false;
    systemHealth.lastBackendCheck = Date.now();
    console.error("Backend connection check failed:", error);
    return false;
  }
}

async function initializeState() {
  const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Init] Attempt ${attempt}/${maxRetries} - Fetching events from API at ${backendUrl}/api/events`
      );
      const res = await fetch(`${backendUrl}/api/internal/events`);

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const events = await res.json();
      console.log(`[Init] Received ${events.length} events from API`);

      // Prepare data for both systems
      const markerDataArray = [];
      const spatialEvents = [];

      // Process events for both systems
      for (const event of events) {
        if (!event.location?.coordinates) {
          console.warn(`[Init] Event ${event.id} missing coordinates:`, event);
          continue;
        }

        const [lng, lat] = event.location.coordinates;

        // For legacy RBush tree
        markerDataArray.push({
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
            categories: event.categories.map((item: any) => item.name),
          },
        });

        // For new SpatialIndex
        spatialEvents.push({
          id: event.id,
          title: event.title,
          location: event.location,
          categories: event.categories.map((item: any) => item.name),
          status: event.status,
          tags: event.tags,
          createdAt: event.created_at,
          updatedAt: event.updated_at,
          creatorId: event.creator_id,
          description: event.description,
          emoji: event.emoji,
          color: event.color,
        });
      }

      // Initialize both indexing systems
      console.log(`[Init] Loading ${markerDataArray.length} events into RBush tree`);
      tree.clear();
      tree.load(markerDataArray);

      console.log(`[Init] Loading ${spatialEvents.length} events into SpatialIndex`);
      spatialIndex.clear();
      spatialIndex.bulkLoad(spatialEvents);

      console.log("[Init] RBush tree and SpatialIndex initialized successfully");

      // Set backend as connected
      systemHealth.backendConnected = true;
      systemHealth.lastBackendCheck = Date.now();
      return;
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

redisSub.on("message", (channel, message) => {
  // Set redis as connected
  systemHealth.redisConnected = true;
  systemHealth.lastRedisCheck = Date.now();

  if (channel === "event_changes") {
    try {
      const { operation, record } = JSON.parse(message);

      // --- DELETION HANDLING ---
      if (operation === "DELETE") {
        // Remove from both systems
        spatialIndex.removeEvent(record.id);
        const markerToDelete = tree.all().find((marker) => marker.id === record.id);
        if (markerToDelete) {
          tree.remove(markerToDelete, (a, b) => a.id === b.id);
        }

        // Send deletion messages (existing code)
        const deletePayload = JSON.stringify({
          type: MessageTypes.MARKER_DELETED,
          data: {
            id: record.id,
            timestamp: new Date().toISOString(),
          },
        });

        const legacyDeletePayload = JSON.stringify({
          type: MessageTypes.MARKER_DELETE,
          data: {
            id: record.id,
            timestamp: new Date().toISOString(),
          },
        });

        clients.forEach((client) => {
          try {
            client.send(deletePayload);
            client.send(legacyDeletePayload);
          } catch (error) {
            console.error(`Failed to send delete event to client ${client.data.clientId}:`, error);
          }
        });
        return;
      }

      // --- CREATION/UPDATE HANDLING ---
      if (!record.location || !record.location.coordinates) {
        console.warn(`Event ${record.id} missing coordinates, skipping`);
        return;
      }

      const [lng, lat] = record.location.coordinates;

      // Format for the legacy system
      const markerData = {
        id: record.id,
        minX: lng,
        minY: lat,
        maxX: lng,
        maxY: lat,
        data: {
          title: record.title,
          emoji: record.emoji,
          color: record.color || "red",
          created_at: record.created_at,
          updated_at: record.updated_at,
          categories: record.categories.map((item: any) => item.name),
        },
      };

      // Format for the new system
      const event = {
        id: record.id,
        title: record.title,
        location: record.location,
        categories: record.categories.map((item: any) => item.name),
        status: record.status,
        tags: record.tags || [],
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        creatorId: record.creator_id,
        description: record.description,
        emoji: record.emoji,
        color: record.color,
      };

      const isUpdate = operation === "UPDATE";
      const isCreate = operation === "CREATE" || operation === "INSERT";

      // Update both systems
      if (isUpdate) {
        tree.remove(markerData, (a, b) => a.id === b.id);
      }
      tree.insert(markerData);

      // Process with EventProcessor to find matching clients
      const clientEvents = eventProcessor.processEvent(event);

      // Send to matching clients with new filtering system
      for (const [clientId, events] of clientEvents.entries()) {
        const client = clients.get(clientId);
        if (!client) continue;

        client.send(
          JSON.stringify({
            type: MessageTypes.MAP_EVENTS,
            events,
          })
        );
      }

      // Legacy system - add to pending updates
      let updates = pendingUpdates.get(record.id);
      if (!updates) {
        updates = new Set();
        pendingUpdates.set(record.id, updates);
      }
      updates.add(markerData);

      // Send real-time updates (existing code)
      const realTimePayload = JSON.stringify({
        type: isCreate ? MessageTypes.MARKER_CREATED : MessageTypes.MARKER_UPDATED,
        data: markerData,
        timestamp: new Date().toISOString(),
      });

      // Legacy behavior - send to clients with this marker in viewport
      clients.forEach((client) => {
        if (client.data.viewport && isMarkerInViewport(markerData, client.data.viewport)) {
          try {
            client.send(realTimePayload);
          } catch (error) {
            console.error(
              `Failed to send real-time update to client ${client.data.clientId}:`,
              error
            );
          }
        }
      });

      // Keep the debug event (existing code)
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

// --- Health Check Routine ---
// Periodically check external services
setInterval(async () => {
  // Only check if last check was more than 30 seconds ago
  const now = Date.now();
  if (now - systemHealth.lastBackendCheck > 30000) {
    await checkBackendConnection();
  }
  if (now - systemHealth.lastRedisCheck > 30000) {
    await checkRedisConnection();
  }
}, 60000); // Run every minute

// --- WebSocket Server Definition ---
const server = {
  port: 8081,
  fetch(req: Request, server: Server): Response | Promise<Response> {
    // Handle HTTP requests for health check
    if (req.url.endsWith("/health")) {
      // Perform fresh checks if it's been over 10 seconds
      const now = Date.now();
      const promises = [];

      if (now - systemHealth.lastBackendCheck > 10000) {
        promises.push(checkBackendConnection());
      }

      if (now - systemHealth.lastRedisCheck > 10000) {
        promises.push(checkRedisConnection());
      }

      // Return health status
      return Promise.all(promises).then(() => {
        const isHealthy = systemHealth.backendConnected && systemHealth.redisConnected;
        const status = isHealthy ? 200 : 503;

        return new Response(
          JSON.stringify({
            status: isHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            services: {
              redis: {
                connected: systemHealth.redisConnected,
                lastChecked: new Date(systemHealth.lastRedisCheck).toISOString(),
              },
              backend: {
                connected: systemHealth.backendConnected,
                lastChecked: new Date(systemHealth.lastBackendCheck).toISOString(),
              },
            },
            clients: clients.size,
            markers: tree.all().length,
          }),
          {
            status,
            headers: { "Content-Type": "application/json" },
          }
        );
      });
    }

    if (server.upgrade(req)) {
      return new Response();
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      const tempClientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substr(2, 9);

      ws.data = {
        clientId: tempClientId,
        lastActivity: Date.now(),
      };
      clients.set(tempClientId, ws);

      // Register client with session manager
      sessionManager.registerClient(ws);

      ws.send(
        JSON.stringify({
          type: MessageTypes.CONNECTION_ESTABLISHED,
          clientId: tempClientId,
          instanceId: process.env.HOSTNAME,
        })
      );
    },

    async message(ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) {
      ws.data.lastActivity = Date.now();

      try {
        const data = JSON.parse(message.toString());

        if (data.type === "client_identification" && data.userId) {
          const oldClientId = ws.data.clientId;
          const newClientId = data.userId;

          // Update client ID in WebSocket data
          ws.data.clientId = newClientId;

          // Remove old client entry and add new one
          clients.delete(oldClientId);
          clients.set(newClientId, ws);

          // Update in session manager and subscription manager
          sessionManager.updateClientId(oldClientId, newClientId);
          subscriptionManager.updateClientId(oldClientId, newClientId);
          viewportManager.updateClientId(oldClientId, newClientId);

          // Send confirmation to client
          ws.send(
            JSON.stringify({
              type: MessageTypes.CONNECTION_ESTABLISHED,
              clientId: newClientId,
              instanceId: process.env.HOSTNAME,
            })
          );

          console.log(`Client ID updated from ${oldClientId} to ${newClientId}`);
          return;
        }

        const clientId = ws.data.clientId; // Assuming client ID is stored here

        // Handle existing session management messages
        if (
          [
            MessageTypes.CREATE_SESSION,
            MessageTypes.JOIN_SESSION,
            MessageTypes.ADD_JOB,
            MessageTypes.CANCEL_JOB,
            MessageTypes.CLEAR_SESSION,
          ].includes(data.type)
        ) {
          sessionManager.handleMessage(ws, message.toString());
          return;
        }

        // Handle new subscription management messages
        switch (data.type) {
          case MessageTypes.CREATE_SUBSCRIPTION:
            try {
              const subscriptionId = await subscriptionManager.createSubscription(
                clientId,
                data.filter,
                data.name
              );

              // Get the created subscription
              const subscription = subscriptionManager.getSubscription(subscriptionId);

              // Send confirmation to client
              ws.send(
                JSON.stringify({
                  type: MessageTypes.SUBSCRIPTION_CREATED,
                  subscription,
                })
              );

              // CRITICAL: Always send updated events after subscription changes
              const viewport = viewportManager.getViewport(clientId);
              if (viewport) {
                const events = eventProcessor.processViewportUpdate(
                  clientId,
                  viewport.boundingBox,
                  viewport.zoom
                );

                console.log(`Sending ${events.length} events after subscription creation`);

                // Always send MAP_EVENTS, even if the array is empty!
                ws.send(
                  JSON.stringify({
                    type: MessageTypes.MAP_EVENTS,
                    events: events,
                  })
                );
              }
            } catch (error: any) {
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ERROR,
                  message: "Failed to create subscription",
                  details: error.message,
                })
              );
            }
            break;

          case MessageTypes.UPDATE_SUBSCRIPTION:
            try {
              const updated = await subscriptionManager.updateSubscription(
                data.subscriptionId,
                data.filter,
                data.name
              );

              if (updated) {
                ws.send(
                  JSON.stringify({
                    type: MessageTypes.SUBSCRIPTION_UPDATED,
                    subscription: subscriptionManager.getSubscription(data.subscriptionId),
                  })
                );

                // Send updated events
                const viewport = viewportManager.getViewport(ws.data.clientId);
                if (viewport) {
                  const events = eventProcessor.processViewportUpdate(
                    ws.data.clientId,
                    viewport.boundingBox,
                    viewport.zoom
                  );

                  ws.send(
                    JSON.stringify({
                      type: MessageTypes.MAP_EVENTS,
                      events,
                    })
                  );
                }
              } else {
                ws.send(
                  JSON.stringify({
                    type: MessageTypes.ERROR,
                    message: "Subscription not found",
                  })
                );
              }
            } catch (error: any) {
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ERROR,
                  message: "Failed to update subscription",
                  details: error.message,
                })
              );
            }
            break;

          case MessageTypes.DELETE_SUBSCRIPTION:
            try {
              const deleted = await subscriptionManager.deleteSubscription(data.subscriptionId);

              // Send deletion acknowledgment
              ws.send(
                JSON.stringify({
                  type: MessageTypes.SUBSCRIPTION_DELETED,
                  subscriptionId: data.subscriptionId,
                  success: deleted,
                })
              );

              // CRITICAL: Always send updated events after subscription changes
              const viewport = viewportManager.getViewport(clientId);
              if (viewport) {
                const events = eventProcessor.processViewportUpdate(
                  clientId,
                  viewport.boundingBox,
                  viewport.zoom
                );

                console.log(`Sending ${events.length} events after subscription deletion`);

                // Always send MAP_EVENTS, even if the array is empty!
                ws.send(
                  JSON.stringify({
                    type: MessageTypes.MAP_EVENTS,
                    events: events,
                  })
                );
              }
            } catch (error: any) {
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ERROR,
                  message: "Failed to delete subscription",
                  details: error.message,
                })
              );
            }
            break;

          case MessageTypes.LIST_SUBSCRIPTIONS:
            try {
              const subscriptions = subscriptionManager.getClientSubscriptions(ws.data.clientId);

              ws.send(
                JSON.stringify({
                  type: MessageTypes.SUBSCRIPTIONS_LIST,
                  subscriptions,
                })
              );
            } catch (error: any) {
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ERROR,
                  message: "Failed to list subscriptions",
                  details: error.message,
                })
              );
            }
            break;

          // Update the viewport update handler to use both systems
          case MessageTypes.VIEWPORT_UPDATE:
            try {
              console.log(`Processing viewport update for client ${clientId}`);
              console.log(`Viewport bounds: ${JSON.stringify(data.boundingBox)}`);

              // Check if client has active subscriptions BEFORE processing the viewport
              const clientSubscriptions = subscriptionManager.getClientSubscriptions(clientId);
              console.log(`Client has ${clientSubscriptions.length} active subscriptions`);

              // Process viewport update - this should filter by both viewport AND subscriptions
              const events = eventProcessor.processViewportUpdate(
                clientId,
                data.boundingBox,
                data.zoom || 14
              );

              console.log(`Found ${events.length} events matching BOTH viewport AND subscriptions`);

              // Debug: Check how many events are in viewport without filtering
              const allEventsInViewport = spatialIndex.queryBoundingBox(data.boundingBox);
              console.log(
                `Total events in viewport (without filtering): ${allEventsInViewport.length}`
              );

              if (clientSubscriptions.length > 0) {
                // Debug: Log filter criteria being applied
                console.log("Active filter criteria:");
                clientSubscriptions.forEach((sub) => {
                  console.log(`- Subscription ${sub.id}: ${JSON.stringify(sub.filter)}`);
                });
              }

              // Acknowledge viewport update
              ws.send(
                JSON.stringify({
                  type: MessageTypes.VIEWPORT_UPDATED,
                  status: "success",
                })
              );

              // Send matching events - ALWAYS send this message, even if events array is empty
              ws.send(
                JSON.stringify({
                  type: MessageTypes.MAP_EVENTS,
                  events: events,
                })
              );
            } catch (error: any) {
              console.error("Failed to update viewport:", error);
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ERROR,
                  message: "Failed to update viewport",
                  details: error.message,
                })
              );
            }
            break;

          // Default handler for other message types
          // (your existing code)
        }
      } catch (error) {
        console.error(`Error processing message from ${ws.data.clientId}:`, error);
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      // Unregister from session manager
      sessionManager.unregisterClient(ws.data.clientId);

      // Clean up filtering system resources
      subscriptionManager.handleClientDisconnect(ws.data.clientId);
      viewportManager.handleClientDisconnect(ws.data.clientId);

      // Clean up client registration
      clients.delete(ws.data.clientId);
    },
  },
};

// Start the server with proper typing
async function startServer() {
  try {
    // Initialize connection checks
    await Promise.all([checkRedisConnection(), checkBackendConnection()]);

    // Initialize state
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
