import { REDIS_CHANNELS, MessageTypes } from "../config/constants";
import {
  formatDiscoveryMessage,
  formatNotificationMessage,
  formatLevelUpdateMessage,
} from "../utils/messageFormatter";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types/websocket";

export interface DiscoveredEvent {
  event: {
    creatorId: string;
    [key: string]: unknown;
  };
}

export interface Notification {
  notification: {
    userId: string;
    title: string;
    message: string;
    type?: string;
  };
}

export interface LevelUpdate {
  userId: string;
  level: number;
  title: string;
  action: string;
  amount: number;
  totalXp: number;
  timestamp?: string;
}

export interface RedisMessageHandlerDependencies {
  getUserClients: (userId: string) => Set<string> | undefined;
  getClient: (clientId: string) => ServerWebSocket<WebSocketData> | undefined;
}

export function handleRedisMessage(
  channel: string,
  message: string,
  dependencies: RedisMessageHandlerDependencies,
): void {
  console.log(`Received message from ${channel}: ${message}`);

  try {
    const data = JSON.parse(message);

    // Handle filtered events channel pattern (user:${userId}:filtered-events)
    if (channel.match(/^user:.+:filtered-events$/)) {
      console.log("[WebSocket] Received filtered events message:", data);

      // Extract userId from channel name
      const userId = channel.split(":")[1];
      if (!userId) {
        console.error("Could not extract userId from channel:", channel);
        return;
      }

      console.log("[WebSocket] Forwarding filtered events to user:", userId);

      // Forward the message to the user's clients
      const userClients = dependencies.getUserClients(userId);
      if (userClients) {
        for (const clientId of userClients) {
          const client = dependencies.getClient(clientId);
          if (client) {
            try {
              client.send(message);
              console.log(`Forwarded filtered events to client ${clientId}`);
            } catch (error) {
              console.error(
                `Error forwarding filtered events to client ${clientId}:`,
                error,
              );
            }
          }
        }
      } else {
        console.log(`No clients found for user ${userId}`);
      }
      return;
    }

    switch (channel) {
      case REDIS_CHANNELS.DISCOVERED_EVENTS: {
        // Backend publishes { type, data: { event, timestamp } }
        const eventPayload = data.data ?? data;
        const eventData = eventPayload as DiscoveredEvent;
        if (!eventData.event?.creatorId) {
          console.error("Invalid discovered event data:", data);
          return;
        }

        const formattedMessage = formatDiscoveryMessage(eventData.event);

        const userClients = dependencies.getUserClients(
          eventData.event.creatorId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = dependencies.getClient(clientId);
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

        const formattedMessage = formatNotificationMessage(
          notificationData.notification.title,
          notificationData.notification.message,
          notificationData.notification.type || "info",
        );

        const userClients = dependencies.getUserClients(
          notificationData.notification.userId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = dependencies.getClient(clientId);
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

        const formattedMessage = formatLevelUpdateMessage(
          levelData.userId,
          levelData.level,
          levelData.title,
          levelData.action,
          levelData.amount,
          levelData.totalXp,
          levelData.timestamp,
        );

        const userClients = dependencies.getUserClients(levelData.userId);
        if (userClients) {
          for (const clientId of userClients) {
            const client = dependencies.getClient(clientId);
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
}
