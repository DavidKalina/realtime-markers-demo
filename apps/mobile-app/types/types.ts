// types.ts - Core app types
import { UserProfile } from "@realtime-markers/database";

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
  isVerified?: boolean;
  description?: string;
  location?: string;
  distance?: string;
  time?: string;
  eventDate?: string;
  endDate?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  locationNotes?: string;
  entityType?: string;
  isRecurring?: boolean;
  goingCount?: number;
  isTrending?: boolean;
  isOfficial?: boolean;
  scanCount?: number;
  saveCount?: number;
  viewCount?: number;
  creator?: unknown;
  creatorId?: string;
  qrUrl?: string | null;
  qrCodeData?: string;
  qrImagePath?: string | null;
  hasQrCode?: boolean;
  qrGeneratedAt?: string | null;
  qrDetectedInImage?: boolean;
  detectedQrData?: string | null;
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
