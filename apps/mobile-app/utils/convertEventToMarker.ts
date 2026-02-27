import { Marker } from "@/types/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      categories: event.categories?.map((c: any) => c.name || c),
      isVerified: event.isVerified,
      created_at: event.createdAt,
      updated_at: event.updatedAt,
      isPrivate: event.isPrivate,
      status: event.status,
      isRecurring: event.isRecurring ?? false,
      recurrenceFrequency: event.recurrenceFrequency,
      recurrenceDays: event.recurrenceDays,
      recurrenceStartDate: event.recurrenceStartDate,
      recurrenceEndDate: event.recurrenceEndDate,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceTime: event.recurrenceTime,
      recurrenceExceptions: event.recurrenceExceptions,
      goingCount: event.goingCount ?? 0,
      saveCount: event.saveCount ?? 0,
      isTrending: event.isTrending ?? false,
      ...(event.metadata || {}),
    },
  };
}
