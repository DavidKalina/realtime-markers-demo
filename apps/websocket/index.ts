// apps/websocket/src/index.ts
import Redis from "ioredis";
import type { Server, ServerWebSocket } from "bun";
import { SessionManager } from "./SessionManager";

// --- Type Definitions ---
interface WebSocketData {
  clientId: string;
  userId?: string;
  lastActivity: number;
  sessionId?: string;
}

// Define message types
const MessageTypes = {
  // Connection messages
  CONNECTION_ESTABLISHED: "connection_established",
  CLIENT_IDENTIFICATION: "client_identification",

  // Viewport-related
  VIEWPORT_UPDATE: "viewport-update",

  // Filtered events from filter processor
  ADD_EVENT: "add-event",
  UPDATE_EVENT: "update-event",
  DELETE_EVENT: "delete-event",
  REPLACE_ALL: "replace-all",

  // Discovery events
  EVENT_DISCOVERED: "event_discovered",

  // Notifications
  NOTIFICATION: "notification",

  ADD_JOB: "add_job",
  JOB_ADDED: "job_added",
  CANCEL_JOB: "cancel_job",

  // Session management
  CREATE_SESSION: "create_session",
  CLEAR_SESSION: "clear_session",
  JOIN_SESSION: "join_session",
  SESSION_CREATED: "session_created",
  SESSION_JOINED: "session_joined",
  SESSION_UPDATE: "session_update",

  // Leveling system
  LEVEL_UPDATE: "level-update",
  XP_AWARDED: "xp-awarded",

  // New message type for error handling
  ERROR: "error",
};

// --- In-Memory State ---
const clients = new Map<string, ServerWebSocket<WebSocketData>>();
const userToClients = new Map<string, Set<string>>();
const userSubscribers = new Map<string, Redis>();

// --- Redis Client Configuration ---
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    // Exponential backoff with max 10s
    return Math.min(times * 100, 10000);
  },
};

// Main Redis client for publishing
const redisPub = new Redis(redisConfig);

// Add error handling for Redis publisher
redisPub.on("error", (error) => {
  console.error("Redis publisher error:", error);
});

redisPub.on("connect", () => {
  console.log("Redis publisher connected successfully");
});

redisPub.on("ready", () => {
  console.log("Redis publisher is ready to accept commands");
});

// Subscribe to discovered events
const redisSub = new Redis(redisConfig);

// Add error handling for Redis subscriber
redisSub.on("error", (error) => {
  console.error("Redis subscriber error:", error);
});

redisSub.on("connect", () => {
  console.log("Redis subscriber connected successfully");
});

redisSub.on("ready", () => {
  console.log("Redis subscriber is ready to accept commands");
});

// Subscribe to channels
redisSub.subscribe("discovered_events", (err, count) => {
  if (err) {
    console.error("Error subscribing to discovered_events:", err);
  } else {
    console.log(`Subscribed to discovered_events, total subscriptions: ${count}`);
  }
});

redisSub.subscribe("notifications", (err, count) => {
  if (err) {
    console.error("Error subscribing to notifications:", err);
  } else {
    console.log(`Subscribed to notifications, total subscriptions: ${count}`);
  }
});

redisSub.subscribe("level-update", (err, count) => {
  if (err) {
    console.error("Error subscribing to level-update:", err);
  } else {
    console.log(`Subscribed to level-update, total subscriptions: ${count}`);
  }
});

redisSub.subscribe("event:deleted", (err, count) => {
  if (err) {
    console.error("Error subscribing to event:deleted:", err);
  } else {
    console.log(`Subscribed to event:deleted, total subscriptions: ${count}`);
  }
});

redisSub.subscribe("event:updated", (err, count) => {
  if (err) {
    console.error("Error subscribing to event:updated:", err);
  } else {
    console.log(`Subscribed to event:updated, total subscriptions: ${count}`);
  }
});

redisSub.on("message", (channel, message) => {
  console.log(`Received message from ${channel}: ${message}`);

  if (channel === "discovered_events") {
    try {
      const data = JSON.parse(message);
      // Format the message properly before sending to clients
      const formattedMessage = JSON.stringify({
        type: MessageTypes.EVENT_DISCOVERED,
        event: data.event,
        timestamp: new Date().toISOString(),
      });

      console.log(data);

      console.log("data.event.creatorId", data.event.creatorId);

      // Get all clients for the creator user
      const userClients = userToClients.get(data.event.creatorId);

      if (userClients) {
        for (const clientId of userClients) {
          const client = clients.get(clientId);
          if (client) {
            try {
              client.send(formattedMessage);
              console.log(`Sent discovery event to client ${clientId}`);
            } catch (error) {
              console.error(`Error sending discovery event to client ${clientId}:`, error);
            }
          }
        }
      } else {
        console.log(`No clients found for user ${data.event.creatorId}`);
      }
    } catch (error) {
      console.error("Error processing discovery event:", error);
    }
  } else if (channel === "notifications") {
    try {
      const data = JSON.parse(message);

      // Format the notification message
      const formattedMessage = JSON.stringify({
        type: MessageTypes.NOTIFICATION,
        title: data.notification.title,
        message: data.notification.message,
        notificationType: data.notification.type || "info",
        timestamp: new Date().getTime(),
        source: "websocket_server",
      });

      // Forward to the specific user's clients
      const userId = data.notification.userId;
      const userClients = userToClients.get(userId);

      if (userClients) {
        for (const clientId of userClients) {
          const client = clients.get(clientId);
          if (client) {
            try {
              client.send(formattedMessage);
              console.log(`Sent notification to client ${clientId}`);
            } catch (error) {
              console.error(`Error sending notification to client ${clientId}:`, error);
            }
          }
        }
      } else {
        console.log(`No clients found for user ${userId}`);
      }
    } catch (error) {
      console.error("Error processing notification:", error);
    }
  } else if (channel === "level-update") {
    try {
      const data = JSON.parse(message);
      console.log("Received level update:", data);

      // Handle both XP awards and level-up events
      const formattedMessage = JSON.stringify({
        type: data.action === "xp_awarded" ? MessageTypes.XP_AWARDED : MessageTypes.LEVEL_UPDATE,
        data: {
          userId: data.userId,
          level: data.level,
          title: data.title,
          action: data.action,
          amount: data.amount,
          totalXp: data.totalXp,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      });

      // Forward to all clients of the user
      const userClients = userToClients.get(data.userId);
      if (userClients) {
        for (const clientId of userClients) {
          const client = clients.get(clientId);
          if (client) {
            try {
              client.send(formattedMessage);
              console.log(`Sent level update to client ${clientId}`);
            } catch (error) {
              console.error(`Error sending level update to client ${clientId}:`, error);
            }
          }
        }
      } else {
        console.log(`No clients found for user ${data.userId}`);
      }
    } catch (error) {
      console.error("Error processing level update:", error);
    }
  } else if (channel === "event:updated") {
    try {
      const data = JSON.parse(message);
      console.log("Received event update:", data);

      const formattedMessage = JSON.stringify({
        type: MessageTypes.UPDATE_EVENT,
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      });

      // Broadcast to all connected clients
      for (const [clientId, client] of clients.entries()) {
        try {
          client.send(formattedMessage);
        } catch (error) {
          console.error(`Error sending event update to client ${clientId}:`, error);
        }
      }
    } catch (error) {
      console.error("Error processing event update:", error);
    }
  } else if (channel === "event:deleted") {
    try {
      const data = JSON.parse(message);
      const formattedMessage = JSON.stringify({
        type: MessageTypes.DELETE_EVENT,
        id: data.id,
        timestamp: data.timestamp || new Date().toISOString(),
      });

      // Broadcast to all connected clients
      for (const [clientId, client] of clients.entries()) {
        try {
          client.send(formattedMessage);
        } catch (error) {
          console.error(`Error sending deletion event to client ${clientId}:`, error);
        }
      }
    } catch (error) {
      console.error("Error processing deletion event:", error);
    }
  }
});

// Initialize session manager
const sessionManager = new SessionManager(redisPub);

// System health state
const systemHealth = {
  backendConnected: false,
  redisConnected: false,
  filterProcessorConnected: false,
  lastBackendCheck: 0,
  lastRedisCheck: 0,
  lastFilterProcessorCheck: 0,
  connectedClients: 0,
  connectedUsers: 0,
};

function publishEmptyFilter(userId: string): void {
  console.log(`📤 Publishing default empty filter for user ${userId} (will match all events)`);

  redisPub.publish(
    "filter-changes",
    JSON.stringify({
      userId,
      filters: [], // Empty array means "match all events"
      timestamp: new Date().toISOString(),
    })
  );
}

async function fetchUserFiltersAndPublish(userId: string): Promise<void> {
  try {
    console.log(`🔍 Fetching filters for user ${userId}`);

    const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
    const response = await fetch(`${backendUrl}/api/internal/filters?userId=${userId}`, {
      headers: {
        Accept: "application/json",
        // Add any required authentication headers here
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch filters for user ${userId}: ${response.status} ${response.statusText}`
      );
      // Default to empty filter set (match all) on error
      publishEmptyFilter(userId);
      return;
    }

    const filters = await response.json();

    console.log("FILTERS", filters);

    console.log(`📊 Fetched ${filters.length} filters for user ${userId}`);

    // Get only active filters
    const activeFilters = filters.filter((filter: any) => filter.isActive);
    console.log(`📊 User ${userId} has ${activeFilters.length} active filters`);

    // Publish to filter-changes
    redisPub.publish(
      "filter-changes",
      JSON.stringify({
        userId,
        filters: activeFilters,
        timestamp: new Date().toISOString(),
      })
    );

    console.log(
      `📤 Published filter update for user ${userId} with ${activeFilters.length} active filters`
    );
  } catch (error) {
    console.error(`Error fetching filters for user ${userId}:`, error);
    // Default to empty filter set (match all) on error
    publishEmptyFilter(userId);
  }
}

// Function to get or create a Redis subscriber for a user
function getRedisSubscriberForUser(userId: string): Redis {
  if (!userSubscribers.has(userId)) {
    console.log(`Creating new Redis subscriber for user ${userId}`);

    const subscriber = new Redis(redisConfig);
    userSubscribers.set(userId, subscriber);

    // Subscribe to user's filtered events channel
    subscriber.subscribe(`user:${userId}:filtered-events`);

    // Handle messages for this user
    subscriber.on("message", (channel, message) => {
      if (channel === `user:${userId}:filtered-events`) {
        // Forward the filtered events to all clients for this user
        forwardMessageToUserClients(userId, message);
      }
    });
  }

  return userSubscribers.get(userId)!;
}

// Forward a message to all clients for a user
function forwardMessageToUserClients(userId: string, message: string): void {
  const clientIds = userToClients.get(userId);
  if (!clientIds) return;

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(message);
    console.log(
      `Forwarding message type ${parsedMessage.type} to ${clientIds.size} clients of user ${userId}`
    );
  } catch (error) {
    console.error(`Error parsing message for user ${userId}:`, error);
    return;
  }

  for (const clientId of clientIds) {
    const client = clients.get(clientId);
    if (client) {
      try {
        client.send(message);
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
      }
    }
  }
}

// Release Redis subscriber for a user
function releaseRedisSubscriber(userId: string): void {
  const subscriber = userSubscribers.get(userId);
  if (subscriber) {
    subscriber.unsubscribe();
    subscriber.quit();
    userSubscribers.delete(userId);
    console.log(`Released Redis subscriber for user ${userId}`);
  }
}

// Function to check Redis connection
async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redisPub.ping();
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
    const response = await fetch(`${backendUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });

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

// Function to check filter processor connection
async function checkFilterProcessorConnection(): Promise<boolean> {
  try {
    const filterProcessorUrl = process.env.FILTER_PROCESSOR_URL || "http://filter-processor:8082";
    const response = await fetch(`${filterProcessorUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    systemHealth.filterProcessorConnected = response.status === 200;
    systemHealth.lastFilterProcessorCheck = Date.now();
    return systemHealth.filterProcessorConnected;
  } catch (error) {
    systemHealth.filterProcessorConnected = false;
    systemHealth.lastFilterProcessorCheck = Date.now();
    console.error("Filter Processor connection check failed:", error);
    return false;
  }
}

// Update system health stats
function updateHealthStats(): void {
  systemHealth.connectedClients = clients.size;
  systemHealth.connectedUsers = userToClients.size;
}

// Run regular health checks
setInterval(async () => {
  await Promise.all([
    checkRedisConnection(),
    checkBackendConnection(),
    checkFilterProcessorConnection(),
  ]);
  updateHealthStats();
}, 30000);

// WebSocket server definition
const server = {
  port: 8081,
  fetch(req: Request, server: Server): Response | Promise<Response> {
    // Handle HTTP requests for health check
    if (req.url.endsWith("/health")) {
      updateHealthStats();

      return Promise.all([
        checkRedisConnection(),
        checkBackendConnection(),
        checkFilterProcessorConnection(),
      ]).then(() => {
        const isHealthy = systemHealth.redisConnected && systemHealth.backendConnected;

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
              filterProcessor: {
                connected: systemHealth.filterProcessorConnected,
                lastChecked: new Date(systemHealth.lastFilterProcessorCheck).toISOString(),
              },
            },
            stats: {
              connectedClients: systemHealth.connectedClients,
              connectedUsers: systemHealth.connectedUsers,
            },
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
      // Generate client ID
      const clientId = crypto.randomUUID();

      // Initialize WebSocket data
      ws.data = {
        clientId,
        lastActivity: Date.now(),
      };

      // Store client in map
      clients.set(clientId, ws);

      // Register client with session manager
      sessionManager.registerClient(ws);

      // Send connection established message
      ws.send(
        JSON.stringify({
          type: MessageTypes.CONNECTION_ESTABLISHED,
          clientId,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`Client ${clientId} connected`);
      updateHealthStats();
    },

    message: async (ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) => {
      // Update last activity timestamp
      ws.data.lastActivity = Date.now();

      try {
        const data = JSON.parse(message.toString());

        if (data.type === MessageTypes.CLIENT_IDENTIFICATION) {
          if (!data.userId || !isValidUserId(data.userId)) {
            console.error(`Invalid userId in client identification from ${ws.data.clientId}`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                message: "Invalid userId format",
                timestamp: new Date().toISOString(),
              })
            );
            return;
          }

          const userId = data.userId;

          // Associate client with user
          ws.data.userId = userId;

          // Add to user-client mapping
          if (!userToClients.has(userId)) {
            userToClients.set(userId, new Set());
          }
          userToClients.get(userId)!.add(ws.data.clientId);

          // Ensure we have a Redis subscriber for this user
          getRedisSubscriberForUser(userId);

          console.log(`Client ${ws.data.clientId} identified as user ${userId}`);

          // Fetch user's filters from backend and publish to filter-changes
          await fetchUserFiltersAndPublish(userId);

          updateHealthStats();
        }

        // Handle viewport updates
        else if (data.type === MessageTypes.VIEWPORT_UPDATE) {
          const userId = ws.data.userId;

          if (!userId) {
            console.warn(`Viewport update received from unidentified client ${ws.data.clientId}`);
            return;
          }

          // Validate viewport data
          if (!data.viewport || typeof data.viewport !== "object") {
            console.error(`Invalid viewport data from client ${ws.data.clientId}`);
            return;
          }

          // Format viewport for Filter Processor
          const viewport = {
            minX: data.viewport.west,
            minY: data.viewport.south,
            maxX: data.viewport.east,
            maxY: data.viewport.north,
          };

          // Store viewport in Redis with expiration
          await redisPub.set(
            `viewport:${userId}`,
            JSON.stringify(viewport),
            "EX",
            3600 // 1 hour expiration
          );

          // Publish viewport update to Filter Processor
          redisPub.publish(
            "viewport-updates",
            JSON.stringify({
              userId,
              viewport,
              timestamp: new Date().toISOString(),
            })
          );

          console.log(`Published viewport update for user ${userId}`);
        }

        // Handle session management messages
        else if (
          [
            MessageTypes.CREATE_SESSION,
            MessageTypes.JOIN_SESSION,
            MessageTypes.ADD_JOB,
            MessageTypes.CANCEL_JOB,
            MessageTypes.CLEAR_SESSION,
            // Other session-related message types
          ].includes(data.type)
        ) {
          // Forward to session manager
          await sessionManager.handleMessage(ws, message.toString());
        }

        // Log unknown message types
        else {
          console.warn(`Unknown message type ${data.type} from client ${ws.data.clientId}`);
        }
      } catch (error) {
        console.error(`Error processing message from ${ws.data.clientId}:`, error);
      }
    },

    close: async (ws: ServerWebSocket<WebSocketData>) => {
      try {
        const { clientId, userId } = ws.data;

        console.log(`Client ${clientId} disconnected`);

        // Clean up session management
        sessionManager.unregisterClient(clientId);

        // Remove from client map
        clients.delete(clientId);

        // Remove from user-client mapping if associated with a user
        if (userId) {
          const userClients = userToClients.get(userId);

          if (userClients) {
            userClients.delete(clientId);

            // If no more clients for this user, clean up
            if (userClients.size === 0) {
              userToClients.delete(userId);
              releaseRedisSubscriber(userId);

              // Remove viewport data from both Redis keys
              const viewportKey = `viewport:${userId}`;
              await Promise.all([
                redisPub.zrem("viewport:geo", viewportKey),
                redisPub.del(viewportKey),
              ]);

              if (process.env.NODE_ENV !== "production") {
                console.log(`Cleaned up viewport data for user ${userId}`);
              }
            }
          }
        }

        updateHealthStats();
      } catch (error) {
        console.error(`Error handling client disconnect:`, error);
      }
    },
  },
};

// Start the server
async function startServer() {
  try {
    // Check connections
    await Promise.all([
      checkRedisConnection(),
      checkBackendConnection(),
      checkFilterProcessorConnection(),
    ]);

    // Start WebSocket server
    Bun.serve(server);
    console.log(`WebSocket server started on port ${server.port}`);
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
    process.exit(1);
  }
}

startServer();

// Add userId validation function
function isValidUserId(userId: string): boolean {
  // UUID v4 format validation
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(userId);
}
