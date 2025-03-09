// src/services/SubscriptionManager.ts
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { EventFilter } from "./filterTypes";

export interface Subscription {
  id: string;
  clientId: string;
  name?: string;
  filter: EventFilter;
  createdAt: string;
  updatedAt: string;
}

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>();
  private clientSubscriptions = new Map<string, Set<string>>();
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.loadSubscriptionsFromRedis();
  }

  /**
   * Load all subscriptions from Redis on startup
   */
  private async loadSubscriptionsFromRedis(): Promise<void> {
    try {
      // Get all subscription keys
      const subscriptionKeys = await this.redis.keys("subscription:*");

      // Load each subscription
      for (const key of subscriptionKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const subscription: Subscription = JSON.parse(data);
          this.subscriptions.set(subscription.id, subscription);

          // Track by client
          if (!this.clientSubscriptions.has(subscription.clientId)) {
            this.clientSubscriptions.set(subscription.clientId, new Set());
          }
          this.clientSubscriptions.get(subscription.clientId)!.add(subscription.id);
        }
      }

      console.log(`Loaded ${this.subscriptions.size} subscriptions from Redis`);
    } catch (error) {
      console.error("Failed to load subscriptions from Redis:", error);
    }
  }

  /**
   * Create a new subscription for a client
   */
  async createSubscription(clientId: string, filter: EventFilter, name?: string): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const subscription: Subscription = {
      id,
      clientId,
      name,
      filter,
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory
    this.subscriptions.set(id, subscription);

    // Track by client
    if (!this.clientSubscriptions.has(clientId)) {
      this.clientSubscriptions.set(clientId, new Set());
    }
    this.clientSubscriptions.get(clientId)!.add(id);

    // Backup to Redis for persistence
    await this.redis.set(`subscription:${id}`, JSON.stringify(subscription));
    await this.redis.sadd(`client:${clientId}:subscriptions`, id);

    return id;
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    filter: EventFilter,
    name?: string
  ): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Update subscription
    subscription.filter = filter;
    if (name !== undefined) {
      subscription.name = name;
    }
    subscription.updatedAt = new Date().toISOString();

    // Update in-memory storage
    this.subscriptions.set(subscriptionId, subscription);

    // Update Redis
    await this.redis.set(`subscription:${subscriptionId}`, JSON.stringify(subscription));

    return true;
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from client tracking
    const clientId = subscription.clientId;
    const clientSubs = this.clientSubscriptions.get(clientId);
    if (clientSubs) {
      clientSubs.delete(subscriptionId);
      if (clientSubs.size === 0) {
        this.clientSubscriptions.delete(clientId);
      }
    }

    // Remove from in-memory storage
    this.subscriptions.delete(subscriptionId);

    // Remove from Redis
    await this.redis.del(`subscription:${subscriptionId}`);
    await this.redis.srem(`client:${clientId}:subscriptions`, subscriptionId);

    return true;
  }

  /**
   * List subscriptions for a client
   */
  getClientSubscriptions(clientId: string): Subscription[] {
    const subscriptionIds = this.clientSubscriptions.get(clientId) || new Set();
    return Array.from(subscriptionIds)
      .map((id) => this.subscriptions.get(id))
      .filter(Boolean) as Subscription[];
  }

  /**
   * Get a specific subscription
   */
  getSubscription(subscriptionId: string): Subscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all client IDs with subscriptions
   */
  getAllClientIds(): string[] {
    return Array.from(this.clientSubscriptions.keys());
  }

  /**
   * Clean up subscriptions for a client that has disconnected
   */
  handleClientDisconnect(clientId: string): void {
    const subscriptionIds = this.clientSubscriptions.get(clientId);
    if (!subscriptionIds) {
      return;
    }

    // Store IDs to delete in an array to avoid modifying the set during iteration
    const idsToDelete = Array.from(subscriptionIds);

    // Delete each subscription
    for (const id of idsToDelete) {
      this.deleteSubscription(id);
    }

    // Remove client tracking
    this.clientSubscriptions.delete(clientId);
  }
}
