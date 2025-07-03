import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { EventService } from "../../services/EventServiceRefactored";
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
      // Start the job and update status to processing
      await this.startJob(jobId, context, "Starting flyer processing");

      // Step 1: Validation and Setup (15% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 15,
        progressStep: "Validating request and checking limits",
        progressDetails: {
          currentStep: "1",
          totalSteps: 6,
          stepProgress: 100,
          stepDescription: "Validating request and checking limits",
        },
      });

      // Step 2: Image Retrieval (25% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 25,
        progressStep: "Retrieving image data",
        progressDetails: {
          currentStep: "2",
          totalSteps: 6,
          stepProgress: 100,
          stepDescription: "Retrieving image data",
        },
      });

      // Get the image buffer from Redis
      const bufferData = await context.redisService.get<{ data: number[] }>(
        `job:${jobId}:buffer`,
      );
      if (!bufferData) {
        throw new Error("Image data not found");
      }

      // Convert the array back to a Buffer
      const imageBuffer = Buffer.from(bufferData.data);

      // Step 3: Image Upload (35% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 35,
        progressStep: "Uploading image to storage",
        progressDetails: {
          currentStep: "3",
          totalSteps: 6,
          stepProgress: 100,
          stepDescription: "Uploading image to storage",
        },
      });

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

      // Step 4: Image Processing (50% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 50,
        progressStep: "Analyzing image content",
        progressDetails: {
          currentStep: "4",
          totalSteps: 6,
          stepProgress: 0,
          stepDescription: "Analyzing image content",
        },
      });

      // Process the image using smart processing with progress callback
      const scanResult = await this.eventProcessingService.processEventFlyer(
        imageBuffer,
        {
          userCoordinates: job.data.userCoordinates as
            | { lat: number; lng: number }
            | undefined,
        },
        // Progress callback for AI processing
        (aiProgress: number, aiStep: string) => {
          // Map AI progress (0-100) to our step progress (50-60)
          const mappedProgress = 50 + (aiProgress / 100) * 10;
          const roundedProgress = Math.round(mappedProgress);
          console.log(
            `[ProcessFlyerHandler] AI Progress: ${aiProgress}% - ${aiStep} -> ${mappedProgress}% (rounded: ${roundedProgress}%)`,
          );

          this.updateJobProgress(jobId, context, {
            progress: roundedProgress,
            progressStep: `AI Processing: ${aiStep}`,
            progressDetails: {
              currentStep: "4",
              totalSteps: 6,
              stepProgress: aiProgress,
              stepDescription: `AI Processing: ${aiStep}`,
            },
          }).catch((error) => {
            console.error("Error updating AI progress:", error);
          });
        },
      );

      console.log("[ProcessFlyerHandler] AI processing complete, scanResult:", {
        hasEvents: "events" in scanResult,
        confidence: "confidence" in scanResult ? scanResult.confidence : "N/A",
        isMultiEvent: "events" in scanResult ? scanResult.isMultiEvent : "N/A",
      });

      // Step 4b: Image Processing Complete (60% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 60,
        progressStep: "Image analysis complete",
        progressDetails: {
          currentStep: "4",
          totalSteps: 6,
          stepProgress: 100,
          stepDescription: "Image analysis complete",
        },
      });

      console.log("[ProcessFlyerHandler] Moving to Step 5: Event Processing");

      // Step 5: Event Processing (75% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 75,
        progressStep: "Processing event details",
        progressDetails: {
          currentStep: "5",
          totalSteps: 6,
          stepProgress: 100,
          stepDescription: "Processing event details",
        },
      });

      console.log(
        "[ProcessFlyerHandler] Step 5 complete, checking for multi-event result",
      );

      // Handle multi-event result
      if ("events" in scanResult) {
        console.log(
          `[ProcessFlyerHandler] Processing multi-event result with ${scanResult.events.length} events`,
        );
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

      console.log("[ProcessFlyerHandler] Processing single event result");

      // Handle single event result (existing logic)
      // Check confidence score
      if (scanResult.confidence < 0.75) {
        console.log(
          `[ProcessFlyerHandler] Low confidence (${scanResult.confidence}), completing with warning`,
        );
        await this.completeJob(jobId, context, {
          message: "No event detected in the image",
          confidence: scanResult.confidence,
          threshold: 0.75,
        });
        return;
      }

      console.log(
        "[ProcessFlyerHandler] Step 5 complete, checking for duplicates",
      );

      // Check for duplicates
      if (scanResult.isDuplicate && scanResult.similarity.matchingEventId) {
        console.log(
          "[ProcessFlyerHandler] Duplicate event found, linking to existing event",
        );
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
              message: "Duplicate event found",
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
        console.log(
          "[ProcessFlyerHandler] Invalid event date, completing with error",
        );
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

      console.log("[ProcessFlyerHandler] Moving to Step 6: Event Creation");

      // Step 6: Event Creation (90% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 90,
        progressStep: "Creating event in database",
        progressDetails: {
          currentStep: "6",
          totalSteps: 6,
          stepProgress: 100,
          stepDescription: "Creating event in database",
        },
      });

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
