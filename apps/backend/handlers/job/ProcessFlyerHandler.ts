import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import { EventProcessingService } from "../../services/EventProcessingService";
import { EventService } from "../../services/EventService";
import { PlanService } from "../../services/PlanService";
import { StorageService } from "../../services/shared/StorageService";
import { isEventTemporalyRelevant } from "../../utils/isEventTemporalyRelevant";
import type { Point } from "geojson";

// Helper function to convert Point to [number, number]
function pointToCoordinates(point: Point): [number, number] {
  if (!point.coordinates || point.coordinates.length < 2) {
    throw new Error("Invalid Point coordinates");
  }
  return [point.coordinates[0], point.coordinates[1]];
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
      const bufferData = await context.redisService.get<Buffer>(
        `job:${jobId}:buffer`,
      );
      if (!bufferData) {
        throw new Error("Image data not found");
      }

      // Upload image
      const originalImageUrl = await this.storageService.uploadImage(
        bufferData,
        "original-flyers",
        {
          jobId: jobId,
          contentType: (job.data.contentType as string) || "image/jpeg",
          filename: (job.data.filename as string) || "event-flyer.jpg",
        },
      );

      console.log("originalImageUrl", originalImageUrl);

      // Process the image
      const scanResult =
        await this.eventProcessingService.processFlyerFromImage(
          bufferData,
          undefined, // No need for progress callback
          {
            userCoordinates: job.data.userCoordinates as
              | { lat: number; lng: number }
              | undefined,
          },
          jobId,
        );

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
        groupId: (job.data as { eventDetails?: { groupId?: string } })
          ?.eventDetails?.groupId,
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
}
