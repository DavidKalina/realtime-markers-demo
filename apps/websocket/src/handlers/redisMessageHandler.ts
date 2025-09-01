import { REDIS_CHANNELS, MessageTypes } from "../config/constants";
import {
  formatDiscoveryMessage,
  formatCivicEngagementDiscoveryMessage,
  formatNotificationMessage,
  formatLevelUpdateMessage,
  formatEventAsMarkerMessage,
  formatCivicEngagementAsMarkerMessage,
  formatEventsAsMarkersMessage,
} from "../utils/messageFormatter";
import { convertCivicEngagementToMarker } from "../utils/markerConverter";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types/websocket";

export interface DiscoveredEvent {
  event: {
    creatorId: string;
    [key: string]: unknown;
  };
}

export interface DiscoveredCivicEngagement {
  civicEngagement: {
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

/**
 * Get the appropriate message type for civic engagement operations
 */
function getCivicEngagementMessageType(operation: string): string {
  switch (operation) {
    case "CREATE":
    case "INSERT":
      return MessageTypes.ADD_CIVIC_ENGAGEMENT;
    case "UPDATE":
      return MessageTypes.UPDATE_CIVIC_ENGAGEMENT;
    case "DELETE":
      return MessageTypes.DELETE_CIVIC_ENGAGEMENT;
    default:
      return MessageTypes.UPDATE_CIVIC_ENGAGEMENT;
  }
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

      console.log(
        "[WebSocket] Converting and forwarding filtered events to user:",
        userId,
      );

      // Convert events to markers and forward to user's clients
      const userClients = dependencies.getUserClients(userId);
      if (userClients) {
        for (const clientId of userClients) {
          const client = dependencies.getClient(clientId);
          if (client) {
            try {
              let convertedMessage: string;

              // Handle different message types
              if (data.type === "replace-all" && data.events) {
                // Convert multiple events to markers
                convertedMessage = formatEventsAsMarkersMessage(data.events);
              } else if (data.type === "add-event" && data.event) {
                // Convert single event to marker
                convertedMessage = formatEventAsMarkerMessage(data.event);
              } else if (data.type === "update-event" && data.event) {
                // Convert updated event to marker
                convertedMessage = formatEventAsMarkerMessage(data.event);
              } else if (data.type === "delete-event" && data.id) {
                // For delete operations, just forward the ID
                convertedMessage = JSON.stringify({
                  type: MessageTypes.DELETE_EVENT,
                  id: data.id,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
              } else {
                // Fallback: forward original message if we can't process it
                console.warn(
                  "[WebSocket] Unknown filtered events message format, forwarding as-is:",
                  data,
                );
                convertedMessage = message;
              }

              client.send(convertedMessage);
              console.log(
                `Forwarded converted filtered events to client ${clientId}`,
              );
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

    // Handle filtered civic engagements channel pattern (user:${userId}:filtered-civic-engagements)
    if (channel.match(/^user:.+:filtered-civic-engagements$/)) {
      console.log(
        "[WebSocket] Received filtered civic engagements message:",
        data,
      );

      // Extract userId from channel name
      const userId = channel.split(":")[1];
      if (!userId) {
        console.error("Could not extract userId from channel:", channel);
        return;
      }

      console.log(
        "[WebSocket] Converting and forwarding filtered civic engagements to user:",
        userId,
      );

      // Convert civic engagements to markers and forward to user's clients
      const userClients = dependencies.getUserClients(userId);
      if (userClients) {
        for (const clientId of userClients) {
          const client = dependencies.getClient(clientId);
          if (client) {
            try {
              let convertedMessage: string;

              // Handle different message types
              if (data.type === "replace-all" && data.civicEngagements) {
                // Convert multiple civic engagements to markers
                const markers = data.civicEngagements.map((ce: any) =>
                  convertCivicEngagementToMarker(ce),
                );
                convertedMessage = JSON.stringify({
                  type: MessageTypes.REPLACE_ALL,
                  markers,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
              } else if (
                data.type === "add-civic-engagement" &&
                data.civicEngagement
              ) {
                // Convert single civic engagement to marker
                convertedMessage = formatCivicEngagementAsMarkerMessage(
                  data.civicEngagement,
                );
              } else if (
                data.type === "update-civic-engagement" &&
                data.civicEngagement
              ) {
                // Convert updated civic engagement to marker
                convertedMessage = formatCivicEngagementAsMarkerMessage(
                  data.civicEngagement,
                );
              } else if (data.type === "delete-civic-engagement" && data.id) {
                // For delete operations, just forward the ID
                convertedMessage = JSON.stringify({
                  type: MessageTypes.DELETE_CIVIC_ENGAGEMENT,
                  id: data.id,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
              } else {
                // Fallback: forward original message if we can't process it
                console.warn(
                  "[WebSocket] Unknown filtered civic engagements message format, forwarding as-is:",
                  data,
                );
                convertedMessage = message;
              }

              client.send(convertedMessage);
              console.log(
                `Forwarded converted filtered civic engagements to client ${clientId}`,
              );
            } catch (error) {
              console.error(
                `Error forwarding filtered civic engagements to client ${clientId}:`,
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
        const eventData = data as DiscoveredEvent;
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

      case REDIS_CHANNELS.DISCOVERED_CIVIC_ENGAGEMENTS: {
        const civicEngagementData = data as DiscoveredCivicEngagement;
        if (!civicEngagementData.civicEngagement?.creatorId) {
          console.error("Invalid discovered civic engagement data:", data);
          return;
        }

        const formattedMessage = formatCivicEngagementDiscoveryMessage(
          civicEngagementData.civicEngagement,
        );

        const userClients = dependencies.getUserClients(
          civicEngagementData.civicEngagement.creatorId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = dependencies.getClient(clientId);
            if (client) {
              try {
                client.send(formattedMessage);
                console.log(
                  `Sent civic engagement discovery to client ${clientId}`,
                );
              } catch (error) {
                console.error(
                  `Error sending civic engagement discovery to client ${clientId}:`,
                  error,
                );
              }
            }
          }
        } else {
          console.log(
            `No clients found for user ${civicEngagementData.civicEngagement.creatorId}`,
          );
        }
        break;
      }

      case REDIS_CHANNELS.CIVIC_ENGAGEMENT_CHANGES: {
        console.log("[WebSocket] Received civic engagement change:", data);
        // Handle civic engagement updates from filter processor
        const civicEngagementData = data.data || data;
        if (!civicEngagementData.userId || !civicEngagementData.operation) {
          console.error("Invalid civic engagement change data:", data);
          return;
        }

        console.log("[WebSocket] Processing civic engagement:", {
          operation: civicEngagementData.operation,
          userId: civicEngagementData.userId,
          civicEngagement:
            civicEngagementData.civicEngagement || civicEngagementData,
        });

        const userClients = dependencies.getUserClients(
          civicEngagementData.userId,
        );
        if (userClients) {
          for (const clientId of userClients) {
            const client = dependencies.getClient(clientId);
            if (client) {
              try {
                const messageType = getCivicEngagementMessageType(
                  civicEngagementData.operation,
                );
                const formattedMessage = JSON.stringify({
                  type: messageType,
                  civicEngagement:
                    civicEngagementData.civicEngagement || civicEngagementData,
                  timestamp: new Date().toISOString(),
                });

                console.log(
                  "[WebSocket] Sending civic engagement message to client:",
                  {
                    clientId,
                    messageType,
                    civicEngagementId:
                      civicEngagementData.civicEngagement?.id ||
                      civicEngagementData.id,
                  },
                );

                client.send(formattedMessage);
                console.log(
                  `Sent civic engagement ${civicEngagementData.operation} to client ${clientId}`,
                );
              } catch (error) {
                console.error(
                  `Error sending civic engagement update to client ${clientId}:`,
                  error,
                );
              }
            }
          }
        } else {
          console.log(
            `No clients found for user ${civicEngagementData.userId}`,
          );
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
