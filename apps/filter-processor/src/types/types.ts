// apps/filter-processor/src/types/types.ts

/**
 * Bounding box for spatial queries
 */
export interface BoundingBox {
  minX: number; // west longitude
  minY: number; // south latitude
  maxX: number; // east longitude
  maxY: number; // north latitude
}

/**
 * Category entity based on your Category.ts
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

/**
 * Event status enum based on your Event.ts
 */
export enum EventStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

/**
 * Recurrence frequency enum based on your Event.ts
 */
export enum RecurrenceFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  BIWEEKLY = "BIWEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

/**
 * Day of week enum based on your Event.ts
 */
export enum DayOfWeek {
  SUNDAY = "SUNDAY",
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
}

/**
 * GeoJSON Point type
 */
export interface Point {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * Event entity based on your Event.ts
 */
export interface Event {
  id: string;
  emoji?: string;
  emojiDescription?: string;
  title: string;
  description?: string;
  eventDate: Date | string;
  endDate?: Date | string;
  timezone?: string;
  address?: string;
  location: Point;
  scanCount: number;
  saveCount: number;
  confidenceScore?: number;
  embedding?: string;
  status: EventStatus;
  creatorId?: string;
  categories?: Category[];
  createdAt: Date | string;
  updatedAt: Date | string;
  tags?: string[]; // Added for tag filtering support
  locationNotes?: string;
  isPrivate: boolean;
  sharedWith?: Array<{
    sharedWithId: string;
    sharedById: string;
  }>;
  // Recurring event fields
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: Date | string;
  recurrenceEndDate?: Date | string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: Date[] | string[];
  // RSVP relationship for popularity scoring
  rsvps?: Array<{
    id: string;
    userId: string;
    eventId: string;
    status: "GOING" | "NOT_GOING";
    createdAt: Date | string;
    updatedAt: Date | string;
  }>;
  // Relevance score from MapMoji algorithm
  relevanceScore?: number;
}

// Update the FilterCriteria interface
export interface FilterCriteria {
  // Remove categories, tags, keywords
  dateRange?: {
    start?: string;
    end?: string;
  };
  status?: string[];
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
}

// Update the Filter interface
export interface Filter {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  semanticQuery?: string; // Add this
  embedding?: string; // Add this
  criteria: FilterCriteria;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Item stored in the RBush spatial index
 */
export interface SpatialItem {
  minX: number; // longitude
  minY: number; // latitude
  maxX: number; // longitude
  maxY: number; // latitude
  id: string;
  event?: Event;
  civicEngagement?: CivicEngagement;
  type: "event" | "civic_engagement";
}

/**
 * User entity (simplified from your User.ts)
 */
export interface User {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * Civic Engagement Type enum based on your CivicEngagement.ts
 */
export enum CivicEngagementType {
  POSITIVE_FEEDBACK = "POSITIVE_FEEDBACK",
  NEGATIVE_FEEDBACK = "NEGATIVE_FEEDBACK",
  IDEA = "IDEA",
}

/**
 * Civic Engagement Status enum based on your CivicEngagement.ts
 */
export enum CivicEngagementStatus {
  PENDING = "PENDING",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  IMPLEMENTED = "IMPLEMENTED",
}

/**
 * Civic Engagement entity based on your CivicEngagement.ts
 */
export interface CivicEngagement {
  id: string;
  title: string;
  description?: string;
  type: CivicEngagementType;
  status: CivicEngagementStatus;
  location?: Point;
  address?: string;
  locationNotes?: string;
  imageUrls?: string[];
  creatorId: string;
  creator?: User;
  adminNotes?: string;
  implementedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
