import { REDIS_CHANNELS } from "../config/constants";
import {
  formatDiscoveryMessage,
  formatNotificationMessage,
  formatLevelUpdateMessage,
} from "../utils/messageFormatter";
import type { ServerWebSocket } from "bun";
import type { WebSocketData, ViewportData } from "../types/websocket";
import type Redis from "ioredis";

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
  redisClient: Redis;
}

const VIEWPORT_EXPANSION_FACTOR = 0.5;
const GEORADIUS_SEARCH_METERS = 50000;

function extractEventCoordinates(
  event: Record<string, unknown>,
): [number, number] | null {
  // Try event.coordinates (GeoJSON: [lng, lat])
  if (Array.isArray(event.coordinates) && event.coordinates.length >= 2) {
    return [event.coordinates[0] as number, event.coordinates[1] as number];
  }
  // Try event.location.coordinates (GeoJSON point)
  const location = event.location as Record<string, unknown> | undefined;
  if (
    location &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length >= 2
  ) {
    return [
      location.coordinates[0] as number,
      location.coordinates[1] as number,
    ];
  }
  return null;
}

function isPointInExpandedViewport(
  lng: number,
  lat: number,
  viewport: ViewportData,
  expansionFactor: number,
): boolean {
  const width = viewport.maxX - viewport.minX;
  const height = viewport.maxY - viewport.minY;
  const expandX = width * expansionFactor;
  const expandY = height * expansionFactor;

  return (
    lng >= viewport.minX - expandX &&
    lng <= viewport.maxX + expandX &&
    lat >= viewport.minY - expandY &&
    lat <= viewport.maxY + expandY
  );
}

async function broadcastToNearbyUsers(
  event: Record<string, unknown>,
  creatorId: string,
  dependencies: RedisMessageHandlerDependencies,
): Promise<void> {
  const coords = extractEventCoordinates(event);
  if (!coords) {
    console.log(
      "[Discovery Broadcast] No coordinates found on event, skipping",
    );
    return;
  }

  const [lng, lat] = coords;

  try {
    const nearbyViewportKeys = (await dependencies.redisClient.georadius(
      "viewport:geo",
      lng,
      lat,
      GEORADIUS_SEARCH_METERS,
      "m",
    )) as string[];

    if (!nearbyViewportKeys || nearbyViewportKeys.length === 0) {
      console.log("[Discovery Broadcast] No nearby viewports found");
      return;
    }

    let notifiedCount = 0;
    const formattedMessage = formatDiscoveryMessage({
      ...event,
      isOwnDiscovery: false,
    });

    for (const viewportKey of nearbyViewportKeys) {
      // viewportKey format: "viewport:{userId}"
      const userId = viewportKey.replace("viewport:", "");

      // Skip the creator — they already got their own notification
      if (userId === creatorId) continue;

      // Fetch the viewport data to do precise bounds check
      const viewportJson = await dependencies.redisClient.get(viewportKey);
      if (!viewportJson) continue;

      let viewport: ViewportData;
      try {
        viewport = JSON.parse(viewportJson) as ViewportData;
      } catch {
        continue;
      }

      if (
        !isPointInExpandedViewport(
          lng,
          lat,
          viewport,
          VIEWPORT_EXPANSION_FACTOR,
        )
      ) {
        continue;
      }

      // Send to all clients for this user
      const userClients = dependencies.getUserClients(userId);
      if (!userClients) continue;

      for (const clientId of userClients) {
        const client = dependencies.getClient(clientId);
        if (client) {
          try {
            client.send(formattedMessage);
            notifiedCount++;
          } catch (error) {
            console.error(
              `[Discovery Broadcast] Error sending to client ${clientId}:`,
              error,
            );
          }
        }
      }
    }

    console.log(
      `[Discovery Broadcast] Notified ${notifiedCount} nearby clients`,
    );
  } catch (error) {
    console.error("[Discovery Broadcast] Error querying nearby users:", error);
  }
}

export async function handleRedisMessage(
  channel: string,
  message: string,
  dependencies: RedisMessageHandlerDependencies,
): Promise<void> {
  console.log(`Received message from ${channel}: ${message}`);

  try {
    const data = JSON.parse(message);

    // Note: user:*:filtered-events messages are handled by the per-user
    // pattern subscriber in clientConnectionService, not here.

    switch (channel) {
      case REDIS_CHANNELS.DISCOVERED_EVENTS: {
        // Backend publishes { type, data: { event, timestamp } }
        const eventPayload = data.data ?? data;
        const eventData = eventPayload as DiscoveredEvent;
        if (!eventData.event?.creatorId) {
          console.error("Invalid discovered event data:", data);
          return;
        }

        // Send to creator with isOwnDiscovery: true
        const creatorMessage = formatDiscoveryMessage({
          ...eventData.event,
          isOwnDiscovery: true,
        });

        const userClients = dependencies.getUserClients(
          eventData.event.creatorId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = dependencies.getClient(clientId);
            if (client) {
              try {
                client.send(creatorMessage);
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

        // Broadcast to nearby users (excluding creator)
        await broadcastToNearbyUsers(
          eventData.event as Record<string, unknown>,
          eventData.event.creatorId,
          dependencies,
        );
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
        // Backend publishes { type, data: { userId, level, ... } }
        const levelPayload = data.data ?? data;
        const levelData = levelPayload as LevelUpdate;
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
