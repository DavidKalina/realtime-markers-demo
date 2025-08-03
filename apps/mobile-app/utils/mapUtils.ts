// mapUtils.ts - Utility functions for map-event conversions
import { Coordinates, EventType } from "../types/types";
import {
  Marker,
  EventMarkerData,
  EventMarker,
  CategorySummary,
  UserProfile,
  EventStatus,
  RecurrenceFrequency,
  DayOfWeek,
} from "@realtime-markers/database";
import type { Point } from "geojson";

/**
 * Converts an EventType to a Marker format for use with maps
 * Ensures compatibility with the markerStore Marker type
 */
export const eventToMarker = (event: EventType): EventMarker | null => {
  // Skip conversion if coordinates are missing
  if (!event.coordinates) {
    console.warn(
      `Event "${event.title}" missing coordinates, cannot convert to marker`,
    );
    return null;
  }

  // Create marker data that matches EventMarkerData type
  const markerData: EventMarkerData = {
    title: event.title,
    emoji: event.emoji || "📍",
    color: event.color || "#4dabf7",
    location:
      typeof event.location === "string"
        ? event.location
        : JSON.stringify(event.location),
    distance: event.distance,
    time: event.time,
    eventDate:
      event.eventDate instanceof Date
        ? event.eventDate.toISOString()
        : event.eventDate,
    endDate:
      event.endDate instanceof Date
        ? event.endDate.toISOString()
        : event.endDate,
    description: event.description,
    categories: event.categories?.map((cat) => cat.name) || [],
    isVerified: event.isVerified || event.isOfficial || false,
    created_at: event.createdAt || new Date().toISOString(),
    updated_at: event.updatedAt || new Date().toISOString(),
    isPrivate: event.isPrivate || false,
    status: event.status,
    locationNotes: event.locationNotes || "",
    emojiDescription: event.emojiDescription,
    entityType: "event",
    // Recurring event fields
    isRecurring: event.isRecurring,
    recurrenceFrequency: event.recurrenceFrequency,
    recurrenceDays: event.recurrenceDays,
    recurrenceStartDate: event.recurrenceStartDate,
    recurrenceEndDate: event.recurrenceEndDate,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceTime: event.recurrenceTime,
    recurrenceExceptions: event.recurrenceExceptions,
  };

  return {
    id: event.id,
    coordinates: event.coordinates,
    data: markerData,
  };
};

/**
 * Converts a Marker to an EventType format for use with UI components
 */
export const markerToEvent = (marker: Marker): EventType => {
  const data = marker.data;

  // Helper function to safely extract string values
  const getString = (value: unknown, defaultValue = ""): string =>
    typeof value === "string" ? value : defaultValue;

  // Helper function to safely extract number values
  const getNumber = (value: unknown, defaultValue = 0): number =>
    typeof value === "number" ? value : defaultValue;

  // Helper function to safely extract boolean values
  const getBoolean = (value: unknown, defaultValue = false): boolean =>
    typeof value === "boolean" ? value : defaultValue;

  // Helper function to map categories to CategorySummary format
  const mapCategories = (categories: unknown): CategorySummary[] => {
    if (!Array.isArray(categories))
      return [
        {
          id: "general",
          name: "General",
          description: "General events",
          icon: "📍",
        },
      ];

    return categories.map(
      (
        cat:
          | string
          | { id: string; name: string; description?: string; icon?: string },
      ) => {
        if (typeof cat === "string") {
          return { id: cat, name: cat, description: cat, icon: "📍" };
        }
        return {
          id: cat.id || cat.name,
          name: cat.name || cat.id,
          description: cat.description || cat.name,
          icon: cat.icon || "📍",
        };
      },
    );
  };

  // Helper function to convert string date to Date object
  const parseDate = (dateString: string): Date => {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  // Extract event date and time with fallbacks
  const eventDateString = getString(
    data.eventDate || data.date,
    new Date().toISOString(),
  );
  const eventDate = parseDate(eventDateString);
  const time = getString(data.time, eventDate.toLocaleTimeString());

  // Convert coordinates to Point format if needed
  const coordinates: Coordinates = marker.coordinates;

  // Parse location - handle both string and Point formats
  let location: Point;
  if (typeof data.location === "string") {
    try {
      const parsed = JSON.parse(data.location);
      location =
        parsed.type === "Point"
          ? parsed
          : { type: "Point", coordinates: coordinates };
    } catch {
      location = { type: "Point", coordinates: coordinates };
    }
  } else {
    location = (data.location as unknown as Point) ?? {
      type: "Point",
      coordinates: coordinates,
    };
  }

  return {
    id: marker.id,
    title: getString(data.title, "Unknown Location"),
    description: getString(data.description),
    eventDate,
    endDate: data.endDate ? parseDate(getString(data.endDate)) : undefined,
    time,
    coordinates,
    location,
    locationNotes: getString(data.locationNotes),
    distance: getString(data.distance),
    emoji: getString(data.emoji, "📍"),
    emojiDescription: getString(data.emojiDescription),
    categories: mapCategories(data.categories),
    creator: data.creator as UserProfile | undefined,
    creatorId: getString(data.creatorId),
    scanCount: getNumber(data.scanCount),
    saveCount: getNumber(data.saveCount),
    viewCount: getNumber(data.viewCount),
    timezone: getString(data.timezone, "UTC"),
    qrUrl: data.qrUrl as string | null | undefined,
    qrCodeData: getString(data.qrCodeData),
    qrImagePath: data.qrImagePath as string | null | undefined,
    hasQrCode: getBoolean(data.hasQrCode),
    qrGeneratedAt: data.qrGeneratedAt as string | null | undefined,
    qrDetectedInImage: getBoolean(data.qrDetectedInImage),
    detectedQrData: data.detectedQrData as string | null | undefined,
    createdAt: getString(
      data.createdAt || data.created_at,
      new Date().toISOString(),
    ),
    updatedAt: getString(
      data.updatedAt || data.updated_at,
      new Date().toISOString(),
    ),
    isPrivate: getBoolean(data.isPrivate),
    isOfficial: getBoolean(data.isOfficial),
    isRecurring: getBoolean(data.isRecurring),
    recurrenceFrequency: data.recurrenceFrequency as
      | RecurrenceFrequency
      | undefined,
    recurrenceDays: data.recurrenceDays as DayOfWeek[] | undefined,
    recurrenceStartDate: getString(data.recurrenceStartDate),
    recurrenceEndDate: getString(data.recurrenceEndDate),
    recurrenceInterval: getNumber(data.recurrenceInterval),
    recurrenceTime: getString(data.recurrenceTime),
    recurrenceExceptions: Array.isArray(data.recurrenceExceptions)
      ? data.recurrenceExceptions
      : [],
    color: getString(data.color, "#4dabf7"),
    isVerified: getBoolean(data.isVerified),
    status: getString(data.status, "active") as EventStatus,
  };
};

/**
 * Converts a batch of events to markers
 */
export const eventsToMarkers = (events: EventType[]): EventMarker[] => {
  return events
    .map(eventToMarker)
    .filter((marker): marker is EventMarker => marker !== null);
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
export const isValidCoordinates = (
  coordinates: unknown,
): coordinates is Coordinates => {
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

/**
 * Helper function to convert Point to Coordinates
 */
export const pointToCoordinates = (point: Point): Coordinates => {
  return point.coordinates as Coordinates;
};

/**
 * Helper function to convert Coordinates to Point
 */
export const coordinatesToPoint = (coordinates: Coordinates): Point => {
  return {
    type: "Point",
    coordinates: coordinates,
  };
};
