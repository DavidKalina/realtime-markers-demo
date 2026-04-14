// types.ts - Core app types
import type { UserProfile } from "@realtime-markers/shared";

// Coordinates type for location data
export type Coordinates = [number, number]; // [longitude, latitude]

// Marker data stored on each map marker
export interface MarkerData {
  title?: string;
  emoji?: string;
  emojiDescription?: string;
  categories?: string[];
  color?: string;
  isPrivate?: boolean;
  description?: string;
  location?: string;
  distance?: string;
  time?: string;
  eventDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  locationNotes?: string;
  entityType?: string;
  [key: string]: unknown;
}

// Marker type for map display
export interface Marker {
  id: string;
  coordinates: Coordinates;
  data: MarkerData;
}

// Viewport bounds for map
export interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

// User type that extends the database UserProfile
export interface UserType extends UserProfile {
  // Add any mobile-specific user properties here
}

// Re-export for convenience
export { MapboxViewport as Viewport };
