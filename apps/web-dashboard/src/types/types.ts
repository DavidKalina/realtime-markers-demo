// types.ts - Updated to use derived types from database package
import type {
  UserProfile as UserType,
  EventSummary as EventType,
  MapboxViewport,
  Marker as MapMarker,
} from "@realtime-markers/database";

// Define Coordinates type locally since it's not exported from database package
export type Coordinates = [number, number]; // [longitude, latitude]

// Re-export the types for backward compatibility
export type { UserType, EventType, MapboxViewport, MapMarker };

// Legacy type aliases for backward compatibility
export type Marker = MapMarker;
