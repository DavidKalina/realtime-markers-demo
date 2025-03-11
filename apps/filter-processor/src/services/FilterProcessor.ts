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

  // PostgreSQL connection

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
   * Initialize the spatial index with existing events from API or database.
   */
  private async initializeSpatialIndex(): Promise<void> {
    try {
      console.log("🌍 Initializing spatial index...");

      // Fetch events from the API or database
      const events = await this.fetchAllEvents();

      // Log some diagnostic info about the events
      console.log(`🌍 Received ${events.length} events for initialization`);

      // Filter out events without valid coordinates
      const validEvents = events.filter((event) => {
        if (
          !event.location?.coordinates ||
          !Array.isArray(event.location.coordinates) ||
          event.location.coordinates.length !== 2
        ) {
          console.warn(`⚠️ Event ${event.id} has invalid coordinates:`, event.location);
          return false;
        }
        return true;
      });

      if (validEvents.length < events.length) {
        console.warn(
          `⚠️ Filtered out ${events.length - validEvents.length} events with invalid coordinates`
        );
      }

      // Format for RBush
      const items = validEvents.map((event) => this.eventToSpatialItem(event));

      // Bulk load for performance
      this.spatialIndex.load(items);

      // Also cache the full events
      validEvents.forEach((event) => {
        this.eventCache.set(event.id, event);
      });

      // Log info about the initialized index
      console.log(`🌍 Spatial index initialized with ${items.length} events`);

      // Log a sample item for debugging
      if (items.length > 0) {
        console.log("🌍 Sample spatial item:", items[0]);
      }
    } catch (error) {
      console.error("❌ Error initializing spatial index:", error);
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

      // Handle incoming Redis messages
      this.redisSub.on("message", this.handleRedisMessage);

      // And this one for pattern matching
      this.redisSub.on("pmessage", (pattern, channel, message) => {
        try {
          console.log(`📦 Received pmessage on channel ${channel} from pattern ${pattern}`);
          const data = JSON.parse(message);

          if (channel.startsWith("event_changes")) {
            this.processEvent(data);
          }
        } catch (error) {
          console.error(`❌ Error handling pmessage: ${error}`);
        }
      });

      console.log(
        "📡 Subscribed to Redis channels: filter-changes, viewport-updates, filter-processor:request-initial, event_changes"
      );
    } catch (error) {
      console.error("❌ Error subscribing to Redis channels:", error);
      throw error;
    }
  }

  private handleRedisMessage = (channel: string, message: string): void => {
    try {
      const data = JSON.parse(message);

      if (channel === "filter-changes") {
        const { userId, filters } = data;

        console.log("FILTERS", filters);

        this.updateUserFilters(userId, filters);
        this.stats.filterChangesProcessed++;
      } else if (channel === "viewport-updates") {
        const { userId, viewport } = data;
        this.updateUserViewport(userId, viewport);
        this.stats.viewportUpdatesProcessed++;
      } else if (channel === "filter-processor:request-initial") {
        const { userId } = data;
        console.log(`📥 Received request for initial events for user ${userId}`);

        // Send all filtered events to this user
        if (userId) {
          // If we have filters for this user, use them
          if (this.userFilters.has(userId)) {
            console.log(`🔍 User ${userId} has existing filters, sending filtered events`);
            this.sendAllFilteredEvents(userId);
          } else {
            // If no filters yet, send empty filter set to get all events
            console.log(`🔍 User ${userId} has no filters yet, setting empty filter`);
            this.updateUserFilters(userId, []);
          }
        }
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

  private sendAllFilteredEvents(userId: string): void {
    try {
      const filters = this.userFilters.get(userId) || [];
      console.log(`📊 Applying ${filters.length} filters for user ${userId}`);

      // Get all events from cache
      const allEvents = Array.from(this.eventCache.values());
      console.log(`📊 Total events before filtering: ${allEvents.length}`);

      // Apply filters
      const filteredEvents = allEvents.filter((event) => this.eventMatchesFilters(event, filters));
      console.log(`📊 Events after filtering: ${filteredEvents.length}`);

      // Send to user's channel
      this.publishFilteredEvents(userId, "replace-all", filteredEvents);

      console.log(
        `📊 Filter results: ${filteredEvents.length}/${allEvents.length} events passed filters`
      );
    } catch (error) {
      console.error(`❌ Error sending filtered events to user ${userId}:`, error);
    }
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

      // Check if event matches filters for each user
      for (const [userId, filters] of this.userFilters.entries()) {
        console.log(userId, filters);
        // Skip if event doesn't match user's filters
        if (!this.eventMatchesFilters(record, filters)) {
          continue;
        }

        console.log("MATCHES_FILTERS", this.eventMatchesFilters(record, filters));

        const viewport = this.userViewports.get(userId);

        if (viewport && !this.isEventInViewport(record, viewport)) {
          continue;
        }

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

    console.log("FILTERS_LENGTH", filters.length);

    if (filters.length === 0) return true;

    // Event matches if it satisfies ANY filter
    return filters.some((filter) => this.matchesFilter(event, filter.criteria));
  }

  private matchesFilter(event: Event, criteria: FilterCriteria): boolean {
    console.log(
      `📊 FILTER DEBUG: Matching event ${event.id} against filter criteria:`,
      JSON.stringify(criteria, null, 2)
    );

    // For debugging, log the complete event structure
    console.log(
      `📊 FILTER DEBUG: Event structure:`,
      JSON.stringify(
        {
          id: event.id,
          title: event.title,
          categories: event.categories,
          startDate: event.eventDate,
          createdAt: event.createdAt,
          status: event.status,
          tags: event.tags,
        },
        null,
        2
      )
    );

    // Category filtering - FIXED to handle multiple category formats
    if (criteria.categories && criteria.categories.length > 0) {
      // Extract event categories, handling different possible formats
      const eventCategories: string[] = [];

      if (event.categories) {
        if (Array.isArray(event.categories)) {
          event.categories.forEach((category) => {
            if (typeof category === "string") {
              // If category is directly a string ID
              eventCategories.push(category);
            } else if (typeof category === "object") {
              // If category is an object with id property
              if (category.id) eventCategories.push(category.id);
              // Also check for category.name for systems that use names as IDs
              if (category.name) eventCategories.push(category.name);
            }
          });
        }
      }

      console.log(`📊 FILTER DEBUG: Event ${event.id} categories:`, eventCategories);
      console.log(`📊 FILTER DEBUG: Filter categories:`, criteria.categories);

      const hasMatchingCategory = criteria.categories.some((categoryId) =>
        eventCategories.includes(categoryId)
      );

      if (!hasMatchingCategory) {
        console.log(`❌ FILTER DEBUG: Event ${event.id} FAILED category filter`);
        return false;
      }

      console.log(`✅ FILTER DEBUG: Event ${event.id} PASSED category filter`);
    }

    if (criteria.dateRange) {
      const { start, end } = criteria.dateRange;

      // Get event start and end dates
      const eventStartDate = new Date(event.eventDate);
      const eventEndDate = event.endDate ? new Date(event.endDate) : eventStartDate;

      console.log(`📊 FILTER DEBUG: Event start date: ${eventStartDate.toISOString()}`);
      console.log(`📊 FILTER DEBUG: Event end date: ${eventEndDate.toISOString()}`);
      if (start) console.log(`📊 FILTER DEBUG: Filter start: ${new Date(start).toISOString()}`);
      if (end) console.log(`📊 FILTER DEBUG: Filter end: ${new Date(end).toISOString()}`);

      // Event fails filter if it ends before filter start or starts after filter end
      if (start && eventEndDate < new Date(start)) {
        console.log(
          `❌ FILTER DEBUG: Event ${event.id} FAILED start date filter (event ends before filter start)`
        );
        return false;
      }

      if (end && eventStartDate > new Date(end)) {
        console.log(
          `❌ FILTER DEBUG: Event ${event.id} FAILED end date filter (event starts after filter end)`
        );
        return false;
      }

      console.log(`✅ FILTER DEBUG: Event ${event.id} PASSED date filter`);
    }

    // Status filtering
    if (criteria.status && criteria.status.length > 0) {
      const eventStatus = event.status || "active"; // Default to 'active' if not specified

      console.log(`📊 FILTER DEBUG: Event status: ${eventStatus}`);
      console.log(`📊 FILTER DEBUG: Filter status:`, criteria.status);

      if (!criteria.status.includes(eventStatus)) {
        console.log(`❌ FILTER DEBUG: Event ${event.id} FAILED status filter`);
        return false;
      }

      console.log(`✅ FILTER DEBUG: Event ${event.id} PASSED status filter`);
    }

    // Tag filtering
    if (criteria.tags && criteria.tags.length > 0) {
      const eventTags = Array.isArray(event.tags) ? event.tags : [];

      console.log(`📊 FILTER DEBUG: Event tags:`, eventTags);
      console.log(`📊 FILTER DEBUG: Filter tags:`, criteria.tags);

      const hasMatchingTag = criteria.tags.some((tag) => eventTags.includes(tag));

      if (!hasMatchingTag) {
        console.log(`❌ FILTER DEBUG: Event ${event.id} FAILED tag filter`);
        return false;
      }

      console.log(`✅ FILTER DEBUG: Event ${event.id} PASSED tag filter`);
    }

    // Keywords filtering (in title or description)
    if (criteria.keywords && criteria.keywords.length > 0) {
      const eventText = `${event.title || ""} ${event.description || ""}`.toLowerCase();

      console.log(`📊 FILTER DEBUG: Event text (first 50 chars): ${eventText.slice(0, 50)}...`);
      console.log(`📊 FILTER DEBUG: Filter keywords:`, criteria.keywords);

      const hasMatchingKeyword = criteria.keywords.some((keyword) => {
        const match = eventText.includes(keyword.toLowerCase());
        return match;
      });

      if (!hasMatchingKeyword) {
        console.log(`❌ FILTER DEBUG: Event ${event.id} FAILED keyword filter`);
        return false;
      }

      console.log(`✅ FILTER DEBUG: Event ${event.id} PASSED keyword filter`);
    }

    // All criteria passed
    console.log(`✅✅ FILTER DEBUG: Event ${event.id} MATCHED ALL filter criteria`);
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

  // Enhanced publishFilteredEvents with more detailed reporting
  private publishFilteredEvents(userId: string, type: string, events: Event[]): void {
    try {
      // Publish the filtered events to the user's channel
      this.redisPub.publish(
        `user:${userId}:filtered-events`,
        JSON.stringify({
          type,
          events,
          count: events.length,
          timestamp: new Date().toISOString(),
        })
      );

      // console.log(`📤 Published ${events.length} ${type} events to user ${userId}`);

      // Update stats
      this.stats.totalFilteredEventsPublished += events.length;

      // If this was a replace-all operation, log additional details
      if (type === "replace-all") {
        console.log(`🔄 Sent complete replacement set to user ${userId}`);

        // Log sample of event IDs for debugging
        if (events.length > 0) {
          const sampleIds = events.slice(0, Math.min(5, events.length)).map((e) => e.id);
          console.log(`🔍 Sample event IDs: ${sampleIds.join(", ")}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error publishing events to user ${userId}:`, error);
    }
  }
  /**
   * Fetch all events from the API or database.
   */
  private async fetchAllEvents(): Promise<Event[]> {
    try {
      // Try fetching from API endpoint first (like your WebSocket server did)
      const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
      const maxRetries = 5;
      const retryDelay = 2000; // 2 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(
            `📊 Attempt ${attempt}/${maxRetries} - Fetching events from API at ${backendUrl}/api/internal/events`
          );

          const response = await fetch(`${backendUrl}/api/internal/events`, {
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }

          const events = await response.json();
          console.log(`📊 Received ${events.length} events from API`);

          // Transform the API response into Event objects
          const validEvents = events
            .filter((event: any) => event.location?.coordinates)
            .map((event: any) => ({
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              startDate: event.start_date || event.startDate,
              endDate: event.end_date || event.endDate,
              createdAt: event.created_at || event.createdAt,
              updatedAt: event.updated_at || event.updatedAt,
              categories: event.categories || [],
            }));

          console.log(`📊 Transformed ${validEvents.length} valid events for spatial index`);

          // Log a sample of coordinates to verify data
          if (validEvents.length > 0) {
            console.log("📊 Sample coordinates:", {
              id: validEvents[0].id,
              coordinates: validEvents[0].location.coordinates,
            });
          }

          return validEvents;
        } catch (error) {
          console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error);

          if (attempt === maxRetries) {
            console.error("❌ Max API retries reached, falling back to database query");
            break;
          }

          console.log(`⏳ Waiting ${retryDelay}ms before next attempt...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      return [];
    } catch (error) {
      console.error("❌ Error fetching events:", error);
      // Return empty array in case of error, but log the issue
      return [];
    }
  }
}
