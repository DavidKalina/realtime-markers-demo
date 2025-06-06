import { z } from "zod";
import { RecurrenceFrequency, DayOfWeek } from "../../../entities/Event";

const RecurrenceFrequencyEnum = z.nativeEnum(RecurrenceFrequency);
const DayOfWeekEnum = z.nativeEnum(DayOfWeek);

export const EventStructuredDataSchema = z.object({
  title: z.string(),
  dateTime: z.string(),
  timezone: z.string().default("UTC"),
  venueAddress: z.string(),
  venueName: z.string().optional(),
  organizer: z.string().optional(),
  description: z.string().optional(),
  contactInfo: z.string().optional(),
  socialMedia: z.string().optional(),
  otherDetails: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.string().optional(),
  recurrenceFrequency: RecurrenceFrequencyEnum.optional(),
  recurrenceDays: z.array(DayOfWeekEnum).optional(),
  recurrenceTime: z.string().optional(),
  recurrenceStartDate: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
  recurrenceInterval: z.number().nullable().optional(),
});

export const EventSchema = z.object({
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  qrCodeDetected: z.boolean().optional(),
  qrCodeData: z.string().optional(),
  structuredData: EventStructuredDataSchema,
});

export const AIResponseSchema = z.object({
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  qrCodeDetected: z.boolean().optional(),
  qrCodeData: z.string().optional(),
  isMultiEvent: z.boolean(),
  events: z.array(EventSchema),
  structuredData: EventStructuredDataSchema,
});

// Export types
export type EventStructuredData = z.infer<typeof EventStructuredDataSchema>;
export type EventData = z.infer<typeof EventSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
