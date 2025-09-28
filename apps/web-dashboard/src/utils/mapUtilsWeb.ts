// mapUtils.ts - Utility functions for map-event conversions
import { Coordinates, EventType } from "../types/types";

/**
 * Converts an EventType to a Marker format for use with maps
 * Ensures compatibility with the markerStore Marker type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const eventToMarker = (event: any): any => {
  // Skip conversion if coordinates are missing
  if (!event.coordinates) {
    console.warn(
      `Event "${event.title}" missing coordinates, cannot convert to marker`,
    );
    return null;
  }

  // Create a marker that matches the expected type in markerStore
  return {
    id: event.id || `event-${Math.random().toString(36).substring(2, 9)}`,
    coordinates: event.coordinates as [number, number],
    data: {
      title: event.title || "Unnamed Location",
      emoji: event.emoji || "📍",
      created_at: event.createdAt || new Date().toISOString(),
      updated_at: event.updatedAt || new Date().toISOString(),
      description: event.description,
      location: event.location,
      date: event.eventDate,
      time: event.time,
      category: event.category,
      // Include any other necessary properties
    },
  };
};

/**
 * Converts a Marker to an EventType format for use with UI components
 */
export const markerToEvent = (marker: {
  id: string;
  coordinates: [number, number];
  data: {
    title?: string;
    emoji?: string;
    color?: string;
    location?: string;
    distance?: string;
    time?: string;
    eventDate?: string;
    endDate?: string;
    description?: string;
    categories?: (string | { id: string; name: string })[];
    isVerified?: boolean;
    created_at?: string;
    updated_at?: string;
    isPrivate?: boolean;
    status?: string;
    locationNotes?: string;
    emojiDescription?: string;
    creator?: {
      id: string;
      displayName: string;
      email: string;
      role: string;
      avatarUrl?: string;
      isVerified: boolean;
    };
    creatorId?: string;
    scanCount?: number;
    saveCount?: number;
    timezone?: string;
    qrUrl?: string | null;
    qrCodeData?: string;
    qrImagePath?: string | null;
    hasQrCode?: boolean;
    qrGeneratedAt?: string | null;
    qrDetectedInImage?: boolean;
    detectedQrData?: string | null;
    createdAt?: string;
    updatedAt?: string;

    isRecurring?: boolean;
    recurrenceFrequency?: string;
    recurrenceDays?: string[];
    recurrenceStartDate?: string;
    recurrenceEndDate?: string;
    recurrenceInterval?: number;
    recurrenceTime?: string;
    recurrenceExceptions?: string[];
    category?: { id: string; name: string };
    [key: string]: unknown;
  };
}): EventType => {
  // Handle both marker types - from marker store or our defined Marker type
  if (marker.data && typeof marker.data === "object") {
    // If marker.data is an EventType (already has the right structure)
    if (marker.data.title && marker.data.id) {
      return {
        id: marker.id,
        coordinates: marker.coordinates,
        title: marker.data.title,
        description: marker.data.description || "",
        eventDate: marker.data.eventDate || new Date().toISOString(),
        endDate: marker.data.endDate,
        time: marker.data.time || new Date().toLocaleTimeString(),
        location: marker.data.location || "",
        locationNotes: marker.data.locationNotes || "",
        distance: marker.data.distance || "",
        emoji: marker.data.emoji || "📍",
        emojiDescription: marker.data.emojiDescription,
        categories: Array.isArray(marker.data.categories)
          ? marker.data.categories.map(
              (cat: string | { id: string; name: string }) =>
                typeof cat === "string"
                  ? { id: cat, name: cat }
                  : { id: cat.id || cat, name: cat.name || cat },
            )
          : [],
        creator: marker.data.creator,
        creatorId: marker.data.creatorId,
        scanCount: marker.data.scanCount || 0,
        saveCount: marker.data.saveCount || 0,
        timezone: marker.data.timezone || "UTC",
        qrUrl: marker.data.qrUrl,
        qrCodeData: marker.data.qrCodeData,
        qrImagePath: marker.data.qrImagePath,
        hasQrCode: marker.data.hasQrCode || false,
        qrGeneratedAt: marker.data.qrGeneratedAt,
        qrDetectedInImage: marker.data.qrDetectedInImage || false,
        detectedQrData: marker.data.detectedQrData,
        createdAt: marker.data.createdAt || new Date().toISOString(),
        updatedAt: marker.data.updatedAt || new Date().toISOString(),
        isPrivate: marker.data.isPrivate || false,
        isRecurring: marker.data.isRecurring || false,
        recurrenceFrequency: marker.data.recurrenceFrequency,
        recurrenceDays: marker.data.recurrenceDays,
        recurrenceStartDate: marker.data.recurrenceStartDate,
        recurrenceEndDate: marker.data.recurrenceEndDate,
        recurrenceInterval: marker.data.recurrenceInterval,
        recurrenceTime: marker.data.recurrenceTime,
        recurrenceExceptions: marker.data.recurrenceExceptions,
        status: marker.data.status || "ACTIVE",
        viewCount: marker.data.viewCount || 0,
        isOfficial: marker.data.isOfficial || false,
      } as unknown as EventType;
    }

    // If marker.data has properties but isn't an EventType - map properly
    const eventDate: string =
      (typeof marker.data.eventDate === "string"
        ? marker.data.eventDate
        : "") ||
      (typeof marker.data.date === "string" ? marker.data.date : "") ||
      new Date().toISOString();
    const time: string =
      (typeof marker.data.time === "string" ? marker.data.time : "") ||
      new Date(eventDate).toLocaleTimeString();

    return {
      id: marker.id,
      title: marker.data.title || "Unknown Location",
      description: marker.data.description || "",
      eventDate: eventDate as string,
      endDate: marker.data.endDate,
      time: time,
      coordinates: marker.coordinates,
      location: marker.data.location || "Unknown location",
      locationNotes: marker.data.locationNotes || "",
      distance: marker.data.distance || "",
      emoji: marker.data.emoji || "📍",
      emojiDescription: marker.data.emojiDescription,
      categories: Array.isArray(marker.data.categories)
        ? marker.data.categories.map(
            (cat: string | { id: string; name: string }) =>
              typeof cat === "string"
                ? { id: cat, name: cat }
                : { id: cat.id || cat, name: cat.name || cat },
          )
        : [],
      creator: marker.data.creator,
      creatorId: marker.data.creatorId,
      scanCount: marker.data.scanCount || 0,
      saveCount: marker.data.saveCount || 0,
      timezone: marker.data.timezone || "UTC",
      qrUrl: marker.data.qrUrl,
      qrCodeData: marker.data.qrCodeData,
      qrImagePath: marker.data.qrImagePath,
      hasQrCode: marker.data.hasQrCode || false,
      qrGeneratedAt: marker.data.qrGeneratedAt,
      qrDetectedInImage: marker.data.qrDetectedInImage || false,
      detectedQrData: marker.data.detectedQrData,
      createdAt:
        marker.data.createdAt ||
        marker.data.created_at ||
        new Date().toISOString(),
      updatedAt:
        marker.data.updatedAt ||
        marker.data.updated_at ||
        new Date().toISOString(),
      isPrivate: marker.data.isPrivate || false,
      // Recurring event fields
      isRecurring: marker.data.isRecurring || false,
      recurrenceFrequency: marker.data.recurrenceFrequency,
      recurrenceDays: marker.data.recurrenceDays,
      recurrenceStartDate: marker.data.recurrenceStartDate,
      recurrenceEndDate: marker.data.recurrenceEndDate,
      recurrenceInterval: marker.data.recurrenceInterval,
      recurrenceTime: marker.data.recurrenceTime,
      recurrenceExceptions: marker.data.recurrenceExceptions,
      // Additional fields
      color: marker.data.color || "#4dabf7",
      isVerified: marker.data.isVerified || false,
      status: marker.data.status || "ACTIVE",
      viewCount: marker.data.viewCount || 0,
      isOfficial: marker.data.isOfficial || false,
      // Legacy support
      category: marker.data.category || { id: "general", name: "General" },
    } as unknown as EventType;
  }

  // Fallback for minimal marker format
  return {
    id: marker.id,
    title: "Unknown Location",
    description: "",
    eventDate: new Date().toISOString(),
    endDate: undefined,
    time: new Date().toLocaleTimeString(),
    coordinates: marker.coordinates,
    location: "Unknown location",
    locationNotes: "",
    distance: "",
    emoji: "📍",
    emojiDescription: undefined,
    categories: [{ id: "general", name: "General" }],
    creator: undefined,
    creatorId: undefined,
    scanCount: 0,
    saveCount: 0,
    timezone: "UTC",
    qrUrl: undefined,
    qrCodeData: undefined,
    qrImagePath: undefined,
    hasQrCode: false,
    qrGeneratedAt: undefined,
    qrDetectedInImage: false,
    detectedQrData: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPrivate: false,

    isRecurring: false,
    status: "ACTIVE",
    viewCount: 0,
    isOfficial: false,
    color: "#4dabf7",
    isVerified: false,
    category: { id: "general", name: "General" },
  } as unknown as EventType;
};

/**
 * Converts a batch of events to markers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const eventsToMarkers = (events: EventType[]): any[] => {
  return events.map(eventToMarker).filter((marker) => marker !== null);
};

/**
 * Converts a batch of markers to events
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const markersToEvents = (markers: any[]): EventType[] => {
  return markers.map(markerToEvent);
};

/**
 * Helper function to check if coordinates are valid
 */
export const isValidCoordinates = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coordinates: any,
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
