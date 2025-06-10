import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import { EventProcessingService } from "../../services/EventProcessingService";
import { EventService } from "../../services/EventService";
import { PlanService } from "../../services/PlanService";
import { StorageService } from "../../services/shared/StorageService";
import { isEventTemporalyRelevant } from "../../utils/isEventTemporalyRelevant";
import type { Point } from "geojson";
import type { MultiEventScanResult } from "../../services/EventProcessingService";
import type { Event } from "../../entities/Event";
import type { Category } from "../../entities/Category";

// Helper function to convert Point to [number, number]
function pointToCoordinates(point: Point): [number, number] {
  return [point.coordinates[0], point.coordinates[1]];
}

interface ProcessedEvent extends Omit<Event, "location"> {
  isDuplicate?: boolean;
  confidenceScore?: number;
  location: Point;
}

// Utility to safely parse date strings or return undefined (NULL for DB)
function parseDateOrNull(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

export class ProcessFlyerHandler extends BaseJobHandler {
  readonly jobType = "process_flyer";

  constructor(
    private readonly eventProcessingService: EventProcessingService,
    private readonly eventService: EventService,
    private readonly planService: PlanService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    try {
      // Check if user has reached their scan limit
      if (job.data.creatorId) {
        const hasReachedLimit = await this.planService.hasReachedScanLimit(
          job.data.creatorId as string,
        );
        if (hasReachedLimit) {
          await this.failJob(
            jobId,
            context,
            "Scan limit reached",
            "You have reached your weekly scan limit. Please upgrade to Pro for more scans.",
          );
          return;
        }
      }

      // Get the image buffer from Redis
      const bufferData = await context.redisService.get<{ data: number[] }>(
        `job:${jobId}:buffer`,
      );
      if (!bufferData) {
        throw new Error("Image data not found");
      }

      // Convert the array back to a Buffer
      const imageBuffer = Buffer.from(bufferData.data);

      // Upload image
      const originalImageUrl = await this.storageService.uploadImage(
        imageBuffer,
        "original-flyers",
        {
          jobId: jobId,
          contentType: (job.data.contentType as string) || "image/jpeg",
          filename: (job.data.filename as string) || "event-flyer.jpg",
        },
      );

      console.log("originalImageUrl", originalImageUrl);

      // Process the image using smart processing
      const scanResult = await this.eventProcessingService.processEventFlyer(
        imageBuffer,
        {
          userCoordinates: job.data.userCoordinates as
            | { lat: number; lng: number }
            | undefined,
        },
      );

      // Handle multi-event result
      if ("events" in scanResult) {
        // Process each event from the multi-event result
        const processedEvents = await this.processMultiEventResult(
          scanResult,
          jobId,
          context,
          job.data.creatorId as string | undefined,
          originalImageUrl,
        );

        // Mark as completed with success for multi-event
        await this.completeJob(
          jobId,
          context,
          {
            events: processedEvents.map((event) => ({
              eventId: event.id,
              title: event.title,
              emoji: event.emoji,
              coordinates: pointToCoordinates(event.location),
              confidence: event.confidenceScore,
              isDuplicate: event.isDuplicate,
            })),
            message: `Successfully processed ${processedEvents.length} events from the flyer!`,
            isMultiEvent: true,
          },
          processedEvents.map((e) => e.id).join(","),
        );
        return;
      }

      // Handle single event result (existing logic)
      // Check confidence score
      if (scanResult.confidence < 0.75) {
        await this.completeJob(jobId, context, {
          message:
            "The image quality or content was not clear enough to reliably extract event information. Please try again with a clearer image.",
          confidence: scanResult.confidence,
          threshold: 0.75,
        });
        return;
      }

      // Check for duplicates
      if (scanResult.isDuplicate && scanResult.similarity.matchingEventId) {
        const existingEvent = await this.eventService.getEventById(
          scanResult.similarity.matchingEventId,
        );

        if (existingEvent) {
          await this.completeJob(
            jobId,
            context,
            {
              eventId: existingEvent.id,
              title: existingEvent.title,
              emoji: existingEvent.emoji,
              coordinates: pointToCoordinates(existingEvent.location),
              isDuplicate: true,
              similarityScore: scanResult.similarity.score,
              message:
                "This event appears to be very similar to an existing event in our database. We've linked you to the existing event instead.",
            },
            existingEvent.id,
          );
          return;
        } else {
          throw new Error(
            `Matching event ${scanResult.similarity.matchingEventId} not found`,
          );
        }
      }

      // Create the event if confidence is high enough
      const eventDetails = scanResult.eventDetails;
      const eventDate = new Date(eventDetails.date);

      // Validate the event date
      const dateValidation = isEventTemporalyRelevant(eventDate);
      if (!dateValidation.valid) {
        await this.completeJob(jobId, context, {
          message:
            dateValidation.daysFromNow !== undefined &&
            dateValidation.daysFromNow < 0
              ? "This event appears to be in the past. We only process upcoming events."
              : dateValidation.reason,
          daysFromNow: dateValidation.daysFromNow,
          date: eventDate.toISOString(),
          confidence: scanResult.confidence,
        });
        return;
      }

      // Create the event
      console.log(
        "[ProcessFlyerHandler] Creating event with emoji:",
        eventDetails.emoji,
      );
      const newEvent = await this.eventService.createEvent({
        emoji: eventDetails.emoji,
        emojiDescription: eventDetails.emojiDescription,
        title: eventDetails.title,
        eventDate: new Date(eventDetails.date),
        endDate: eventDetails.endDate
          ? new Date(eventDetails.endDate)
          : undefined,
        location: eventDetails.location,
        description: eventDetails.description,
        confidenceScore: scanResult.confidence,
        address: eventDetails.address,
        locationNotes: eventDetails.locationNotes || "",
        categoryIds: eventDetails.categories?.map((cat) => cat.id),
        creatorId: job.data.creatorId as string,
        qrDetectedInImage: scanResult.qrCodeDetected || false,
        detectedQrData: scanResult.qrCodeData,
        originalImageUrl: originalImageUrl,
        embedding: scanResult.embedding,
        isRecurring: eventDetails.isRecurring,
        recurrenceFrequency: eventDetails.recurrenceFrequency,
        recurrenceDays: eventDetails.recurrenceDays,
        recurrenceTime: eventDetails.recurrenceTime,
        recurrenceStartDate: parseDateOrNull(eventDetails.recurrenceStartDate),
        recurrenceEndDate: parseDateOrNull(eventDetails.recurrenceEndDate),
        recurrenceInterval: eventDetails.recurrenceInterval || 1,
      });

      // Create discovery record if creator exists
      if (job.data.creatorId) {
        await this.eventService.createDiscoveryRecord(
          job.data.creatorId as string,
          newEvent.id,
        );
      }

      // Get the shares for the event to include in notifications
      const eventShares = await this.eventService.getEventShares(newEvent.id);

      // Publish notifications
      const eventChangeMessage = {
        operation: "INSERT",
        record: {
          ...newEvent,
          coordinates: pointToCoordinates(newEvent.location),
          ...(newEvent.isPrivate && { sharedWith: eventShares }),
        },
      };

      await context.redisService
        .getClient()
        .publish("event_changes", JSON.stringify(eventChangeMessage));

      await context.redisService.publish("discovered_events", {
        type: "EVENT_DISCOVERED",
        data: {
          event: {
            ...newEvent,
            coordinates: pointToCoordinates(newEvent.location),
            ...(newEvent.isPrivate && { sharedWith: eventShares }),
          },
          timestamp: new Date().toISOString(),
        },
      });

      // Mark as completed with success
      await this.completeJob(
        jobId,
        context,
        {
          eventId: newEvent.id,
          title: eventDetails.title,
          emoji: eventDetails.emoji,
          coordinates: pointToCoordinates(newEvent.location),
          message: "Event successfully processed and added to the database!",
        },
        newEvent.id,
      );
    } catch (error) {
      await this.failJob(
        jobId,
        context,
        error instanceof Error ? error : new Error("Unknown error"),
        "We encountered an error while processing your event. Please try again with a different image or contact support if the issue persists.",
      );
    } finally {
      // Clean up the buffer data
      await context.redisService.del(`job:${jobId}:buffer`);
    }
  }

  /**
   * Process multiple events from a multi-event scan result
   * @param scanResult The multi-event scan result
   * @param jobId The job ID
   * @param context The job handler context
   * @param creatorId Optional creator ID
   * @param originalImageUrl The URL of the original image
   * @returns Array of processed events
   */
  private async processMultiEventResult(
    scanResult: MultiEventScanResult,
    jobId: string,
    context: JobHandlerContext,
    creatorId?: string,
    originalImageUrl?: string | null,
  ): Promise<ProcessedEvent[]> {
    const processedEvents: ProcessedEvent[] = [];

    for (const eventResult of scanResult.events) {
      // Skip low confidence events
      if (eventResult.confidence < 0.75) {
        console.warn(
          `Skipping event due to low confidence: ${eventResult.confidence}`,
        );
        continue;
      }

      // Check for duplicates
      if (eventResult.isDuplicate && eventResult.similarity.matchingEventId) {
        const existingEvent = await this.eventService.getEventById(
          eventResult.similarity.matchingEventId,
        );

        if (existingEvent) {
          processedEvents.push({
            ...existingEvent,
            isDuplicate: true,
            confidenceScore: eventResult.confidence,
          } as ProcessedEvent);
          continue;
        }
      }

      // Validate event date
      const eventDate = new Date(eventResult.eventDetails.date);
      const dateValidation = isEventTemporalyRelevant(eventDate);
      if (!dateValidation.valid) {
        console.warn(
          `Skipping event due to invalid date: ${dateValidation.reason}`,
        );
        continue;
      }

      // Create the event
      console.log(
        "[ProcessFlyerHandler] Creating multi-event with emoji:",
        eventResult.eventDetails.emoji,
      );
      const newEvent = await this.eventService.createEvent({
        emoji: eventResult.eventDetails.emoji,
        emojiDescription: eventResult.eventDetails.emojiDescription,
        title: eventResult.eventDetails.title || "Untitled Event",
        eventDate: new Date(eventResult.eventDetails.date),
        endDate: eventResult.eventDetails.endDate
          ? new Date(eventResult.eventDetails.endDate)
          : undefined,
        location: eventResult.eventDetails.location,
        description: eventResult.eventDetails.description,
        confidenceScore: eventResult.confidence,
        address: eventResult.eventDetails.address,
        locationNotes: eventResult.eventDetails.locationNotes || "",
        categoryIds:
          eventResult.eventDetails.categories?.map((cat: Category) => cat.id) ||
          [],
        creatorId: creatorId || "", // Use empty string as fallback since it's required
        qrDetectedInImage: eventResult.qrCodeDetected || false,
        detectedQrData: eventResult.qrCodeData,
        originalImageUrl: originalImageUrl || undefined,
        embedding: eventResult.embedding,
      });

      // Create discovery record if creator exists
      if (creatorId) {
        await this.eventService.createDiscoveryRecord(creatorId, newEvent.id);
      }

      // Get the shares for the event
      const eventShares = await this.eventService.getEventShares(newEvent.id);

      // Publish notifications
      const eventChangeMessage = {
        operation: "INSERT",
        record: {
          ...newEvent,
          coordinates: pointToCoordinates(newEvent.location),
          ...(newEvent.isPrivate && { sharedWith: eventShares }),
        },
      };

      await context.redisService
        .getClient()
        .publish("event_changes", JSON.stringify(eventChangeMessage));

      await context.redisService.publish("discovered_events", {
        type: "EVENT_DISCOVERED",
        data: {
          event: {
            ...newEvent,
            coordinates: pointToCoordinates(newEvent.location),
            ...(newEvent.isPrivate && { sharedWith: eventShares }),
          },
          timestamp: new Date().toISOString(),
        },
      });

      processedEvents.push(newEvent as ProcessedEvent);
    }

    return processedEvents;
  }
}
