// src/services/SubscriptionManager.ts
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";
import type { ServerWebSocket } from "bun";
import { SubscriptionMessageTypes, type EventFilter, type Subscription } from "./types/filters";

/**
 * Handles creation, retrieval, and deletion of event subscriptions
 */
export class SubscriptionManager {
  private redis: Redis;
  private subscriptions = new Map<string, Subscription>();
  private clientSubscriptions = new Map<string, Set<string>>();
  private clients = new Map<string, ServerWebSocket<any>>();

  constructor(redis: Redis) {
    this.redis = redis;

    // Automatically load subscriptions from Redis
    this.loadSubscriptionsFromRedis().catch((err) => {
      console.error("Failed to load subscriptions from Redis:", err);
    });
  }

  /**
   * Register a WebSocket client
   */
  registerClient(ws: ServerWebSocket<any>): void {
    this.clients.set(ws.data.clientId, ws);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    clientId: string,
    filter: EventFilter,
    name?: string
  ): Promise<Subscription> {
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

    console.log(`Created subscription ${id} for client ${clientId}`);
    return subscription;
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    filter: EventFilter,
    name?: string
  ): Promise<Subscription | null> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return null;
    }

    const now = new Date().toISOString();

    const updatedSubscription: Subscription = {
      ...subscription,
      filter,
      name: name !== undefined ? name : subscription.name,
      updatedAt: now,
    };

    // Update in memory
    this.subscriptions.set(subscriptionId, updatedSubscription);

    // Update in Redis
    await this.redis.set(`subscription:${subscriptionId}`, JSON.stringify(updatedSubscription));

    console.log(`Updated subscription ${subscriptionId}`);
    return updatedSubscription;
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from memory
    this.subscriptions.delete(subscriptionId);

    // Remove from client subscriptions
    const clientSubscriptions = this.clientSubscriptions.get(subscription.clientId);
    if (clientSubscriptions) {
      clientSubscriptions.delete(subscriptionId);
    }

    // Remove from Redis
    await this.redis.del(`subscription:${subscriptionId}`);
    await this.redis.srem(`client:${subscription.clientId}:subscriptions`, subscriptionId);

    console.log(`Deleted subscription ${subscriptionId}`);
    return true;
  }

  /**
   * Get all subscriptions for a client
   */
  async getClientSubscriptions(clientId: string): Promise<Subscription[]> {
    const subscriptionIds = await this.redis.smembers(`client:${clientId}:subscriptions`);
    const subscriptions: Subscription[] = [];

    for (const id of subscriptionIds) {
      const data = await this.redis.get(`subscription:${id}`);
      if (data) {
        try {
          subscriptions.push(JSON.parse(data));
        } catch (error) {
          console.error(`Failed to parse subscription data for ${id}:`, error);
        }
      }
    }

    return subscriptions;
  }

  /**
   * Get a specific subscription
   */
  getSubscription(subscriptionId: string): Subscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all subscriptions for filter evaluation
   */
  getAllSubscriptions(): Map<string, Subscription> {
    return this.subscriptions;
  }

  /**
   * Send an event to a client based on subscription
   */
  sendEventToClient(clientId: string, subscriptionId: string, event: any): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      client.send(
        JSON.stringify({
          type: SubscriptionMessageTypes.SUBSCRIPTION_EVENT,
          subscriptionId,
          event,
          timestamp: new Date().toISOString(),
        })
      );
      console.log(`Sent event to client ${clientId} for subscription ${subscriptionId}`);
    } catch (error) {
      console.error(`Failed to send event to client ${clientId}:`, error);
    }
  }

  /**
   * Handle WebSocket messages related to subscriptions
   */
  async handleMessage(ws: ServerWebSocket<any>, message: string): Promise<boolean> {
    try {
      const data = JSON.parse(message);

      // Check if it's a subscription-related message
      if (!Object.values(SubscriptionMessageTypes).includes(data.type)) {
        return false; // Not a subscription message
      }

      switch (data.type) {
        case SubscriptionMessageTypes.CREATE_SUBSCRIPTION:
          const subscription = await this.createSubscription(
            ws.data.clientId,
            data.filter,
            data.name
          );

          ws.send(
            JSON.stringify({
              type: SubscriptionMessageTypes.SUBSCRIPTION_CREATED,
              subscription,
            })
          );
          break;

        case SubscriptionMessageTypes.UPDATE_SUBSCRIPTION:
          const updatedSubscription = await this.updateSubscription(
            data.subscriptionId,
            data.filter,
            data.name
          );

          if (updatedSubscription) {
            ws.send(
              JSON.stringify({
                type: SubscriptionMessageTypes.SUBSCRIPTION_UPDATED,
                subscription: updatedSubscription,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Subscription not found",
              })
            );
          }
          break;

        case SubscriptionMessageTypes.DELETE_SUBSCRIPTION:
          const deleted = await this.deleteSubscription(data.subscriptionId);

          ws.send(
            JSON.stringify({
              type: SubscriptionMessageTypes.SUBSCRIPTION_DELETED,
              success: deleted,
              subscriptionId: data.subscriptionId,
            })
          );
          break;

        case SubscriptionMessageTypes.LIST_SUBSCRIPTIONS:
          const subscriptions = await this.getClientSubscriptions(ws.data.clientId);

          ws.send(
            JSON.stringify({
              type: SubscriptionMessageTypes.SUBSCRIPTIONS_LIST,
              subscriptions,
            })
          );
          break;
      }

      return true; // Successfully handled subscription message
    } catch (error) {
      console.error("Error handling subscription message:", error);

      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid subscription message format",
        })
      );

      return false;
    }
  }

  /**
   * Load subscriptions from Redis on startup
   */
  async loadSubscriptionsFromRedis(): Promise<void> {
    // Get all subscription keys
    const subscriptionKeys = await this.redis.keys("subscription:*");

    for (const key of subscriptionKeys) {
      const subscriptionData = await this.redis.get(key);
      if (subscriptionData) {
        try {
          const subscription: Subscription = JSON.parse(subscriptionData);

          // Add to memory maps
          this.subscriptions.set(subscription.id, subscription);

          if (!this.clientSubscriptions.has(subscription.clientId)) {
            this.clientSubscriptions.set(subscription.clientId, new Set());
          }
          this.clientSubscriptions.get(subscription.clientId)!.add(subscription.id);
        } catch (error) {
          console.error(`Failed to parse subscription data for key ${key}:`, error);
        }
      }
    }

    console.log(`Loaded ${this.subscriptions.size} subscriptions from Redis`);
  }
}
