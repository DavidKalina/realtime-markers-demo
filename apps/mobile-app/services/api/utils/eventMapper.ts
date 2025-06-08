import { ApiEvent } from "../base/types";
import { EventType } from "@/types/types";

export const mapEventToEventType = (apiEvent: ApiEvent): EventType => {
  return {
    id: apiEvent.id,
    title: apiEvent.title,
    description: apiEvent.description || "",
    eventDate: new Date(apiEvent.eventDate),
    endDate: apiEvent.endDate,
    time: new Date(apiEvent.eventDate).toLocaleTimeString(),
    coordinates: apiEvent.location.coordinates,
    location: apiEvent.address || "",
    locationNotes: apiEvent.locationNotes || "",
    distance: "",
    emoji: apiEvent.emoji || "📍",
    emojiDescription: apiEvent.emojiDescription,
    categories: Array.isArray(apiEvent.categories)
      ? apiEvent.categories.map((cat) =>
          typeof cat === "string"
            ? { id: cat, name: cat }
            : { id: cat.id, name: cat.name },
        )
      : [],
    creator: apiEvent.creator,
    creatorId: apiEvent.creatorId,
    scanCount: apiEvent.scanCount || 0,
    saveCount: apiEvent.saveCount || 0,
    timezone: apiEvent.timezone || "UTC",
    qrUrl: apiEvent.qrUrl,
    qrCodeData: apiEvent.qrCodeData,
    qrImagePath: apiEvent.qrImagePath,
    hasQrCode: apiEvent.hasQrCode,
    qrGeneratedAt: apiEvent.qrGeneratedAt,
    qrDetectedInImage: apiEvent.qrDetectedInImage,
    isPrivate: apiEvent.isPrivate,
    detectedQrData: apiEvent.detectedQrData,
    createdAt: apiEvent.createdAt,
    updatedAt: apiEvent.updatedAt,
    sharedWithIds: apiEvent.shares?.map((share) => share.sharedWithId) || [],
    isRecurring: apiEvent.isRecurring,
    recurrenceFrequency: apiEvent.recurrenceFrequency,
    recurrenceDays: apiEvent.recurrenceDays,
    recurrenceStartDate: apiEvent.recurrenceStartDate,
    recurrenceEndDate: apiEvent.recurrenceEndDate,
    recurrenceInterval: apiEvent.recurrenceInterval,
    recurrenceTime: apiEvent.recurrenceTime,
    recurrenceExceptions: apiEvent.recurrenceExceptions,
  };
};
