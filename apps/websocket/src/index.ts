import type { Server, ServerWebSocket } from "bun";
import { SERVER_CONFIG } from "./config/constants";
import { ConnectionHandler } from "./handlers/connectionHandler";
import { HealthService } from "./services/healthService";
import { RedisService } from "./services/redisService";
import { handleRedisMessage } from "./handlers/redisMessageHandler";
import type { WebSocketData } from "./types/websocket";

// Initialize services
const connectionHandler = ConnectionHandler.getInstance();
const healthService = HealthService.getInstance();
const redisService = RedisService.getInstance();

// Set up Redis message handling
redisService.onMessage((channel, message) => {
  handleRedisMessage(channel, message, connectionHandler);
});

// Run regular health checks
setInterval(async () => {
  await healthService.checkAllServices();
}, SERVER_CONFIG.healthCheckInterval);

// WebSocket server definition
const server = {
  port: SERVER_CONFIG.port,
  fetch(req: Request, server: Server): Response | Promise<Response> {
    // Handle HTTP requests for health check
    if (req.url.endsWith("/health")) {
      return healthService.getHealthResponse();
    }

    if (server.upgrade(req)) {
      return new Response();
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      connectionHandler.handleOpen(ws);
    },
    message(ws: ServerWebSocket<WebSocketData>, message: string) {
      connectionHandler.handleMessage(ws, message);
    },
    close(ws: ServerWebSocket<WebSocketData>) {
      connectionHandler.handleClose(ws);
    },
  },
};

// Start the server
async function startServer() {
  try {
    // Check connections
    await healthService.checkAllServices();

    // Start WebSocket server
    Bun.serve(server);
    console.log(`WebSocket server started on port ${server.port}`);
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
    process.exit(1);
  }
}

startServer();
