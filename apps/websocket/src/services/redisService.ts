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

  // User-specific subscribers
  getUserSubscriber: (userId: string) => Redis;
  releaseUserSubscriber: (userId: string) => void;

  // Viewport management
  updateViewport: (userId: string, viewport: ViewportData) => Promise<void>;

  // Connection health
  checkConnection: () => Promise<boolean>;

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

  // Map to store user-specific subscribers
  const userSubscribers = new Map<string, Redis>();

  // Event emitter for global messages
  const eventEmitter = new EventEmitter();

  // Setup error handling for main clients
  setupErrorHandling(pubClient, "publisher");
  setupErrorHandling(globalSubClient, "global subscriber");

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

    getUserSubscriber(userId: string): Redis {
      if (!userSubscribers.has(userId)) {
        console.log(`Creating new Redis subscriber for user ${userId}`);

        // Create a dedicated subscriber for this user
        const userSubscriber = new Redis(config);
        userSubscribers.set(userId, userSubscriber);

        // Setup error handling for user subscriber
        setupErrorHandling(userSubscriber, `user ${userId} subscriber`);

        // Subscribe to user's filtered events channel
        const userChannel = `user:${userId}:filtered-events`;
        console.log(
          `[RedisService] Subscribing to user channel: ${userChannel}`,
        );
        userSubscriber.subscribe(userChannel, (err, count) => {
          if (err) {
            console.error(`Error subscribing to ${userChannel}:`, err);
          } else {
            console.log(
              `Successfully subscribed to ${userChannel}, total subscriptions: ${count}`,
            );
          }
        });

        userSubscriber.on("connect", () => {
          console.log(`Redis subscriber connected for user ${userId}`);
        });

        userSubscriber.on("message", (channel: string, message: string) => {
          console.log(
            `[RedisService] Received message on ${channel} for user ${userId}:`,
            message,
          );
        });
      } else {
        console.log(`Using existing Redis subscriber for user ${userId}`);
      }

      return userSubscribers.get(userId)!;
    },

    releaseUserSubscriber(userId: string): void {
      const subscriber = userSubscribers.get(userId);
      if (subscriber) {
        subscriber.unsubscribe();
        subscriber.quit();
        userSubscribers.delete(userId);
        console.log(`Released Redis subscriber for user ${userId}`);
      }
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

    getPubClient(): Redis {
      return pubClient;
    },

    getSubClient(): Redis {
      return globalSubClient;
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
