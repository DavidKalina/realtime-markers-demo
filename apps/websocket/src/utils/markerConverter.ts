/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Marker } from "@realtime-markers/database";

/**
 * Converts an event object to a Marker format ready for client consumption
 * This centralizes the transformation logic that was previously duplicated across clients
 */
export function convertEventToMarker(event: any): Marker {
  return {
    id: event.id,
    coordinates: event.location.coordinates,
    data: {
      title: event.title || "Unnamed Event",
      emoji: event.emoji || "📍",
      color: event.color || "red",
      description: event.description,
      eventDate: event.eventDate,
      endDate: event.endDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories: event.categories?.map((c: any) => c.name || c), // Ensure categories are handled
      isVerified: event.isVerified,
      created_at: event.createdAt,
      updated_at: event.updatedAt,
      isPrivate: event.isPrivate,
      status: event.status,
      // Add recurring event fields
      isRecurring: event.isRecurring ?? false,
      recurrenceFrequency: event.recurrenceFrequency,
      recurrenceDays: event.recurrenceDays,
      recurrenceStartDate: event.recurrenceStartDate,
      recurrenceEndDate: event.recurrenceEndDate,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceTime: event.recurrenceTime,
      recurrenceExceptions: event.recurrenceExceptions,
      // Add entity type for client identification
      entityType: "event",
      // Include any additional metadata
      ...(event.metadata || {}),
    },
  };
}

/**
 * Converts a civic engagement object to a Marker format ready for client consumption
 */
export function convertCivicEngagementToMarker(civicEngagement: any): Marker {
  return {
    id: civicEngagement.id,
    coordinates: civicEngagement.location.coordinates,
    data: {
      title: civicEngagement.title || "Unnamed Civic Engagement",
      emoji: civicEngagement.emoji || "🏛️",
      color: civicEngagement.color || "blue",
      description: civicEngagement.description,
      eventDate: civicEngagement.eventDate,
      endDate: civicEngagement.endDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories: civicEngagement.categories?.map((c: any) => c.name || c),
      isVerified: civicEngagement.isVerified,
      created_at: civicEngagement.createdAt,
      updated_at: civicEngagement.updatedAt,
      isPrivate: civicEngagement.isPrivate,
      status: civicEngagement.status,
      // Civic engagement specific fields
      type: civicEngagement.type,
      address: civicEngagement.address,
      locationNotes: civicEngagement.locationNotes,
      creatorId: civicEngagement.creatorId,
      adminNotes: civicEngagement.adminNotes,
      implementedAt: civicEngagement.implementedAt,
      imageUrls: civicEngagement.imageUrls,
      // Add entity type for client identification
      entityType: "civic_engagement",
      // Include any additional metadata
      ...(civicEngagement.metadata || {}),
    },
  };
}
