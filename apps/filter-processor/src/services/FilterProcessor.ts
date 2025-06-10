// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import RBush from "rbush";
import { Filter, BoundingBox, SpatialItem, Event } from "../types/types";
import { EventProcessor } from "../handlers/EventProcessor";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventPublisher } from "../handlers/EventPublisher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { BatchScoreUpdateService } from "./BatchScoreUpdateService";
import { getBatchConfig } from "../config/batchConfig";

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
  private mapMojiFilter: MapMojiFilterService;
  private batchScoreUpdateService: BatchScoreUpdateService;

  // Stats for monitoring
  private stats = {
    eventsProcessed: 0,
    filterChangesProcessed: 0,
    viewportUpdatesProcessed: 0,
    totalFilteredEventsPublished: 0,
    mapMojiFilterApplied: 0,
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
    this.mapMojiFilter = new MapMojiFilterService();

    // Initialize batch score update service
    this.batchScoreUpdateService = new BatchScoreUpdateService(
      this.eventPublisher,
      this.mapMojiFilter,
      this.filterMatcher,
      this.viewportProcessor,
      this.spatialIndex,
      this.eventCache,
      getBatchConfig(),
    );
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
        ...this.batchScoreUpdateService.getStats(),
      });
    }

    // Shutdown batch score update service
    this.batchScoreUpdateService.shutdown();

    // Clean up Redis subscribers
    await this.redisSub.unsubscribe();
    await this.redisSub.quit();
    await this.redisPub.quit();
  }

  /**
   * Get current statistics for the filter processor.
   */
  public getStats(): typeof this.stats &
    ReturnType<typeof this.eventPublisher.getStats> &
    ReturnType<typeof this.batchScoreUpdateService.getStats> {
    return {
      ...this.stats,
      ...this.eventPublisher.getStats(),
      ...this.batchScoreUpdateService.getStats(),
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

        // Handle the nested structure from EventService
        const eventData = data.data || data;

        // Check if this is a popularity-related update
        const isPopularityUpdate = this.isPopularityRelatedUpdate(eventData);

        console.log("[FilterProcessor] Received event change:", {
          operation: eventData.operation,
          eventId: eventData.record?.id,
          isPrivate: eventData.record?.isPrivate,
          creatorId: eventData.record?.creatorId,
          sharedWith: eventData.record?.sharedWith?.map(
            (s: { sharedWithId: string }) => s.sharedWithId,
          ),
          isPopularityUpdate,
          popularityMetrics: isPopularityUpdate
            ? {
                current: {
                  scanCount: eventData.record?.scanCount,
                  saveCount: eventData.record?.saveCount,
                  rsvpCount: eventData.record?.rsvps?.length || 0,
                },
                previous: eventData.previousMetrics
                  ? {
                      scanCount: eventData.previousMetrics.scanCount,
                      saveCount: eventData.previousMetrics.saveCount,
                      rsvpCount: eventData.previousMetrics.rsvpCount,
                    }
                  : undefined,
                change: eventData.previousMetrics
                  ? {
                      scanCount:
                        (eventData.record?.scanCount || 0) -
                        eventData.previousMetrics.scanCount,
                      saveCount:
                        (eventData.record?.saveCount || 0) -
                        eventData.previousMetrics.saveCount,
                      rsvpCount:
                        (eventData.record?.rsvps?.length || 0) -
                        eventData.previousMetrics.rsvpCount,
                    }
                  : undefined,
                changeType: eventData.changeType,
                userId: eventData.userId,
              }
            : undefined,
          rawData: data, // Log the full data for debugging
        });

        // Validate the event data
        if (!eventData.record || !eventData.record.id) {
          console.error("[FilterProcessor] Invalid event data received:", data);
          return;
        }

        // Process the event (this updates both spatial index and cache)
        console.log("[FilterProcessor] Processing event update:", {
          eventId: eventData.record.id,
          operation: eventData.operation,
          isPopularityUpdate,
          spatialIndexSize: this.spatialIndex.all().length,
          cacheSize: this.eventCache.size,
        });

        await this.eventProcessor.processEvent(eventData);
        this.stats.eventsProcessed++;

        console.log(
          "[FilterProcessor] Event processed, spatial index updated:",
          {
            eventId: eventData.record.id,
            operation: eventData.operation,
            isPopularityUpdate,
            newSpatialIndexSize: this.spatialIndex.all().length,
            newCacheSize: this.eventCache.size,
          },
        );

        // For popularity updates, verify the spatial index was updated correctly
        if (isPopularityUpdate) {
          const spatialIndexUpdated = this.verifySpatialIndexUpdate(
            eventData.record.id,
            eventData.record,
          );
          console.log(
            "[FilterProcessor] Spatial index verification for popularity update:",
            {
              eventId: eventData.record.id,
              spatialIndexUpdated,
            },
          );
        }

        // Add event to batch update service instead of immediate processing
        this.batchScoreUpdateService.addEventUpdate(
          eventData.record,
          eventData.operation as "CREATE" | "UPDATE" | "DELETE",
          isPopularityUpdate,
        );

        // For non-popularity updates, still use immediate notification for critical updates
        if (!isPopularityUpdate) {
          const affectedUsers = await this.getAffectedUsers(eventData.record);
          await this.notifyAffectedUsers(affectedUsers, eventData);
        }

        console.log("[FilterProcessor] Event added to batch update service:", {
          eventId: eventData.record.id,
          operation: eventData.operation,
          isPopularityUpdate,
          willUseBatching: isPopularityUpdate,
        });
      }
    } catch (error) {
      console.error(`Error handling pattern message: ${error}`, {
        channel,
        message,
      });
    }
  };

  /**
   * Check if an event update is related to popularity metrics
   */
  private isPopularityRelatedUpdate(data: {
    operation: string;
    record?: Event;
  }): boolean {
    if (data.operation !== "UPDATE") return false;

    const record = data.record;
    if (!record) return false;

    // Check if any popularity-related fields are present
    return (
      typeof record.scanCount === "number" ||
      typeof record.saveCount === "number" ||
      (Array.isArray(record.rsvps) && record.rsvps.length > 0)
    );
  }

  private async handleFilterChanges(data: {
    userId: string;
    filters: Filter[];
  }): Promise<void> {
    const { userId, filters } = data;
    this.userFilters.set(userId, filters);
    this.stats.filterChangesProcessed++;

    // Register user with batch update service
    const viewport = this.userViewports.get(userId);
    this.batchScoreUpdateService.updateUserConfig(userId, viewport, filters);

    // Re-filter existing events for this user based on current viewport
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

    // Update user config in batch service
    const filters = this.userFilters.get(userId) || [];
    this.batchScoreUpdateService.updateUserConfig(userId, viewport, filters);

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

      // Register user with batch update service
      const viewport = this.userViewports.get(userId);
      const filters = this.userFilters.get(userId) || [];
      this.batchScoreUpdateService.registerUserForUpdates(
        userId,
        viewport,
        filters,
      );
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
      let filteredEvents: Event[];

      if (filters.length === 0) {
        // No custom filters - apply MapMoji algorithm for curated experience
        console.log(
          `[FilterProcessor] Applying MapMoji algorithm for user ${userId} (no custom filters)`,
        );

        // Update MapMoji configuration for this request
        this.mapMojiFilter.updateConfig({
          viewportBounds: viewport,
          maxEvents: 1000, // Configurable
          currentTime: new Date(),
        });

        // Apply MapMoji filtering (events will have relevance scores)
        const mapMojiEvents =
          await this.mapMojiFilter.filterEvents(eventsInViewport);
        filteredEvents = mapMojiEvents;
        this.stats.mapMojiFilterApplied++;

        console.log(
          `[FilterProcessor] MapMoji filtered ${eventsInViewport.length} events to ${filteredEvents.length} for user ${userId}`,
        );
      } else {
        // Check if we have date range filters only (hybrid mode)
        const hasDateRangeOnly = filters.every(
          (filter) =>
            filter.criteria.dateRange &&
            !filter.criteria.location &&
            !filter.semanticQuery,
        );

        if (hasDateRangeOnly) {
          // Hybrid mode: Apply MapMoji first, then date range filters
          console.log(
            `[FilterProcessor] Applying hybrid filtering for user ${userId} (MapMoji + date range)`,
          );

          // Update MapMoji configuration for this request
          this.mapMojiFilter.updateConfig({
            viewportBounds: viewport,
            maxEvents: 100, // Allow more events for date filtering
            currentTime: new Date(),
          });

          // Apply MapMoji filtering first
          const mapMojiEvents =
            await this.mapMojiFilter.filterEvents(eventsInViewport);
          this.stats.mapMojiFilterApplied++;

          // Then apply date range filters on top of MapMoji results
          filteredEvents = mapMojiEvents.filter((event) =>
            this.filterMatcher.eventMatchesFilters(event, filters, userId),
          );

          console.log(
            `[FilterProcessor] Hybrid filtered ${eventsInViewport.length} events to ${mapMojiEvents.length} (MapMoji) to ${filteredEvents.length} (with date range) for user ${userId}`,
          );
        } else {
          // Traditional filtering mode - bypass MapMoji and use traditional filtering
          console.log(
            `[FilterProcessor] Using traditional filters for user ${userId} (${filters.length} filters)`,
          );

          // Apply traditional filters
          filteredEvents = eventsInViewport.filter((event) =>
            this.filterMatcher.eventMatchesFilters(event, filters, userId),
          );

          // Add relevance scores for traditionally filtered events
          filteredEvents = this.addRelevanceScoresToEvents(
            filteredEvents,
            viewport,
          );
        }
      }

      // Send to user's channel
      console.log(
        `[FilterProcessor] Publishing ${filteredEvents.length} events to user ${userId} with updated relevance scores:`,
        {
          userId,
          eventCount: filteredEvents.length,
          topEventScores: filteredEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
            popularityMetrics: {
              scanCount: event.scanCount,
              saveCount: event.saveCount || 0,
              rsvpCount: event.rsvps?.length || 0,
            },
          })),
          messageType: "viewport",
        },
      );

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

      // Get user's filters
      const userFilters = this.userFilters.get(userId) || [];
      let filteredEvents: Event[];

      if (userFilters.length === 0) {
        // No custom filters - apply MapMoji algorithm for curated experience
        console.log(
          `[FilterProcessor] Applying MapMoji algorithm for all events for user ${userId} (no custom filters)`,
        );

        // Update MapMoji configuration for this request
        this.mapMojiFilter.updateConfig({
          maxEvents: 50, // Configurable
          currentTime: new Date(),
        });

        // Apply MapMoji filtering (events will have relevance scores)
        const mapMojiEvents = await this.mapMojiFilter.filterEvents(allEvents);
        filteredEvents = mapMojiEvents;
        this.stats.mapMojiFilterApplied++;

        console.log(
          `[FilterProcessor] MapMoji filtered ${allEvents.length} events to ${filteredEvents.length} for user ${userId}`,
        );
      } else {
        // Check if we have date range filters only (hybrid mode)
        const hasDateRangeOnly = userFilters.every(
          (filter) =>
            filter.criteria.dateRange &&
            !filter.criteria.location &&
            !filter.semanticQuery,
        );

        if (hasDateRangeOnly) {
          // Hybrid mode: Apply MapMoji first, then date range filters
          console.log(
            `[FilterProcessor] Applying hybrid filtering for all events for user ${userId} (MapMoji + date range)`,
          );

          // Update MapMoji configuration for this request
          this.mapMojiFilter.updateConfig({
            maxEvents: 100, // Allow more events for date filtering
            currentTime: new Date(),
          });

          // Apply MapMoji filtering first
          const mapMojiEvents =
            await this.mapMojiFilter.filterEvents(allEvents);
          this.stats.mapMojiFilterApplied++;

          // Then apply date range filters on top of MapMoji results
          filteredEvents = mapMojiEvents.filter((event) =>
            this.filterMatcher.eventMatchesFilters(event, userFilters, userId),
          );

          console.log(
            `[FilterProcessor] Hybrid filtered ${allEvents.length} events to ${mapMojiEvents.length} (MapMoji) to ${filteredEvents.length} (with date range) for user ${userId}`,
          );
        } else {
          // Traditional filtering mode - bypass MapMoji and use traditional filtering
          console.log(
            `[FilterProcessor] Using traditional filters for all events for user ${userId} (${userFilters.length} filters)`,
          );

          // Apply traditional filters
          filteredEvents = allEvents.filter((event) =>
            this.filterMatcher.eventMatchesFilters(event, userFilters, userId),
          );

          // Add relevance scores for traditionally filtered events
          filteredEvents = this.addRelevanceScoresToEvents(filteredEvents);
        }
      }

      // Publish the filtered events
      console.log(
        `[FilterProcessor] Publishing ${filteredEvents.length} events to user ${userId} with updated relevance scores:`,
        {
          userId,
          eventCount: filteredEvents.length,
          topEventScores: filteredEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
            popularityMetrics: {
              scanCount: event.scanCount,
              saveCount: event.saveCount || 0,
              rsvpCount: event.rsvps?.length || 0,
            },
          })),
          messageType: "all",
        },
      );

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

      let shouldSendEvent = false;

      if (filters.length === 0) {
        // No custom filters - check if event would pass MapMoji pre-filtering
        console.log(
          `[FilterProcessor] Checking MapMoji pre-filtering for user ${userId} (no custom filters)`,
        );

        // Update MapMoji configuration to check pre-filtering
        this.mapMojiFilter.updateConfig({
          viewportBounds: viewport || {
            minX: -180,
            minY: -90,
            maxX: 180,
            maxY: 90,
          },
          currentTime: new Date(),
        });

        // Check if event passes basic MapMoji criteria (status, viewport, time)
        const now = new Date();
        const eventDate = new Date(record.eventDate);

        // Basic pre-filter checks
        const validStatus =
          record.status !== "REJECTED" && record.status !== "EXPIRED";
        const inViewport = viewport
          ? this.viewportProcessor.isEventInViewport(record, viewport)
          : true;
        const notTooFarPast =
          eventDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000); // Within 24h past
        const notTooFarFuture =
          eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Within 30 days future

        shouldSendEvent =
          validStatus && inViewport && notTooFarPast && notTooFarFuture;

        console.log(
          `[FilterProcessor] MapMoji pre-filter result for user ${userId}:`,
          {
            eventId: record.id,
            validStatus,
            inViewport,
            notTooFarPast,
            notTooFarFuture,
            shouldSendEvent,
          },
        );
      } else {
        // Check if we have date range filters only (hybrid mode)
        const hasDateRangeOnly = filters.every(
          (filter) =>
            filter.criteria.dateRange &&
            !filter.criteria.location &&
            !filter.semanticQuery,
        );

        if (hasDateRangeOnly) {
          // Hybrid mode: Check MapMoji pre-filtering first, then date range filters
          console.log(
            `[FilterProcessor] Checking hybrid filtering for user ${userId} (MapMoji + date range)`,
          );

          // Update MapMoji configuration to check pre-filtering
          this.mapMojiFilter.updateConfig({
            viewportBounds: viewport || {
              minX: -180,
              minY: -90,
              maxX: 180,
              maxY: 90,
            },
            currentTime: new Date(),
          });

          // Check if event passes basic MapMoji criteria (status, viewport, time)
          const now = new Date();
          const eventDate = new Date(record.eventDate);

          // Basic pre-filter checks
          const validStatus =
            record.status !== "REJECTED" && record.status !== "EXPIRED";
          const inViewport = viewport
            ? this.viewportProcessor.isEventInViewport(record, viewport)
            : true;
          const notTooFarPast =
            eventDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000); // Within 24h past
          const notTooFarFuture =
            eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Within 30 days future

          const passesMapMoji =
            validStatus && inViewport && notTooFarPast && notTooFarFuture;

          // If passes MapMoji, check date range filters
          const matchesDateRange = passesMapMoji
            ? this.filterMatcher.eventMatchesFilters(record, filters, userId)
            : false;

          shouldSendEvent = matchesDateRange;

          console.log(
            `[FilterProcessor] Hybrid filter result for user ${userId}:`,
            {
              eventId: record.id,
              validStatus,
              inViewport,
              notTooFarPast,
              notTooFarFuture,
              passesMapMoji,
              matchesDateRange,
              shouldSendEvent,
            },
          );
        } else {
          // Traditional filtering mode - use traditional filtering
          console.log(
            `[FilterProcessor] Using traditional filters for user ${userId} (${filters.length} filters)`,
          );

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

          shouldSendEvent = matchesFilters && inViewport;

          console.log("[FilterProcessor] Traditional filter result:", {
            eventId: record.id,
            userId,
            matchesFilters,
            inViewport,
            hasViewport: !!viewport,
            filterCount: filters.length,
            shouldSendEvent,
          });
        }
      }

      if (shouldSendEvent) {
        // Add relevance score to the event before sending
        const eventWithRelevanceScore = this.addRelevanceScoresToEvents(
          [record],
          viewport,
        )[0];

        switch (operation) {
          case "CREATE":
          case "INSERT": // Add support for INSERT operation
            console.log("[FilterProcessor] Publishing new event to user:", {
              eventId: record.id,
              userId,
              operation,
              isPrivate: record.isPrivate,
              creatorId: record.creatorId,
              relevanceScore: eventWithRelevanceScore.relevanceScore,
            });
            await this.eventPublisher.publishFilteredEvents(userId, "add", [
              eventWithRelevanceScore,
            ]);
            break;
          case "UPDATE":
            await this.eventPublisher.publishUpdateEvent(
              userId,
              eventWithRelevanceScore,
            );
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
                  scanCount?: number;
                  saveCount?: number;
                  confidenceScore?: number;
                  timezone?: string;
                  address?: string;
                  locationNotes?: string;
                  // Recurring event fields
                  isRecurring?: boolean;
                  recurrenceFrequency?: string;
                  recurrenceDays?: string[];
                  recurrenceStartDate?: string;
                  recurrenceEndDate?: string;
                  recurrenceInterval?: number;
                  recurrenceTime?: string;
                  recurrenceExceptions?: string[];
                  // RSVP relationship
                  rsvps?: Array<{
                    id: string;
                    userId: string;
                    eventId: string;
                    status: "GOING" | "NOT_GOING";
                    createdAt: string;
                    updatedAt: string;
                  }>;
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
                  scanCount: event.scanCount || 0,
                  saveCount: event.saveCount || 0,
                  confidenceScore: event.confidenceScore,
                  timezone: event.timezone,
                  address: event.address,
                  locationNotes: event.locationNotes,
                  // Recurring event fields
                  isRecurring: event.isRecurring || false,
                  recurrenceFrequency: event.recurrenceFrequency,
                  recurrenceDays: event.recurrenceDays,
                  recurrenceStartDate: event.recurrenceStartDate,
                  recurrenceEndDate: event.recurrenceEndDate,
                  recurrenceInterval: event.recurrenceInterval,
                  recurrenceTime: event.recurrenceTime,
                  recurrenceExceptions: event.recurrenceExceptions,
                  // RSVP relationship
                  rsvps: event.rsvps || [],
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

  private addRelevanceScoresToEvents(
    events: Event[],
    viewport?: BoundingBox,
  ): Event[] {
    if (events.length === 0) return events;

    // For traditionally filtered events, we'll calculate a simplified relevance score
    // based on time proximity and popularity
    const now = new Date();

    return events.map((event) => {
      // Calculate time proximity score (0-1)
      const eventDate = new Date(event.eventDate);
      const hoursUntilEvent =
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      let timeScore = 0.5; // Default score
      if (hoursUntilEvent < 0) {
        // Past events (within 24h) get lower scores
        timeScore = Math.max(0, 0.5 + hoursUntilEvent / 48);
      } else if (hoursUntilEvent <= 2) {
        // Very soon - high urgency
        timeScore = 1.0;
      } else if (hoursUntilEvent <= 24) {
        // Today - good relevance
        timeScore = 0.8;
      } else if (hoursUntilEvent <= 72) {
        // Within 3 days - moderate relevance
        timeScore = 0.6;
      } else {
        // Further out - lower relevance
        timeScore = 0.3;
      }

      // Calculate popularity score (0-1)
      const scanScore = Math.min(event.scanCount / 10, 1.0);
      const saveScore = Math.min((event.saveCount || 0) / 5, 1.0);
      const rsvpScore = Math.min((event.rsvps?.length || 0) / 3, 1.0);
      const popularityScore = (scanScore + saveScore * 2 + rsvpScore * 3) / 6;

      // Calculate distance score if viewport is provided
      let distanceScore = 0.5; // Default score
      if (viewport) {
        const centerLat = (viewport.maxY + viewport.minY) / 2;
        const centerLng = (viewport.maxX + viewport.minX) / 2;
        const eventLat = event.location.coordinates[1];
        const eventLng = event.location.coordinates[0];

        // Simple distance calculation (Haversine would be more accurate)
        const latDiff = Math.abs(eventLat - centerLat);
        const lngDiff = Math.abs(eventLng - centerLng);
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion

        if (distance <= 1) distanceScore = 1.0;
        else if (distance <= 5) distanceScore = 0.8;
        else if (distance <= 15) distanceScore = 0.6;
        else if (distance <= 50) distanceScore = 0.4;
        else distanceScore = 0.2;
      }

      // Combine scores with weights similar to MapMoji
      const relevanceScore =
        timeScore * 0.4 + // Time proximity (40%)
        popularityScore * 0.4 + // Popularity (40%)
        distanceScore * 0.2; // Distance (20%)

      return {
        ...event,
        relevanceScore: Math.max(0, Math.min(1, relevanceScore)), // Clamp to 0-1
      };
    });
  }

  /**
   * Verify that the spatial index contains the updated event data
   */
  private verifySpatialIndexUpdate(
    eventId: string,
    expectedEvent: Event,
  ): boolean {
    try {
      const spatialItems = this.spatialIndex.all();
      const spatialItem = spatialItems.find((item) => item.id === eventId);

      if (!spatialItem) {
        console.warn(
          "[FilterProcessor] Event not found in spatial index:",
          eventId,
        );
        return false;
      }

      const cachedEvent = this.eventCache.get(eventId);
      if (!cachedEvent) {
        console.warn("[FilterProcessor] Event not found in cache:", eventId);
        return false;
      }

      // Verify that popularity metrics match
      const spatialEvent = spatialItem.event;
      if (!spatialEvent) {
        console.warn(
          "[FilterProcessor] Spatial item has no event data:",
          eventId,
        );
        return false;
      }

      const metricsMatch =
        spatialEvent.scanCount === expectedEvent.scanCount &&
        spatialEvent.saveCount === expectedEvent.saveCount &&
        spatialEvent.rsvps?.length === expectedEvent.rsvps?.length;

      if (!metricsMatch) {
        console.warn(
          "[FilterProcessor] Popularity metrics mismatch in spatial index:",
          {
            eventId,
            expected: {
              scanCount: expectedEvent.scanCount,
              saveCount: expectedEvent.saveCount,
              rsvpCount: expectedEvent.rsvps?.length || 0,
            },
            actual: {
              scanCount: spatialEvent.scanCount,
              saveCount: spatialEvent.saveCount,
              rsvpCount: spatialEvent.rsvps?.length || 0,
            },
          },
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "[FilterProcessor] Error verifying spatial index update:",
        error,
      );
      return false;
    }
  }

  /**
   * Handle user disconnection - unregister from batch updates
   */
  public handleUserDisconnection(userId: string): void {
    console.log("[FilterProcessor] User disconnected:", {
      userId,
      hadFilters: this.userFilters.has(userId),
      hadViewport: this.userViewports.has(userId),
    });

    // Unregister from batch update service
    this.batchScoreUpdateService.unregisterUser(userId);

    // Clean up user data
    this.userFilters.delete(userId);
    this.userViewports.delete(userId);

    console.log("[FilterProcessor] User cleanup complete:", {
      userId,
      remainingUsers: this.userFilters.size,
    });
  }

  /**
   * Force process the current batch immediately (for testing or manual triggers)
   */
  public async forceProcessBatch(): Promise<void> {
    console.log("[FilterProcessor] Force processing batch update");
    await this.batchScoreUpdateService.forceProcessBatch();
  }

  /**
   * Update batch configuration
   */
  public updateBatchConfig(config: {
    batchIntervalMs?: number;
    maxBatchSize?: number;
    enableBatching?: boolean;
  }): void {
    console.log("[FilterProcessor] Updating batch configuration:", config);
    this.batchScoreUpdateService.updateConfig(config);
  }
}
