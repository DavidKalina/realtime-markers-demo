import Redis from "ioredis";
import { Event } from "../types/types";

export class EventPublisher {
  private redisPub: Redis;
  private stats = {
    totalFilteredEventsPublished: 0,
  };

  constructor(redisPub: Redis) {
    this.redisPub = redisPub;
  }

  public async publishFilteredEvents(
    userId: string,
    type: string,
    events: Event[],
  ): Promise<void> {
    try {
      // Strip sensitive data from all events
      const sanitizedEvents = events.map((event) =>
        this.stripSensitiveData(event),
      );
      const channel = `user:${userId}:filtered-events`;

      // For viewport updates, send all events in one message to replace existing ones
      if (type === "viewport") {
        const message = {
          type: "replace-all",
          events: sanitizedEvents,
          count: sanitizedEvents.length,
          timestamp: new Date().toISOString(),
        };

        // Publish the filtered events to the user's channel
        await this.redisPub.publish(channel, JSON.stringify(message));
      } else {
        // For other types (like new events), send each event individually
        for (const event of sanitizedEvents) {
          const message = {
            type: "add-event",
            event,
            timestamp: new Date().toISOString(),
          };

          // Publish the event to the user's channel
          await this.redisPub.publish(channel, JSON.stringify(message));
        }
      }

      // Update stats
      this.stats.totalFilteredEventsPublished += sanitizedEvents.length;
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
    } catch (error) {
      console.error(
        `[Publish] Error publishing update event to user ${userId}:`,
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
