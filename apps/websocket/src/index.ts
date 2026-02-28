import type { Server, ServerWebSocket } from "bun";
import { SERVER_CONFIG, REDIS_CHANNELS } from "./config/constants";
import { handleRedisMessage } from "./handlers/redisMessageHandler";
import {
  createWebSocketMessageHandler,
  handleWebSocketMessage,
} from "./handlers/websocketMessageHandler";
import { createHealthCheckService } from "./services/healthCheckService";
import { createRedisService } from "./services/redisService";
import { createUserFilterService } from "./services/userFilterService";
import { createClientConnectionService } from "./services/clientConnectionService";
import { SessionManager } from "../SessionManager";
import type { WebSocketData } from "./types/websocket";
import type { FormattedViewport } from "./handlers/viewportHandler";

// Connection reaper config
const ZOMBIE_CHECK_INTERVAL_MS = 60_000; // Check every 60s
const ZOMBIE_IDLE_THRESHOLD_MS = 5 * 60_000; // 5 minutes idle = zombie

// Viewport debounce state — coalesces rapid panning into single Redis writes
const VIEWPORT_DEBOUNCE_MS = 25;
const viewportTimers = new Map<string, NodeJS.Timeout>();
const pendingViewports = new Map<string, FormattedViewport>();

// Initialize services with dependency injection
const redisService = createRedisService();
const sessionManager = new SessionManager(redisService.getPubClient());
const clientConnectionService = createClientConnectionService({
  sessionManager,
  redisService,
});
const userFilterService = createUserFilterService({
  redisService,
  backendUrl: SERVER_CONFIG.backendUrl,
});
const healthCheckService = createHealthCheckService({
  redisPing: () => redisService.ping(),
  backendUrl: SERVER_CONFIG.backendUrl,
  filterProcessorUrl: SERVER_CONFIG.filterProcessorUrl,
});

// Create WebSocket message handler with dependencies
const webSocketMessageHandler = createWebSocketMessageHandler({
  sessionManager,
  redisService: {
    setClientType: (userId: string, clientType: string) =>
      redisService.setClientType(userId, clientType),
  },
  updateViewport: async (userId: string, viewport) => {
    // Store latest viewport and debounce the Redis write
    pendingViewports.set(userId, viewport);

    if (viewportTimers.has(userId)) {
      clearTimeout(viewportTimers.get(userId)!);
    }

    const timer = setTimeout(() => {
      viewportTimers.delete(userId);
      const latestViewport = pendingViewports.get(userId);
      pendingViewports.delete(userId);
      if (latestViewport) {
        redisService.updateViewport(userId, latestViewport).catch((error) => {
          console.error(
            `[WebSocket] Error publishing debounced viewport for user ${userId}:`,
            error,
          );
        });
      }
    }, VIEWPORT_DEBOUNCE_MS);

    viewportTimers.set(userId, timer);
  },
  getUserClients: (userId: string) =>
    clientConnectionService.getUserClients(userId),
  addUserClient: (userId: string, clientId: string) =>
    clientConnectionService.addUserClient(userId, clientId),
  setupUserMessageHandling: (userId: string) =>
    clientConnectionService.setupUserMessageHandling(userId),
  fetchUserFiltersAndPublish: (userId: string) =>
    userFilterService.fetchUserFiltersAndPublish(userId),
  updateHealthStats: () => {
    healthCheckService.updateHealthStats(
      clientConnectionService.getConnectedClientsCount(),
      clientConnectionService.getConnectedUsersCount(),
    );
  },
});

// Set up Redis message handling
redisService.onGlobalMessage((channel: string, message: string) => {
  handleRedisMessage(channel, message, {
    getUserClients: (userId: string) =>
      clientConnectionService.getUserClients(userId),
    getClient: (clientId: string) =>
      clientConnectionService.getClient(clientId),
    redisClient: redisService.getPubClient(),
    publishPushDiscovery: (msg: string) =>
      redisService
        .getPubClient()
        .publish(REDIS_CHANNELS.PUSH_DISCOVERY, msg)
        .then(() => {}),
  });
});

// Subscribe to Redis channels
async function setupRedisSubscriptions() {
  await Promise.all([
    redisService.subscribeToChannel(REDIS_CHANNELS.DISCOVERED_EVENTS, () => {}),
    redisService.subscribeToChannel(REDIS_CHANNELS.NOTIFICATIONS, () => {}),
    redisService.subscribeToChannel(REDIS_CHANNELS.LEVEL_UPDATE, () => {}),
  ]);
}

// Run regular health checks
const healthCheckInterval = setInterval(async () => {
  await Promise.all([
    healthCheckService.checkRedisConnection(),
    healthCheckService.checkBackendConnection(),
    healthCheckService.checkFilterProcessorConnection(),
  ]);
  healthCheckService.updateHealthStats(
    clientConnectionService.getConnectedClientsCount(),
    clientConnectionService.getConnectedUsersCount(),
  );
}, SERVER_CONFIG.healthCheckInterval);

// Reap zombie connections periodically
const zombieReaperInterval = setInterval(() => {
  clientConnectionService.reapZombieConnections(ZOMBIE_IDLE_THRESHOLD_MS);
}, ZOMBIE_CHECK_INTERVAL_MS);

// WebSocket server definition
const server = {
  port: SERVER_CONFIG.port,
  fetch(
    req: Request,
    server: Server<WebSocketData>,
  ): Response | Promise<Response> {
    // Handle HTTP requests for health check
    if (req.url.endsWith("/health")) {
      return healthCheckService.getHealthResponse();
    }

    if (
      server.upgrade(req, {
        data: {
          clientId: "",
          lastActivity: Date.now(),
        },
      })
    ) {
      return new Response();
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      clientConnectionService.registerClient(ws);
      healthCheckService.updateHealthStats(
        clientConnectionService.getConnectedClientsCount(),
        clientConnectionService.getConnectedUsersCount(),
      );
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) {
      handleWebSocketMessage(ws, message, webSocketMessageHandler);
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      clientConnectionService.unregisterClient(
        ws.data.clientId,
        ws.data.userId,
      );
      healthCheckService.updateHealthStats(
        clientConnectionService.getConnectedClientsCount(),
        clientConnectionService.getConnectedUsersCount(),
      );
    },
  },
};

// Start the server
async function startServer() {
  try {
    // Check connections
    await Promise.all([
      healthCheckService.checkRedisConnection(),
      healthCheckService.checkBackendConnection(),
      healthCheckService.checkFilterProcessorConnection(),
    ]);

    // Setup Redis subscriptions
    await setupRedisSubscriptions();

    // Start WebSocket server
    Bun.serve(server);
    console.log(`WebSocket server started on port ${server.port}`);
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
async function shutdown() {
  console.log("[WebSocket] Graceful shutdown initiated...");

  // Stop intervals and clear viewport debounce timers
  clearInterval(healthCheckInterval);
  clearInterval(zombieReaperInterval);
  for (const timer of viewportTimers.values()) {
    clearTimeout(timer);
  }
  viewportTimers.clear();
  pendingViewports.clear();

  // Close all Redis connections
  await redisService.shutdown();

  console.log("[WebSocket] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
