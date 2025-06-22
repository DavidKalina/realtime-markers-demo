import type { ServerWebSocket } from "bun";
import { MessageTypes } from "../config/constants";
import type { WebSocketData } from "../types/websocket";
import type { SessionManager } from "../../SessionManager";
import type { RedisService } from "./redisService";
import type { ClientType } from "../../../filter-processor/src/types/types";

export interface ClientConnectionService {
  registerClient: (ws: ServerWebSocket<WebSocketData>) => void;
  unregisterClient: (clientId: string, userId?: string) => Promise<void>;
  getUserClients: (userId: string) => Set<string> | undefined;
  addUserClient: (userId: string, clientId: string) => void;
  removeUserClient: (userId: string, clientId: string) => void;
  getClient: (clientId: string) => ServerWebSocket<WebSocketData> | undefined;
  getConnectedClientsCount: () => number;
  getConnectedUsersCount: () => number;
  getUserSubscriber: (userId: string) => unknown;
  releaseUserSubscriber: (userId: string) => void;
  forwardMessageToUserClients: (userId: string, message: string) => void;
  setupUserMessageHandling: (userId: string) => void;
  getClientTypeForUser: (userId: string) => ClientType | undefined;
  cleanupClientTypes: (userId: string) => Promise<void>;
  updateClientTypesForUser: (userId: string) => Promise<void>;
}

export interface ClientConnectionServiceDependencies {
  sessionManager: SessionManager;
  redisService: RedisService;
}

export function createClientConnectionService(
  dependencies: ClientConnectionServiceDependencies,
): ClientConnectionService {
  // Centralized state management
  const clients = new Map<string, ServerWebSocket<WebSocketData>>();
  const userToClients = new Map<string, Set<string>>();
  const userMessageHandlers = new Map<
    string,
    (channel: string, message: string) => void
  >();
  const userIdToClientType = new Map<string, ClientType>();

  return {
    registerClient(ws: ServerWebSocket<WebSocketData>): void {
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
      dependencies.sessionManager.registerClient(ws);

      // Send connection established message
      ws.send(
        JSON.stringify({
          type: MessageTypes.CONNECTION_ESTABLISHED,
          clientId,
          timestamp: new Date().toISOString(),
        }),
      );

      console.log(`Client ${clientId} connected`);
    },

    async unregisterClient(clientId: string, userId?: string): Promise<void> {
      try {
        console.log(`Client ${clientId} disconnected`);

        // Clean up session management
        dependencies.sessionManager.unregisterClient(clientId);

        // Remove from client map
        clients.delete(clientId);

        // Remove from user-client mapping if associated with a user
        if (userId) {
          this.removeUserClient(userId, clientId);

          // If no more clients for this user, clean up
          const userClients = userToClients.get(userId);
          if (userClients && userClients.size === 0) {
            userToClients.delete(userId);
            this.releaseUserSubscriber(userId);

            // Remove viewport data from both Redis keys
            const viewportKey = `viewport:${userId}`;
            await Promise.all([
              dependencies.redisService
                .getPubClient()
                .zrem("viewport:geo", viewportKey),
              dependencies.redisService.delete(viewportKey),
            ]);

            // Clean up client types for this user since no clients are connected
            await this.cleanupClientTypes(userId);

            if (process.env.NODE_ENV !== "production") {
              console.log(`Cleaned up viewport data for user ${userId}`);
            }
          } else {
            // If there are still other clients for this user, update client types
            // to reflect only the remaining client types
            await this.updateClientTypesForUser(userId);
          }
        }
      } catch (error) {
        console.error("Error handling client disconnect:", error);
      }
    },

    getUserClients(userId: string): Set<string> | undefined {
      return userToClients.get(userId);
    },

    addUserClient(userId: string, clientId: string): void {
      if (!userToClients.has(userId)) {
        userToClients.set(userId, new Set());
      }
      userToClients.get(userId)!.add(clientId);
      // Try to get clientType from the client connection
      const ws = clients.get(clientId);
      if (ws && ws.data && ws.data.clientType) {
        userIdToClientType.set(userId, ws.data.clientType);
        console.log(
          `[ClientConnectionService] Set clientType for user ${userId}: ${ws.data.clientType}`,
        );
      }
    },

    removeUserClient(userId: string, clientId: string): void {
      const userClients = userToClients.get(userId);
      if (userClients) {
        userClients.delete(clientId);
      }
    },

    getClient(clientId: string): ServerWebSocket<WebSocketData> | undefined {
      return clients.get(clientId);
    },

    getConnectedClientsCount(): number {
      return clients.size;
    },

    getConnectedUsersCount(): number {
      return userToClients.size;
    },

    getUserSubscriber(userId: string): unknown {
      return dependencies.redisService.getUserSubscriber(userId);
    },

    releaseUserSubscriber(userId: string): void {
      dependencies.redisService.releaseUserSubscriber(userId);
      userMessageHandlers.delete(userId);
    },

    setupUserMessageHandling(userId: string): void {
      if (userMessageHandlers.has(userId)) {
        return; // Already set up
      }

      const userSubscriber =
        dependencies.redisService.getUserSubscriber(userId);

      const messageHandler = (channel: string, message: string) => {
        console.log(
          `[WebSocket] Received message on channel ${channel} for user ${userId}:`,
          message,
        );

        if (channel === `user:${userId}:filtered-events`) {
          console.log(
            `[WebSocket] Processing filtered events for user ${userId}:`,
            message,
          );
          // Forward the filtered events to all clients for this user
          this.forwardMessageToUserClients(userId, message);
        } else if (channel === `user:${userId}:filtered-civic-engagements`) {
          console.log(
            `[WebSocket] Processing filtered civic engagements for user ${userId}:`,
            message,
          );
          // Forward the filtered civic engagements to all clients for this user
          this.forwardMessageToUserClients(userId, message);
        } else {
          console.log(
            `[WebSocket] Ignoring message on channel ${channel} for user ${userId}`,
          );
        }
      };

      userSubscriber.on("message", messageHandler);
      userMessageHandlers.set(userId, messageHandler);

      userSubscriber.on("error", (error: Error) => {
        console.error(
          `[WebSocket] Redis subscriber error for user ${userId}:`,
          error,
        );
      });

      userSubscriber.on("connect", () => {
        console.log(
          `[WebSocket] Redis subscriber connected for user ${userId}`,
        );
      });
    },

    forwardMessageToUserClients(userId: string, message: string): void {
      const clientIds = userToClients.get(userId);
      if (!clientIds) {
        console.log(
          `[WebSocket] No clients found for user ${userId} to forward message to`,
        );
        return;
      }

      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);

        // Transform batch-update messages to the format expected by mobile app
        if (parsedMessage.type === "batch-update") {
          console.log(
            `[WebSocket] Transforming batch-update message for user ${userId}:`,
            {
              userId,
              clientCount: clientIds.size,
              summary: parsedMessage.summary,
            },
          );

          // For deletes, send as delete-event (check this first)
          if (parsedMessage.updates.deletes.length > 0) {
            for (const eventId of parsedMessage.updates.deletes) {
              const deleteEventMessage = {
                type: "delete-event",
                id: eventId,
                timestamp: parsedMessage.timestamp,
              };

              for (const clientId of clientIds) {
                const client = clients.get(clientId);
                if (client) {
                  try {
                    client.send(JSON.stringify(deleteEventMessage));
                  } catch (error) {
                    console.error(
                      `[WebSocket] Error sending delete-event message to client ${clientId}:`,
                      error,
                    );
                  }
                }
              }
            }
            return; // Don't continue with the original message
          }

          // For individual updates, send as update-event
          if (parsedMessage.updates.updates.length > 0) {
            for (const event of parsedMessage.updates.updates) {
              const updateEventMessage = {
                type: "update-event",
                event: event,
                timestamp: parsedMessage.timestamp,
              };

              for (const clientId of clientIds) {
                const client = clients.get(clientId);
                if (client) {
                  try {
                    client.send(JSON.stringify(updateEventMessage));
                  } catch (error) {
                    console.error(
                      `[WebSocket] Error sending update-event message to client ${clientId}:`,
                      error,
                    );
                  }
                }
              }
            }
            return; // Don't continue with the original message
          }

          // For viewport/all updates, send as replace-all (including empty arrays to clear markers)
          if (
            parsedMessage.updates.creates !== undefined &&
            parsedMessage.updates.creates.length > 0
          ) {
            const replaceAllMessage = {
              type: "replace-all",
              events: parsedMessage.updates.creates,
              civicEngagements: parsedMessage.civicEngagements || [],
              timestamp: parsedMessage.timestamp,
            };

            console.log(
              `[WebSocket] Sending replace-all message with ${parsedMessage.updates.creates.length} events and ${parsedMessage.civicEngagements?.length || 0} civic engagements to ${clientIds.size} clients of user ${userId}:`,
              {
                userId,
                clientCount: clientIds.size,
                eventCount: parsedMessage.updates.creates.length,
                civicEngagementCount:
                  parsedMessage.civicEngagements?.length || 0,
                topEventScores: parsedMessage.updates.creates
                  .slice(0, 3)
                  .map(
                    (event: {
                      id: string;
                      title: string;
                      relevanceScore?: number;
                      scanCount?: number;
                      saveCount?: number;
                      rsvps?: Array<{ id: string }>;
                    }) => ({
                      eventId: event.id,
                      title: event.title,
                      relevanceScore: event.relevanceScore,
                      popularityMetrics: {
                        scanCount: event.scanCount,
                        saveCount: event.saveCount || 0,
                        rsvpCount: event.rsvps?.length || 0,
                      },
                    }),
                  ),
                topCivicEngagementScores:
                  parsedMessage.civicEngagements
                    ?.slice(0, 3)
                    .map(
                      (civicEngagement: {
                        id: string;
                        title: string;
                        relevanceScore?: number;
                        status?: string;
                        type?: string;
                      }) => ({
                        civicEngagementId: civicEngagement.id,
                        title: civicEngagement.title,
                        relevanceScore: civicEngagement.relevanceScore,
                        status: civicEngagement.status,
                        type: civicEngagement.type,
                      }),
                    ) || [],
                messageType: "replace-all",
              },
            );

            // Send the transformed message to all clients
            for (const clientId of clientIds) {
              const client = clients.get(clientId);
              if (client) {
                try {
                  client.send(JSON.stringify(replaceAllMessage));
                  console.log(
                    `[WebSocket] Successfully sent replace-all message to client ${clientId}`,
                  );
                } catch (error) {
                  console.error(
                    `[WebSocket] Error sending replace-all message to client ${clientId}:`,
                    error,
                  );
                }
              } else {
                console.log(
                  `[WebSocket] Client ${clientId} not found in clients map`,
                );
              }
            }
            return; // Don't continue with the original message
          }

          // For empty creates arrays, also send as replace-all to clear markers
          if (
            parsedMessage.updates.creates !== undefined &&
            parsedMessage.updates.creates.length === 0
          ) {
            const replaceAllMessage = {
              type: "replace-all",
              events: [],
              civicEngagements: parsedMessage.civicEngagements || [],
              timestamp: parsedMessage.timestamp,
            };

            console.log(
              `[WebSocket] Sending replace-all message with 0 events and ${parsedMessage.civicEngagements?.length || 0} civic engagements to ${clientIds.size} clients of user ${userId}:`,
              {
                userId,
                clientCount: clientIds.size,
                eventCount: 0,
                civicEngagementCount:
                  parsedMessage.civicEngagements?.length || 0,
                topEventScores: [],
                topCivicEngagementScores:
                  parsedMessage.civicEngagements
                    ?.slice(0, 3)
                    .map(
                      (civicEngagement: {
                        id: string;
                        title: string;
                        relevanceScore?: number;
                        status?: string;
                        type?: string;
                      }) => ({
                        civicEngagementId: civicEngagement.id,
                        title: civicEngagement.title,
                        relevanceScore: civicEngagement.relevanceScore,
                        status: civicEngagement.status,
                        type: civicEngagement.type,
                      }),
                    ) || [],
                messageType: "replace-all",
              },
            );

            // Send the transformed message to all clients
            for (const clientId of clientIds) {
              const client = clients.get(clientId);
              if (client) {
                try {
                  client.send(JSON.stringify(replaceAllMessage));
                  console.log(
                    `[WebSocket] Successfully sent replace-all message to client ${clientId}`,
                  );
                } catch (error) {
                  console.error(
                    `[WebSocket] Error sending replace-all message to client ${clientId}:`,
                    error,
                  );
                }
              } else {
                console.log(
                  `[WebSocket] Client ${clientId} not found in clients map`,
                );
              }
            }
            return; // Don't continue with the original message
          }

          // Handle case where there are only civic engagements (no events)
          if (
            parsedMessage.civicEngagements &&
            parsedMessage.civicEngagements.length > 0 &&
            (!parsedMessage.updates.creates ||
              parsedMessage.updates.creates.length === 0)
          ) {
            const replaceAllMessage = {
              type: "replace-all",
              events: [],
              civicEngagements: parsedMessage.civicEngagements,
              timestamp: parsedMessage.timestamp,
            };

            console.log(
              `[WebSocket] Sending replace-all message with 0 events and ${parsedMessage.civicEngagements.length} civic engagements to ${clientIds.size} clients of user ${userId}:`,
              {
                userId,
                clientCount: clientIds.size,
                eventCount: 0,
                civicEngagementCount: parsedMessage.civicEngagements.length,
                topEventScores: [],
                topCivicEngagementScores: parsedMessage.civicEngagements
                  .slice(0, 3)
                  .map(
                    (civicEngagement: {
                      id: string;
                      title: string;
                      relevanceScore?: number;
                      status?: string;
                      type?: string;
                    }) => ({
                      civicEngagementId: civicEngagement.id,
                      title: civicEngagement.title,
                      relevanceScore: civicEngagement.relevanceScore,
                      status: civicEngagement.status,
                      type: civicEngagement.type,
                    }),
                  ),
                messageType: "replace-all",
              },
            );

            // Send the transformed message to all clients
            for (const clientId of clientIds) {
              const client = clients.get(clientId);
              if (client) {
                try {
                  client.send(JSON.stringify(replaceAllMessage));
                  console.log(
                    `[WebSocket] Successfully sent replace-all message to client ${clientId}`,
                  );
                } catch (error) {
                  console.error(
                    `[WebSocket] Error sending replace-all message to client ${clientId}:`,
                    error,
                  );
                }
              } else {
                console.log(
                  `[WebSocket] Client ${clientId} not found in clients map`,
                );
              }
            }
            return; // Don't continue with the original message
          }
        }

        // Enhanced logging for relevance score updates
        if (parsedMessage.type === "replace-all" && parsedMessage.events) {
          console.log(
            `[WebSocket] Forwarding replace-all message with ${parsedMessage.events.length} events to ${clientIds.size} clients of user ${userId}:`,
            {
              userId,
              clientCount: clientIds.size,
              eventCount: parsedMessage.events.length,
              topEventScores: parsedMessage.events
                .slice(0, 3)
                .map(
                  (event: {
                    id: string;
                    title: string;
                    relevanceScore?: number;
                    scanCount?: number;
                    saveCount?: number;
                    rsvps?: Array<{ id: string }>;
                  }) => ({
                    eventId: event.id,
                    title: event.title,
                    relevanceScore: event.relevanceScore,
                    popularityMetrics: {
                      scanCount: event.scanCount,
                      saveCount: event.saveCount || 0,
                      rsvpCount: event.rsvps?.length || 0,
                    },
                  }),
                ),
              messageType: parsedMessage.type,
            },
          );
        } else {
          console.log(
            `[WebSocket] Forwarding message type ${parsedMessage.type} to ${clientIds.size} clients of user ${userId}`,
            parsedMessage,
          );
        }
      } catch (error) {
        console.error(
          `[WebSocket] Error parsing message for user ${userId}:`,
          error,
        );
        return;
      }

      // Forward the original message if no transformation was applied
      for (const clientId of clientIds) {
        const client = clients.get(clientId);
        if (client) {
          try {
            client.send(message);
            console.log(
              `[WebSocket] Successfully sent message to client ${clientId}`,
            );
          } catch (error) {
            console.error(
              `[WebSocket] Error sending message to client ${clientId}:`,
              error,
            );
          }
        } else {
          console.log(
            `[WebSocket] Client ${clientId} not found in clients map`,
          );
        }
      }
    },

    getClientTypeForUser(userId: string): ClientType | undefined {
      return userIdToClientType.get(userId);
    },

    async cleanupClientTypes(userId: string): Promise<void> {
      try {
        // Remove all client types for this user since no clients are connected
        const clientTypeKey = `user:${userId}:client_types`;
        await dependencies.redisService.delete(clientTypeKey);
        userIdToClientType.delete(userId);
        console.log(
          `[ClientConnectionService] Cleaned up client types for user ${userId}`,
        );
      } catch (error) {
        console.error(
          `[ClientConnectionService] Error cleaning up client types for user ${userId}:`,
          error,
        );
      }
    },

    async updateClientTypesForUser(userId: string): Promise<void> {
      try {
        // Get all currently connected clients for this user
        const userClients = userToClients.get(userId);
        if (!userClients || userClients.size === 0) {
          await this.cleanupClientTypes(userId);
          return;
        }

        // Collect client types from currently connected clients
        const currentClientTypes = new Set<string>();
        for (const clientId of userClients) {
          const client = clients.get(clientId);
          if (client && client.data.clientType) {
            currentClientTypes.add(client.data.clientType);
          }
        }

        // Update Redis with only the current client types
        if (currentClientTypes.size > 0) {
          const clientTypeKey = `user:${userId}:client_types`;
          await dependencies.redisService.set(
            clientTypeKey,
            JSON.stringify(Array.from(currentClientTypes)),
            24 * 60 * 60, // 24 hour expiry
          );
          console.log(
            `[ClientConnectionService] Updated client types for user ${userId}: ${Array.from(currentClientTypes)}`,
          );
        } else {
          await this.cleanupClientTypes(userId);
        }
      } catch (error) {
        console.error(
          `[ClientConnectionService] Error updating client types for user ${userId}:`,
          error,
        );
      }
    },
  };
}
