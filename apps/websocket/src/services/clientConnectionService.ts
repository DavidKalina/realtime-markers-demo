import type { ServerWebSocket } from "bun";
import { MessageTypes } from "../config/constants";
import type { WebSocketData } from "../types/websocket";
import type { SessionManager } from "../../SessionManager";
import type { RedisService } from "./redisService";

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

            if (process.env.NODE_ENV !== "production") {
              console.log(`Cleaned up viewport data for user ${userId}`);
            }
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
          // Forward the filtered events to all clients for this user
          this.forwardMessageToUserClients(userId, message);
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

          // For viewport/all updates, send as replace-all (including empty arrays to clear markers)
          if (parsedMessage.updates.creates !== undefined) {
            const replaceAllMessage = {
              type: "replace-all",
              events: parsedMessage.updates.creates,
              timestamp: parsedMessage.timestamp,
            };

            console.log(
              `[WebSocket] Sending replace-all message with ${parsedMessage.updates.creates.length} events to ${clientIds.size} clients of user ${userId}:`,
              {
                userId,
                clientCount: clientIds.size,
                eventCount: parsedMessage.updates.creates.length,
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

          // For deletes, send as delete-event
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
  };
}
