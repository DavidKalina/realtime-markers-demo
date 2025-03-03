// mapUtils.ts - Utility functions for map-event conversions
import { EventType, Marker, Coordinates } from "../types/types";

/**
 * Converts an EventType to a Marker format for use with maps
 * Ensures compatibility with the markerStore Marker type
 */
export const eventToMarker = (event: EventType): any => {
  // Skip conversion if coordinates are missing
  if (!event.coordinates) {
    console.warn(`Event "${event.title}" missing coordinates, cannot convert to marker`);
    return null;
  }

  // Create a marker that matches the expected type in markerStore
  return {
    id: event.id || `event-${Math.random().toString(36).substring(2, 9)}`,
    coordinates: event.coordinates as [number, number],
    data: {
      title: event.title || "Unnamed Location",
      emoji: event.emoji || "📍",
      color: event.color || "#4dabf7",
      created_at: event.created_at || new Date().toISOString(),
      updated_at: event.updated_at || new Date().toISOString(),
      description: event.description,
      location: event.location,
      date: event.date,
      time: event.time,
      category: event.category,
      // Include any other necessary properties
    },
  };
};

/**
 * Converts a Marker to an EventType format for use with UI components
 */
export const markerToEvent = (marker: any): EventType => {
  // Handle both marker types - from marker store or our defined Marker type
  if (marker.data && typeof marker.data === "object") {
    // If marker.data is an EventType
    if (marker.data.title && marker.data.id) {
      return {
        id: marker.id,
        coordinates: marker.coordinates,
        ...marker.data,
      };
    }

    // If marker.data has properties but isn't an EventType
    return {
      id: marker.id,
      title: marker.data.title || "Unknown Location",
      emoji: marker.data.emoji || "📍",
      color: marker.data.color || "#4dabf7",
      coordinates: marker.coordinates,
      description: marker.data.description || "",
      location: marker.data.location || "Unknown location",
      date: marker.data.date || "No date specified",
      time: marker.data.time || "No time specified",
      category: marker.data.category || "General",
    };
  }

  // Fallback for minimal marker format
  return {
    id: marker.id,
    title: "Unknown Location",
    emoji: "📍",
    color: "#4dabf7",
    coordinates: marker.coordinates,
    description: "",
    location: "Unknown location",
    date: "No date specified",
    time: "No time specified",
    category: "General",
  };
};

/**
 * Converts a batch of events to markers
 */
export const eventsToMarkers = (events: EventType[]): any[] => {
  return events.map(eventToMarker).filter((marker) => marker !== null);
};

/**
 * Converts a batch of markers to events
 */
export const markersToEvents = (markers: any[]): EventType[] => {
  return markers.map(markerToEvent);
};

/**
 * Helper function to check if coordinates are valid
 */
export const isValidCoordinates = (coordinates: any): coordinates is Coordinates => {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number" &&
    coordinates[0] >= -180 &&
    coordinates[0] <= 180 &&
    coordinates[1] >= -90 &&
    coordinates[1] <= 90
  );
};
