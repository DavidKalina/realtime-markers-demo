// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import RBush from "rbush";
import { Filter, BoundingBox, SpatialItem, Event } from "../types/types";
import { VectorService } from "./VectorService";

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
  private vectorService: VectorService;

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
    this.vectorService = VectorService.getInstance();
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
      console.log("Final stats:", this.stats);
    }

    // Clean up Redis subscribers
    await this.redisSub.unsubscribe();
    await this.redisSub.quit();
    await this.redisPub.quit();
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

      // Handle incoming Redis messages
      this.redisSub.on("message", this.handleRedisMessage);

      // And this one for pattern matching
      this.redisSub.on("pmessage", (pattern, channel, message) => {
        try {
          if (process.env.NODE_ENV !== "production") {
            console.log(
              `Received pmessage on channel ${channel} from pattern ${pattern}`,
            );
          }
          const data = JSON.parse(message);

          if (channel.startsWith("event_changes")) {
            this.processEvent(data);
          }
        } catch (error) {
          console.error(`Error handling pmessage: ${error}`);
        }
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Subscribed to Redis channels: filter-changes, viewport-updates, filter-processor:request-initial, event_changes",
        );
      }
    } catch (error) {
      console.error("Error subscribing to Redis channels:", error);
      throw error;
    }
  }

  private handleRedisMessage = (channel: string, message: string): void => {
    try {
      const data = JSON.parse(message);

      if (channel === "filter-changes") {
        const { userId, filters } = data;

        if (process.env.NODE_ENV !== "production") {
          console.log("Processing filter changes:", {
            userId,
            filterCount: filters.length,
          });
        }

        this.updateUserFilters(userId, filters);
        this.stats.filterChangesProcessed++;
      } else if (channel === "viewport-updates") {
        const { userId, viewport } = data;
        this.updateUserViewport(userId, viewport);
        this.stats.viewportUpdatesProcessed++;
      } else if (channel === "filter-processor:request-initial") {
        const { userId } = data;
        if (process.env.NODE_ENV !== "production") {
          console.log(`Received request for initial events for user ${userId}`);
        }

        // Send all filtered events to this user
        if (userId) {
          // If we have filters for this user, use them
          if (this.userFilters.has(userId)) {
            if (process.env.NODE_ENV !== "production") {
              console.log(
                `User ${userId} has existing filters, sending filtered events`,
              );
            }
            this.sendAllFilteredEvents(userId);
          } else {
            // If no filters yet, send empty filter set to get all events
            if (process.env.NODE_ENV !== "production") {
              console.log(
                `User ${userId} has no filters yet, setting empty filter`,
              );
            }
            this.updateUserFilters(userId, []);
          }
        }
      } else if (channel === "event_changes") {
        this.processEvent(data);
        this.stats.eventsProcessed++;
      }
    } catch (error) {
      console.error(`Error processing message from channel ${channel}:`, error);
    }
  };

  /**
   * Update a user's filters and send relevant events.
   */
  private updateUserFilters(userId: string, filters: Filter[]): void {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Updating filters for user ${userId} with ${filters.length} filters`,
        );
      }

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
      console.error(`Error updating filters for user ${userId}:`, error);
    }
  }

  /**
   * Update a user's viewport and send relevant events.
   */
  private async updateUserViewport(
    userId: string,
    viewport: BoundingBox,
  ): Promise<void> {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log(`Updating viewport for user ${userId}`, viewport);
      }

      const viewportKey = `viewport:${userId}`;

      // Store the full viewport data
      await this.redisPub.set(viewportKey, JSON.stringify(viewport));

      // Calculate center point for GEO indexing
      const centerLng = (viewport.minX + viewport.maxX) / 2;
      const centerLat = (viewport.minY + viewport.maxY) / 2;

      // Add to GEO index
      await this.redisPub.geoadd(
        "viewport:geo",
        centerLng,
        centerLat,
        viewportKey,
      );

      // Send events in this viewport that match the user's filters
      this.sendViewportEvents(userId, viewport);
    } catch (error) {
      console.error(`Error updating viewport for user ${userId}:`, error);
    }
  }

  /**
   * Remove a user's viewport from Redis and GEO index
   */
  private async removeUserViewport(userId: string): Promise<void> {
    try {
      const viewportKey = `viewport:${userId}`;

      // Remove from GEO index first
      await this.redisPub.zrem("viewport:geo", viewportKey);

      // Then remove viewport data
      await this.redisPub.del(viewportKey);

      if (process.env.NODE_ENV !== "production") {
        console.log(`Removed viewport data for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error removing viewport for user ${userId}:`, error);
    }
  }

  private sendAllFilteredEvents(userId: string): void {
    try {
      // Get all events from the spatial index
      const allEvents = Array.from(this.eventCache.values());

      // Apply user's filters
      const userFilters = this.userFilters.get(userId) || [];
      const filteredEvents = allEvents.filter((event) =>
        this.eventMatchesFilters(event, userFilters, userId),
      );

      // Publish the filtered events
      this.publishFilteredEvents(userId, "all", filteredEvents);
    } catch (error) {
      console.error("Error sending all filtered events:", error);
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

      if (process.env.NODE_ENV !== "production") {
        console.log("[Viewport] Raw spatial items:", {
          count: spatialItems.length,
          ids: spatialItems.map((item) => item.id),
        });
      }

      // Deduplicate spatial items by ID
      const uniqueSpatialItems = Array.from(
        new Map(spatialItems.map((item) => [item.id, item])).values(),
      );

      if (process.env.NODE_ENV !== "production") {
        console.log("[Viewport] Unique spatial items:", {
          count: uniqueSpatialItems.length,
          ids: uniqueSpatialItems.map((item) => item.id),
        });
      }

      // Get the full events from cache
      const eventsInViewport = uniqueSpatialItems
        .map((item) => this.eventCache.get(item.id))
        .filter(Boolean) as Event[];

      if (process.env.NODE_ENV !== "production") {
        console.log("[Viewport] Events from cache:", {
          count: eventsInViewport.length,
          ids: eventsInViewport.map((event) => event.id),
        });
      }

      // First apply privacy filter
      const accessibleEvents = eventsInViewport.filter((event) =>
        this.isEventAccessible(event, userId),
      );

      if (process.env.NODE_ENV !== "production") {
        console.log("[Viewport] Accessible events:", {
          count: accessibleEvents.length,
          ids: accessibleEvents.map((event) => event.id),
        });
      }

      // Then apply user's filters
      const filteredEvents = accessibleEvents.filter((event) =>
        this.eventMatchesFilters(event, filters),
      );

      if (process.env.NODE_ENV !== "production") {
        console.log("[Viewport] Final filtered events:", {
          count: filteredEvents.length,
          ids: filteredEvents.map((event) => event.id),
        });
      }

      // Send to user's channel
      this.publishFilteredEvents(userId, "viewport", filteredEvents);
    } catch (error) {
      console.error(`Error sending viewport events for user ${userId}:`, error);
    }
  }

  /**
   * Process an event from the raw events feed.
   * This includes CREATE, UPDATE, and DELETE operations.
   */
  private async processEvent(event: {
    operation: string;
    record: Event;
  }): Promise<void> {
    try {
      const { operation, record } = event;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Cache] Processing ${operation} for event ${record.id}`);
      }

      // Handle deletion
      if (operation === "DELETE") {
        // Get all users who might be seeing this event
        const affectedUsers = await this.getAffectedUsers(record);

        // Remove from spatial index and cache
        this.removeEventFromIndex(record.id);
        this.eventCache.delete(record.id);

        // Send delete event to affected users
        for (const userId of affectedUsers) {
          await this.redisPub.publish(
            `user:${userId}:filtered-events`,
            JSON.stringify({
              type: "delete-event",
              id: record.id,
              timestamp: new Date().toISOString(),
            }),
          );
          this.stats.totalFilteredEventsPublished++;
        }
        return;
      }

      // For CREATE/UPDATE operations
      if (operation === "UPDATE") {
        // Get the existing spatial item
        const currentItems = this.spatialIndex.all();
        const existingItem = currentItems.find((item) => item.id === record.id);

        // Create new spatial item
        const newSpatialItem = this.eventToSpatialItem(record);

        if (existingItem) {
          // Update existing item in spatial index
          this.spatialIndex.remove(existingItem);
          this.spatialIndex.insert(newSpatialItem);
        } else {
          // If item doesn't exist, insert it
          this.spatialIndex.insert(newSpatialItem);
        }

        // Update cache
        this.eventCache.set(record.id, record);

        // Get all users who might be affected by this update
        const affectedUsers = await this.getAffectedUsers(record);

        // For each affected user, determine if they should receive an update
        for (const userId of affectedUsers) {
          const filters = this.userFilters.get(userId) || [];
          const viewport = this.userViewports.get(userId);

          // Check if event matches user's filters
          const matchesFilters = this.eventMatchesFilters(
            record,
            filters,
            userId,
          );

          // Check if event is in user's viewport
          const inViewport = viewport
            ? this.isEventInViewport(record, viewport)
            : true;

          if (matchesFilters && inViewport) {
            // Event is visible to user - send update
            const sanitizedEvent = this.stripSensitiveData(record);
            await this.redisPub.publish(
              `user:${userId}:filtered-events`,
              JSON.stringify({
                type: "update-event",
                event: sanitizedEvent,
                timestamp: new Date().toISOString(),
              }),
            );
            this.stats.totalFilteredEventsPublished++;
          } else {
            // Event is no longer visible to user - send delete
            await this.redisPub.publish(
              `user:${userId}:filtered-events`,
              JSON.stringify({
                type: "delete-event",
                id: record.id,
                timestamp: new Date().toISOString(),
              }),
            );
            this.stats.totalFilteredEventsPublished++;
          }
        }
        return;
      }

      // For CREATE operations
      // Add to spatial index and cache
      const spatialItem = this.eventToSpatialItem(record);
      this.spatialIndex.insert(spatialItem);
      this.eventCache.set(record.id, record);

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Cache] Added/Updated event ${record.id} in cache`);
        console.log(`[Cache] Current cache size: ${this.eventCache.size}`);
      }

      // Get all users who might be affected by this new event
      const affectedUsers = await this.getAffectedUsers(record);

      // For each affected user, determine if they should receive the event
      for (const userId of affectedUsers) {
        const filters = this.userFilters.get(userId) || [];
        const viewport = this.userViewports.get(userId);

        // Check if event matches user's filters
        const matchesFilters = this.eventMatchesFilters(
          record,
          filters,
          userId,
        );

        // Check if event is in user's viewport
        const inViewport = viewport
          ? this.isEventInViewport(record, viewport)
          : true;

        if (matchesFilters && inViewport) {
          // Event is visible to user - send add
          const sanitizedEvent = this.stripSensitiveData(record);
          await this.redisPub.publish(
            `user:${userId}:filtered-events`,
            JSON.stringify({
              type: "add-event",
              event: sanitizedEvent,
              timestamp: new Date().toISOString(),
            }),
          );
          this.stats.totalFilteredEventsPublished++;
        }
      }
    } catch (error) {
      console.error("❌ Error processing event:", error);
    }
  }

  /**
   * Get all users who might be affected by an event change
   */
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
        await this.getIntersectingViewports(eventBounds);

      // Add users from intersecting viewports
      for (const { userId } of intersectingViewports) {
        affectedUsers.add(userId);
      }

      // Add users who might see the event regardless of viewport
      // (e.g., users with no viewport set or users with filters that match)
      for (const [userId, filters] of this.userFilters.entries()) {
        if (this.eventMatchesFilters(event, filters, userId)) {
          affectedUsers.add(userId);
        }
      }
    } catch (error) {
      console.error("Error getting affected users:", error);
    }

    return affectedUsers;
  }

  /**
   * Get all viewports that intersect with an event's location
   */
  private async getIntersectingViewports(
    eventBounds: BoundingBox,
  ): Promise<{ userId: string; viewport: BoundingBox }[]> {
    const intersectingViewports: { userId: string; viewport: BoundingBox }[] =
      [];

    try {
      // Calculate the center point of the event
      const centerLng = (eventBounds.minX + eventBounds.maxX) / 2;
      const centerLat = (eventBounds.minY + eventBounds.maxY) / 2;

      // Use a fixed search radius of 50km to ensure we catch all potentially relevant viewports
      const SEARCH_RADIUS_METERS = 50000;

      // Use GEORADIUS to find nearby viewports
      const nearbyViewports = (await this.redisPub.georadius(
        "viewport:geo",
        centerLng,
        centerLat,
        SEARCH_RADIUS_METERS,
        "m", // meters
        "WITHDIST", // include distance
        "ASC", // sort by distance
      )) as [string, string][]; // Type assertion for GEORADIUS response

      // Process results
      for (const [viewportKey] of nearbyViewports) {
        const userId = viewportKey.replace("viewport:", "");
        const viewportData = await this.redisPub.get(viewportKey);

        if (viewportData) {
          const viewport = JSON.parse(viewportData);

          // Double-check intersection (GEORADIUS is approximate)
          if (this.boundsIntersect(eventBounds, viewport)) {
            intersectingViewports.push({ userId, viewport });
          }
        }
      }
    } catch (error) {
      console.error("Error querying intersecting viewports:", error);
    }

    return intersectingViewports;
  }

  /**
   * Check if two bounding boxes intersect
   */
  private boundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.maxX < b.minX ||
      a.minX > b.maxX ||
      a.maxY < b.minY ||
      a.minY > b.maxY
    );
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

  private eventMatchesFilters(
    event: Event,
    filters: Filter[],
    userId?: string,
  ): boolean {
    // If no filters, match everything
    if (filters.length === 0) return true;

    // First check privacy if userId is provided
    if (userId && !this.isEventAccessible(event, userId)) {
      return false;
    }

    // Event matches if it satisfies ANY filter
    return filters.some((filter) => {
      const criteria = filter.criteria;
      let compositeScore = 0;
      let totalWeight = 0;

      // 1. Apply strict location filter if specified
      if (
        criteria.location?.latitude &&
        criteria.location?.longitude &&
        criteria.location?.radius
      ) {
        const [eventLng, eventLat] = event.location.coordinates;
        const distance = this.calculateDistance(
          eventLat,
          eventLng,
          criteria.location.latitude,
          criteria.location.longitude,
        );

        // If event is outside the radius, reject immediately
        if (distance > criteria.location.radius) {
          if (process.env.NODE_ENV !== "production") {
            console.log(
              `Location Filter Rejection: Event ${event.id} is ${distance.toFixed(
                0,
              )}m from filter center (radius: ${criteria.location.radius}m)`,
            );
          }
          return false;
        }
      }

      // 2. Apply date range filter if specified
      if (criteria.dateRange) {
        const { start, end } = criteria.dateRange;

        if (process.env.NODE_ENV !== "production") {
          console.log("Raw Date Values:", {
            eventDate: event.eventDate,
            eventEndDate: event.endDate,
            filterStart: start,
            filterEnd: end,
          });
        }

        try {
          // Parse filter dates first
          if (!start || !end) {
            console.error("Missing filter date range");
            return false;
          }

          // Get the event's timezone or default to UTC
          const eventTimezone = event.timezone || "UTC";

          // Normalize filter dates to cover the full day in the event's timezone
          const filterStartDate = new Date(start + "T00:00:00.000Z");
          const filterEndDate = new Date(end + "T23:59:59.999Z");

          // Validate filter dates
          if (isNaN(filterStartDate.getTime())) {
            console.error("Invalid filter start date:", start);
            return false;
          }
          if (isNaN(filterEndDate.getTime())) {
            console.error("Invalid filter end date:", end);
            return false;
          }

          // Parse event dates
          if (!event.eventDate) {
            console.error("Missing event date");
            return false;
          }

          // For single-day events (endDate is null), use eventDate for both start and end
          const eventStartDate = new Date(event.eventDate);
          const eventEndDate = event.endDate
            ? new Date(event.endDate)
            : eventStartDate;

          // Validate event dates
          if (isNaN(eventStartDate.getTime())) {
            console.error("Invalid event start date:", event.eventDate);
            return false;
          }
          if (isNaN(eventEndDate.getTime())) {
            console.error("Invalid event end date:", event.endDate);
            return false;
          }

          // Validate event date range
          if (eventEndDate < eventStartDate) {
            console.error(
              "Invalid event date range: end date is before start date",
              {
                eventId: event.id,
                eventStartDate: eventStartDate.toISOString(),
                eventEndDate: eventEndDate.toISOString(),
              },
            );
            return false;
          }

          // Convert event dates to the event's timezone for comparison
          const eventStartInTimezone = new Date(
            eventStartDate.toLocaleString("en-US", { timeZone: eventTimezone }),
          );
          const eventEndInTimezone = new Date(
            eventEndDate.toLocaleString("en-US", { timeZone: eventTimezone }),
          );
          const filterStartInTimezone = new Date(
            filterStartDate.toLocaleString("en-US", {
              timeZone: eventTimezone,
            }),
          );
          const filterEndInTimezone = new Date(
            filterEndDate.toLocaleString("en-US", { timeZone: eventTimezone }),
          );

          if (process.env.NODE_ENV !== "production") {
            console.log("Date Range Analysis:", {
              eventId: event.id,
              eventTitle: event.title,
              eventStartDate: eventStartInTimezone.toISOString(),
              eventEndDate: eventEndInTimezone.toISOString(),
              filterStartDate: filterStartInTimezone.toISOString(),
              filterEndDate: filterEndInTimezone.toISOString(),
              isMultiDay: event.endDate !== null,
              timezone: eventTimezone,
              isRejected:
                eventStartInTimezone > filterEndInTimezone ||
                eventEndInTimezone < filterStartInTimezone,
              rejectionReason:
                eventStartInTimezone > filterEndInTimezone
                  ? "start after filter end"
                  : eventEndInTimezone < filterStartInTimezone
                    ? "end before filter start"
                    : "none",
              rawDates: {
                eventStart: eventStartDate.toISOString(),
                eventEnd: eventEndDate.toISOString(),
                filterStart: filterStartDate.toISOString(),
                filterEnd: filterEndDate.toISOString(),
              },
            });
          }

          // Check if event overlaps with filter date range
          // Event must overlap with the filter date range
          const eventStartsBeforeFilterEnd =
            eventStartInTimezone <= filterEndInTimezone;
          const eventEndsAfterFilterStart =
            eventEndInTimezone >= filterStartInTimezone;
          const isInRange =
            eventStartsBeforeFilterEnd && eventEndsAfterFilterStart;

          if (!isInRange) {
            if (process.env.NODE_ENV !== "production") {
              console.log("Date Range Rejection:", {
                eventId: event.id,
                eventTitle: event.title,
                eventStartDate: eventStartInTimezone.toISOString(),
                eventEndDate: eventEndInTimezone.toISOString(),
                filterStartDate: filterStartInTimezone.toISOString(),
                filterEndDate: filterEndInTimezone.toISOString(),
                reason: !eventStartsBeforeFilterEnd
                  ? "starts after filter end"
                  : "ends before filter start",
                currentDate: new Date().toISOString(),
                timezone: eventTimezone,
                isMultiDay: event.endDate !== null,
                eventDuration:
                  eventEndInTimezone.getTime() - eventStartInTimezone.getTime(),
                filterDuration:
                  filterEndInTimezone.getTime() -
                  filterStartInTimezone.getTime(),
                rawDates: {
                  eventStart: eventStartDate.toISOString(),
                  eventEnd: eventEndDate.toISOString(),
                  filterStart: filterStartDate.toISOString(),
                  filterEnd: filterEndDate.toISOString(),
                },
              });
            }
            return false;
          }

          // If this is a date-only filter, return true if the date matches
          if (!criteria.location && !filter.embedding) {
            return true;
          }
        } catch (error) {
          console.error("Error parsing dates:", error);
          return false;
        }
      }

      // 3. If we have a semantic query, calculate weighted similarity score
      if (filter.embedding && event.embedding) {
        try {
          const filterEmbedding = this.vectorService.parseSqlEmbedding(
            filter.embedding,
          );
          const eventEmbedding = this.vectorService.parseSqlEmbedding(
            event.embedding,
          );
          const semanticQuery = filter.semanticQuery?.toLowerCase() || "";

          const similarityScore = this.vectorService.calculateSimilarity(
            filterEmbedding,
            eventEmbedding,
          );

          // Base semantic similarity weight (higher weight since we know the embedding is well-structured)
          compositeScore += similarityScore * 0.5;
          totalWeight += 0.5;

          // Additional text matching for better natural language understanding
          if (filter.semanticQuery) {
            // Title match (still significant weight)
            if (event.title.toLowerCase().includes(semanticQuery)) {
              compositeScore += 0.6;
              totalWeight += 0.15;
            }

            // Category matching (highest weight)
            if (event.categories?.length) {
              const categoryMatches = event.categories.filter((cat) =>
                cat.name.toLowerCase().includes(semanticQuery),
              );
              if (categoryMatches.length > 0) {
                compositeScore += 0.8;
                totalWeight += 0.2;
              }
            }

            // Description match (second highest weight)
            if (event.description?.toLowerCase().includes(semanticQuery)) {
              compositeScore += 0.7;
              totalWeight += 0.15;
            }

            // Location-related matches (higher weight)
            if (!criteria.location) {
              if (event.address?.toLowerCase().includes(semanticQuery)) {
                compositeScore += 0.5;
                totalWeight += 0.1;
              }
              if (event.locationNotes?.toLowerCase().includes(semanticQuery)) {
                compositeScore += 0.6;
                totalWeight += 0.1;
              }
            }
          }

          if (process.env.NODE_ENV !== "production") {
            console.log("Semantic Analysis:", {
              eventId: event.id,
              eventTitle: event.title,
              filterQuery: filter.semanticQuery,
              similarityScore: similarityScore.toFixed(2),
              compositeScore: compositeScore.toFixed(2),
              totalWeight: totalWeight.toFixed(2),
              finalScore: (totalWeight > 0
                ? compositeScore / totalWeight
                : 0
              ).toFixed(2),
              categoryMatches: event.categories
                ?.filter((cat) =>
                  cat.name.toLowerCase().includes(semanticQuery),
                )
                .map((cat) => cat.name),
            });
          }
        } catch (error) {
          console.error("Error calculating semantic similarity:", error);
          return false;
        }
      }

      // If we only have date criteria and no other criteria, return true if we got this far
      if (criteria.dateRange && !criteria.location && !filter.embedding) {
        return true;
      }

      // Calculate final score for semantic filters
      const finalScore = totalWeight > 0 ? compositeScore / totalWeight : 0;

      // Keep threshold low to ensure we catch relevant matches
      let threshold = 0.31; // Lowered threshold for more lenient matching

      // Only slightly lower threshold when combining with other filters
      if (criteria.location || criteria.dateRange) {
        threshold = 0.25;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Filter Debug: Event ${event.id} "${event.title}"\n` +
            `  - Final Score: ${finalScore.toFixed(2)}\n` +
            `  - Threshold: ${threshold.toFixed(2)}\n` +
            `  - Passes: ${finalScore >= threshold}\n` +
            `  - Filter Type: ${
              !criteria.location && !criteria.dateRange
                ? "Semantic Only"
                : "Combined"
            }\n` +
            `  - Has Category Match: ${
              event.categories?.some((cat) =>
                cat.name
                  .toLowerCase()
                  .includes(filter.semanticQuery!.toLowerCase()),
              ) || false
            }`,
        );
      }

      return finalScore >= threshold;
    });
  }

  /**
   * Check if an event is accessible to a user (privacy filter)
   */
  private isEventAccessible(event: Event, userId: string): boolean {
    // Public events are always accessible
    if (!event.isPrivate) return true;

    // Private events are accessible to creator and shared users
    return (
      event.creatorId === userId ||
      (event.sharedWith?.some((share) => share.sharedWithId === userId) ??
        false)
    );
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Check if an event is within a given viewport.
   */
  private isEventInViewport(event: Event, viewport: BoundingBox): boolean {
    const [lng, lat] = event.location.coordinates;

    return (
      lng >= viewport.minX &&
      lng <= viewport.maxX &&
      lat >= viewport.minY &&
      lat <= viewport.maxY
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
   * Strip sensitive data from events before sending to client
   */
  private stripSensitiveData(event: Event): Omit<Event, "embedding"> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding, ...eventWithoutEmbedding } = event;
    return eventWithoutEmbedding;
  }

  // Enhanced publishFilteredEvents with more detailed reporting
  private publishFilteredEvents(
    userId: string,
    type: string,
    events: Event[],
  ): void {
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
        this.redisPub.publish(channel, JSON.stringify(message));
      } else {
        // For other types (like new events), send each event individually
        for (const event of sanitizedEvents) {
          const message = {
            type: "add-event",
            event,
            timestamp: new Date().toISOString(),
          };

          // Publish the event to the user's channel
          this.redisPub.publish(channel, JSON.stringify(message));
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

            // Validate response format
            if (!data || !Array.isArray(data.events)) {
              throw new Error("Invalid response format from backend");
            }

            const { events, hasMore } = data;

            // Process and validate events
            const validEvents = events
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((event: any) => event.location?.coordinates)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((event: any) => ({
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
              }));

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

      // Format for RBush
      const items = uniqueEvents.map((event) => this.eventToSpatialItem(event));

      // Remove any existing items with the same IDs
      items.forEach((item) => {
        this.removeEventFromIndex(item.id);
      });

      // Bulk load for performance
      this.spatialIndex.load(items);

      // Cache the full events
      uniqueEvents.forEach((event) => {
        this.eventCache.set(event.id, event);
      });
    } catch (error) {
      console.error("Error processing initial events batch:", error);
    }
  }
}
