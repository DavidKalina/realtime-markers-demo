// src/types/FilterTypes.ts

export type EventStatus = "active" | "pending" | "completed" | "cancelled";

export interface EventFilter {
  // Category filtering
  categories?: string[];

  // Time filtering
  dateRange?: {
    start?: string; // ISO timestamp
    end?: string; // ISO timestamp
  };

  // Status filtering
  status?: EventStatus[];

  // Text filtering
  keywords?: string[];

  // Creator filtering
  creatorId?: string;

  // Additional filter types
  tags?: string[];
}

export interface BoundingBox {
  minX: number; // West longitude
  minY: number; // South latitude
  maxX: number; // East longitude
  maxY: number; // North latitude
}

export interface Viewport {
  clientId: string;
  boundingBox: BoundingBox;
  zoom: number;
  updatedAt: string;
}

export interface Event {
  id: string;
  title: string;
  location: {
    coordinates: [number, number]; // [longitude, latitude]
  };
  categories: string[];
  status?: EventStatus;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  creatorId?: string;
  description?: string;
  emoji?: string;
  color?: string;
  [key: string]: any; // For any additional properties
}
