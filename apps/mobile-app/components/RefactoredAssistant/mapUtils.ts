// mapUtils.ts - Utility functions for map-event conversions
import { EventType, Marker, Coordinates } from "./types";

/**
 * Converts an EventType to a Marker format for use with maps
 */
export const eventToMarker = (event: EventType): Marker | null => {
  // Skip conversion if coordinates are missing
  if (!event.coordinates) {
    console.warn(`Event "${event.title}" missing coordinates, cannot convert to marker`);
    return null;
  }

  return {
    id: event.id || `event-${Math.random().toString(36).substring(2, 9)}`,
    coordinates: event.coordinates,
    data: { ...event },
  };
};

/**
 * Converts a Marker to an EventType format for use with UI components
 */
export const markerToEvent = (marker: Marker): EventType => {
  return {
    id: marker.id,
    ...marker.data,
    coordinates: marker.coordinates,
  };
};

/**
 * Converts a batch of events to markers
 */
export const eventsToMarkers = (events: EventType[]): Marker[] => {
  return events.map(eventToMarker).filter((marker): marker is Marker => marker !== null);
};

/**
 * Converts a batch of markers to events
 */
export const markersToEvents = (markers: Marker[]): EventType[] => {
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
