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
};

// --- In-Memory State ---
const clients = new Map<string, ServerWebSocket<WebSocketData>>();
const userToClients = new Map<string, Set<string>>();
const userSubscribers = new Map<string, Redis>();

// --- Redis Client Configuration ---
const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis retry attempt ${times} with delay ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    console.log('Redis reconnectOnError triggered:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    return true;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  authRetry: true,
  enableReadyCheck: true
};

// Main Redis client for publishing
const redisPub = new Redis(redisConfig);

// Initialize session manager
const sessionManager = new SessionManager(redisPub);
console.log('SessionManager initialized');

// Add error handling for Redis
redisPub.on('error', (error: Error & { code?: string }) => {
  console.error('Redis connection error:', {
    message: error.message,
    code: error.code,
    stack: error.stack,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    hasPassword: !!process.env.REDIS_PASSWORD
  });
});

redisPub.on('connect', () => {
  console.log('Redis connected successfully');
});

redisPub.on('ready', () => {
  console.log('Redis is ready to accept commands');
});

// Subscribe to discovered events
const redisSub = new Redis(redisConfig);

// Add error handling for subscriber
redisSub.on('error', (error: Error & { code?: string }) => {
  console.error('Redis subscriber error:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
});

redisSub.on('connect', () => {
  console.log('Redis subscriber connected successfully');
  redisSub.subscribe("discovered_events");
});

redisSub.on("message", (channel, message) => {
  if (channel === "discovered_events") {
    try {
      const data = JSON.parse(message);
      // Format the message properly before sending to clients
      const formattedMessage = JSON.stringify({
        type: MessageTypes.EVENT_DISCOVERED,
        event: data.event,
        timestamp: new Date().toISOString()
      });

      // Only send to the creator of the event
      const creatorId = data.event.creatorId;
      if (creatorId) {
        const creatorClients = userToClients.get(creatorId);
        if (creatorClients) {
          for (const clientId of creatorClients) {
            const client = clients.get(clientId);
            if (client) {
              try {
                client.send(formattedMessage);
              } catch (error) {
                console.error(`Error sending discovery event to client ${clientId}:`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing discovery event:", error);
    }
  }
});

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

    // Get only active filters
    const activeFilters = filters.filter((filter: any) => filter.isActive);

    // Publish to filter-changes
    redisPub.publish(
      "filter-changes",
      JSON.stringify({
        userId,
        filters: activeFilters,
        timestamp: new Date().toISOString(),
      })
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

    message(ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) {
      // Update last activity timestamp
      ws.data.lastActivity = Date.now();

      try {
        const data = JSON.parse(message.toString());

        if (data.type === MessageTypes.CLIENT_IDENTIFICATION) {
          if (!data.userId) {
            console.error(`Missing userId in client identification from ${ws.data.clientId}`);
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
          fetchUserFiltersAndPublish(userId);

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
          sessionManager.handleMessage(ws, message.toString());
        }

        // Log unknown message types
        else {
          console.warn(`Unknown message type ${data.type} from client ${ws.data.clientId}`);
        }
      } catch (error) {
        console.error(`Error processing message from ${ws.data.clientId}:`, error);
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
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
