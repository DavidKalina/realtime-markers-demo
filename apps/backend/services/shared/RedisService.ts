import { Redis } from "ioredis";

export type RedisChannel =
  | "event_changes"
  | "notifications"
  | "user_updates"
  | "location_updates"
  | "job_created"
  | "job_updates"
  | "level-update"
  | `job:${string}:updates`;

export interface RedisMessage<T = unknown> {
  type: string;
  data: T;
}

export class RedisService {
  private static instance: RedisService;
  private redis: Redis;

  private constructor(redis: Redis) {
    this.redis = redis;
  }

  public static getInstance(redis: Redis): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService(redis);
    }
    return RedisService.instance;
  }

  /**
   * Publish a message to a Redis channel
   */
  async publish<T>(
    channel: RedisChannel,
    message: RedisMessage<T>,
  ): Promise<void> {
    try {
      await this.redis.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error(`Error publishing to Redis channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a Redis channel
   */
  async subscribe(
    channel: RedisChannel,
    callback: (message: string) => void,
  ): Promise<void> {
    try {
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe(channel);

      subscriber.on("message", (ch, message) => {
        if (ch === channel) {
          callback(message);
        }
      });

      // Handle errors
      subscriber.on("error", (error) => {
        console.error(
          `Redis subscription error for channel ${channel}:`,
          error,
        );
      });
    } catch (error) {
      console.error(`Error subscribing to Redis channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Store a value in Redis with optional expiration
   */
  async set(
    key: string,
    value: string | number | object,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const serializedValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      if (ttlSeconds) {
        await this.redis.set(key, serializedValue, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      console.error(`Error setting Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      try {
        // Try to parse as JSON first
        return JSON.parse(value) as T;
      } catch {
        // If not JSON, return as is
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`Error getting Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Error deleting Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(
        `Error deleting Redis keys matching pattern ${pattern}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Store a hash field
   */
  async hset(
    key: string,
    field: string,
    value: string | number | object,
  ): Promise<void> {
    try {
      const serializedValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      await this.redis.hset(key, field, serializedValue);
    } catch (error) {
      console.error(`Error setting Redis hash field ${key}.${field}:`, error);
      throw error;
    }
  }

  /**
   * Get a hash field
   */
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (!value) return null;

      try {
        // Try to parse as JSON first
        return JSON.parse(value) as T;
      } catch {
        // If not JSON, return as is
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`Error getting Redis hash field ${key}.${field}:`, error);
      throw error;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall<T extends Record<string, unknown>>(
    key: string,
  ): Promise<T | null> {
    try {
      const hash = await this.redis.hgetall(key);
      if (!hash || Object.keys(hash).length === 0) return null;

      // Try to parse each value as JSON
      const result: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }

      return result as T;
    } catch (error) {
      console.error(`Error getting all Redis hash fields for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a hash field
   */
  async hdel(key: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(key, field);
    } catch (error) {
      console.error(`Error deleting Redis hash field ${key}.${field}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking existence of Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set key expiration
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
    } catch (error) {
      console.error(`Error setting expiration for Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get the Redis client instance
   * Note: This should be used sparingly and only when absolutely necessary
   */
  getClient(): Redis {
    return this.redis;
  }
}
