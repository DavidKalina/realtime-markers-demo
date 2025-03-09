// src/types/filters.ts
export enum EventStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

/**
 * Minimal Event type needed for filtering
 * This should match the structure of the events coming from Redis
 */
export interface Event {
  id: string;
  title: string;
  description?: string;
  eventDate: string; // ISO timestamp
  location: {
    coordinates: [number, number]; // [lng, lat]
  };
  categories?: { id: string; name: string }[];
  status: EventStatus;
  creatorId?: string;
  timezone?: string;
  // Add any other fields needed for filtering
}

/**
 * Redis message format for event changes
 */
export interface EventChangeMessage {
  operation: "CREATE" | "UPDATE" | "DELETE" | "INSERT";
  record: Event;
}
/**
 * Defines filter criteria for event subscriptions
 */
export interface EventFilter {
  // Category filtering
  categories?: string[]; // Category IDs to include

  // Time filtering
  dateRange?: {
    start?: string; // ISO timestamp
    end?: string; // ISO timestamp
  };

  // Status filtering
  status?: EventStatus[]; // Event statuses to include

  // Text filtering
  keywords?: string[]; // Words/phrases to match in title/description

  // Location filtering
  location?: {
    radius?: number; // Distance in meters
    center?: [number, number]; // [lng, lat]
    boundingBox?: {
      minX: number; // West longitude
      minY: number; // South latitude
      maxX: number; // East longitude
      maxY: number; // North latitude
    };
  };

  // Creator filtering
  creatorId?: string; // Filter by event creator
}

/**
 * Subscription model for the event stream
 */
export interface Subscription {
  id: string; // Unique subscription ID
  clientId: string; // ID of the subscribing client
  name?: string; // Optional friendly name
  filter: EventFilter; // Filter criteria
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Message types for subscription-related WebSocket communication
 */
export const SubscriptionMessageTypes = {
  // Client -> Server
  CREATE_SUBSCRIPTION: "create_subscription",
  UPDATE_SUBSCRIPTION: "update_subscription",
  DELETE_SUBSCRIPTION: "delete_subscription",
  LIST_SUBSCRIPTIONS: "list_subscriptions",

  // Server -> Client
  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_UPDATED: "subscription_updated",
  SUBSCRIPTION_DELETED: "subscription_deleted",
  SUBSCRIPTIONS_LIST: "subscriptions_list",

  // Event delivery
  SUBSCRIPTION_EVENT: "subscription_event",
};
