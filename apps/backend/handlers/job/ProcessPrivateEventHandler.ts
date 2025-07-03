import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { EventService } from "../../services/EventServiceRefactored";
import type { Point } from "geojson";
import AppDataSource from "../../data-source";
import { User } from "../../entities/User";
import { Category } from "../../entities/Category";
import { In } from "typeorm";

interface PrivateEventDetails {
  emoji: string;
  emojiDescription?: string;
  title: string;
  date: string;
  endDate?: string;
  address: string;
  location: Point;
  description: string;
  categories?: { id: string }[];
  timezone?: string;
  locationNotes?: string;
  isPrivate: boolean;
  sharedWithIds?: string[];
}

// Helper function to convert Point to [number, number]
function pointToCoordinates(point: Point): [number, number] {
  if (!point.coordinates || point.coordinates.length < 2) {
    throw new Error("Invalid Point coordinates");
  }
  return [point.coordinates[0], point.coordinates[1]];
}

export class ProcessPrivateEventHandler extends BaseJobHandler {
  readonly jobType = "process_private_event";

  constructor(
    private readonly eventProcessingService: EventProcessingService,
    private readonly eventService: EventService,
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
      await this.startJob(jobId, context, "Starting private event processing");

      // Step 1: Validation (25% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 25,
        progressStep: "Validating event details",
        progressDetails: {
          currentStep: "1",
          totalSteps: 4,
          stepProgress: 100,
          stepDescription: "Validating event details",
        },
      });

      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (job.data.creatorId && !uuidRegex.test(job.data.creatorId as string)) {
        await this.failJob(
          jobId,
          context,
          "Invalid creator ID format",
          "The creator ID is not in a valid UUID format.",
        );
        return;
      }

      // Check if creator exists
      if (job.data.creatorId) {
        const creator = await AppDataSource.getRepository(User).findOne({
          where: { id: job.data.creatorId as string },
        });

        if (!creator) {
          await this.failJob(
            jobId,
            context,
            "Creator not found",
            "The specified creator does not exist in the system.",
          );
          return;
        }
      }

      // Validate shared user IDs if present
      if (job.data.sharedWithIds) {
        const sharedWithIds = job.data.sharedWithIds as string[];
        for (const userId of sharedWithIds) {
          if (!uuidRegex.test(userId)) {
            await this.failJob(
              jobId,
              context,
              "Invalid shared user ID format",
              `The shared user ID ${userId} is not in a valid UUID format.`,
            );
            return;
          }
        }
      }

      // Step 2: Category Processing (50% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 50,
        progressStep: "Processing event categories",
        progressDetails: {
          currentStep: "2",
          totalSteps: 4,
          stepProgress: 100,
          stepDescription: "Processing event categories",
        },
      });

      // Process the private event
      const eventDetails = job.data.eventDetails as PrivateEventDetails;

      console.log(`[ProcessPrivateEventHandler] Processing job ${jobId}`);
      console.log(
        `[ProcessPrivateEventHandler] Original emoji: ${eventDetails.emoji}`,
      );

      // Fetch full category objects if category IDs are provided
      let categories: Category[] | undefined;
      if (eventDetails.categories?.length) {
        categories = await AppDataSource.getRepository(Category).findBy({
          id: In(eventDetails.categories.map((cat) => cat.id)),
        });
      }

      // Step 3: Duplicate Check (75% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 75,
        progressStep: "Checking for duplicate events",
        progressDetails: {
          currentStep: "3",
          totalSteps: 4,
          stepProgress: 100,
          stepDescription: "Checking for duplicate events",
        },
      });

      const scanResult = await this.eventProcessingService.processPrivateEvent({
        ...eventDetails,
        categories,
        isPrivate: true,
        sharedWithIds: (job.data.sharedWithIds as string[]) || [],
      });

      console.log(
        `[ProcessPrivateEventHandler] Processed emoji: ${scanResult.eventDetails.emoji}`,
      );

      // Step 4: Event Creation (90% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 90,
        progressStep: "Creating private event",
        progressDetails: {
          currentStep: "4",
          totalSteps: 4,
          stepProgress: 100,
          stepDescription: "Creating private event",
        },
      });

      // Create the event
      const newEvent = await this.eventService.createEvent({
        emoji: scanResult.eventDetails.emoji,
        emojiDescription: scanResult.eventDetails.emojiDescription,
        title: scanResult.eventDetails.title,
        eventDate: new Date(scanResult.eventDetails.date),
        endDate: scanResult.eventDetails.endDate
          ? new Date(scanResult.eventDetails.endDate)
          : undefined,
        location: scanResult.eventDetails.location,
        description: scanResult.eventDetails.description,
        confidenceScore: scanResult.confidence,
        address: scanResult.eventDetails.address,
        locationNotes: scanResult.eventDetails.locationNotes || "",
        categoryIds: scanResult.eventDetails.categories?.map((cat) => cat.id),
        creatorId: job.data.creatorId as string,
        embedding: scanResult.embedding,
        isPrivate: true,
        sharedWithIds: (job.data.sharedWithIds as string[]) || [],
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
      const result = {
        eventId: newEvent.id,
        title: scanResult.eventDetails.title,
        emoji: scanResult.eventDetails.emoji,
        coordinates: pointToCoordinates(newEvent.location),
        message: "Private event successfully created!",
      };

      console.log(
        `[ProcessPrivateEventHandler] Job result emoji: ${result.emoji}`,
      );

      await this.completeJob(jobId, context, result, newEvent.id);
    } catch (error) {
      await this.failJob(
        jobId,
        context,
        error instanceof Error ? error : new Error("Unknown error"),
        "We encountered an error while processing your private event. Please try again or contact support if the issue persists.",
      );
    }
  }
}
