import { type Point } from "geojson";
import { RecurrenceFrequency, DayOfWeek } from "@realtime-markers/database";

export interface CreateEventInput {
  emoji: string;
  emojiDescription?: string;
  title: string;
  description?: string;
  eventDate: Date;
  endDate?: Date;
  location: Point;
  categoryIds?: string[];
  confidenceScore?: number;
  address?: string;
  locationNotes?: string;
  creatorId: string;
  timezone?: string;
  qrDetectedInImage?: boolean;
  detectedQrData?: string;
  originalImageUrl?: string | null;
  embedding: number[];
  isPrivate?: boolean;
  isOfficial?: boolean;
  sharedWithIds?: string[]; // Optional array of user IDs to share the event with
  qrUrl?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceTime?: string;
  recurrenceStartDate?: Date;
  recurrenceEndDate?: Date;
  recurrenceInterval?: number;
}
