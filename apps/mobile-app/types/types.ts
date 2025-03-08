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
  id?: string;
  emoji: string;
  title: string;
  description: string;
  location: string;
  time: string;
  coordinates?: Coordinates;
  isVerified?: boolean;
  color?: string;
  created_at?: string;
  updated_at?: string;
  creator?: UserType; // Add this field to store the creator information
  creatorId?: string; // Add this if you need just the ID reference
  scanCount?: number;
  saveCount?: number; // Add count of saves
  isSaved?: boolean; // Add whether current user has saved this event
  timezone?: string;
  [key: string]: any; // Allow additional properties for flexibility
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
