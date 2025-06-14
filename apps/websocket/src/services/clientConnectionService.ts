import type { ServerWebSocket } from "bun";
import { MessageTypes } from "../config/constants";
import type { WebSocketData } from "../types/websocket";
import type { SessionManager } from "../../SessionManager";
import type { RedisConnectionService } from "./redisConnectionService";
import type Redis from "ioredis";

export interface ClientConnectionService {
  registerClient: (ws: ServerWebSocket<WebSocketData>) => void;
  unregisterClient: (clientId: string, userId?: string) => Promise<void>;
  getUserClients: (userId: string) => Set<string> | undefined;
  addUserClient: (userId: string, clientId: string) => void;
  removeUserClient: (userId: string, clientId: string) => void;
  getClient: (clientId: string) => ServerWebSocket<WebSocketData> | undefined;
  getConnectedClientsCount: () => number;
  getConnectedUsersCount: () => number;
  getRedisSubscriberForUser: (userId: string) => unknown;
  releaseRedisSubscriber: (userId: string) => void;
  forwardMessageToUserClients: (userId: string, message: string) => void;
}

export interface ClientConnectionServiceDependencies {
  sessionManager: SessionManager;
  redisService: RedisConnectionService;
}

export function createClientConnectionService(
  dependencies: ClientConnectionServiceDependencies,
): ClientConnectionService {
  const clients = new Map<string, ServerWebSocket<WebSocketData>>();
  const userToClients = new Map<string, Set<string>>();
  const userSubscribers = new Map<string, unknown>();

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
            this.releaseRedisSubscriber(userId);

            // Remove viewport data from both Redis keys
            const viewportKey = `viewport:${userId}`;
            await Promise.all([
              dependencies.redisService
                .getPubClient()
                .zrem("viewport:geo", viewportKey),
              dependencies.redisService.deleteKey(viewportKey),
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

    getRedisSubscriberForUser(userId: string): unknown {
      if (!userSubscribers.has(userId)) {
        console.log(`Creating new Redis subscriber for user ${userId}`);

        const subscriber = dependencies.redisService.getPubClient();
        userSubscribers.set(userId, subscriber);

        // Subscribe to user's filtered events channel
        subscriber.subscribe(`user:${userId}:filtered-events`);
        console.log(`Subscribed to user:${userId}:filtered-events`);

        // Handle messages for this user
        subscriber.on("message", (channel: string, message: string) => {
          console.log(
            `[WebSocket] Received message on channel ${channel} for user ${userId}:`,
            message,
          );
          if (channel === `user:${userId}:filtered-events`) {
            // Forward the filtered events to all clients for this user
            this.forwardMessageToUserClients(userId, message);
          }
        });

        subscriber.on("error", (error: Error) => {
          console.error(
            `[WebSocket] Redis subscriber error for user ${userId}:`,
            error,
          );
        });

        subscriber.on("connect", () => {
          console.log(
            `[WebSocket] Redis subscriber connected for user ${userId}`,
          );
        });
      }

      return userSubscribers.get(userId)!;
    },

    releaseRedisSubscriber(userId: string): void {
      const subscriber = userSubscribers.get(userId);
      if (subscriber) {
        (subscriber as Redis).unsubscribe();
        (subscriber as Redis).quit();
        userSubscribers.delete(userId);
        console.log(`Released Redis subscriber for user ${userId}`);
      }
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
