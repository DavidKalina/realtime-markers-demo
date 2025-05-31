import Redis from "ioredis";
import { EventEmitter } from "events";
import {
  REDIS_CONFIG,
  REDIS_CHANNELS,
  SERVER_CONFIG,
} from "../config/constants";
import type { ViewportData } from "../types/websocket";

export class RedisService extends EventEmitter {
  private static instance: RedisService;
  private pubClient: Redis;
  private subClient: Redis;
  private userSubscribers: Map<string, Redis>;

  private constructor() {
    super();
    this.pubClient = new Redis(REDIS_CONFIG);
    this.subClient = new Redis(REDIS_CONFIG);
    this.userSubscribers = new Map();

    this.setupErrorHandling();
    this.setupSubscriptions();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupErrorHandling(): void {
    this.pubClient.on("error", (error) => {
      console.error("Redis publisher error:", error);
    });

    this.subClient.on("error", (error) => {
      console.error("Redis subscriber error:", error);
    });

    this.pubClient.on("connect", () => {
      console.log("Redis publisher connected successfully");
    });

    this.subClient.on("connect", () => {
      console.log("Redis subscriber connected successfully");
    });
  }

  private setupSubscriptions(): void {
    // Subscribe to global channels
    Object.values(REDIS_CHANNELS).forEach((channel) => {
      this.subClient.subscribe(channel, (err, count) => {
        if (err) {
          console.error(`Error subscribing to ${channel}:`, err);
        } else {
          console.log(
            `Subscribed to ${channel}, total subscriptions: ${count}`,
          );
        }
      });
    });
  }

  public async publish(channel: string, message: string): Promise<void> {
    await this.pubClient.publish(channel, message);
  }

  public async set(key: string, value: string, expiry?: number): Promise<void> {
    if (expiry) {
      await this.pubClient.set(key, value, "EX", expiry);
    } else {
      await this.pubClient.set(key, value);
    }
  }

  public async get(key: string): Promise<string | null> {
    return await this.pubClient.get(key);
  }

  public async del(key: string): Promise<void> {
    await this.pubClient.del(key);
  }

  public getSubscriberForUser(userId: string): Redis {
    if (!this.userSubscribers.has(userId)) {
      const subscriber = new Redis(REDIS_CONFIG);
      this.userSubscribers.set(userId, subscriber);

      subscriber.subscribe(`user:${userId}:filtered-events`);
      subscriber.on("message", (channel, message) => {
        if (channel === `user:${userId}:filtered-events`) {
          // This will be handled by the message handler
          this.emit("userMessage", { userId, message });
        }
      });
    }
    return this.userSubscribers.get(userId)!;
  }

  public releaseSubscriber(userId: string): void {
    const subscriber = this.userSubscribers.get(userId);
    if (subscriber) {
      subscriber.unsubscribe();
      subscriber.quit();
      this.userSubscribers.delete(userId);
    }
  }

  public async updateViewport(
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
  }

  public async checkConnection(): Promise<boolean> {
    try {
      const pong = await this.pubClient.ping();
      return pong === "PONG";
    } catch (error) {
      console.error("Redis connection check failed:", error);
      return false;
    }
  }

  public onMessage(callback: (channel: string, message: string) => void): void {
    this.subClient.on("message", callback);
  }

  public getPubClient(): Redis {
    return this.pubClient;
  }

  public getSubClient(): Redis {
    return this.subClient;
  }
}
