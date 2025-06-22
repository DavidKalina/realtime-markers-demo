import { Redis } from "ioredis";

export type RedisChannel =
  | "event_changes"
  | "notifications"
  | "user_updates"
  | "location_updates"
  | "job_created"
  | "job_updates"
  | "level-update"
  | "discovered_events"
  | "filter-changes"
  | "viewport-updates"
  | "websocket:job_updates"
  | "civic_engagement:created"
  | "civic_engagement:updated"
  | "civic_engagement:deleted"
  | `user:${string}:filtered-events`
  | `job:${string}:updates`;

// Define base interface for messages that require timestamps
interface TimestampedMessage {
  timestamp: string;
}

// Define specific message types for better type safety
export type FilterChangeMessage = TimestampedMessage & {
  userId: string;
  filters: Array<{
    id: string;
    name: string;
    criteria: Record<string, unknown>;
    isActive: boolean;
  }>;
};

export type ViewportUpdateMessage = TimestampedMessage & {
  userId: string;
  viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
};

export type FilteredEventMessage = TimestampedMessage & {
  type: "add-event" | "update-event" | "delete-event" | "replace-all";
  event?: Record<string, unknown>;
  id?: string;
  events?: Array<Record<string, unknown>>;
  count?: number;
};

export type NotificationMessage = {
  type: string;
  title: string;
  message: string;
  notificationType: string;
  timestamp: number;
  source: string;
};

export type LevelUpdateMessage = {
  type: string;
  data: {
    userId: string;
    level: number;
    title: string;
    action: string;
    amount: number;
    totalXp: number;
    timestamp: string;
  };
};

export type JobCreatedMessage = TimestampedMessage & {
  type: "JOB_CREATED";
  data: {
    jobId: string;
    jobType?: string;
  };
};

export type RedisMessageType =
  | FilterChangeMessage
  | ViewportUpdateMessage
  | FilteredEventMessage
  | NotificationMessage
  | LevelUpdateMessage
  | JobCreatedMessage
  | (Record<string, unknown> & Partial<TimestampedMessage>);

export interface RedisMessage<T = RedisMessageType> {
  type?: string;
  data?: T;
}

export interface RedisService {
  publishMessage<T extends RedisMessageType>(
    channel: RedisChannel,
    message: T,
  ): Promise<void>;
  publish<T>(channel: RedisChannel, message: RedisMessage<T>): Promise<void>;
  subscribe(
    channel: RedisChannel,
    callback: (message: string) => void,
  ): Promise<void>;
  set(
    key: string,
    value: string | number | object,
    ttlSeconds?: number,
  ): Promise<void>;
  get<T = string>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
  hset(
    key: string,
    field: string,
    value: string | number | object,
  ): Promise<void>;
  hget<T = string>(key: string, field: string): Promise<T | null>;
  hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null>;
  hdel(key: string, field: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, seconds: number): Promise<void>;
  getClient(): Redis;
}

export class RedisServiceImpl implements RedisService {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Publish a message to a Redis channel with standardized formatting
   */
  async publishMessage<T extends RedisMessageType>(
    channel: RedisChannel,
    message: T,
  ): Promise<void> {
    try {
      // Ensure timestamp is present for messages that support it
      const messageWithTimestamp = {
        ...message,
        ...("timestamp" in message && !message.timestamp
          ? { timestamp: new Date().toISOString() }
          : {}),
      };

      // For filtered events, ensure the message format matches what FilterProcessor expects
      if (channel.startsWith("user:") && channel.endsWith(":filtered-events")) {
        await this.redis.publish(channel, JSON.stringify(messageWithTimestamp));
        return;
      }

      // For filter changes, ensure the format matches what FilterProcessor expects
      if (channel === "filter-changes") {
        const filterMessage = message as FilterChangeMessage;
        await this.redis.publish(
          channel,
          JSON.stringify({
            userId: filterMessage.userId,
            filters: filterMessage.filters,
            timestamp: filterMessage.timestamp || new Date().toISOString(),
          }),
        );
        return;
      }

      // For viewport updates, ensure the format matches what FilterProcessor expects
      if (channel === "viewport-updates") {
        const viewportMessage = message as ViewportUpdateMessage;
        await this.redis.publish(
          channel,
          JSON.stringify({
            userId: viewportMessage.userId,
            viewport: viewportMessage.viewport,
            timestamp: viewportMessage.timestamp || new Date().toISOString(),
          }),
        );
        return;
      }

      // For notifications, ensure the format matches what WebSocket expects
      if (channel === "notifications") {
        const notificationMessage = message as NotificationMessage;
        await this.redis.publish(
          channel,
          JSON.stringify({
            type: notificationMessage.type,
            title: notificationMessage.title,
            message: notificationMessage.message,
            notificationType: notificationMessage.notificationType,
            timestamp: notificationMessage.timestamp || Date.now(),
            source: notificationMessage.source || "backend",
          }),
        );
        return;
      }

      // For level updates, ensure the format matches what WebSocket expects
      if (channel === "level-update") {
        const levelMessage = message as LevelUpdateMessage;
        await this.redis.publish(
          channel,
          JSON.stringify({
            type: levelMessage.type,
            data: {
              ...levelMessage.data,
              timestamp:
                levelMessage.data.timestamp || new Date().toISOString(),
            },
          }),
        );
        return;
      }

      // For job created, ensure the format matches what WebSocket expects
      if (channel === "job_created") {
        const jobCreatedMessage = message as JobCreatedMessage;
        await this.redis.publish(
          channel,
          JSON.stringify({
            type: jobCreatedMessage.type,
            data: {
              ...jobCreatedMessage.data,
              timestamp:
                jobCreatedMessage.timestamp || new Date().toISOString(),
            },
          }),
        );
        return;
      }

      // Default case: publish the message as-is
      await this.redis.publish(channel, JSON.stringify(messageWithTimestamp));
    } catch (error) {
      console.error(`Error publishing message to channel ${channel}:`, error);
      throw error;
    }
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
      console.error(`Error publishing to channel ${channel}:`, error);
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
      await this.redis.subscribe(channel);
      this.redis.on("message", (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      console.error(`Error subscribing to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Set a key-value pair in Redis
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
        await this.redis.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) return null;

      // Try to parse as JSON first, fall back to string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete keys by pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`Error deleting pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Set a hash field
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
      console.error(`Error setting hash field ${key}.${field}:`, error);
      throw error;
    }
  }

  /**
   * Get a hash field
   */
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (value === null) return null;

      // Try to parse as JSON first, fall back to string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Error getting hash field ${key}.${field}:`, error);
      return null;
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
      console.error(`Error getting hash ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a hash field
   */
  async hdel(key: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(key, field);
    } catch (error) {
      console.error(`Error deleting hash field ${key}.${field}:`, error);
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
      console.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
    } catch (error) {
      console.error(`Error setting expiration for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get the underlying Redis client
   */
  getClient(): Redis {
    return this.redis;
  }
}

/**
 * Factory function to create a RedisService instance
 */
export function createRedisService(redis: Redis): RedisService {
  return new RedisServiceImpl(redis);
}
