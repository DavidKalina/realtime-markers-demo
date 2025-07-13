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

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Marker data types derived from EventResponse and CivicEngagementResponse
export type EventMarkerData = Pick<
  import("@realtime-markers/types").EventResponse,
  | "title"
  | "emoji"
  | "description"
  | "eventDate"
  | "endDate"
  | "createdAt"
  | "updatedAt"
  | "isPrivate"
  | "isRecurring"
  | "recurrenceFrequency"
  | "recurrenceDays"
  | "recurrenceStartDate"
  | "recurrenceEndDate"
  | "recurrenceInterval"
  | "recurrenceTime"
  | "recurrenceExceptions"
> & {
  color: string;
  location?: string;
  distance?: string;
  time?: string;
  categories?: string[];
  isVerified?: boolean;
  status?: string;
  entityType?: "event";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type CivicEngagementMarkerData = Pick<
  import("@realtime-markers/types").CivicEngagementResponse,
  | "title"
  | "description"
  | "type"
  | "status"
  | "address"
  | "locationNotes"
  | "createdAt"
  | "updatedAt"
  | "creatorId"
  | "adminNotes"
  | "implementedAt"
  | "imageUrls"
> & {
  emoji: string;
  color: string;
  entityType: "civic_engagement";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// Re-export EventType from the shared types for backward compatibility
export type { EventResponse as EventType } from "@realtime-markers/types";

// Server marker structure adjusted for Mapbox
export interface Marker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: EventMarkerData | CivicEngagementMarkerData;
}
