import Redis from "ioredis";
import { EventEmitter } from "events";
import {
  REDIS_CONFIG,
  REDIS_CHANNELS,
  SERVER_CONFIG,
} from "../config/constants";
import type { ViewportData } from "../types/websocket";

export interface RedisService {
  // Core Redis operations
  publish: (channel: string, message: string) => Promise<void>;
  set: (key: string, value: string, expiry?: number) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  delete: (key: string) => Promise<void>;
  ping: () => Promise<string>;

  // Global subscriptions
  subscribeToChannel: (
    channel: string,
    callback: (channel: string, message: string) => void,
  ) => Promise<void>;
  onGlobalMessage: (
    callback: (channel: string, message: string) => void,
  ) => void;

  // User-specific subscribers (shared pattern subscriber)
  subscribeUser: (userId: string) => void;
  unsubscribeUser: (userId: string) => void;
  onUserMessage: (
    callback: (userId: string, channel: string, message: string) => void,
  ) => void;

  // Viewport management
  updateViewport: (userId: string, viewport: ViewportData) => Promise<void>;

  // Client type management
  setClientType: (userId: string, clientType: string) => Promise<void>;
  getClientType: (userId: string) => Promise<string | null>;
  setClientTypeByClientId: (
    clientId: string,
    clientType: string,
  ) => Promise<void>;
  getClientTypeByClientId: (clientId: string) => Promise<string | null>;

  // Connection health
  checkConnection: () => Promise<boolean>;

  // Lifecycle
  shutdown: () => Promise<void>;

  // Client access (for backward compatibility)
  getPubClient: () => Redis;
  getSubClient: () => Redis;
}

export interface RedisServiceDependencies {
  config?: typeof REDIS_CONFIG;
}

export function createRedisService(
  dependencies: RedisServiceDependencies = {},
): RedisService {
  const config = dependencies.config || REDIS_CONFIG;

  // Main publisher client
  const pubClient = new Redis(config);

  // Global subscriber client for system-wide channels
  const globalSubClient = new Redis(config);

  // Shared pattern subscriber for all user channels
  const subscribedUsers = new Set<string>();
  let userMessageCallback:
    | ((userId: string, channel: string, message: string) => void)
    | null = null;
  const userPatternSubClient = new Redis(config);

  // Event emitter for global messages
  const eventEmitter = new EventEmitter();

  // Setup error handling for main clients
  setupErrorHandling(pubClient, "publisher");
  setupErrorHandling(globalSubClient, "global subscriber");
  setupErrorHandling(userPatternSubClient, "user pattern subscriber");

  // Subscribe to all user filtered-events channels via pattern
  userPatternSubClient.psubscribe("user:*:filtered-events", (err, count) => {
    if (err) {
      console.error(
        "Error pattern-subscribing to user:*:filtered-events:",
        err,
      );
    } else {
      console.log(
        `Pattern-subscribed to user:*:filtered-events, total subscriptions: ${count}`,
      );
    }
  });

  // Route pattern messages to the registered callback
  const userChannelRegex = /^user:([^:]+):filtered-events$/;
  userPatternSubClient.on(
    "pmessage",
    (_pattern: string, channel: string, message: string) => {
      const match = channel.match(userChannelRegex);
      if (match) {
        const userId = match[1];
        if (subscribedUsers.has(userId) && userMessageCallback) {
          userMessageCallback(userId, channel, message);
        }
      }
    },
  );

  // Setup global message handling
  globalSubClient.on("message", (channel: string, message: string) => {
    eventEmitter.emit("message", channel, message);
  });

  return {
    async publish(channel: string, message: string): Promise<void> {
      await pubClient.publish(channel, message);
    },

    async set(key: string, value: string, expiry?: number): Promise<void> {
      if (expiry) {
        await pubClient.set(key, value, "EX", expiry);
      } else {
        await pubClient.set(key, value);
      }
    },

    async get(key: string): Promise<string | null> {
      return await pubClient.get(key);
    },

    async delete(key: string): Promise<void> {
      await pubClient.del(key);
    },

    async ping(): Promise<string> {
      return await pubClient.ping();
    },

    async subscribeToChannel(
      channel: string,
      callback: (channel: string, message: string) => void,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        globalSubClient.subscribe(channel, (err, count) => {
          if (err) {
            console.error(`Error subscribing to ${channel}:`, err);
            reject(err);
          } else {
            console.log(
              `Subscribed to ${channel}, total subscriptions: ${count}`,
            );
            resolve();
          }
        });

        // Listen for messages on this specific channel
        const messageHandler = (msgChannel: string, message: string) => {
          if (msgChannel === channel) {
            callback(msgChannel, message);
          }
        };

        eventEmitter.on("message", messageHandler);
      });
    },

    onGlobalMessage(
      callback: (channel: string, message: string) => void,
    ): void {
      eventEmitter.on("message", callback);
    },

    subscribeUser(userId: string): void {
      subscribedUsers.add(userId);
      console.log(
        `[RedisService] Subscribed user ${userId} (${subscribedUsers.size} active users)`,
      );
    },

    unsubscribeUser(userId: string): void {
      subscribedUsers.delete(userId);
      console.log(
        `[RedisService] Unsubscribed user ${userId} (${subscribedUsers.size} active users)`,
      );
    },

    onUserMessage(
      callback: (userId: string, channel: string, message: string) => void,
    ): void {
      userMessageCallback = callback;
    },

    async updateViewport(
      userId: string,
      viewport: ViewportData,
    ): Promise<void> {
      const viewportKey = `viewport:${userId}`;
      await Promise.all([
        this.set(
          viewportKey,
          JSON.stringify(viewport),
          SERVER_CONFIG.viewportExpiration,
        ),
        this.publish(
          REDIS_CHANNELS.VIEWPORT_UPDATES,
          JSON.stringify({
            userId,
            viewport,
            timestamp: new Date().toISOString(),
          }),
        ),
      ]);
    },

    async checkConnection(): Promise<boolean> {
      try {
        const pong = await pubClient.ping();
        return pong === "PONG";
      } catch (error) {
        console.error("Redis connection check failed:", error);
        return false;
      }
    },

    async shutdown(): Promise<void> {
      console.log("[RedisService] Shutting down Redis connections...");
      subscribedUsers.clear();
      userMessageCallback = null;
      try {
        await Promise.allSettled([
          userPatternSubClient
            .punsubscribe()
            .then(() => userPatternSubClient.quit()),
          globalSubClient.unsubscribe().then(() => globalSubClient.quit()),
          pubClient.quit(),
        ]);
        console.log("[RedisService] All Redis connections closed");
      } catch (error) {
        console.error("[RedisService] Error during shutdown:", error);
      }
    },

    getPubClient(): Redis {
      return pubClient;
    },

    getSubClient(): Redis {
      return globalSubClient;
    },

    async setClientType(userId: string, clientType: string): Promise<void> {
      const clientTypeKey = `user:${userId}:client_types`;

      // Get existing client types for this user
      const existingTypes = await this.get(clientTypeKey);
      let clientTypes: Set<string>;

      if (existingTypes) {
        try {
          const parsed = JSON.parse(existingTypes);
          clientTypes = new Set(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          clientTypes = new Set();
        }
      } else {
        clientTypes = new Set();
      }

      // Add the new client type
      clientTypes.add(clientType);

      // Store the updated set
      await this.set(
        clientTypeKey,
        JSON.stringify(Array.from(clientTypes)),
        24 * 60 * 60,
      ); // 24 hour expiry
      console.log(
        `[RedisService] Stored client types ${Array.from(clientTypes)} for user ${userId}`,
      );
    },

    async getClientType(userId: string): Promise<string | null> {
      const clientTypeKey = `user:${userId}:client_types`;
      const clientTypesJson = await this.get(clientTypeKey);

      if (!clientTypesJson) {
        console.log(`[RedisService] No client types found for user ${userId}`);
        return null;
      }

      try {
        const clientTypes = JSON.parse(clientTypesJson);
        const typesArray = Array.isArray(clientTypes)
          ? clientTypes
          : [clientTypes];

        // If user has both mobile and dashboard clients, check which one is more recent
        if (typesArray.includes("dashboard") && typesArray.includes("mobile")) {
          // Get the most recent client type by checking the order in the array
          // The last item in the array is typically the most recent
          const mostRecentType = typesArray[typesArray.length - 1];

          if (mostRecentType === "mobile") {
            console.log(
              `[RedisService] User ${userId} has both mobile and dashboard clients, using mobile (most recent)`,
            );
            return "mobile";
          } else {
            console.log(
              `[RedisService] User ${userId} has both mobile and dashboard clients, using dashboard (most recent)`,
            );
            return "dashboard";
          }
        } else if (typesArray.includes("dashboard")) {
          console.log(
            `[RedisService] User ${userId} has dashboard client, using dashboard config`,
          );
          return "dashboard";
        } else if (typesArray.includes("mobile")) {
          console.log(
            `[RedisService] User ${userId} has mobile client, using mobile config`,
          );
          return "mobile";
        }

        // Fallback to first type found
        const firstType = typesArray[0];
        console.log(
          `[RedisService] Using client type ${firstType} for user ${userId}`,
        );
        return firstType;
      } catch (error) {
        console.error(
          `[RedisService] Error parsing client types for user ${userId}:`,
          error,
        );
        return null;
      }
    },

    async setClientTypeByClientId(
      clientId: string,
      clientType: string,
    ): Promise<void> {
      const clientTypeKey = `client_type:${clientId}`;
      await this.set(clientTypeKey, clientType, 24 * 60 * 60); // 24 hour expiry
      console.log(
        `[RedisService] Stored client type ${clientType} for client ${clientId}`,
      );
    },

    async getClientTypeByClientId(clientId: string): Promise<string | null> {
      const clientTypeKey = `client_type:${clientId}`;
      const clientType = await this.get(clientTypeKey);
      console.log(
        `[RedisService] Retrieved client type ${clientType} for client ${clientId}`,
      );
      return clientType;
    },
  };
}

function setupErrorHandling(client: Redis, clientName: string): void {
  client.on("error", (error) => {
    console.error(`Redis ${clientName} error:`, error);
  });

  client.on("connect", () => {
    console.log(`Redis ${clientName} connected successfully`);
  });

  client.on("ready", () => {
    console.log(`Redis ${clientName} is ready to accept commands`);
  });
}
