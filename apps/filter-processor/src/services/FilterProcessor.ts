// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import RBush from "rbush";
import { Filter, BoundingBox, SpatialItem, FilterCriteria, Event } from "../types/types";

/**
 * FilterProcessor is responsible for maintaining active filter sets for connected users,
 * applying both attribute and spatial filters to events, and publishing filtered events
 * to user-specific channels.
 */
export class FilterProcessor {
  // Redis clients for pub/sub
  private redisPub: Redis;
  private redisSub: Redis;

  // In-memory state
  private userFilters = new Map<string, Filter[]>();
  private userViewports = new Map<string, BoundingBox>();
  private spatialIndex = new RBush<SpatialItem>();
  private eventCache = new Map<string, Event>();

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
  }

  /**
   * Initialize the filter processor service.
   */
  public async initialize(): Promise<void> {
    try {
      console.log("🔄 Loading initial data and subscribing to channels...");

      // Initialize the spatial index with existing events
      await this.initializeSpatialIndex();

      // Subscribe to Redis channels
      await this.subscribeToChannels();

      console.log("🔄 Filter Processor initialized with:", {
        events: this.spatialIndex.all().length,
        users: this.userFilters.size,
      });
    } catch (error) {
      console.error("❌ Error initializing Filter Processor:", error);
      throw error;
    }
  }

  /**
   * Gracefully shut down the filter processor.
   */
  public async shutdown(): Promise<void> {
    console.log("🛑 Shutting down Filter Processor...");

    // Clean up Redis subscribers
    await this.redisSub.unsubscribe();
    await this.redisSub.quit();
    await this.redisPub.quit();

    console.log("📊 Final stats:", this.stats);
  }

  /**
   * Get current statistics for the filter processor.
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Initialize the spatial index with existing events from database.
   * In a real implementation, this would fetch events from the database.
   */
  private async initializeSpatialIndex(): Promise<void> {
    try {
      console.log("🌍 Initializing spatial index...");

      // For now, just fetch events from Redis or another service
      // In a real implementation, this might fetch from a database
      const events = await this.fetchAllEvents();

      // Format for RBush
      const items = events.map((event) => this.eventToSpatialItem(event));

      // Bulk load for performance
      this.spatialIndex.load(items);

      // Also cache the full events
      events.forEach((event) => {
        this.eventCache.set(event.id, event);
      });

      console.log(`🌍 Spatial index initialized with ${items.length} events`);
    } catch (error) {
      console.error("❌ Error initializing spatial index:", error);
      throw error;
    }
  }

  /**
   * Subscribe to Redis channels needed for operation.
   */
  private async subscribeToChannels(): Promise<void> {
    try {
      // Subscribe to filter changes
      await this.redisSub.subscribe("filter-changes");

      // Subscribe to viewport updates
      await this.redisSub.subscribe("viewport-updates");

      // Subscribe to raw events feed
      // Subscribe to raw events feed
      await this.redisSub.psubscribe("event_changes");
      // Handle incoming Redis messages
      this.redisSub.on("message", this.handleRedisMessage);

      this.redisSub.on("message", this.handleRedisMessage);

      // AND this one for pattern matching
      this.redisSub.on("pmessage", (pattern, channel, message) => {
        try {
          console.log(`📦 Received pmessage on channel ${channel} from pattern ${pattern}`);
          const data = JSON.parse(message);

          console.log("DATA", data);

          if (channel.startsWith("event_changes")) {
            this.processEvent(data);
          }
        } catch (error) {
          console.error(`❌ Error handling pmessage: ${error}`);
        }
      });

      console.log(
        "📡 Subscribed to Redis channels: filter-changes, viewport-updates, event_changes"
      );
    } catch (error) {
      console.error("❌ Error subscribing to Redis channels:", error);
      throw error;
    }
  }

  /**
   * Handle messages from Redis pub/sub channels.
   */
  private handleRedisMessage = (channel: string, message: string): void => {
    try {
      const data = JSON.parse(message);

      if (channel === "filter-changes") {
        const { userId, filters } = data;
        this.updateUserFilters(userId, filters);
        this.stats.filterChangesProcessed++;
      } else if (channel === "viewport-updates") {
        const { userId, viewport } = data;
        this.updateUserViewport(userId, viewport);
        this.stats.viewportUpdatesProcessed++;
      } else if (channel === "event_changes") {
        this.processEvent(data);
        this.stats.eventsProcessed++;
      }
    } catch (error) {
      console.error(`❌ Error processing message from channel ${channel}:`, error);
    }
  };

  /**
   * Update a user's filters and send relevant events.
   */
  private updateUserFilters(userId: string, filters: Filter[]): void {
    try {
      console.log(`👤 Updating filters for user ${userId} with ${filters.length} filters`);

      // Store the user's current filters
      this.userFilters.set(userId, filters);

      // Re-filter existing events for this user based on current viewport
      const viewport = this.userViewports.get(userId);
      if (viewport) {
        this.sendViewportEvents(userId, viewport);
      } else {
        // If no viewport, send all events that match filters
        this.sendAllFilteredEvents(userId);
      }
    } catch (error) {
      console.error(`❌ Error updating filters for user ${userId}:`, error);
    }
  }

  /**
   * Update a user's viewport and send relevant events.
   */
  private updateUserViewport(userId: string, viewport: BoundingBox): void {
    try {
      console.log(`🗺️ Updating viewport for user ${userId}`, viewport);

      // Store the user's current viewport
      this.userViewports.set(userId, viewport);

      // Send events in this viewport that match the user's filters
      this.sendViewportEvents(userId, viewport);
    } catch (error) {
      console.error(`❌ Error updating viewport for user ${userId}:`, error);
    }
  }

  /**
   * Send all events that match a user's filters.
   */
  private sendAllFilteredEvents(userId: string): void {
    const filters = this.userFilters.get(userId) || [];

    // Get all events from cache
    const allEvents = Array.from(this.eventCache.values());

    // Apply filters
    const filteredEvents = allEvents.filter((event) => this.eventMatchesFilters(event, filters));

    // Send to user's channel
    this.publishFilteredEvents(userId, "replace-all", filteredEvents);
  }

  /**
   * Send events in a specific viewport that match the user's filters.
   */
  private sendViewportEvents(userId: string, viewport: BoundingBox): void {
    try {
      // Get user's filters
      const filters = this.userFilters.get(userId) || [];

      // Query spatial index for events in viewport
      const spatialItems = this.spatialIndex.search(viewport);

      // Get the full events from cache
      const eventsInViewport = spatialItems
        .map((item) => this.eventCache.get(item.id))
        .filter(Boolean) as Event[];

      // Apply attribute filters
      const filteredEvents = eventsInViewport.filter((event) =>
        this.eventMatchesFilters(event, filters)
      );

      // Send to user's channel
      this.publishFilteredEvents(userId, "viewport-update", filteredEvents);
    } catch (error) {
      console.error(`❌ Error sending viewport events for user ${userId}:`, error);
    }
  }

  /**
   * Process an event from the raw events feed.
   * This includes CREATE, UPDATE, and DELETE operations.
   */
  private processEvent(event: { operation: string; record: Event }): void {
    try {
      const { operation, record } = event;

      // Handle deletion
      if (operation === "DELETE") {
        // Remove from spatial index and cache
        this.removeEventFromIndex(record.id);
        this.eventCache.delete(record.id);

        // Deletion events are forwarded to all users
        for (const userId of this.userFilters.keys()) {
          this.redisPub.publish(
            `user:${userId}:filtered-events`,
            JSON.stringify({
              type: "delete-event",
              id: record.id,
            })
          );
          this.stats.totalFilteredEventsPublished++;
        }
        return;
      }

      // For CREATE/UPDATE operations

      // Remove any existing entry for updates
      if (operation === "UPDATE") {
        this.removeEventFromIndex(record.id);
      }

      // Add to spatial index and cache
      const spatialItem = this.eventToSpatialItem(record);
      this.spatialIndex.insert(spatialItem);
      this.eventCache.set(record.id, record);

      console.log("CHECKING_FILTERS");

      // Check if event matches filters for each user
      for (const [userId, filters] of this.userFilters.entries()) {
        // Skip if event doesn't match user's filters
        if (!this.eventMatchesFilters(record, filters)) {
          continue;
        }

        // Check if in user's viewport (if they have one)

        console.log("CHECKED_EVENT_MATCHES_FILTERS");

        const viewport = this.userViewports.get(userId);

        console.log("VIEWPORT", viewport);

        if (viewport && !this.isEventInViewport(record, viewport)) {
          continue;
        }

        console.log("INSERTING", record);

        // Publish to user channel
        this.redisPub.publish(
          `user:${userId}:filtered-events`,
          JSON.stringify({
            type: operation === "INSERT" ? "add-event" : "update-event",
            event: record,
          })
        );
        this.stats.totalFilteredEventsPublished++;
      }
    } catch (error) {
      console.error("❌ Error processing event:", error);
    }
  }

  /**
   * Removes an event from the spatial index.
   */
  private removeEventFromIndex(eventId: string): void {
    const currentItems = this.spatialIndex.all();
    const itemToRemove = currentItems.find((item) => item.id === eventId);

    if (itemToRemove) {
      this.spatialIndex.remove(itemToRemove, (a, b) => a.id === b.id);
    }
  }

  /**
   * Check if an event matches any of the filters provided.
   */
  private eventMatchesFilters(event: Event, filters: Filter[]): boolean {
    // If no filters, match everything
    if (filters.length === 0) return true;

    // Event matches if it satisfies ANY filter
    return filters.some((filter) => this.matchesFilter(event, filter.criteria));
  }

  /**
   * Check if an event matches a specific filter criteria.
   */
  private matchesFilter(event: Event, criteria: FilterCriteria): boolean {
    // Category filtering
    if (criteria.categories && criteria.categories.length > 0) {
      const eventCategories = event.categories?.map((c: any) => c.id) || [];
      const hasMatchingCategory = criteria.categories.some((category: any) =>
        eventCategories.includes(category)
      );

      if (!hasMatchingCategory) return false;
    }

    // Date range filtering
    if (criteria.dateRange) {
      const { start, end } = criteria.dateRange;
      const eventDate = new Date(event.eventDate || event.createdAt);

      if (start && new Date(start) > eventDate) return false;
      if (end && new Date(end) < eventDate) return false;
    }

    // Status filtering
    if (criteria.status && criteria.status.length > 0) {
      if (!criteria.status.includes(event.status)) return false;
    }

    // Tag filtering (extending the model to support tags)
    if (criteria.tags && criteria.tags.length > 0) {
      const eventTags = event.tags || [];
      const hasMatchingTag = criteria.tags.some((tag: string) => eventTags.includes(tag));

      if (!hasMatchingTag) return false;
    }

    // Keywords filtering (in title or description)
    if (criteria.keywords && criteria.keywords.length > 0) {
      const eventText = `${event.title} ${event.description || ""}`.toLowerCase();
      const hasMatchingKeyword = criteria.keywords.some((keyword: string) =>
        eventText.includes(keyword.toLowerCase())
      );

      if (!hasMatchingKeyword) return false;
    }

    // All criteria passed
    return true;
  }

  /**
   * Check if an event is within a given viewport.
   */
  private isEventInViewport(event: Event, viewport: BoundingBox): boolean {
    const [lng, lat] = event.location.coordinates;

    return (
      lng >= viewport.minX && lng <= viewport.maxX && lat >= viewport.minY && lat <= viewport.maxY
    );
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
   * Publish filtered events to a user's channel.
   */
  private publishFilteredEvents(userId: string, type: string, events: Event[]): void {
    try {
      this.redisPub.publish(
        `user:${userId}:filtered-events`,
        JSON.stringify({
          type,
          events,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`📤 Published ${events.length} events to user ${userId}`);
      this.stats.totalFilteredEventsPublished += events.length;
    } catch (error) {
      console.error(`❌ Error publishing events to user ${userId}:`, error);
    }
  }

  /**
   * Fetch all events from the database.
   * In a real implementation, this would connect to the database.
   */
  private async fetchAllEvents(): Promise<Event[]> {
    try {
      // This is a placeholder. In a real implementation, this would fetch
      // from a database or API. For now, return an empty array.
      return [];
    } catch (error) {
      console.error("❌ Error fetching events:", error);
      return [];
    }
  }
}
