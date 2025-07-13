// Base API types - using shared types package
import {
  // Core entity types
  Event,
  User,
  Category,
  Filter,
  UserEventRsvp,

  // Response types (API-safe)
  EventResponse,
  UserResponse,
  CategoryResponse,
  FilterResponse,
  UserEventRsvpResponse,

  // Request types
  CreateEventRequest,
  UpdateEventRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateFilterRequest,
  UpdateFilterRequest,
  CreateUserEventRsvpRequest,
  UpdateUserEventRsvpRequest,
} from "@realtime-markers/types";

// Re-export shared types for convenience
export {
  Event,
  User,
  Category,
  Filter,
  UserEventRsvp,
  EventResponse,
  UserResponse,
  CategoryResponse,
  FilterResponse,
  UserEventRsvpResponse,
  CreateEventRequest,
  UpdateEventRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateFilterRequest,
  UpdateFilterRequest,
  CreateUserEventRsvpRequest,
  UpdateUserEventRsvpRequest,
};

// Mobile-specific types that aren't in the shared package

export interface Location {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken?: string;
}

// Pagination types
export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// Alias for EventResponse to maintain compatibility
export type ApiEvent = EventResponse;

export interface GetEventsParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
  query?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  _t?: number; // Cache-busting timestamp
}

// Alias for CreateEventRequest to maintain compatibility
export type CreateEventPayload = CreateEventRequest;

// Alias for UpdateEventRequest to maintain compatibility
export type UpdateEventPayload = UpdateEventRequest;

export interface JobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  result?: {
    message?: string;
    confidence?: number;
    threshold?: number;
    daysFromNow?: number;
    date?: string;
    deletedCount?: number;
    hasMore?: boolean;
    eventId?: string;
    title?: string;
    emoji?: string;
    coordinates?: [number, number];
    [key: string]: unknown;
  };
  error?: string;
}

export interface JobStreamMessage extends JobStatus {
  progressStep?: string;
  progressDetails?: {
    currentStep: string;
    totalSteps: number;
    stepProgress: number;
    stepDescription: string;
    estimatedTimeRemaining?: number;
  };
}

export interface ProcessEventImagePayload {
  imageFile: File;
  userLat: number;
  userLng: number;
  source: string;
}

// Legacy place types
export interface Place {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface PlaceCreateInput {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface PlaceUpdateInput {
  name?: string;
  description?: string;
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

// Legacy RSVP types
export interface RSVP {
  id: string;
  eventId: string;
  userId: string;
  status: "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";
  createdAt: string;
  updatedAt: string;
}

export interface RSVPCreateInput {
  status: "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";
}

export interface RSVPUpdateInput {
  status?: "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";
}

export type RsvpStatus = "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";

export interface EventEngagementMetrics {
  eventId: string;
  saveCount: number;
  scanCount: number;
  rsvpCount: number;
  goingCount: number;
  notGoingCount: number;
  totalEngagement: number;
  lastUpdated: string;
}
