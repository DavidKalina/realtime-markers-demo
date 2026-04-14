import { Redis } from "ioredis";

export type RedisChannel =
  | "notifications"
  | "job_created"
  | "job_updates"
  | `job:${string}:updates`;

export type NotificationMessage = {
  type: string;
  title: string;
  message: string;
  notificationType: string;
  timestamp: number;
  source: string;
};

export type JobCreatedMessage = {
  type: "JOB_CREATED";
  timestamp: string;
  data: {
    jobId: string;
    jobType?: string;
  };
};

export type RedisMessageType =
  | NotificationMessage
  | JobCreatedMessage
  | Record<string, unknown>;

export interface RedisMessage<T = RedisMessageType> {
  type?: string;
  data?: T;
}

export class RedisService {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Publish a typed message to a Redis channel.
   */
  async publishMessage<T extends RedisMessageType>(
    channel: RedisChannel,
    message: T,
  ): Promise<void> {
    if (channel === "notifications") {
      const m = message as NotificationMessage;
      await this.redis.publish(
        channel,
        JSON.stringify({
          type: m.type,
          title: m.title,
          message: m.message,
          notificationType: m.notificationType,
          timestamp: m.timestamp || Date.now(),
          source: m.source || "backend",
        }),
      );
      return;
    }

    if (channel === "job_created") {
      const m = message as JobCreatedMessage;
      await this.redis.publish(
        channel,
        JSON.stringify({
          type: m.type,
          data: {
            ...m.data,
            timestamp: m.timestamp || new Date().toISOString(),
          },
        }),
      );
      return;
    }

    await this.redis.publish(channel, JSON.stringify(message));
  }

  /**
   * Publish a raw message to a Redis channel.
   */
  async publish<T>(
    channel: RedisChannel,
    message: RedisMessage<T>,
  ): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to a Redis channel.
   */
  async subscribe(
    channel: RedisChannel,
    callback: (message: string) => void,
  ): Promise<void> {
    await this.redis.subscribe(channel);
    this.redis.on("message", (receivedChannel: string, message: string) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  /**
   * Set a key-value pair in Redis.
   */
  async set(
    key: string,
    value: string | number | object,
    ttlSeconds?: number,
  ): Promise<void> {
    const serializedValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serializedValue);
    } else {
      await this.redis.set(key, serializedValue);
    }
  }

  /**
   * Get a value from Redis. Attempts JSON parse, falls back to raw string.
   */
  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Store which city a user is currently in (for background push discovery).
   */
  async storeUserCity(userId: string, city: string): Promise<void> {
    const userCityKey = `user:${userId}:city`;

    const previousCity = await this.redis.get(userCityKey);
    if (previousCity && previousCity !== city) {
      await this.redis.srem(`city:${previousCity}:users`, userId);
    }

    await this.redis.setex(userCityKey, 86400, city);
    await this.redis.sadd(`city:${city}:users`, userId);
  }

  /**
   * Get all user IDs currently in a given city.
   */
  async getUsersInCity(city: string): Promise<string[]> {
    return this.redis.smembers(`city:${city}:users`);
  }

  /**
   * Get-or-compute cache helper.
   */
  async cached<T extends string | number | object>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) return existing;
    const result = await fn();
    await this.set(key, result, ttlSeconds);
    return result;
  }

  /**
   * Get the underlying Redis client for direct operations.
   */
  getClient(): Redis {
    return this.redis;
  }
}
