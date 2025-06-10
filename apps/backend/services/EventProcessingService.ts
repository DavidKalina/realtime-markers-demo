// services/EventProcessingService.ts
import type { Point } from "geojson";
import type { Category } from "../entities/Category";
import type { SimilarityResult } from "./event-processing/dto/SimilarityResult";
import { EventExtractionService } from "./event-processing/EventExtractionService";
import { ImageProcessingService } from "./event-processing/ImageProcessingService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { IEventExtractionService } from "./event-processing/interfaces/IEventExtractionService";
import type { IEventProcessingServiceDependencies } from "./event-processing/interfaces/IEventProcessingServiceDependencies";
import type { IImageProcessingService } from "./event-processing/interfaces/IImageProcesssingService";

import type { JobQueue } from "./JobQueue";
import { EmbeddingService } from "./shared/EmbeddingService";
import type { EventStructuredData } from "./event-processing/dto/ImageProcessingResult";
import { RecurrenceFrequency, DayOfWeek } from "../entities/Event";

interface LocationContext {
  userCoordinates?: { lat: number; lng: number };
  organizationHints?: string[];
}

interface EventDetails {
  emoji: string;
  emojiDescription?: string;
  title: string;
  date: string;
  endDate?: string;
  address: string;
  location: Point;
  description: string;
  categories?: Category[];
  timezone?: string; // IANA timezone identifier (e.g., "America/New_York")
  locationNotes?: string; // Additional location context like building, room, etc.
  userCityState?: string; // User's city and state for location context
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceTime?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number | null;
}

interface ScanResult {
  confidence: number;
  eventDetails: EventDetails;
  similarity: SimilarityResult;
  isDuplicate?: boolean;
  qrCodeDetected?: boolean;
  qrCodeData?: string;
  embedding: number[];
}

interface PrivateEventInput {
  emoji: string;
  emojiDescription?: string;
  title: string;
  date: string;
  endDate?: string;
  address: string;
  location: Point;
  description: string;
  categories?: Category[];
  timezone?: string;
  locationNotes?: string;
  isPrivate: boolean;
  sharedWithIds?: string[];
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceTime?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
}

/**
 * Result of processing multiple events from a single image
 */
export interface MultiEventScanResult {
  events: ScanResult[];
  isMultiEvent: boolean;
  extractedAt: string;
  error?: string;
}

export class EventProcessingService {
  private imageProcessingService: IImageProcessingService;
  private eventExtractionService: IEventExtractionService;
  private embeddingService: IEmbeddingService;
  private jobQueue?: JobQueue; // Store JobQueue instance

  constructor(private dependencies: IEventProcessingServiceDependencies) {
    // Initialize the image processing service (use provided or create new one)
    this.imageProcessingService =
      dependencies.imageProcessingService || new ImageProcessingService();

    // Use provided location service

    // Initialize or use the provided event extraction service
    if (dependencies.eventExtractionService) {
      this.eventExtractionService = dependencies.eventExtractionService;
    } else {
      // If not provided, create a new instance using OpenAIService singleton
      this.eventExtractionService = new EventExtractionService(
        dependencies.categoryProcessingService,
        dependencies.locationResolutionService,
      );
    }

    // Use provided embedding service or get singleton instance
    this.embeddingService =
      dependencies.embeddingService ||
      EmbeddingService.getInstance(dependencies.configService);

    this.jobQueue = dependencies.jobQueue;
  }

  async processFlyerFromImage(
    imageData: Buffer | string,
    locationContext?: LocationContext,
  ): Promise<ScanResult> {
    // Define total steps for this workflow

    // Step 1: Process image
    const visionResult =
      await this.imageProcessingService.processImage(imageData);

    // Step 2: Extract text and analyze
    const extractedText = visionResult.rawText;

    // Step 3: Extract event details

    const extractionResult =
      await this.eventExtractionService.extractEventDetails(
        extractedText,
        locationContext,
      );

    // Add recurrence information to event details
    const eventDetailsWithCategories = {
      ...extractionResult.event,
      isRecurring: visionResult.structuredData?.isRecurring,
      recurrenceFrequency: visionResult.structuredData?.recurrenceFrequency,
      recurrenceDays: visionResult.structuredData?.recurrenceDays,
      recurrenceTime: visionResult.structuredData?.recurrenceTime,
      recurrenceStartDate: visionResult.structuredData?.recurrenceStartDate,
      recurrenceEndDate: visionResult.structuredData?.recurrenceEndDate,
      recurrenceInterval: visionResult.structuredData?.recurrenceInterval,
    };

    // Step 4: Generate embedding
    const finalEmbedding = await this.generateEmbedding(
      eventDetailsWithCategories,
    );

    // Step 5: Check for duplicates
    const similarity =
      await this.dependencies.eventSimilarityService.findSimilarEvents(
        finalEmbedding,
        {
          title: eventDetailsWithCategories.title,
          date: eventDetailsWithCategories.date,
          endDate: eventDetailsWithCategories.endDate,
          coordinates: eventDetailsWithCategories.location.coordinates as [
            number,
            number,
          ],
          address: eventDetailsWithCategories.address,
          description: eventDetailsWithCategories.description,
          timezone: eventDetailsWithCategories.timezone,
          isRecurring: eventDetailsWithCategories.isRecurring,
          recurrenceFrequency: eventDetailsWithCategories.recurrenceFrequency,
          recurrenceDays: eventDetailsWithCategories.recurrenceDays,
          recurrenceTime: eventDetailsWithCategories.recurrenceTime,
        },
      );

    const isDuplicate = similarity.isDuplicate;

    if (isDuplicate && similarity.matchingEventId) {
      await this.dependencies.eventSimilarityService.handleDuplicateScan(
        similarity.matchingEventId,
      );
    }

    return {
      confidence: visionResult.confidence || 0,
      eventDetails: eventDetailsWithCategories,
      similarity,
      isDuplicate: isDuplicate || false,
      qrCodeDetected: visionResult.qrCodeDetected,
      qrCodeData: visionResult.qrCodeData,
      embedding: finalEmbedding,
    };
  }

  async processPrivateEvent(
    eventInput: PrivateEventInput,
  ): Promise<ScanResult> {
    // Generate emoji only if not provided (not if it's the default "📍")
    let eventDetails = { ...eventInput };
    if (!eventInput.emoji) {
      const emojiResult = await this.eventExtractionService.generateEventEmoji(
        eventInput.title,
        eventInput.description,
      );
      eventDetails = {
        ...eventInput,
        emoji: emojiResult.emoji,
        emojiDescription: emojiResult.emojiDescription,
      };
    }

    const categories =
      await this.dependencies.categoryProcessingService.extractAndProcessCategories(
        `${eventDetails.title} ${eventDetails.description}`,
      );

    eventDetails = {
      ...eventDetails,
      categories,
    };

    // Add recurrence information to event details
    const eventDetailsWithRecurrence = {
      ...eventDetails,
      isRecurring: eventDetails.isRecurring,
      recurrenceFrequency: eventDetails.recurrenceFrequency,
      recurrenceDays: eventDetails.recurrenceDays,
      recurrenceTime: eventDetails.recurrenceTime,
      recurrenceStartDate: eventDetails.recurrenceStartDate,
      recurrenceEndDate: eventDetails.recurrenceEndDate,
      recurrenceInterval: eventDetails.recurrenceInterval,
    };

    // Generate embedding
    const finalEmbedding = await this.generateEmbedding(
      eventDetailsWithRecurrence,
    );

    // Check for duplicates
    const similarity =
      await this.dependencies.eventSimilarityService.findSimilarEvents(
        finalEmbedding,
        {
          title: eventDetailsWithRecurrence.title,
          date: eventDetailsWithRecurrence.date,
          endDate: eventDetailsWithRecurrence.endDate,
          coordinates: eventDetailsWithRecurrence.location.coordinates as [
            number,
            number,
          ],
          address: eventDetailsWithRecurrence.address,
          description: eventDetailsWithRecurrence.description,
          timezone: eventDetailsWithRecurrence.timezone,
          isRecurring: eventDetailsWithRecurrence.isRecurring,
          recurrenceFrequency: eventDetailsWithRecurrence.recurrenceFrequency,
          recurrenceDays: eventDetailsWithRecurrence.recurrenceDays,
          recurrenceTime: eventDetailsWithRecurrence.recurrenceTime,
        },
      );

    const isDuplicate = similarity.isDuplicate;

    if (isDuplicate && similarity.matchingEventId) {
      await this.dependencies.eventSimilarityService.handleDuplicateScan(
        similarity.matchingEventId,
      );
    }

    return {
      confidence: 1.0, // Private events are manually created, so confidence is always high
      eventDetails: eventDetailsWithRecurrence,
      similarity,
      isDuplicate: isDuplicate || false,
      qrCodeDetected: false,
      embedding: finalEmbedding,
    };
  }

  private async generateEmbedding(
    eventDetails: EventDetails,
  ): Promise<number[]> {
    // Use the same format as EventService
    const textForEmbedding = `
      TITLE: ${eventDetails.title} ${eventDetails.title} ${eventDetails.title}
      EMOJI: ${eventDetails.emoji} - ${eventDetails.emojiDescription || ""}
      CATEGORIES: ${eventDetails.categories?.map((c) => c.name).join(", ") || ""}
      DESCRIPTION: ${eventDetails.description || ""}
      LOCATION: ${eventDetails.address || ""}
      LOCATION_NOTES: ${eventDetails.locationNotes || ""}
      ${eventDetails.isRecurring ? `RECURRENCE: ${eventDetails.recurrenceFrequency} ${eventDetails.recurrenceDays?.join(", ")} at ${eventDetails.recurrenceTime}` : ""}
      `.trim();

    // Get embedding using the embedding service
    return await this.embeddingService.getEmbedding(textForEmbedding);
  }

  /**
   * Process a flyer that may contain multiple events
   * @param imageData Buffer or string containing image data
   * @param progressCallback Optional callback for progress updates
   * @param locationContext Optional location context for better resolution
   * @param jobId Optional job ID for progress tracking
   * @returns Array of scan results for each event found
   */
  async processMultiEventFlyer(
    imageData: Buffer | string,
    locationContext?: LocationContext,
  ): Promise<MultiEventScanResult> {
    try {
      // Step 1: Process image and detect multiple events

      const multiEventResult =
        await this.imageProcessingService.processMultiEventImage(imageData);

      if (!multiEventResult.success) {
        throw new Error(
          multiEventResult.error || "Failed to process multi-event image",
        );
      }

      // Step 2: Process each event
      const eventResults: ScanResult[] = [];
      const totalEvents = multiEventResult.events.length;

      for (let i = 0; i < totalEvents; i++) {
        const event = multiEventResult.events[i];

        // Skip events with low confidence
        if (event.confidence < 0.5) {
          console.warn(
            `Skipping event ${i + 1} due to low confidence: ${event.confidence}`,
          );
          continue;
        }

        // Extract event details using the structured data if available
        const extractionResult =
          await this.eventExtractionService.extractEventDetails(
            event.structuredData
              ? this.formatStructuredData(event.structuredData)
              : event.rawText,
            locationContext,
          );

        // Generate embedding
        const eventDetailsWithCategories = extractionResult.event;
        const finalEmbedding = await this.generateEmbedding(
          eventDetailsWithCategories,
        );

        // Check for duplicates
        const similarity =
          await this.dependencies.eventSimilarityService.findSimilarEvents(
            finalEmbedding,
            {
              title: eventDetailsWithCategories.title,
              date: eventDetailsWithCategories.date,
              endDate: eventDetailsWithCategories.endDate,
              coordinates: eventDetailsWithCategories.location.coordinates as [
                number,
                number,
              ],
              address: eventDetailsWithCategories.address,
              description: eventDetailsWithCategories.description,
              timezone: eventDetailsWithCategories.timezone,
              isRecurring: eventDetailsWithCategories.isRecurring,
              recurrenceFrequency:
                eventDetailsWithCategories.recurrenceFrequency,
              recurrenceDays: eventDetailsWithCategories.recurrenceDays,
              recurrenceTime: eventDetailsWithCategories.recurrenceTime,
            },
          );

        const isDuplicate = similarity.isDuplicate;

        if (isDuplicate && similarity.matchingEventId) {
          await this.dependencies.eventSimilarityService.handleDuplicateScan(
            similarity.matchingEventId,
          );
        }

        eventResults.push({
          confidence: event.confidence,
          eventDetails: eventDetailsWithCategories,
          similarity,
          isDuplicate: isDuplicate || false,
          qrCodeDetected: event.qrCodeDetected,
          qrCodeData: event.qrCodeData,
          embedding: finalEmbedding,
        });
      }

      return {
        events: eventResults,
        isMultiEvent: multiEventResult.isMultiEvent,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error processing multi-event flyer";

      return {
        events: [],
        isMultiEvent: false,
        extractedAt: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * Format structured data into a text format for event extraction
   * @param data Structured data from image processing
   * @returns Formatted text for event extraction
   */
  private formatStructuredData(data: EventStructuredData): string {
    const parts: string[] = [];

    if (data.title) parts.push(`Event Title: ${data.title}`);
    if (data.dateTime) parts.push(`Date and Time: ${data.dateTime}`);
    if (data.timezone) parts.push(`Timezone: ${data.timezone}`);
    if (data.venueAddress) parts.push(`VENUE ADDRESS: ${data.venueAddress}`);
    if (data.venueName) parts.push(`VENUE NAME: ${data.venueName}`);
    if (data.organizer) parts.push(`ORGANIZER: ${data.organizer}`);
    if (data.description) parts.push(`Description: ${data.description}`);
    if (data.contactInfo) parts.push(`Contact Info: ${data.contactInfo}`);
    if (data.socialMedia) parts.push(`Social Media: ${data.socialMedia}`);
    if (data.otherDetails) parts.push(`Other Details: ${data.otherDetails}`);

    // Add recurrence information
    if (data.isRecurring) {
      parts.push("Is Recurring: yes");
      if (data.recurrencePattern)
        parts.push(`Recurrence Pattern: ${data.recurrencePattern}`);
      if (data.recurrenceFrequency)
        parts.push(`Recurrence Frequency: ${data.recurrenceFrequency}`);
      if (data.recurrenceDays?.length)
        parts.push(`Recurrence Days: ${data.recurrenceDays.join(", ")}`);
      if (data.recurrenceTime)
        parts.push(`Recurrence Time: ${data.recurrenceTime}`);
      if (data.recurrenceStartDate)
        parts.push(`Recurrence Start Date: ${data.recurrenceStartDate}`);
      if (data.recurrenceEndDate)
        parts.push(`Recurrence End Date: ${data.recurrenceEndDate}`);
      if (data.recurrenceInterval)
        parts.push(`Recurrence Interval: ${data.recurrenceInterval}`);
    }

    return parts.join("\n");
  }

  /**
   * Smart processing method that detects whether an image contains multiple events
   * and routes to the appropriate processing method
   * @param imageData Buffer or string containing image data
   * @param progressCallback Optional callback for progress updates
   * @param locationContext Optional location context for better resolution
   * @param jobId Optional job ID for progress tracking
   * @returns Either a single ScanResult or MultiEventScanResult
   */
  async processEventFlyer(
    imageData: Buffer | string,
    locationContext?: LocationContext,
  ): Promise<ScanResult | MultiEventScanResult> {
    // Define total steps for this workflow

    try {
      // Step 1: Check if image contains multiple events
      const multiEventResult =
        await this.imageProcessingService.processMultiEventImage(imageData);

      // Step 2: Process based on event type
      if (multiEventResult.isMultiEvent && multiEventResult.events.length > 1) {
        return await this.processMultiEventFlyer(imageData, locationContext);
      } else {
        // If it's a single event or detection failed, process as single event
        return await this.processFlyerFromImage(imageData);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error processing event flyer";

      // Return a failed single event result
      return {
        confidence: 0,
        eventDetails: {
          emoji: "❌",
          title: "Processing Failed",
          date: new Date().toISOString(),
          address: "",
          location: { type: "Point", coordinates: [0, 0] },
          description: errorMessage,
          categories: [],
        },
        similarity: {
          score: 0,
          isDuplicate: false,
        },
        isDuplicate: false,
        qrCodeDetected: false,
        embedding: [],
        error: errorMessage,
      } as ScanResult;
    }
  }
}
