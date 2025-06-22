import Redis from "ioredis";
import { Event, CivicEngagement } from "../types/types";

export class EventPublisher {
  private redisPub: Redis;
  private stats = {
    totalFilteredEventsPublished: 0,
    batchUpdatesPublished: 0,
    individualUpdatesPublished: 0,
  };

  constructor(redisPub: Redis) {
    this.redisPub = redisPub;
  }

  public async publishFilteredEvents(
    userId: string,
    type: string,
    events: Event[],
    civicEngagements?: CivicEngagement[],
  ): Promise<void> {
    try {
      // Strip sensitive data from all events
      const sanitizedEvents = events.map((event) =>
        this.stripSensitiveData(event),
      );
      const channel = `user:${userId}:filtered-events`;

      // Log the publishing details
      console.log(
        `[EventPublisher] Publishing ${sanitizedEvents.length} events and ${civicEngagements?.length || 0} civic engagements to user ${userId}:`,
        {
          userId,
          type,
          channel,
          eventCount: sanitizedEvents.length,
          civicEngagementCount: civicEngagements?.length || 0,
          topEventScores: sanitizedEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
            popularityMetrics: {
              scanCount: event.scanCount,
              saveCount: event.saveCount || 0,
              rsvpCount: event.rsvps?.length || 0,
            },
          })),
        },
      );

      // Always use batch updates for multi-event publications
      const message = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: type === "viewport" || type === "all" ? sanitizedEvents : [],
          updates: type === "update" ? sanitizedEvents : [],
          deletes: [],
        },
        civicEngagements: civicEngagements || [], // Include civic engagements in the same message
        summary: {
          totalEvents: sanitizedEvents.length,
          newEvents:
            type === "viewport" || type === "all" ? sanitizedEvents.length : 0,
          updatedEvents: type === "update" ? sanitizedEvents.length : 0,
          deletedEvents: 0,
          totalCivicEngagements: civicEngagements?.length || 0,
          newCivicEngagements:
            type === "viewport" || type === "all"
              ? civicEngagements?.length || 0
              : 0,
        },
      };

      // Publish the batch update to the user's channel
      await this.redisPub.publish(channel, JSON.stringify(message));

      // Update stats
      this.stats.totalFilteredEventsPublished += sanitizedEvents.length;
      this.stats.batchUpdatesPublished++;

      console.log(
        `[EventPublisher] Published batch update to ${channel} with ${sanitizedEvents.length} events and ${civicEngagements?.length || 0} civic engagements`,
      );
    } catch (error) {
      console.error(
        `[Publish] Error publishing events to user ${userId}:`,
        error,
      );
    }
  }

  public async publishDeleteEvent(
    userId: string,
    eventId: string,
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-events`;
      const message = {
        type: "delete-event",
        id: eventId,
        timestamp: new Date().toISOString(),
      };

      await this.redisPub.publish(channel, JSON.stringify(message));
      this.stats.totalFilteredEventsPublished++;
      this.stats.individualUpdatesPublished++;
    } catch (error) {
      console.error(
        `[Publish] Error publishing delete event to user ${userId}:`,
        error,
      );
    }
  }

  public async publishUpdateEvent(userId: string, event: Event): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-events`;
      const sanitizedEvent = this.stripSensitiveData(event);
      const message = {
        type: "update-event",
        event: sanitizedEvent,
        timestamp: new Date().toISOString(),
      };

      await this.redisPub.publish(channel, JSON.stringify(message));
      this.stats.totalFilteredEventsPublished++;
      this.stats.individualUpdatesPublished++;
    } catch (error) {
      console.error(
        `[Publish] Error publishing update event to user ${userId}:`,
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
        creates: Event[];
        updates: Event[];
        deletes: string[];
      };
      summary: {
        totalEvents: number;
        newEvents: number;
        updatedEvents: number;
        deletedEvents: number;
      };
    },
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-events`;

      // Strip sensitive data from events
      const sanitizedCreates = batchData.updates.creates.map((event) =>
        this.stripSensitiveData(event),
      );
      const sanitizedUpdates = batchData.updates.updates.map((event) =>
        this.stripSensitiveData(event),
      );

      const message = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: sanitizedCreates,
          updates: sanitizedUpdates,
          deletes: batchData.updates.deletes,
        },
        summary: batchData.summary,
      };

      await this.redisPub.publish(channel, JSON.stringify(message));

      // Update stats
      this.stats.totalFilteredEventsPublished +=
        batchData.summary.newEvents +
        batchData.summary.updatedEvents +
        batchData.summary.deletedEvents;
      this.stats.batchUpdatesPublished++;

      console.log(
        `[EventPublisher] Published batch update to user ${userId}:`,
        {
          userId,
          channel,
          summary: batchData.summary,
          topEventScores: sanitizedCreates.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
          })),
        },
      );
    } catch (error) {
      console.error(
        `[Publish] Error publishing batch update to user ${userId}:`,
        error,
      );
    }
  }

  public async publishFilteredCivicEngagements(
    userId: string,
    type: string,
    civicEngagements: CivicEngagement[],
  ): Promise<void> {
    try {
      const channel = `user:${userId}:filtered-civic-engagements`;

      // Log the publishing details
      console.log(
        `[EventPublisher] Publishing ${civicEngagements.length} civic engagements to user ${userId}:`,
        {
          userId,
          type,
          channel,
          civicEngagementCount: civicEngagements.length,
          topCivicEngagementScores: civicEngagements.slice(0, 3).map((ce) => ({
            civicEngagementId: ce.id,
            title: ce.title,
            relevanceScore:
              (ce as CivicEngagement & { relevanceScore?: number })
                .relevanceScore || 0,
            status: ce.status,
          })),
        },
      );

      // Create message for civic engagements
      const message = {
        type: "civic-engagement-batch-update",
        timestamp: new Date().toISOString(),
        civicEngagements: civicEngagements,
        summary: {
          totalCivicEngagements: civicEngagements.length,
          newCivicEngagements:
            type === "viewport" || type === "all" ? civicEngagements.length : 0,
        },
      };

      // Publish to the civic engagements channel
      await this.redisPub.publish(channel, JSON.stringify(message));

      // Update stats
      this.stats.totalFilteredEventsPublished += civicEngagements.length;
      this.stats.batchUpdatesPublished++;

      console.log(
        `[EventPublisher] Published ${civicEngagements.length} civic engagements to user ${userId} on channel ${channel}`,
      );
    } catch (error) {
      console.error(
        `[Publish] Error publishing civic engagements to user ${userId}:`,
        error,
      );
    }
  }

  private stripSensitiveData(event: Event): Omit<Event, "embedding"> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding, ...eventWithoutEmbedding } = event;
    return eventWithoutEmbedding;
  }

  public getStats(): typeof this.stats {
    return { ...this.stats };
  }
}
