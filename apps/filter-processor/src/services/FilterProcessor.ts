// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import RBush from "rbush";
import { Filter, BoundingBox, SpatialItem, Event } from "../types/types";
import { EventProcessor } from "../handlers/EventProcessor";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventPublisher } from "../handlers/EventPublisher";

/**
 * FilterProcessor is responsible for maintaining active filter sets for connected users,
 * applying both attribute and spatial filters to events, and publishing filtered events
 * to user-specific channels.
 */
export class FilterProcessor {
  // Redis clients for pub/sub
  private redisPub: Redis;
  private redisSub: Redis;

  // PostgreSQL connection

  // In-memory state
  private userFilters = new Map<string, Filter[]>();
  private userViewports = new Map<string, BoundingBox>();
  private spatialIndex = new RBush<SpatialItem>();
  private eventCache = new Map<string, Event>();

  // Handlers
  private eventProcessor: EventProcessor;
  private filterMatcher: FilterMatcher;
  private viewportProcessor: ViewportProcessor;
  private eventPublisher: EventPublisher;

  // Stats for monitoring
  private stats = {
    eventsProcessed: 0,
    filterChangesProcessed: 0,
    viewportUpdatesProcessed: 0,
    totalFilteredEventsPublished: 0,
  };

  constructor(redisPub: Redis, redisSub: Redis) {
    this.redisPub = redisPub;
    this.redisSub = redisSub;

    // Initialize handlers
    this.eventProcessor = new EventProcessor(
      this.spatialIndex,
      this.eventCache,
    );
    this.filterMatcher = new FilterMatcher();
    this.viewportProcessor = new ViewportProcessor(
      redisPub,
      this.spatialIndex,
      this.eventCache,
    );
    this.eventPublisher = new EventPublisher(redisPub);
  }

  /**
   * Initialize the filter processor service.
   */
  public async initialize(): Promise<void> {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("Initializing Filter Processor...");
      }

      // Initialize the spatial index with existing events
      await this.initializeSpatialIndex();

      // Subscribe to Redis channels
      await this.subscribeToChannels();

      if (process.env.NODE_ENV !== "production") {
        console.log("Filter Processor initialized:", {
          events: this.spatialIndex.all().length,
          users: this.userFilters.size,
        });
      }
    } catch (error) {
      console.error("Error initializing Filter Processor:", error);
      throw error;
    }
  }

  /**
   * Gracefully shut down the filter processor.
   */
  public async shutdown(): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      console.log("Shutting down Filter Processor...");
      console.log("Final stats:", {
        ...this.stats,
        ...this.eventPublisher.getStats(),
      });
    }

    // Clean up Redis subscribers
    await this.redisSub.unsubscribe();
    await this.redisSub.quit();
    await this.redisPub.quit();
  }

  /**
   * Get current statistics for the filter processor.
   */
  public getStats(): typeof this.stats &
    ReturnType<typeof this.eventPublisher.getStats> {
    return {
      ...this.stats,
      ...this.eventPublisher.getStats(),
    };
  }

  /**
   * Initialize the spatial index with existing events from API or database.
   */
  private async initializeSpatialIndex(): Promise<void> {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("Initializing spatial index...");
      }

      // Clear existing cache and spatial index
      this.eventCache.clear();
      this.spatialIndex.clear();

      if (process.env.NODE_ENV !== "production") {
        console.log("[Cache] Cleared existing cache and spatial index");
      }

      // Fetch events from the API or database
      const events = await this.fetchAllEvents();

      if (process.env.NODE_ENV !== "production") {
        console.log(`Received ${events.length} events for initialization`);
      }

      // Filter out events without valid coordinates
      const validEvents = events.filter((event) => {
        if (
          !event.location?.coordinates ||
          !Array.isArray(event.location.coordinates) ||
          event.location.coordinates.length !== 2
        ) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `Event ${event.id} has invalid coordinates:`,
              event.location,
            );
          }
          return false;
        }
        return true;
      });

      if (
        process.env.NODE_ENV !== "production" &&
        validEvents.length < events.length
      ) {
        console.warn(
          `Filtered out ${events.length - validEvents.length} events with invalid coordinates`,
        );
      }

      // Format for RBush
      const items = validEvents.map((event) => this.eventToSpatialItem(event));

      // Bulk load for performance
      this.spatialIndex.load(items);

      // Cache the full events
      validEvents.forEach((event) => {
        this.eventCache.set(event.id, event);
      });
    } catch (error) {
      console.error("Error initializing spatial index:", error);
      throw error;
    }
  }

  private async subscribeToChannels(): Promise<void> {
    try {
      // Subscribe to filter changes
      await this.redisSub.subscribe("filter-changes");

      // Subscribe to viewport updates
      await this.redisSub.subscribe("viewport-updates");

      // Subscribe to initial event requests from WebSocket server
      await this.redisSub.subscribe("filter-processor:request-initial");

      // Subscribe to raw events feed
      await this.redisSub.psubscribe("event_changes");

      // Subscribe to job notifications
      await this.redisSub.subscribe("job_created");
      await this.redisSub.subscribe("job_updates");

      // Handle incoming Redis messages
      this.redisSub.on("message", this.handleRedisMessage);

      // And this one for pattern matching
      this.redisSub.on("pmessage", this.handlePatternMessage);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Subscribed to Redis channels: filter-changes, viewport-updates, filter-processor:request-initial, event_changes, job_created, job_updates",
        );
      }
    } catch (error) {
      console.error("Error subscribing to Redis channels:", error);
      throw error;
    }
  }

  private handleRedisMessage = async (
    channel: string,
    message: string,
  ): Promise<void> => {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case "filter-changes":
          await this.handleFilterChanges(data);
          break;
        case "viewport-updates":
          await this.handleViewportUpdate(data);
          break;
        case "filter-processor:request-initial":
          await this.handleInitialRequest(data);
          break;
        case "job_created":
          await this.handleJobCreated(data);
          break;
        case "job_updates":
          await this.handleJobUpdate(data);
          break;
        default:
          console.warn(`Unknown channel: ${channel}`);
      }
    } catch (error) {
      console.error(`Error processing message from channel ${channel}:`, error);
    }
  };

  private handlePatternMessage = async (
    pattern: string,
    channel: string,
    message: string,
  ): Promise<void> => {
    try {
      if (channel.startsWith("event_changes")) {
        const data = JSON.parse(message);
        console.log("[FilterProcessor] Received event change:", {
          operation: data.operation,
          eventId: data.record?.id,
          isPrivate: data.record?.isPrivate,
          creatorId: data.record?.creatorId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sharedWith: data.record?.sharedWith?.map((s: any) => s.sharedWithId),
          rawData: data, // Log the full data for debugging
        });

        // Validate the event data
        if (!data.record || !data.record.id) {
          console.error("[FilterProcessor] Invalid event data received:", data);
          return;
        }

        await this.eventProcessor.processEvent(data);
        this.stats.eventsProcessed++;

        // Get affected users and notify them
        const affectedUsers = await this.getAffectedUsers(data.record);
        console.log("[FilterProcessor] Affected users for event:", {
          eventId: data.record?.id,
          affectedUsers: Array.from(affectedUsers),
          totalUsers: this.userFilters.size,
          operation: data.operation,
          isPrivate: data.record?.isPrivate,
          creatorId: data.record?.creatorId,
        });

        if (affectedUsers.size === 0) {
          console.log("[FilterProcessor] No affected users found for event:", {
            eventId: data.record.id,
            operation: data.operation,
            isPrivate: data.record.isPrivate,
            creatorId: data.record.creatorId,
          });
        }

        await this.notifyAffectedUsers(affectedUsers, data);
      }
    } catch (error) {
      console.error(`Error handling pattern message: ${error}`, {
        channel,
        message,
      });
    }
  };

  private async handleFilterChanges(data: {
    userId: string;
    filters: Filter[];
  }): Promise<void> {
    const { userId, filters } = data;
    this.userFilters.set(userId, filters);
    this.stats.filterChangesProcessed++;

    // Re-filter existing events for this user based on current viewport
    const viewport = this.userViewports.get(userId);
    if (viewport) {
      await this.sendViewportEvents(userId, viewport);
    } else {
      await this.sendAllFilteredEvents(userId);
    }
  }

  private async handleViewportUpdate(data: {
    userId: string;
    viewport: BoundingBox;
  }): Promise<void> {
    const { userId, viewport } = data;
    await this.viewportProcessor.updateUserViewport(userId, viewport);
    this.userViewports.set(userId, viewport);
    this.stats.viewportUpdatesProcessed++;

    // Send events in this viewport that match the user's filters
    await this.sendViewportEvents(userId, viewport);
  }

  private async handleInitialRequest(data: { userId: string }): Promise<void> {
    const { userId } = data;
    if (process.env.NODE_ENV !== "production") {
      console.log(`Received request for initial events for user ${userId}`);
    }

    if (userId) {
      if (this.userFilters.has(userId)) {
        await this.sendAllFilteredEvents(userId);
      } else {
        this.userFilters.set(userId, []);
      }
    }
  }

  private async sendViewportEvents(
    userId: string,
    viewport: BoundingBox,
  ): Promise<void> {
    try {
      // Get events in viewport
      const eventsInViewport =
        this.viewportProcessor.getEventsInViewport(viewport);

      // Get user's filters
      const filters = this.userFilters.get(userId) || [];

      // Apply filters
      const filteredEvents = eventsInViewport.filter((event) =>
        this.filterMatcher.eventMatchesFilters(event, filters, userId),
      );

      // Send to user's channel
      await this.eventPublisher.publishFilteredEvents(
        userId,
        "viewport",
        filteredEvents,
      );
    } catch (error) {
      console.error(`Error sending viewport events for user ${userId}:`, error);
    }
  }

  private async sendAllFilteredEvents(userId: string): Promise<void> {
    try {
      // Get all events from the cache
      const allEvents = Array.from(this.eventCache.values());

      // Apply user's filters
      const userFilters = this.userFilters.get(userId) || [];
      const filteredEvents = allEvents.filter((event) =>
        this.filterMatcher.eventMatchesFilters(event, userFilters, userId),
      );

      // Publish the filtered events
      await this.eventPublisher.publishFilteredEvents(
        userId,
        "all",
        filteredEvents,
      );
    } catch (error) {
      console.error("Error sending all filtered events:", error);
    }
  }

  private async getAffectedUsers(event: Event): Promise<Set<string>> {
    const affectedUsers = new Set<string>();

    try {
      // Calculate event's spatial bounds
      const [lng, lat] = event.location.coordinates;
      const eventBounds = {
        minX: lng,
        minY: lat,
        maxX: lng,
        maxY: lat,
      };

      // Get all viewports that intersect with this event
      const intersectingViewports =
        await this.viewportProcessor.getIntersectingViewports(eventBounds);

      console.log("[FilterProcessor] Intersecting viewports:", {
        eventId: event.id,
        intersectingViewports: intersectingViewports.map((v) => v.userId),
      });

      // Add users from intersecting viewports, but only if they have access to the event
      for (const { userId } of intersectingViewports) {
        // Check if user has access to the event before adding them
        const hasAccess = this.filterMatcher.isEventAccessible(event, userId);
        console.log("[FilterProcessor] User access check:", {
          eventId: event.id,
          userId,
          hasAccess,
          isPrivate: event.isPrivate,
          creatorId: event.creatorId,
          sharedWith: event.sharedWith?.map((s) => s.sharedWithId),
        });

        if (hasAccess) {
          affectedUsers.add(userId);
        }
      }

      // Add users who might see the event regardless of viewport
      for (const [userId, filters] of this.userFilters.entries()) {
        const matchesFilters = this.filterMatcher.eventMatchesFilters(
          event,
          filters,
          userId,
        );
        console.log("[FilterProcessor] Filter match check:", {
          eventId: event.id,
          userId,
          matchesFilters,
          filterCount: filters.length,
        });

        if (matchesFilters) {
          affectedUsers.add(userId);
        }
      }
    } catch (error) {
      console.error("Error getting affected users:", error);
    }

    return affectedUsers;
  }

  private async notifyAffectedUsers(
    affectedUsers: Set<string>,
    event: { operation: string; record: Event },
  ): Promise<void> {
    const { operation, record } = event;

    console.log("[FilterProcessor] Notifying affected users:", {
      eventId: record.id,
      operation,
      affectedUserCount: affectedUsers.size,
      isPrivate: record.isPrivate,
      creatorId: record.creatorId,
    });

    for (const userId of affectedUsers) {
      const filters = this.userFilters.get(userId) || [];
      const viewport = this.userViewports.get(userId);

      // Check if event matches user's filters
      const matchesFilters = this.filterMatcher.eventMatchesFilters(
        record,
        filters,
        userId,
      );

      // Check if event is in user's viewport
      const inViewport = viewport
        ? this.viewportProcessor.isEventInViewport(record, viewport)
        : true;

      console.log("[FilterProcessor] Final visibility check:", {
        eventId: record.id,
        userId,
        matchesFilters,
        inViewport,
        hasViewport: !!viewport,
        filterCount: filters.length,
        operation,
        isPrivate: record.isPrivate,
        creatorId: record.creatorId,
      });

      if (matchesFilters && inViewport) {
        switch (operation) {
          case "CREATE":
          case "INSERT": // Add support for INSERT operation
            console.log("[FilterProcessor] Publishing new event to user:", {
              eventId: record.id,
              userId,
              operation,
              isPrivate: record.isPrivate,
              creatorId: record.creatorId,
            });
            await this.eventPublisher.publishFilteredEvents(userId, "add", [
              record,
            ]);
            break;
          case "UPDATE":
            await this.eventPublisher.publishUpdateEvent(userId, record);
            break;
          case "DELETE":
            await this.eventPublisher.publishDeleteEvent(userId, record.id);
            break;
        }
      } else if (operation === "UPDATE" || operation === "DELETE") {
        // If event is no longer visible to user, send delete
        await this.eventPublisher.publishDeleteEvent(userId, record.id);
      }
    }
  }

  /**
   * Convert an event to a spatial item for the RBush index.
   */
  private eventToSpatialItem(event: Event): SpatialItem {
    const [lng, lat] = event.location.coordinates;

    return {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      id: event.id,
      event,
    };
  }

  /**
   * Fetch all events from the API or database.
   */
  private async fetchAllEvents(): Promise<Event[]> {
    try {
      const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
      const pageSize = 100;
      let currentPage = 1;
      let hasMorePages = true;
      let allEvents: Event[] = [];

      while (hasMorePages) {
        const maxRetries = 3;
        const initialRetryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(
              `${backendUrl}/api/internal/events?limit=${pageSize}&offset=${
                (currentPage - 1) * pageSize
              }`,
              {
                headers: {
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !Array.isArray(data.events)) {
              throw new Error("Invalid response format from backend");
            }

            const { events, hasMore } = data;

            // Process and validate events
            const validEvents = events
              .filter(
                (event: { location?: { coordinates?: number[] } }) =>
                  event.location?.coordinates,
              )
              .map(
                (event: {
                  id: string;
                  emoji?: string;
                  title: string;
                  description?: string;
                  location: { coordinates: number[] };
                  eventDate?: string;
                  start_date?: string;
                  startDate?: string;
                  endDate?: string;
                  end_date?: string;
                  created_at?: string;
                  createdAt?: string;
                  updated_at?: string;
                  updatedAt?: string;
                  categories?: Array<{ name: string }>;
                  embedding?: string;
                  status?: string;
                  isPrivate?: boolean;
                  creatorId?: string;
                  sharedWith?: Array<{ sharedWithId: string }>;
                }) => ({
                  id: event.id,
                  emoji: event.emoji,
                  title: event.title,
                  description: event.description,
                  location: event.location,
                  eventDate:
                    event.eventDate || event.start_date || event.startDate,
                  endDate: event.endDate || event.end_date,
                  createdAt: event.created_at || event.createdAt,
                  updatedAt: event.updated_at || event.updatedAt,
                  categories: event.categories || [],
                  embedding: event.embedding,
                  status: event.status,
                  isPrivate: event.isPrivate || false,
                  creatorId: event.creatorId,
                  sharedWith: event.sharedWith || [],
                }),
              );

            // Add to our collection, ensuring no duplicates
            const newEvents = validEvents.filter(
              (event: Event) =>
                !allEvents.some((existing) => existing.id === event.id),
            );
            allEvents = [...allEvents, ...newEvents];

            // Update pagination state
            hasMorePages = hasMore;
            currentPage++;

            // If we're in production and have enough events, start processing
            if (
              process.env.NODE_ENV === "production" &&
              allEvents.length >= pageSize
            ) {
              this.processInitialEventsBatch(allEvents);
              allEvents = []; // Clear the array to free memory
            }

            break; // Success, exit retry loop
          } catch (error) {
            console.error(
              `Attempt ${attempt}/${maxRetries} failed for page ${currentPage}:`,
              error,
            );

            if (attempt === maxRetries) {
              console.error("Max API retries reached for page", currentPage);
              hasMorePages = false; // Stop pagination on persistent failure
              break;
            }

            // Exponential backoff
            const retryDelay = initialRetryDelay * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
      }

      // Process any remaining events
      if (allEvents.length > 0) {
        this.processInitialEventsBatch(allEvents);
      }

      return allEvents;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  }

  /**
   * Process a batch of events for initial loading
   */
  private processInitialEventsBatch(events: Event[]): void {
    try {
      // Remove duplicates based on event ID
      const uniqueEvents = Array.from(
        new Map(events.map((event) => [event.id, event])).values(),
      );

      // Process each event
      for (const event of uniqueEvents) {
        this.eventProcessor.processEvent({
          operation: "CREATE",
          record: event,
        });
      }
    } catch (error) {
      console.error("Error processing initial events batch:", error);
    }
  }

  // Add new methods for handling jobs
  private async handleJobCreated(data: {
    type: string;
    data: { jobId: string; jobType?: string };
  }): Promise<void> {
    if (
      data.type === "JOB_CREATED" &&
      data.data.jobType === "cleanup_outdated_events"
    ) {
      console.log("[FilterProcessor] Received cleanup job:", data.data.jobId);

      // When a cleanup job is created, we should clear our spatial index and event cache
      // since events will be deleted from the database
      this.spatialIndex.clear();
      this.eventCache.clear();

      // Notify all connected users that they need to refresh their events
      const userIds = Array.from(this.userFilters.keys());
      for (const userId of userIds) {
        await this.eventPublisher.publishFilteredEvents(
          userId,
          "replace-all",
          [],
        );
      }
    }
  }

  private async handleJobUpdate(data: {
    jobId: string;
    status: string;
    result?: { deletedCount?: number };
  }): Promise<void> {
    if (data.status === "completed" && data.result?.deletedCount) {
      console.log("[FilterProcessor] Cleanup job completed:", {
        jobId: data.jobId,
        deletedCount: data.result.deletedCount,
      });

      // Reinitialize the spatial index with remaining events
      await this.initializeSpatialIndex();

      // Notify all users to refresh their events
      const userIds = Array.from(this.userFilters.keys());
      for (const userId of userIds) {
        const viewport = this.userViewports.get(userId);
        if (viewport) {
          await this.sendViewportEvents(userId, viewport);
        } else {
          await this.sendAllFilteredEvents(userId);
        }
      }
    }
  }
}
