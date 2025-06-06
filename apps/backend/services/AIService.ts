import { openai } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { RecurrenceFrequency, DayOfWeek } from "../entities/Event";

const RecurrenceFrequencyEnum = z.nativeEnum(RecurrenceFrequency);
const DayOfWeekEnum = z.nativeEnum(DayOfWeek);

const EventStructuredDataSchema = z.object({
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

const EventSchema = z.object({
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  qrCodeDetected: z.boolean().optional(),
  qrCodeData: z.string().optional(),
  structuredData: EventStructuredDataSchema,
});

const AIResponseSchema = z.object({
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  qrCodeDetected: z.boolean().optional(),
  qrCodeData: z.string().optional(),
  isMultiEvent: z.boolean(),
  events: z.array(EventSchema),
  structuredData: EventStructuredDataSchema,
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export class AiService {
  private static instance: AiService;
  model: LanguageModel = openai("gpt-4o");
  constructor(model: LanguageModel) {
    this.model = model;
  }

  public static getInstance(): AiService {
    if (!this.instance) {
      if (!process.env.AI_KEY) {
        throw new Error("AI_KEY is not set");
      }
      this.instance = new AiService(openai("gpt-4o"));
    }
    return this.instance;
  }

  public static async describeImage(
    image: Buffer,
  ): Promise<{ object: AIResponse }> {
    const service = this.getInstance();
    const imageAsUint8Array = await Bun.file(image).arrayBuffer();
    const imageAsBase64 = Buffer.from(imageAsUint8Array).toString("base64");
    const imageAsBase64Url = `data:image/jpeg;base64,${imageAsBase64}`;

    const schema = AIResponseSchema;

    const result = await generateObject({
      model: service.model,
      output: "object",
      schema,
      system: `You are a helpful assistant that describes images. Return a JSON object with the following fields:
        - rawText: The full text content of the image
        - confidence: A number between 0 and 1 indicating confidence in the extraction
        - qrCodeDetected: Boolean indicating if a QR code was found (optional)
        - qrCodeData: The QR code data if found (optional)
        - isMultiEvent: Boolean indicating if multiple events were found
        - events: Array of event objects containing extracted event information
        - structuredData: Object containing parsed event details with required fields:
          * title: Event title
          * dateTime: Event date and time
          * timezone: Event timezone (defaults to UTC)
          * venueAddress: Event venue address
          * venueName: Event venue name (optional)
          * organizer: Event organizer (optional)
          * description: Event description (optional)
          * isRecurring: Whether the event is recurring (defaults to false)
          * recurrenceFrequency: Frequency of recurrence if recurring (optional)
          * recurrenceDays: Days of the week for recurring events (optional)
          * recurrenceTime: Time for recurring events (optional)
          * recurrenceStartDate: Start date for recurring events (optional)
          * recurrenceEndDate: End date for recurring events (optional)
          * recurrenceInterval: Interval for recurring events (optional)`,
      messages: [
        {
          role: "user",
          content: `Please analyze this image and extract event information: ${imageAsBase64Url}`,
        },
      ],
    });

    // Validate the response
    const validatedResult = AIResponseSchema.parse(result.object);
    return { object: validatedResult };
  }
}
