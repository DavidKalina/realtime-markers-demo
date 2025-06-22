// types.ts - Updated to align with Marker interface

// Coordinates type for location data
export type Coordinates = [number, number]; // [longitude, latitude]

// Base event interface with all common properties
export interface UserType {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
  // Add other user properties you need
}

export interface EventType {
  id: string;
  title: string;
  description: string;
  eventDate: Date | string; // Allow both Date and string for flexibility
  endDate?: string;
  time: string;
  coordinates: [number, number];
  location: string;
  locationNotes?: string; // Additional location context like building, room, etc.
  distance: string;
  emoji: string;
  emojiDescription?: string;
  categories: { id: string; name: string }[];
  creator?: UserType;
  creatorId?: string;
  scanCount: number;
  saveCount: number;
  timezone: string;
  qrUrl?: string | null;
  qrCodeData?: string;
  qrImagePath?: string | null;
  hasQrCode?: boolean;
  qrGeneratedAt?: string | null;
  qrDetectedInImage?: boolean;
  detectedQrData?: string | null;
  imageUrl?: string;
  category?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  discoveryCount?: number;
  savedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  isPrivate?: boolean;
  isOfficial?: boolean;
  sharedWithIds?: string[]; // Add shared user IDs
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceDays?: (
    | "SUNDAY"
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
  )[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: string[];
}

// Mapbox viewport format for map integration
export interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Marker type that extends EventType for map usage
export interface Marker {
  id: string;
  coordinates: Coordinates;
  data: EventType;
}
