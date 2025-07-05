import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { EventService } from "../../services/EventServiceRefactored";
import type { Point } from "geojson";

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
    try {
      // Start the job and update status to processing
      await this.startJob(jobId, context, "Starting cleanup process");

      const batchSize = (job.data.batchSize as number) || 100;

      await this.updateJobProgress(jobId, context, {
        progress: 0.1,
        message: `Cleaning up outdated events (batch size: ${batchSize})`,
      });

      const result = await this.eventService.cleanupOutdatedEvents(batchSize);

      // Publish deletion notifications for each deleted event
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

      await this.completeJob(jobId, context, {
        deletedCount: result.deletedCount,
        hasMore: result.hasMore,
        deletedEvents: result.deletedEvents.map((event) => ({ id: event.id })),
      });

      // If there are more events to clean up, queue another job
      if (result.hasMore) {
        await context.jobQueue.enqueueCleanupJob(batchSize);
      }
    } catch (error) {
      await this.failJob(
        jobId,
        context,
        error instanceof Error ? error : new Error("Unknown error"),
        "Failed to clean up outdated events. The system will retry automatically.",
      );
    }
  }
}
