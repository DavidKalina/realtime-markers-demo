// Derived types from database entities
import type { Point } from "geojson";
import {
  User,
  UserRole,
  Event,
  EventStatus,
  RecurrenceFrequency,
  DayOfWeek,
  Category,
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
  UserEventDiscovery,
  UserEventSave,
  UserEventView,
  UserEventRsvp,
  Filter,
  QueryAnalytics,
  UserPushToken,
} from "../entities";

// ============================================================================
// MAP MARKER TYPES
// ============================================================================

// Mapbox viewport format for map interactions
export interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Base marker data structure for map display
export interface MarkerData {
  title: string;
  emoji: string;
  color: string;
  location?: string;
  distance?: string;
  time?: string;
  eventDate?: string;
  endDate?: string;
  description?: string;
  categories?: string[];
  isVerified?: boolean;
  created_at?: string;
  updated_at?: string;
  isPrivate?: boolean;
  status?: string;
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: string[];
  // Civic engagement specific fields
  type?: CivicEngagementType;
  address?: string;
  locationNotes?: string;
  creatorId?: string;
  adminNotes?: string;
  implementedAt?: string;
  imageUrls?: string[];
  entityType?: "event" | "civic_engagement";
  // Metadata and additional fields
  [key: string]: unknown;
}

// Main marker interface for map display
export interface Marker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: MarkerData;
}

// Event-specific marker data
export interface EventMarkerData extends MarkerData {
  entityType: "event";
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: string[];
}

// Civic engagement-specific marker data
export interface CivicEngagementMarkerData extends MarkerData {
  entityType: "civic_engagement";
  type: CivicEngagementType;
  address?: string;
  locationNotes?: string;
  creatorId?: string;
  adminNotes?: string;
  implementedAt?: string;
  imageUrls?: string[];
}

// Typed marker variants
export interface EventMarker extends Omit<Marker, 'data'> {
  data: EventMarkerData;
}

export interface CivicEngagementMarker extends Omit<Marker, 'data'> {
  data: CivicEngagementMarkerData;
}

// Union type for all marker types
export type MapMarker = EventMarker | CivicEngagementMarker;

// ============================================================================
// USER TYPES
// ============================================================================

export type UserInput = Omit<
  User,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "discoveries"
  | "createdEvents"
  | "savedEvents"
  | "viewedEvents"
  | "rsvps"
  | "pushTokens"
>;

export type UserUpdate = Partial<
  Omit<
    User,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "discoveries"
    | "createdEvents"
    | "savedEvents"
    | "viewedEvents"
    | "rsvps"
    | "pushTokens"
  >
>;

export type UserProfile = Pick<
  User,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "avatarUrl"
  | "bio"
  | "role"
  | "isVerified"
  | "discoveryCount"
  | "scanCount"
  | "saveCount"
  | "viewCount"
>;

export type UserStats = Pick<
  User,
  "discoveryCount" | "scanCount" | "saveCount" | "viewCount" | "weeklyScanCount"
>;

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventInput = Omit<
  Event,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "scanCount"
  | "saveCount"
  | "viewCount"
  | "discoveries"
  | "saves"
  | "views"
  | "rsvps"
  | "categories"
  | "creator"
> & {
  creatorId?: string;
  categoryIds?: string[];
};

export type EventUpdate = Partial<
  Omit<
    Event,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "discoveries"
    | "saves"
    | "views"
    | "rsvps"
    | "categories"
    | "creator"
  >
> & {
  categoryIds?: string[];
};

export type EventSummary = Pick<
  Event,
  | "id"
  | "title"
  | "description"
  | "emoji"
  | "emojiDescription"
  | "eventDate"
  | "endDate"
  | "address"
  | "location"
  | "scanCount"
  | "saveCount"
  | "viewCount"
  | "status"
  | "isOfficial"
  | "hasQrCode"
> & {
  creator?: UserProfile;
  categories?: CategorySummary[];
};

export type EventDetails = EventSummary & {
  locationNotes?: string;
  timezone?: string;
  confidenceScore?: number;
  qrUrl?: string;
  qrCodeData?: string;
  qrImagePath?: string;
  qrGeneratedAt?: Date;
  qrDetectedInImage?: boolean;
  detectedQrData?: string;
  originalImageUrl?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: Date;
  recurrenceEndDate?: Date;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: Date[];
  createdAt: Date;
  updatedAt: Date;
};

export type EventLocation = {
  location: Point;
  address?: string;
  locationNotes?: string;
};

export type EventRecurrence = {
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: Date;
  recurrenceEndDate?: Date;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: Date[];
};

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export type CategoryInput = Omit<
  Category,
  "id" | "createdAt" | "updatedAt" | "events"
>;

export type CategoryUpdate = Partial<
  Omit<Category, "id" | "createdAt" | "updatedAt" | "events">
>;

export type CategorySummary = Pick<
  Category,
  "id" | "name" | "description" | "icon"
>;

// ============================================================================
// CIVIC ENGAGEMENT TYPES
// ============================================================================

export type CivicEngagementInput = Omit<
  CivicEngagement,
  "id" | "createdAt" | "updatedAt" | "creator"
> & {
  creatorId: string;
};

export type CivicEngagementUpdate = Partial<
  Omit<CivicEngagement, "id" | "createdAt" | "updatedAt" | "creator">
>;

export type CivicEngagementSummary = Pick<
  CivicEngagement,
  | "id"
  | "title"
  | "description"
  | "type"
  | "status"
  | "address"
  | "location"
  | "imageUrls"
> & {
  creator?: UserProfile;
};

export type CivicEngagementDetails = CivicEngagementSummary & {
  locationNotes?: string;
  embedding?: string;
  adminNotes?: string;
  implementedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// USER EVENT RELATIONSHIP TYPES
// ============================================================================

export type UserEventDiscoveryInput = Omit<
  UserEventDiscovery,
  "id" | "createdAt" | "user" | "event"
> & {
  userId: string;
  eventId: string;
};

export type UserEventSaveInput = Omit<
  UserEventSave,
  "id" | "createdAt" | "user" | "event"
> & {
  userId: string;
  eventId: string;
};

export type UserEventViewInput = Omit<
  UserEventView,
  "id" | "createdAt" | "user" | "event"
> & {
  userId: string;
  eventId: string;
};

export type UserEventRsvpInput = Omit<
  UserEventRsvp,
  "id" | "createdAt" | "user" | "event"
> & {
  userId: string;
  eventId: string;
};

// ============================================================================
// FILTER TYPES
// ============================================================================

export type FilterInput = Omit<
  Filter,
  "id" | "createdAt" | "updatedAt" | "user"
> & {
  userId: string;
};

export type FilterUpdate = Partial<
  Omit<Filter, "id" | "createdAt" | "updatedAt" | "user">
>;

// ============================================================================
// QUERY ANALYTICS TYPES
// ============================================================================

export type QueryAnalyticsInput = Omit<
  QueryAnalytics,
  "id" | "createdAt" | "user"
> & {
  userId: string;
};

// ============================================================================
// PUSH TOKEN TYPES
// ============================================================================

export type UserPushTokenInput = Omit<
  UserPushToken,
  "id" | "createdAt" | "user"
> & {
  userId: string;
};

// ============================================================================
// EVENT SHARE TYPES
// ============================================================================

// Removed EventShare types since event sharing has been removed

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

export type EventSearchFilters = {
  categories?: string[];
  status?: EventStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  location?: {
    center: Point;
    radius: number; // in meters
  };
  isOfficial?: boolean;
  hasQrCode?: boolean;
  creatorId?: string;
};

export type CivicEngagementSearchFilters = {
  types?: CivicEngagementType[];
  status?: CivicEngagementStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  location?: {
    center: Point;
    radius: number; // in meters
  };
  creatorId?: string;
};

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export type PaginationParams = {
  page?: number;
  limit?: number;
  offset?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type ApiError = {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type WithTimestamps = {
  createdAt: Date;
  updatedAt: Date;
};

export type WithId = {
  id: string;
};

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type EntityRelations<T> = {
  [K in keyof T]: T[K] extends Array<infer U> ? U : T[K];
};

// ============================================================================
// ENUM EXPORTS
// ============================================================================

export {
  UserRole,
  EventStatus,
  RecurrenceFrequency,
  DayOfWeek,
  CivicEngagementType,
  CivicEngagementStatus,
};
