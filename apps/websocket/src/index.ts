import type { Server, ServerWebSocket } from "bun";
import {
  SERVER_CONFIG,
  REDIS_CHANNELS,
  MessageTypes,
} from "./config/constants";
import { ConnectionHandler } from "./handlers/connectionHandler";
import { HealthService } from "./services/healthService";
import { RedisService } from "./services/redisService";
import type { WebSocketData } from "./types/websocket";

// Initialize services
const connectionHandler = ConnectionHandler.getInstance();
const healthService = HealthService.getInstance();
const redisService = RedisService.getInstance();

interface DiscoveredEvent {
  event: {
    creatorId: string;
    [key: string]: unknown;
  };
}

interface Notification {
  notification: {
    userId: string;
    title: string;
    message: string;
    type?: string;
  };
}

interface LevelUpdate {
  userId: string;
  level: number;
  title: string;
  action: string;
  amount: number;
  totalXp: number;
  timestamp?: string;
}

// Set up Redis message handling
redisService.onMessage((channel, message) => {
  console.log(`Received message from ${channel}: ${message}`);

  try {
    const data = JSON.parse(message);

    switch (channel) {
      case REDIS_CHANNELS.DISCOVERED_EVENTS: {
        const eventData = data as DiscoveredEvent;
        if (!eventData.event?.creatorId) {
          console.error("Invalid discovered event data:", data);
          return;
        }

        const formattedMessage = JSON.stringify({
          type: MessageTypes.EVENT_DISCOVERED,
          event: eventData.event,
          timestamp: new Date().toISOString(),
        });

        const userClients = connectionHandler.getUserClients(
          eventData.event.creatorId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = connectionHandler.getClient(clientId);
            if (client) {
              try {
                client.send(formattedMessage);
                console.log(`Sent discovery event to client ${clientId}`);
              } catch (error) {
                console.error(
                  `Error sending discovery event to client ${clientId}:`,
                  error,
                );
              }
            }
          }
        } else {
          console.log(`No clients found for user ${eventData.event.creatorId}`);
        }
        break;
      }

      case REDIS_CHANNELS.NOTIFICATIONS: {
        const notificationData = data as Notification;
        if (!notificationData.notification?.userId) {
          console.error("Invalid notification data:", data);
          return;
        }

        const formattedMessage = JSON.stringify({
          type: MessageTypes.NOTIFICATION,
          title: notificationData.notification.title,
          message: notificationData.notification.message,
          notificationType: notificationData.notification.type || "info",
          timestamp: new Date().getTime(),
          source: "websocket_server",
        });

        const userClients = connectionHandler.getUserClients(
          notificationData.notification.userId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = connectionHandler.getClient(clientId);
            if (client) {
              try {
                client.send(formattedMessage);
                console.log(`Sent notification to client ${clientId}`);
              } catch (error) {
                console.error(
                  `Error sending notification to client ${clientId}:`,
                  error,
                );
              }
            }
          }
        } else {
          console.log(
            `No clients found for user ${notificationData.notification.userId}`,
          );
        }
        break;
      }

      case REDIS_CHANNELS.LEVEL_UPDATE: {
        const levelData = data as LevelUpdate;
        if (!levelData.userId) {
          console.error("Invalid level update data:", data);
          return;
        }

        const formattedMessage = JSON.stringify({
          type:
            levelData.action === "xp_awarded"
              ? MessageTypes.XP_AWARDED
              : MessageTypes.LEVEL_UPDATE,
          data: {
            userId: levelData.userId,
            level: levelData.level,
            title: levelData.title,
            action: levelData.action,
            amount: levelData.amount,
            totalXp: levelData.totalXp,
            timestamp: levelData.timestamp || new Date().toISOString(),
          },
        });

        const userClients = connectionHandler.getUserClients(levelData.userId);
        if (userClients) {
          for (const clientId of userClients) {
            const client = connectionHandler.getClient(clientId);
            if (client) {
              try {
                client.send(formattedMessage);
                console.log(`Sent level update to client ${clientId}`);
              } catch (error) {
                console.error(
                  `Error sending level update to client ${clientId}:`,
                  error,
                );
              }
            }
          }
        } else {
          console.log(`No clients found for user ${levelData.userId}`);
        }
        break;
      }

      default:
        console.warn(`Unhandled Redis channel: ${channel}`);
    }
  } catch (error) {
    console.error(`Error processing message from ${channel}:`, error);
  }
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
