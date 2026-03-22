import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { ItineraryService } from "../../services/ItineraryService";
import type { RedisService } from "../../services/shared/RedisService";
import type { DataSource } from "typeorm";

/**
 * Job handler that generates a single itinerary and auto-publishes it.
 * Used by the seed pipeline to populate districts with varied content.
 */
export class SeedItineraryHandler extends BaseJobHandler {
  readonly jobType = "seed_itinerary";

  constructor(
    private readonly itineraryService: ItineraryService,
    private readonly dataSource: DataSource,
    private readonly redisService?: RedisService,
  ) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    _context: JobHandlerContext,
  ): Promise<void> {
    const {
      userId,
      city,
      plannedDate,
      budgetMin,
      budgetMax,
      durationHours,
      activityTypes,
      stopCount,
      intention,
      surpriseMe,
      timezone,
    } = job.data as {
      userId: string;
      city: string;
      plannedDate: string;
      budgetMin: number;
      budgetMax: number;
      durationHours: number;
      activityTypes: string[];
      stopCount: number;
      intention?: string;
      surpriseMe?: boolean;
      timezone?: string;
    };

    try {
      console.log(
        `[SeedItinerary] Generating for ${city}: ${activityTypes.join("+")} / ${intention || "any"} / ${durationHours}h`,
      );

      const itinerary = await this.itineraryService.create(userId, {
        city,
        plannedDate: new Date(plannedDate),
        budgetMin,
        budgetMax,
        durationHours,
        activityTypes,
        stopCount,
        intention,
        surpriseMe,
        timezone,
      });

      // Auto-publish: set isPublished + a default rating
      await this.dataSource.query(
        `UPDATE itineraries
         SET is_published = true, rating = 4, completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [itinerary.id],
      );

      // Notify district clustering via Redis pub/sub
      // Delay to let async enhancements (embedding, entry point) complete
      if (this.redisService) {
        const redis = this.redisService;
        const ds = this.dataSource;
        const itId = itinerary.id;
        setTimeout(async () => {
          try {
            const [row] = await ds.query(
              `SELECT entry_latitude, entry_longitude FROM itineraries WHERE id = $1`,
              [itId],
            );
            const changePayload = JSON.stringify({
              operation: "CREATE",
              record: {
                id: itId,
                city,
                entryLatitude: row?.entry_latitude,
                entryLongitude: row?.entry_longitude,
              },
              timestamp: new Date().toISOString(),
            });
            await redis.getClient().publish("itinerary_changes", changePayload);
          } catch (err) {
            console.error("[SeedItinerary] Failed to publish change:", err);
          }
        }, 15_000); // 15s delay for enhancements to finish
      }

      console.log(
        `[SeedItinerary] Published "${itinerary.title}" in ${city} (${itinerary.items?.length ?? 0} stops)`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SeedItinerary] Failed for ${city}:`, message);
    }
  }
}
