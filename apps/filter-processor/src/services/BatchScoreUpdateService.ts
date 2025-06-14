import { Event, BoundingBox, Filter } from "../types/types";
import { EventPublisher } from "../handlers/EventPublisher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventCacheService } from "./EventCacheService";
import { UserStateService } from "./UserStateService";
import { RelevanceScoringService } from "./RelevanceScoringService";

interface BatchUpdateConfig {
  batchIntervalMs: number; // Default: 15 minutes
  maxBatchSize: number; // Maximum events to process in one batch
  enableBatching: boolean; // Feature flag to enable/disable batching
}

interface PendingUpdate {
  eventId: string;
  event: Event;
  operation: "CREATE" | "UPDATE" | "DELETE";
  timestamp: number;
  isPopularityUpdate: boolean;
}

interface UserScoreUpdate {
  userId: string;
  viewport?: BoundingBox;
  hasCustomFilters: boolean;
  filters: Filter[];
  lastUpdateTime: number;
}

export class BatchScoreUpdateService {
  private config: BatchUpdateConfig;
  private eventPublisher: EventPublisher;
  private mapMojiFilter: MapMojiFilterService;
  private filterMatcher: FilterMatcher;
  private viewportProcessor: ViewportProcessor;

  // Service dependencies
  private eventCacheService: EventCacheService;
  private userStateService: UserStateService;
  private relevanceScoringService: RelevanceScoringService;

  // Batching state
  private pendingUpdates = new Map<string, PendingUpdate>();
  private userScoreUpdates = new Map<string, UserScoreUpdate>();
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessingBatch = false;

  // Stats
  private stats = {
    batchesProcessed: 0,
    totalEventsProcessed: 0,
    totalUsersUpdated: 0,
    averageBatchSize: 0,
    lastBatchTime: 0,
  };

  constructor(
    eventPublisher: EventPublisher,
    mapMojiFilter: MapMojiFilterService,
    filterMatcher: FilterMatcher,
    viewportProcessor: ViewportProcessor,
    eventCacheService: EventCacheService,
    userStateService: UserStateService,
    relevanceScoringService: RelevanceScoringService,
    config?: Partial<BatchUpdateConfig>,
  ) {
    this.eventPublisher = eventPublisher;
    this.mapMojiFilter = mapMojiFilter;
    this.filterMatcher = filterMatcher;
    this.viewportProcessor = viewportProcessor;
    this.eventCacheService = eventCacheService;
    this.userStateService = userStateService;
    this.relevanceScoringService = relevanceScoringService;

    this.config = {
      batchIntervalMs: 15 * 60 * 1000, // 15 minutes
      maxBatchSize: 1000,
      enableBatching: true,
      ...config,
    };

    if (this.config.enableBatching) {
      this.startBatchTimer();
    }
  }

  /**
   * Add an event update to the batch queue
   */
  addEventUpdate(
    event: Event,
    operation: "CREATE" | "UPDATE" | "DELETE",
    isPopularityUpdate: boolean = false,
  ): void {
    if (!this.config.enableBatching) {
      return; // Batching disabled, updates should be handled immediately
    }

    const update: PendingUpdate = {
      eventId: event.id,
      event,
      operation,
      timestamp: Date.now(),
      isPopularityUpdate,
    };

    this.pendingUpdates.set(event.id, update);

    console.log("[BatchScoreUpdate] Added event to batch:", {
      eventId: event.id,
      operation,
      isPopularityUpdate,
      pendingUpdatesCount: this.pendingUpdates.size,
    });

    // If we've reached max batch size, process immediately
    if (this.pendingUpdates.size >= this.config.maxBatchSize) {
      console.log(
        "[BatchScoreUpdate] Max batch size reached, processing immediately",
      );
      this.processBatch();
    }
  }

  /**
   * Register a user for score updates
   */
  registerUserForUpdates(
    userId: string,
    viewport?: BoundingBox,
    filters: Filter[] = [],
  ): void {
    const userUpdate: UserScoreUpdate = {
      userId,
      viewport,
      hasCustomFilters: filters.length > 0,
      filters,
      lastUpdateTime: Date.now(),
    };

    this.userScoreUpdates.set(userId, userUpdate);

    console.log("[BatchScoreUpdate] Registered user for updates:", {
      userId,
      hasViewport: !!viewport,
      filterCount: filters.length,
      totalUsers: this.userScoreUpdates.size,
    });
  }

  /**
   * Unregister a user from score updates
   */
  unregisterUser(userId: string): void {
    this.userScoreUpdates.delete(userId);
    console.log("[BatchScoreUpdate] Unregistered user:", {
      userId,
      remainingUsers: this.userScoreUpdates.size,
    });
  }

  /**
   * Update user's viewport or filters
   */
  updateUserConfig(
    userId: string,
    viewport?: BoundingBox,
    filters: Filter[] = [],
  ): void {
    const existing = this.userScoreUpdates.get(userId);
    if (existing) {
      existing.viewport = viewport;
      existing.filters = filters;
      existing.hasCustomFilters = filters.length > 0;
      existing.lastUpdateTime = Date.now();
    } else {
      this.registerUserForUpdates(userId, viewport, filters);
    }
  }

  /**
   * Start the batch timer
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, this.config.batchIntervalMs);

    console.log("[BatchScoreUpdate] Started batch timer:", {
      intervalMs: this.config.batchIntervalMs,
      intervalMinutes: this.config.batchIntervalMs / (1000 * 60),
    });
  }

  /**
   * Process the current batch of updates
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessingBatch || this.pendingUpdates.size === 0) {
      return;
    }

    this.isProcessingBatch = true;
    const startTime = Date.now();

    try {
      console.log("[BatchScoreUpdate] Starting batch processing:", {
        pendingUpdates: this.pendingUpdates.size,
        registeredUsers: this.userScoreUpdates.size,
        batchIntervalMs: this.config.batchIntervalMs,
      });

      // Get all pending updates
      const updates = Array.from(this.pendingUpdates.values());
      this.pendingUpdates.clear();

      // Group updates by type
      const createUpdates = updates.filter((u) => u.operation === "CREATE");
      const updateUpdates = updates.filter((u) => u.operation === "UPDATE");
      const deleteUpdates = updates.filter((u) => u.operation === "DELETE");

      console.log("[BatchScoreUpdate] Batch composition:", {
        total: updates.length,
        creates: createUpdates.length,
        updates: updateUpdates.length,
        deletes: deleteUpdates.length,
        popularityUpdates: updates.filter((u) => u.isPopularityUpdate).length,
      });

      // Process each user's score updates
      const userUpdatePromises = Array.from(this.userScoreUpdates.values()).map(
        (userUpdate) => this.processUserScoreUpdate(userUpdate, updates),
      );

      await Promise.all(userUpdatePromises);

      // Update stats
      this.stats.batchesProcessed++;
      this.stats.totalEventsProcessed += updates.length;
      this.stats.totalUsersUpdated += this.userScoreUpdates.size;
      this.stats.averageBatchSize =
        (this.stats.averageBatchSize * (this.stats.batchesProcessed - 1) +
          updates.length) /
        this.stats.batchesProcessed;
      this.stats.lastBatchTime = Date.now();

      const processingTime = Date.now() - startTime;

      console.log("[BatchScoreUpdate] Batch processing complete:", {
        processingTimeMs: processingTime,
        eventsProcessed: updates.length,
        usersUpdated: this.userScoreUpdates.size,
        stats: this.stats,
      });
    } catch (error) {
      console.error("[BatchScoreUpdate] Error processing batch:", error);
    } finally {
      this.isProcessingBatch = false;
    }
  }

  /**
   * Process score updates for a specific user
   */
  private async processUserScoreUpdate(
    userUpdate: UserScoreUpdate,
    allUpdates: PendingUpdate[],
  ): Promise<void> {
    try {
      const { userId, viewport, hasCustomFilters, filters } = userUpdate;

      // Get events that are relevant to this user
      const relevantUpdates = allUpdates.filter((update) =>
        this.isEventRelevantToUser(update.event, userId, viewport, filters),
      );

      if (relevantUpdates.length === 0) {
        return; // No relevant updates for this user
      }

      console.log("[BatchScoreUpdate] Processing user score update:", {
        userId,
        relevantUpdates: relevantUpdates.length,
        totalUpdates: allUpdates.length,
        hasViewport: !!viewport,
        hasCustomFilters,
      });

      // Get current events for this user
      const currentEvents = this.getCurrentEventsForUser(
        userId,
        viewport,
        filters,
      );

      // Apply batch updates to current events
      const updatedEvents = this.applyBatchUpdatesToEvents(
        currentEvents,
        relevantUpdates,
      );

      // Recalculate scores for updated events
      const eventsWithScores = await this.recalculateEventScores(
        updatedEvents,
        userId,
        viewport,
        filters,
      );

      // Send batch update to user
      await this.sendBatchUpdateToUser(
        userId,
        eventsWithScores,
        relevantUpdates,
      );

      console.log("[BatchScoreUpdate] User score update complete:", {
        userId,
        eventsUpdated: eventsWithScores.length,
        relevanceScores: eventsWithScores.slice(0, 3).map((e) => ({
          eventId: e.id,
          title: e.title,
          relevanceScore: e.relevanceScore,
        })),
      });
    } catch (error) {
      console.error(
        `[BatchScoreUpdate] Error processing user ${userUpdate.userId}:`,
        error,
      );
    }
  }

  /**
   * Check if an event is relevant to a specific user
   */
  private isEventRelevantToUser(
    event: Event,
    userId: string,
    viewport?: BoundingBox,
    filters: Filter[] = [],
  ): boolean {
    // Check if user has access to the event
    if (!this.filterMatcher.isEventAccessible(event, userId)) {
      return false;
    }

    // Check if event is in user's viewport
    if (
      viewport &&
      !this.viewportProcessor.isEventInViewport(event, viewport)
    ) {
      return false;
    }

    // Check if event matches user's filters
    if (filters.length > 0) {
      return this.filterMatcher.eventMatchesFilters(event, filters, userId);
    }

    return true;
  }

  /**
   * Get current events for a user based on their viewport and filters
   */
  private getCurrentEventsForUser(
    userId: string,
    viewport?: BoundingBox,
    filters: Filter[] = [],
  ): Event[] {
    try {
      let events: Event[] = [];

      if (viewport) {
        // Get events in viewport
        events = this.viewportProcessor.getEventsInViewport(viewport);
      } else {
        // Get all events from cache
        events = Array.from(this.eventCacheService.getAllEvents());
      }

      // Apply filters if any
      if (filters.length > 0) {
        events = events.filter((event) =>
          this.filterMatcher.eventMatchesFilters(event, filters, userId),
        );
      }

      // Filter out events user doesn't have access to
      events = events.filter((event) =>
        this.filterMatcher.isEventAccessible(event, userId),
      );

      return events;
    } catch (error) {
      console.error(
        `[BatchScoreUpdate] Error getting current events for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Apply batch updates to a list of events
   */
  private applyBatchUpdatesToEvents(
    currentEvents: Event[],
    updates: PendingUpdate[],
  ): Event[] {
    const eventMap = new Map<string, Event>();

    // Start with current events
    currentEvents.forEach((event) => {
      eventMap.set(event.id, event);
    });

    // Apply updates
    updates.forEach((update) => {
      switch (update.operation) {
        case "CREATE":
        case "UPDATE":
          eventMap.set(update.eventId, update.event);
          break;
        case "DELETE":
          eventMap.delete(update.eventId);
          break;
      }
    });

    return Array.from(eventMap.values());
  }

  /**
   * Recalculate event scores for a user
   */
  private async recalculateEventScores(
    events: Event[],
    userId: string,
    viewport?: BoundingBox,
    filters: Filter[] = [],
  ): Promise<Array<Event & { relevanceScore?: number }>> {
    if (events.length === 0) return [];

    if (filters.length === 0) {
      // No custom filters - use MapMoji algorithm
      this.mapMojiFilter.updateConfig({
        viewportBounds: viewport || {
          minX: -180,
          minY: -90,
          maxX: 180,
          maxY: 90,
        },
        maxEvents: 50,
        currentTime: new Date(),
      });

      return await this.mapMojiFilter.filterEvents(events);
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
        this.mapMojiFilter.updateConfig({
          viewportBounds: viewport || {
            minX: -180,
            minY: -90,
            maxX: 180,
            maxY: 90,
          },
          maxEvents: 100,
          currentTime: new Date(),
        });

        const mapMojiEvents = await this.mapMojiFilter.filterEvents(events);
        return mapMojiEvents.filter((event) =>
          this.filterMatcher.eventMatchesFilters(event, filters, userId),
        );
      } else {
        // Traditional filtering mode
        const filteredEvents = events.filter((event) =>
          this.filterMatcher.eventMatchesFilters(event, filters, userId),
        );

        // Add simplified relevance scores
        return this.addSimplifiedRelevanceScores(filteredEvents, viewport);
      }
    }
  }

  /**
   * Add simplified relevance scores for traditionally filtered events
   */
  private addSimplifiedRelevanceScores(
    events: Event[],
    viewport?: BoundingBox,
  ): Array<Event & { relevanceScore?: number }> {
    if (events.length === 0) return events;

    const now = new Date();

    return events.map((event) => {
      // Calculate time proximity score (0-1)
      const eventDate = new Date(event.eventDate);
      const hoursUntilEvent =
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      let timeScore = 0.5; // Default score
      if (hoursUntilEvent < 0) {
        timeScore = Math.max(0, 0.5 + hoursUntilEvent / 48);
      } else if (hoursUntilEvent <= 2) {
        timeScore = 1.0;
      } else if (hoursUntilEvent <= 24) {
        timeScore = 0.8;
      } else if (hoursUntilEvent <= 72) {
        timeScore = 0.6;
      } else {
        timeScore = 0.3;
      }

      // Calculate popularity score (0-1)
      const scanScore = Math.min(event.scanCount / 10, 1.0);
      const saveScore = Math.min((event.saveCount || 0) / 5, 1.0);
      const rsvpScore = Math.min((event.rsvps?.length || 0) / 3, 1.0);
      const popularityScore = (scanScore + saveScore * 2 + rsvpScore * 3) / 6;

      // Calculate distance score if viewport is provided
      let distanceScore = 0.5;
      if (viewport) {
        const centerLat = (viewport.maxY + viewport.minY) / 2;
        const centerLng = (viewport.maxX + viewport.minX) / 2;
        const eventLat = event.location.coordinates[1];
        const eventLng = event.location.coordinates[0];

        const latDiff = Math.abs(eventLat - centerLat);
        const lngDiff = Math.abs(eventLng - centerLng);
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;

        if (distance <= 1) distanceScore = 1.0;
        else if (distance <= 5) distanceScore = 0.8;
        else if (distance <= 15) distanceScore = 0.6;
        else if (distance <= 50) distanceScore = 0.4;
        else distanceScore = 0.2;
      }

      // Combine scores with weights
      const relevanceScore =
        timeScore * 0.4 + popularityScore * 0.4 + distanceScore * 0.2;

      return {
        ...event,
        relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
      };
    });
  }

  /**
   * Send batch update to a user
   */
  private async sendBatchUpdateToUser(
    userId: string,
    eventsWithScores: Array<Event & { relevanceScore?: number }>,
    updates: PendingUpdate[],
  ): Promise<void> {
    try {
      // Group events by operation type
      const createEvents = eventsWithScores.filter((event) =>
        updates.some((u) => u.eventId === event.id && u.operation === "CREATE"),
      );
      const updateEvents = eventsWithScores.filter((event) =>
        updates.some((u) => u.eventId === event.id && u.operation === "UPDATE"),
      );
      const deleteEventIds = updates
        .filter((u) => u.operation === "DELETE")
        .map((u) => u.eventId);

      // Send batch update message
      await this.eventPublisher.publishBatchUpdate(userId, {
        type: "batch-update",
        timestamp: Date.now(),
        updates: {
          creates: createEvents,
          updates: updateEvents,
          deletes: deleteEventIds,
        },
        summary: {
          totalEvents: eventsWithScores.length,
          newEvents: createEvents.length,
          updatedEvents: updateEvents.length,
          deletedEvents: deleteEventIds.length,
        },
      });

      console.log("[BatchScoreUpdate] Sent batch update to user:", {
        userId,
        totalEvents: eventsWithScores.length,
        newEvents: createEvents.length,
        updatedEvents: updateEvents.length,
        deletedEvents: deleteEventIds.length,
      });
    } catch (error) {
      console.error(
        `[BatchScoreUpdate] Error sending batch update to user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Get current statistics
   */
  getStats(): typeof this.stats & {
    pendingUpdates: number;
    registeredUsers: number;
    isProcessingBatch: boolean;
    config: BatchUpdateConfig;
  } {
    return {
      ...this.stats,
      pendingUpdates: this.pendingUpdates.size,
      registeredUsers: this.userScoreUpdates.size,
      isProcessingBatch: this.isProcessingBatch,
      config: this.config,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BatchUpdateConfig>): void {
    const oldInterval = this.config.batchIntervalMs;
    this.config = { ...this.config, ...config };

    // Restart timer if interval changed
    if (
      oldInterval !== this.config.batchIntervalMs &&
      this.config.enableBatching
    ) {
      this.startBatchTimer();
    }

    console.log("[BatchScoreUpdate] Configuration updated:", this.config);
  }

  /**
   * Force process the current batch immediately
   */
  async forceProcessBatch(): Promise<void> {
    console.log("[BatchScoreUpdate] Force processing batch");
    await this.processBatch();
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Process any remaining updates
    if (this.pendingUpdates.size > 0) {
      console.log(
        "[BatchScoreUpdate] Processing remaining updates on shutdown",
      );
      this.processBatch();
    }

    console.log("[BatchScoreUpdate] Service shutdown complete");
  }
}
