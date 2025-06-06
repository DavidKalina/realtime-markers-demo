import { AIResponseSchema } from "../schemas/eventSchemas";

// Define a type for our prompt structure
export interface PromptDefinition {
  role: "system" | "user" | "assistant";
  content: string;
}

// Define a type for image analysis prompt data
export interface ImageAnalysisPromptData {
  imageUrl: string;
}

// Define a type for our prompt templates
export interface PromptTemplate<T> {
  system: PromptDefinition;
  user: (data: T) => PromptDefinition;
}

// Define the event image analysis prompt template
export const eventImageAnalysisPrompt: PromptTemplate<ImageAnalysisPromptData> =
  {
    system: {
      role: "system",
      content: `You are a helpful assistant that describes images. Return a JSON object with the following fields:
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
    },
    user: (data: ImageAnalysisPromptData) => ({
      role: "user",
      content: `Please analyze this image and extract event information: ${data.imageUrl}`,
    }),
  };

// Helper function to get messages for the AI model
export function getEventImageAnalysisMessages(
  imageUrl: string,
): PromptDefinition[] {
  return [
    eventImageAnalysisPrompt.system,
    eventImageAnalysisPrompt.user({ imageUrl }),
  ];
}

// Export a type for the expected response
export type EventImageAnalysisResponse = typeof AIResponseSchema._type;
