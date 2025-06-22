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
    await redisService.updateViewport(userId, viewport);
    console.log(`Published viewport update for user ${userId}`);
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
  });
});

// Subscribe to Redis channels
async function setupRedisSubscriptions() {
  await Promise.all([
    redisService.subscribeToChannel(REDIS_CHANNELS.DISCOVERED_EVENTS, () => {}),
    redisService.subscribeToChannel(
      REDIS_CHANNELS.DISCOVERED_CIVIC_ENGAGEMENTS,
      () => {},
    ),
    redisService.subscribeToChannel(REDIS_CHANNELS.NOTIFICATIONS, () => {}),
    redisService.subscribeToChannel(REDIS_CHANNELS.LEVEL_UPDATE, () => {}),
    redisService.subscribeToChannel(
      REDIS_CHANNELS.CIVIC_ENGAGEMENT_CHANGES,
      () => {},
    ),
  ]);
}

// Run regular health checks
setInterval(async () => {
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

// WebSocket server definition
const server = {
  port: SERVER_CONFIG.port,
  fetch(req: Request, server: Server): Response | Promise<Response> {
    // Handle HTTP requests for health check
    if (req.url.endsWith("/health")) {
      return healthCheckService.getHealthResponse();
    }

    if (server.upgrade(req)) {
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
