import Redis from "ioredis";
import { Event, Filter, BoundingBox } from "../types/types";

export interface RedisMessageHandler {
  subscribeToChannels(): Promise<void>;
  unsubscribe(): Promise<void>;
  quit(): Promise<void>;
  getStats(): Record<string, unknown>;
}

export interface MessageHandlers {
  onFilterChanges: (userId: string, filters: Filter[]) => Promise<void>;
  onViewportUpdate: (userId: string, viewport: BoundingBox) => Promise<void>;
  onInitialRequest: (userId: string) => Promise<void>;
  onEventUpdate: (eventData: {
    operation: string;
    record: Event;
  }) => Promise<void>;
  onJobCreated: (data: {
    type: string;
    data: { jobId: string; jobType?: string };
  }) => Promise<void>;
  onJobUpdate: (data: {
    jobId: string;
    status: string;
    result?: { deletedCount?: number };
  }) => Promise<void>;
}

export interface RedisMessageHandlerConfig {
  channels?: {
    filterChanges?: string;
    viewportUpdates?: string;
    initialRequest?: string;
    eventChanges?: string;
    jobCreated?: string;
    jobUpdates?: string;
  };
}

export function createRedisMessageHandler(
  redisSub: Redis,
  handlers: MessageHandlers,
  config: RedisMessageHandlerConfig = {},
): RedisMessageHandler {
  const {
    filterChanges = "filter-changes",
    viewportUpdates = "viewport-updates",
    initialRequest = "filter-processor:request-initial",
    eventChanges = "event_changes",
    jobCreated = "job_created",
    jobUpdates = "job_updates",
  } = config.channels || {};

  // Stats for monitoring
  const stats = {
    messagesReceived: 0,
    filterChangesProcessed: 0,
    viewportUpdatesProcessed: 0,
    initialRequestsProcessed: 0,
    eventUpdatesProcessed: 0,
    jobNotificationsProcessed: 0,
    errors: 0,
  };

  /**
   * Subscribe to Redis channels
   */
  async function subscribeToChannels(): Promise<void> {
    try {
      // Subscribe to filter changes
      await redisSub.subscribe(filterChanges);

      // Subscribe to viewport updates
      await redisSub.subscribe(viewportUpdates);

      // Subscribe to initial event requests from WebSocket server
      await redisSub.subscribe(initialRequest);

      // Subscribe to raw events feed
      await redisSub.psubscribe(eventChanges);

      // Subscribe to job notifications
      await redisSub.subscribe(jobCreated);
      await redisSub.subscribe(jobUpdates);

      // Handle incoming Redis messages
      redisSub.on("message", handleRedisMessage);
      redisSub.on("pmessage", handlePatternMessage);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[RedisMessageHandler] Subscribed to Redis channels: ${filterChanges}, ${viewportUpdates}, ${initialRequest}, ${eventChanges}, ${jobCreated}, ${jobUpdates}`,
        );
      }
    } catch (error) {
      console.error(
        "[RedisMessageHandler] Error subscribing to Redis channels:",
        error,
      );
      throw error;
    }
  }

  /**
   * Handle Redis messages
   */
  async function handleRedisMessage(
    channel: string,
    message: string,
  ): Promise<void> {
    try {
      stats.messagesReceived++;
      const data = JSON.parse(message);

      switch (channel) {
        case filterChanges:
          await handlers.onFilterChanges(data.userId, data.filters);
          stats.filterChangesProcessed++;
          break;
        case viewportUpdates:
          await handlers.onViewportUpdate(data.userId, data.viewport);
          stats.viewportUpdatesProcessed++;
          break;
        case initialRequest:
          await handlers.onInitialRequest(data.userId);
          stats.initialRequestsProcessed++;
          break;
        case jobCreated:
          await handlers.onJobCreated(data);
          stats.jobNotificationsProcessed++;
          break;
        case jobUpdates:
          await handlers.onJobUpdate(data);
          stats.jobNotificationsProcessed++;
          break;
        default:
          console.warn(`[RedisMessageHandler] Unknown channel: ${channel}`);
      }
    } catch (error) {
      console.error(
        `[RedisMessageHandler] Error processing message from channel ${channel}:`,
        error,
      );
      stats.errors++;
    }
  }

  /**
   * Handle pattern messages (event changes)
   */
  async function handlePatternMessage(
    pattern: string,
    channel: string,
    message: string,
  ): Promise<void> {
    try {
      if (channel.startsWith(eventChanges)) {
        stats.messagesReceived++;
        const data = JSON.parse(message);
        const eventData = data.data || data;

        // Validate the event data
        if (!eventData.record || !eventData.record.id) {
          console.error(
            "[RedisMessageHandler] Invalid event data received:",
            data,
          );
          stats.errors++;
          return;
        }

        await handlers.onEventUpdate(eventData);
        stats.eventUpdatesProcessed++;
      }
    } catch (error) {
      console.error(
        `[RedisMessageHandler] Error handling pattern message: ${error}`,
        {
          channel,
          message,
        },
      );
      stats.errors++;
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async function unsubscribe(): Promise<void> {
    try {
      await redisSub.unsubscribe();
      if (process.env.NODE_ENV !== "production") {
        console.log("[RedisMessageHandler] Unsubscribed from all channels");
      }
    } catch (error) {
      console.error("[RedisMessageHandler] Error unsubscribing:", error);
    }
  }

  /**
   * Quit the Redis connection
   */
  async function quit(): Promise<void> {
    try {
      await redisSub.quit();
      if (process.env.NODE_ENV !== "production") {
        console.log("[RedisMessageHandler] Redis connection closed");
      }
    } catch (error) {
      console.error(
        "[RedisMessageHandler] Error closing Redis connection:",
        error,
      );
    }
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
    };
  }

  return {
    subscribeToChannels,
    unsubscribe,
    quit,
    getStats,
  };
}
