import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { EventService } from "../../services/EventServiceRefactored";
import type { Point } from "geojson";
import {
  createJobTracker,
  CLEANUP_PIPELINE,
} from "../../services/shared/JobPipeline";
import { jobNotificationService } from "../../services/JobNotificationService";

// Helper function to convert Point to [number, number]
function pointToCoordinates(point: Point): [number, number] {
  if (!point.coordinates || point.coordinates.length < 2) {
    throw new Error("Invalid Point coordinates");
  }
  return [point.coordinates[0], point.coordinates[1]];
}

export class CleanupEventsHandler extends BaseJobHandler {
  readonly jobType = "cleanup_outdated_events";

  constructor(private readonly eventService: EventService) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    const tracker = createJobTracker(jobId, CLEANUP_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: jobNotificationService,
    });

    try {
      const batchSize = (job.data.batchSize as number) || 100;

      // Step 1: Find outdated events
      await tracker.step("query");

      const result = await this.eventService.cleanupOutdatedEvents(batchSize);

      // Step 2: Publish deletion notifications
      await tracker.step("delete");

      for (const deletedEvent of result.deletedEvents) {
        await context.redisService.publish("event_changes", {
          type: "DELETE",
          data: {
            operation: "DELETE",
            record: {
              id: deletedEvent.id,
              location: deletedEvent.location,
              coordinates: pointToCoordinates(deletedEvent.location),
            },
          },
        });
      }

      // Step 3: Complete and notify
      await tracker.step("notify");

      await tracker.complete({
        deletedCount: result.deletedCount,
        hasMore: result.hasMore,
        deletedEvents: result.deletedEvents.map((event) => ({ id: event.id })),
      });

      // If there are more events to clean up, queue another job
      if (result.hasMore) {
        await context.jobQueue.enqueueCleanupJob(batchSize);
      }
    } catch (error) {
      await tracker.fail(
        error instanceof Error ? error.message : "Unknown error",
        "Failed to clean up outdated events. The system will retry automatically.",
      );
    }
  }
}
