import { EventSource, EventStatus } from "@realtime-markers/database";
import type { EventDigest } from "@realtime-markers/database";
import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { EventService } from "../../services/EventServiceRefactored";
import type { TicketmasterService } from "../../services/TicketmasterService";
import type { CategoryProcessingService } from "../../services/CategoryProcessingService";
import type { IEmbeddingService } from "../../services/event-processing/interfaces/IEmbeddingService";
import {
  resolveTicketmasterCategories,
  getSegmentEmoji,
} from "../../services/TicketmasterCategoryMap";
import {
  createJobTracker,
  IMPORT_PIPELINE,
} from "../../services/shared/JobPipeline";
import { jobNotificationService } from "../../services/JobNotificationService";

const REDIS_DEDUP_PREFIX = "external:ticketmaster:";
const REDIS_DEDUP_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

export class ImportEventsHandler extends BaseJobHandler {
  readonly jobType = "import_external_events";

  constructor(
    private readonly eventService: EventService,
    private readonly ticketmasterService: TicketmasterService,
    private readonly categoryProcessingService: CategoryProcessingService,
    private readonly embeddingService: IEmbeddingService,
  ) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    const tracker = createJobTracker(jobId, IMPORT_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: jobNotificationService,
    });

    try {
      const latitude = job.data.latitude as number;
      const longitude = job.data.longitude as number;
      const radiusKm = (job.data.radiusKm as number) || 50;

      // Step 1: Fetch events from Ticketmaster
      await tracker.step("fetch");
      const tmEvents = await this.ticketmasterService.searchEvents({
        latitude,
        longitude,
        radiusKm,
      });
      console.log(
        `[ImportEventsHandler] Fetched ${tmEvents.length} events from Ticketmaster`,
      );

      // Step 2: Deduplicate against already-imported events
      await tracker.step("deduplicate");
      const newEvents = [];
      for (const tmEvent of tmEvents) {
        const dedupKey = `${REDIS_DEDUP_PREFIX}${tmEvent.externalId}`;
        const existing = await context.redisService.get(dedupKey);
        if (!existing) {
          newEvents.push(tmEvent);
        }
      }
      console.log(
        `[ImportEventsHandler] ${newEvents.length} new events after dedup (${tmEvents.length - newEvents.length} already imported)`,
      );

      if (newEvents.length === 0) {
        await tracker.step("create");
        await tracker.step("notify");
        await tracker.complete({
          message: "All events already imported",
          importedCount: 0,
          fetchedCount: tmEvents.length,
          skippedCount: tmEvents.length,
        });
        return;
      }

      // Step 3: Create events
      await tracker.step("create");
      let importedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < newEvents.length; i++) {
        const tmEvent = newEvents[i];
        try {
          // Resolve categories from TM classifications
          const categoryNames = resolveTicketmasterCategories(
            tmEvent.classifications,
          );
          const categories =
            await this.categoryProcessingService.getOrCreateCategories(
              categoryNames,
            );
          const categoryIds = categories.map((c) => c.id);

          // Generate embedding (raw number[] — lifecycle service calls pgvector.toSql)
          const embedding =
            await this.embeddingService.getStructuredEmbedding({
              title: tmEvent.title,
              text: tmEvent.description || tmEvent.title,
              date: tmEvent.eventDate,
              endDate: tmEvent.endDate,
              coordinates: [tmEvent.longitude, tmEvent.latitude],
              address: tmEvent.address,
              timezone: tmEvent.timezone,
            });

          // Choose emoji based on TM segment
          const emoji = getSegmentEmoji(tmEvent.classifications);

          // Build a digest from the available Ticketmaster data
          const digest: EventDigest = {
            summary: tmEvent.description
              ? tmEvent.description.length > 200
                ? tmEvent.description.slice(0, 197) + "..."
                : tmEvent.description
              : `${tmEvent.title} at ${tmEvent.venueName || tmEvent.address || "TBA"}.`,
            cost: null,
            highlights: tmEvent.venueName
              ? [`Venue: ${tmEvent.venueName}`]
              : null,
            contact: null,
          };

          // Create event through the standard service
          await this.eventService.createEvent({
            title: tmEvent.title,
            description: tmEvent.description,
            eventDate: tmEvent.eventDate,
            endDate: tmEvent.endDate,
            timezone: tmEvent.timezone,
            location: {
              type: "Point",
              coordinates: [tmEvent.longitude, tmEvent.latitude],
            },
            address: tmEvent.address,
            city: tmEvent.city,
            emoji,
            embedding: embedding as unknown as string,
            source: EventSource.TICKETMASTER,
            externalId: tmEvent.externalId,
            isOfficial: true,
            status: EventStatus.VERIFIED,
            confidenceScore: 1.0,
            categoryIds,
            originalImageUrl: tmEvent.imageUrl,
            externalUrl: tmEvent.url,
            eventDigest: digest,
            // These fields don't apply to imported events
            hasQrCode: false,
            qrDetectedInImage: false,
            isRecurring: false,
          });

          // Set Redis dedup key with 30-day TTL
          await context.redisService.set(
            `${REDIS_DEDUP_PREFIX}${tmEvent.externalId}`,
            "1",
            REDIS_DEDUP_TTL,
          );

          importedCount++;

          // Update step progress
          await tracker.stepProgress(
            Math.round(((i + 1) / newEvents.length) * 100),
            `Imported ${importedCount}/${newEvents.length} events`,
          );
        } catch (error) {
          // Continue on per-event errors — don't fail the whole batch
          errorCount++;
          console.error(
            `[ImportEventsHandler] Error importing event "${tmEvent.title}" (${tmEvent.externalId}):`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      // Step 4: Complete with stats
      await tracker.step("notify");

      console.log(
        `[ImportEventsHandler] Import complete: ${importedCount} imported, ${errorCount} errors, ${tmEvents.length - newEvents.length} skipped (dedup)`,
      );

      await tracker.complete({
        message: `Imported ${importedCount} events from Ticketmaster`,
        importedCount,
        fetchedCount: tmEvents.length,
        skippedCount: tmEvents.length - newEvents.length,
        errorCount,
      });
    } catch (error) {
      await tracker.fail(
        error instanceof Error ? error.message : "Unknown error",
        "Failed to import external events. The system will retry automatically.",
      );
    }
  }
}
