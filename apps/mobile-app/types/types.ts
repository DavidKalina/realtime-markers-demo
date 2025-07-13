// Re-export shared types from the @realtime-markers/types package
export * from "@realtime-markers/types";

// Additional mobile app specific types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapboxViewport {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

// Re-export EventType from the shared types for backward compatibility
export type { EventResponse as EventType } from "@realtime-markers/types";
