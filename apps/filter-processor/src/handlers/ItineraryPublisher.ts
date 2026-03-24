import Redis from "ioredis";
import { CommunityItinerary } from "../types/types";

export class ItineraryPublisher {
  private redisPub: Redis;
  private stats = {
    totalPublished: 0,
    batchUpdatesPublished: 0,
    individualUpdatesPublished: 0,
  };

  constructor(redisPub: Redis) {
    this.redisPub = redisPub;
  }

  public async publishFilteredItineraries(
    userId: string,
    type: string,
    itineraries: CommunityItinerary[],
  ): Promise<void> {
    try {
      const sanitized = itineraries.map((it) => this.stripSensitiveData(it));
      const channel = `user:${userId}:filtered-itineraries`;

      const message = {
        type: "batch-update-itineraries",
        timestamp: new Date().toISOString(),
        updates: {
          creates:
            type === "viewport" || type === "all" ? sanitized : [],
          updates: type === "update" ? sanitized : [],
          deletes: [],
        },
        summary: {
          totalItineraries: sanitized.length,
          newItineraries:
            type === "viewport" || type === "all" ? sanitized.length : 0,
          updatedItineraries: type === "update" ? sanitized.length : 0,
          deletedItineraries: 0,
        },
      };

      await this.redisPub.publish(channel, JSON.stringify(message));

      this.stats.totalPublished += sanitized.length;
      this.stats.batchUpdatesPublished++;
    } catch (error) {
      console.error(
        `[ItineraryPublisher] Error publishing itineraries to user ${userId}:`,
        error,
      );
    }
  }

  public async publishAddItinerary(
    userId: string,
    itinerary: CommunityItinerary,
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-itineraries`;
      const message = {
        type: "add-itinerary",
        itinerary: this.stripSensitiveData(itinerary),
        timestamp: new Date().toISOString(),
      };

      await this.redisPub.publish(channel, JSON.stringify(message));
      this.stats.totalPublished++;
      this.stats.individualUpdatesPublished++;
    } catch (error) {
      console.error(
        `[ItineraryPublisher] Error publishing add itinerary to user ${userId}:`,
        error,
      );
    }
  }

  public async publishUpdateItinerary(
    userId: string,
    itinerary: CommunityItinerary,
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-itineraries`;
      const message = {
        type: "update-itinerary",
        itinerary: this.stripSensitiveData(itinerary),
        timestamp: new Date().toISOString(),
      };

      await this.redisPub.publish(channel, JSON.stringify(message));
      this.stats.totalPublished++;
      this.stats.individualUpdatesPublished++;
    } catch (error) {
      console.error(
        `[ItineraryPublisher] Error publishing update itinerary to user ${userId}:`,
        error,
      );
    }
  }

  public async publishDeleteItinerary(
    userId: string,
    itineraryId: string,
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-itineraries`;
      const message = {
        type: "delete-itinerary",
        id: itineraryId,
        timestamp: new Date().toISOString(),
      };

      await this.redisPub.publish(channel, JSON.stringify(message));
      this.stats.totalPublished++;
      this.stats.individualUpdatesPublished++;
    } catch (error) {
      console.error(
        `[ItineraryPublisher] Error publishing delete itinerary to user ${userId}:`,
        error,
      );
    }
  }

  public async publishBatchUpdate(
    userId: string,
    batchData: {
      type: string;
      timestamp: number;
      updates: {
        creates: CommunityItinerary[];
        updates: CommunityItinerary[];
        deletes: string[];
      };
      summary: {
        totalItineraries: number;
        newItineraries: number;
        updatedItineraries: number;
        deletedItineraries: number;
      };
    },
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-itineraries`;

      const message = {
        type: "batch-update-itineraries",
        timestamp: new Date().toISOString(),
        updates: {
          creates: batchData.updates.creates.map((it) =>
            this.stripSensitiveData(it),
          ),
          updates: batchData.updates.updates.map((it) =>
            this.stripSensitiveData(it),
          ),
          deletes: batchData.updates.deletes,
        },
        summary: batchData.summary,
      };

      await this.redisPub.publish(channel, JSON.stringify(message));

      this.stats.totalPublished +=
        batchData.summary.newItineraries +
        batchData.summary.updatedItineraries +
        batchData.summary.deletedItineraries;
      this.stats.batchUpdatesPublished++;
    } catch (error) {
      console.error(
        `[ItineraryPublisher] Error publishing batch update to user ${userId}:`,
        error,
      );
    }
  }

  private stripSensitiveData(
    itinerary: CommunityItinerary,
  ): Omit<CommunityItinerary, "embedding"> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding, ...rest } = itinerary;
    return rest;
  }

  public getStats(): typeof this.stats {
    return { ...this.stats };
  }
}
