// types.ts - Updated to use derived types from database package
import {
  Marker,
  MapboxViewport,
  EventSummary,
  UserProfile,
  EventStatus,
  RecurrenceFrequency,
  DayOfWeek,
} from "@realtime-markers/database";

// Re-export the main types for convenience
export { Marker, MapboxViewport };

// Coordinates type for location data
export type Coordinates = [number, number]; // [longitude, latitude]

// User type that extends the database UserProfile
export interface UserType extends UserProfile {
  // Add any mobile-specific user properties here
}

// Event type that extends the database EventSummary with mobile-specific additions
export interface EventType extends Omit<EventSummary, "hasQrCode"> {
  // Add mobile-specific event properties
  coordinates: Coordinates; // Required for map display
  time: string;
  distance: string;
  timezone: string;
  qrUrl?: string | null;
  qrCodeData?: string;
  qrImagePath?: string | null;
  hasQrCode?: boolean; // Make optional to match mobile usage
  qrGeneratedAt?: string | null;
  qrDetectedInImage?: boolean;
  detectedQrData?: string | null;
  imageUrl?: string;
  discoveryCount?: number;
  savedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  // Recurring event fields with proper types
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: string[];
  // Social proof
  goingCount?: number;
  // Ensure required properties from EventSummary are included
  viewCount: number;
  status: EventStatus;
  // Additional mobile-specific properties
  createdAt?: string;
  updatedAt?: string;
  isPrivate?: boolean;
  locationNotes?: string;
  creator?: UserProfile;
  creatorId?: string;
  color?: string;
  isVerified?: boolean;
  source?: string;
  externalUrl?: string;
}

// Trending event type for the "Trending Now" section
export interface TrendingEventType extends EventType {
  isTrending: boolean;
  trendingScore?: number;
}

// Discovered event type for the "Just Discovered" feed
export interface DiscoveredEventType extends EventType {
  discoveredAt: string;
  discoverer?: {
    id: string;
    firstName?: string;
    avatarUrl?: string;
    currentTier?: string;
  };
}

// Re-export database enums for convenience
export { EventStatus, RecurrenceFrequency, DayOfWeek };
