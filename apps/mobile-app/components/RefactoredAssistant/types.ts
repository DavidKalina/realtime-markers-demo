// types.ts - Updated to align with Marker interface

// Coordinates type for location data
export type Coordinates = [number, number]; // [longitude, latitude]

// Base event interface with all common properties
export interface EventType {
  id?: string;
  emoji: string;
  title: string;
  description: string;
  location: string;
  time: string;
  distance: string;
  categories: string[];
  coordinates?: Coordinates;
  isVerified?: boolean;
  color?: string;
  created_at?: string;
  updated_at?: string;
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
