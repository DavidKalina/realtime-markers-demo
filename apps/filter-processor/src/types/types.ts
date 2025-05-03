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
  // Private event fields
  privateStatus?: "DRAFT" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  isProcessedByAI?: boolean;
  imageUrl?: string;
  imageDescription?: string;
  isImageProcessed?: boolean;
  invitedUsers?: User[];
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
  semanticQuery?: string;
  embedding?: string;
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
}

/**
 * User entity (simplified from your User.ts)
 */
export interface User {
  id: string;
  email: string;
  displayName?: string;
}
