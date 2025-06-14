import Redis from "ioredis";
import { REDIS_CONFIG } from "../config/constants";

export interface RedisConnectionService {
  getPubClient: () => Redis;
  getSubClient: () => Redis;
  subscribeToChannel: (
    channel: string,
    callback: (channel: string, message: string) => void,
  ) => Promise<void>;
  publishToChannel: (channel: string, message: string) => Promise<void>;
  setKeyWithExpiry: (
    key: string,
    value: string,
    expirySeconds: number,
  ) => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
  ping: () => Promise<string>;
}

export function createRedisConnectionService(): RedisConnectionService {
  // Main Redis client for publishing
  const redisPub = new Redis(REDIS_CONFIG);

  // Add error handling for Redis publisher
  redisPub.on("error", (error) => {
    console.error("Redis publisher error:", error);
  });

  redisPub.on("connect", () => {
    console.log("Redis publisher connected successfully");
  });

  redisPub.on("ready", () => {
    console.log("Redis publisher is ready to accept commands");
  });

  // Subscribe to discovered events
  const redisSub = new Redis(REDIS_CONFIG);

  // Add error handling for Redis subscriber
  redisSub.on("error", (error) => {
    console.error("Redis subscriber error:", error);
  });

  redisSub.on("connect", () => {
    console.log("Redis subscriber connected successfully");
  });

  redisSub.on("ready", () => {
    console.log("Redis subscriber is ready to accept commands");
  });

  return {
    getPubClient(): Redis {
      return redisPub;
    },

    getSubClient(): Redis {
      return redisSub;
    },

    async subscribeToChannel(
      channel: string,
      callback: (channel: string, message: string) => void,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        redisSub.subscribe(channel, (err, count) => {
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

        redisSub.on("message", callback);
      });
    },

    async publishToChannel(channel: string, message: string): Promise<void> {
      await redisPub.publish(channel, message);
    },

    async setKeyWithExpiry(
      key: string,
      value: string,
      expirySeconds: number,
    ): Promise<void> {
      await redisPub.set(key, value, "EX", expirySeconds);
    },

    async deleteKey(key: string): Promise<void> {
      await redisPub.del(key);
    },

    async ping(): Promise<string> {
      return await redisPub.ping();
    },
  };
}
