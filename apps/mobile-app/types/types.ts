// types.ts - Updated to align with Marker interface

// Coordinates type for location data
export type Coordinates = [number, number]; // [longitude, latitude]

// Base event interface with all common properties
export interface UserType {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  // Add other user properties you need
}

export interface EventType {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  endDate?: string;
  time: string;
  coordinates: [number, number];
  location: string;
  locationNotes?: string; // Additional location context like building, room, etc.
  distance: string;
  emoji: string;
  emojiDescription?: string;
  categories: string[];
  creator?: UserType;
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
