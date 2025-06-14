// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import { Filter, BoundingBox, Event } from "../types/types";
import { EventProcessor } from "../handlers/EventProcessor";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventPublisher } from "../handlers/EventPublisher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { BatchScoreUpdateService } from "./BatchScoreUpdateService";
import { createEventCacheService } from "./EventCacheService";
import { createUserStateService } from "./UserStateService";
import { createRelevanceScoringService } from "./RelevanceScoringService";
import { createEventFilteringService } from "./EventFilteringService";
import {
  createRedisMessageHandler,
  MessageHandlers,
} from "./RedisMessageHandler";
import { createEventInitializationService } from "./EventInitializationService";
import { createUserNotificationService } from "./UserNotificationService";
import { createJobProcessingService } from "./JobProcessingService";
import { getBatchConfig } from "../config/batchConfig";

export interface FilterProcessor {
  // Core lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Event processing
  processEventUpdate(eventData: {
    operation: string;
    record: Event;
  }): Promise<void>;

  // User management
  handleFilterChanges(userId: string, filters: Filter[]): Promise<void>;
  handleViewportUpdate(userId: string, viewport: BoundingBox): Promise<void>;
  handleInitialRequest(userId: string): Promise<void>;
  handleUserDisconnection(userId: string): void;

  // Batch processing
  forceProcessBatch(): Promise<void>;
  updateBatchConfig(config: {
    batchIntervalMs?: number;
    maxBatchSize?: number;
    enableBatching?: boolean;
  }): void;

  // Stats
  getStats(): Record<string, unknown>;
}

export interface FilterProcessorConfig {
  // Service configurations
  eventCacheConfig?: {
    maxCacheSize?: number;
    enableSpatialIndex?: boolean;
  };
  userStateConfig?: {
    maxUsers?: number;
    enableViewportTracking?: boolean;
    enableFilterTracking?: boolean;
  };
  relevanceScoringConfig?: {
    popularityWeight?: number;
    timeWeight?: number;
    distanceWeight?: number;
    maxPastHours?: number;
    maxFutureDays?: number;
  };
  batchConfig?: {
    batchIntervalMs?: number;
    maxBatchSize?: number;
    enableBatching?: boolean;
  };
  eventFilteringConfig?: {
    mapMojiConfig?: {
      maxEvents?: number;
      enableHybridMode?: boolean;
    };
  };
  redisConfig?: {
    channels?: {
      filterChanges?: string;
      viewportUpdates?: string;
      initialRequest?: string;
      eventChanges?: string;
      jobCreated?: string;
      jobUpdates?: string;
    };
  };
  eventInitializationConfig?: {
    backendUrl?: string;
    pageSize?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  userNotificationConfig?: {
    enableMapMojiPreFiltering?: boolean;
    enableHybridMode?: boolean;
  };
  jobProcessingConfig?: {
    enableEventCacheClearing?: boolean;
    enableUserNotifications?: boolean;
  };
}

export function createFilterProcessor(
  redisPub: Redis,
  redisSub: Redis,
  config: FilterProcessorConfig = {},
): FilterProcessor {
  const {
    eventCacheConfig = {},
    userStateConfig = {},
    relevanceScoringConfig = {},
    batchConfig = {},
    eventFilteringConfig = {},
    redisConfig = {},
    eventInitializationConfig = {},
    userNotificationConfig = {},
    jobProcessingConfig = {},
  } = config;

  // Create core services
  const eventCacheService = createEventCacheService(eventCacheConfig);
  const userStateService = createUserStateService(userStateConfig);
  const relevanceScoringService = createRelevanceScoringService(
    relevanceScoringConfig,
  );

  // Create handlers with service dependencies
  const eventProcessor = new EventProcessor(eventCacheService);
  const filterMatcher = new FilterMatcher();
  const viewportProcessor = new ViewportProcessor(redisPub, eventCacheService);
  const eventPublisher = new EventPublisher(redisPub);
  const mapMojiFilter = new MapMojiFilterService();

  // Create specialized services
  const eventFilteringService = createEventFilteringService(
    filterMatcher,
    mapMojiFilter,
    relevanceScoringService,
    eventPublisher,
    eventFilteringConfig,
  );

  const eventInitializationService = createEventInitializationService(
    eventProcessor,
    eventInitializationConfig,
  );

  const userNotificationService = createUserNotificationService(
    filterMatcher,
    viewportProcessor,
    eventPublisher,
    relevanceScoringService,
    mapMojiFilter,
    (userId: string) => userStateService.getUserFilters(userId),
    (userId: string) => userStateService.getUserViewport(userId),
    userNotificationConfig,
  );

  const jobProcessingService = createJobProcessingService(
    eventPublisher,
    () => eventCacheService.clearAll(),
    () => userStateService.getAllUserIds(),
    async (userId: string, viewport: BoundingBox) => {
      const eventsInViewport = viewportProcessor.getEventsInViewport(viewport);
      const filters = userStateService.getUserFilters(userId);
      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        viewport,
        filters,
        eventsInViewport,
      );
    },
    async (userId: string) => {
      const allEvents = eventCacheService.getAllEvents();
      const filters = userStateService.getUserFilters(userId);
      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        allEvents,
      );
    },
    (userId: string) => userStateService.getUserViewport(userId),
    jobProcessingConfig,
  );

  // Create batch score update service
  const batchScoreUpdateService = new BatchScoreUpdateService(
    eventPublisher,
    mapMojiFilter,
    filterMatcher,
    viewportProcessor,
    eventCacheService,
    userStateService,
    relevanceScoringService,
    { ...getBatchConfig(), ...batchConfig },
  );

  // Create Redis message handler
  const messageHandlers: MessageHandlers = {
    onFilterChanges: handleFilterChanges,
    onViewportUpdate: handleViewportUpdate,
    onInitialRequest: handleInitialRequest,
    onEventUpdate: processEventUpdate,
    onJobCreated: jobProcessingService.handleJobCreated,
    onJobUpdate: jobProcessingService.handleJobUpdate,
  };

  const redisMessageHandler = createRedisMessageHandler(
    redisSub,
    messageHandlers,
    redisConfig,
  );

  // Stats for monitoring
  const stats = {
    eventsProcessed: 0,
    filterChangesProcessed: 0,
    viewportUpdatesProcessed: 0,
    totalFilteredEventsPublished: 0,
  };

  /**
   * Initialize the filter processor service.
   */
  async function initialize(): Promise<void> {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("Initializing Filter Processor...");
      }

      // Initialize events
      await eventInitializationService.initializeEvents();

      // Subscribe to Redis channels
      await redisMessageHandler.subscribeToChannels();

      if (process.env.NODE_ENV !== "production") {
        console.log("Filter Processor initialized:", {
          events: eventCacheService.getStats().spatialIndexSize,
          users: userStateService.getStats().totalUsers,
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
  async function shutdown(): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      console.log("Shutting down Filter Processor...");
      console.log("Final stats:", {
        ...stats,
        ...eventPublisher.getStats(),
        ...batchScoreUpdateService.getStats(),
        ...eventCacheService.getStats(),
        ...userStateService.getStats(),
        ...relevanceScoringService.getStats(),
        ...eventFilteringService.getStats(),
        ...redisMessageHandler.getStats(),
        ...eventInitializationService.getStats(),
        ...userNotificationService.getStats(),
        ...jobProcessingService.getStats(),
      });
    }

    // Shutdown batch score update service
    batchScoreUpdateService.shutdown();

    // Clean up Redis connection
    await redisMessageHandler.unsubscribe();
    await redisMessageHandler.quit();
    await redisPub.quit();
  }

  /**
   * Process an event update
   */
  async function processEventUpdate(eventData: {
    operation: string;
    record: Event;
  }): Promise<void> {
    try {
      const { operation, record } = eventData;

      // Check if this is a popularity-related update
      const isPopularityUpdate = isPopularityRelatedUpdate(eventData);

      console.log("[FilterProcessor] Processing event update:", {
        eventId: record.id,
        operation,
        isPopularityUpdate,
        spatialIndexSize: eventCacheService.getStats().spatialIndexSize,
        cacheSize: eventCacheService.getStats().cacheSize,
      });

      // Process the event (this updates both spatial index and cache)
      await eventProcessor.processEvent(eventData);
      stats.eventsProcessed++;

      console.log("[FilterProcessor] Event processed, spatial index updated:", {
        eventId: record.id,
        operation,
        isPopularityUpdate,
        newSpatialIndexSize: eventCacheService.getStats().spatialIndexSize,
        newCacheSize: eventCacheService.getStats().cacheSize,
      });

      // For popularity updates, verify the spatial index was updated correctly
      if (isPopularityUpdate) {
        const spatialIndexUpdated = eventCacheService.verifyEventInSpatialIndex(
          record.id,
          record,
        );
        console.log(
          "[FilterProcessor] Spatial index verification for popularity update:",
          {
            eventId: record.id,
            spatialIndexUpdated,
          },
        );
      }

      // Add event to batch update service instead of immediate processing
      batchScoreUpdateService.addEventUpdate(
        record,
        operation as "CREATE" | "UPDATE" | "DELETE",
        isPopularityUpdate,
      );

      // For non-popularity updates, still use immediate notification for critical updates
      if (!isPopularityUpdate) {
        const affectedUsers =
          await userNotificationService.getAffectedUsers(record);
        await userNotificationService.notifyAffectedUsers(
          affectedUsers,
          eventData,
        );
      }

      console.log("[FilterProcessor] Event added to batch update service:", {
        eventId: record.id,
        operation,
        isPopularityUpdate,
        willUseBatching: isPopularityUpdate,
      });
    } catch (error) {
      console.error("[FilterProcessor] Error processing event update:", error);
    }
  }

  /**
   * Handle filter changes for a user
   */
  async function handleFilterChanges(
    userId: string,
    filters: Filter[],
  ): Promise<void> {
    userStateService.setUserFilters(userId, filters);
    stats.filterChangesProcessed++;

    // Register user with batch update service
    const viewport = userStateService.getUserViewport(userId);
    batchScoreUpdateService.updateUserConfig(userId, viewport, filters);

    // Re-filter existing events for this user based on current viewport
    if (viewport) {
      const eventsInViewport = viewportProcessor.getEventsInViewport(viewport);
      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        viewport,
        filters,
        eventsInViewport,
      );
    } else {
      const allEvents = eventCacheService.getAllEvents();
      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        allEvents,
      );
    }
  }

  /**
   * Handle viewport updates for a user
   */
  async function handleViewportUpdate(
    userId: string,
    viewport: BoundingBox,
  ): Promise<void> {
    await viewportProcessor.updateUserViewport(userId, viewport);
    userStateService.setUserViewport(userId, viewport);
    stats.viewportUpdatesProcessed++;

    // Update user config in batch service
    const filters = userStateService.getUserFilters(userId);
    batchScoreUpdateService.updateUserConfig(userId, viewport, filters);

    // Send events in this viewport that match the user's filters
    const eventsInViewport = viewportProcessor.getEventsInViewport(viewport);
    await eventFilteringService.filterAndSendViewportEvents(
      userId,
      viewport,
      filters,
      eventsInViewport,
    );
  }

  /**
   * Handle initial request for a user
   */
  async function handleInitialRequest(userId: string): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Received request for initial events for user ${userId}`);
    }

    if (userId) {
      if (userStateService.hasUserFilters(userId)) {
        const allEvents = eventCacheService.getAllEvents();
        const filters = userStateService.getUserFilters(userId);
        await eventFilteringService.filterAndSendAllEvents(
          userId,
          filters,
          allEvents,
        );
      } else {
        userStateService.setUserFilters(userId, []);
      }

      // Register user with batch update service
      const viewport = userStateService.getUserViewport(userId);
      const filters = userStateService.getUserFilters(userId);
      batchScoreUpdateService.registerUserForUpdates(userId, viewport, filters);
    }
  }

  /**
   * Handle user disconnection
   */
  function handleUserDisconnection(userId: string): void {
    console.log("[FilterProcessor] User disconnected:", {
      userId,
      hadFilters: userStateService.hasUserFilters(userId),
      hadViewport: userStateService.hasUserViewport(userId),
    });

    // Unregister from batch update service
    batchScoreUpdateService.unregisterUser(userId);

    // Clean up user data
    userStateService.unregisterUser(userId);

    console.log("[FilterProcessor] User cleanup complete:", {
      userId,
      remainingUsers: userStateService.getStats().totalUsers,
    });
  }

  /**
   * Force process the current batch immediately
   */
  async function forceProcessBatch(): Promise<void> {
    console.log("[FilterProcessor] Force processing batch update");
    await batchScoreUpdateService.forceProcessBatch();
  }

  /**
   * Update batch configuration
   */
  function updateBatchConfig(config: {
    batchIntervalMs?: number;
    maxBatchSize?: number;
    enableBatching?: boolean;
  }): void {
    console.log("[FilterProcessor] Updating batch configuration:", config);
    batchScoreUpdateService.updateConfig(config);
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      ...eventPublisher.getStats(),
      ...batchScoreUpdateService.getStats(),
      ...eventCacheService.getStats(),
      ...userStateService.getStats(),
      ...relevanceScoringService.getStats(),
      ...eventFilteringService.getStats(),
      ...redisMessageHandler.getStats(),
      ...eventInitializationService.getStats(),
      ...userNotificationService.getStats(),
      ...jobProcessingService.getStats(),
    };
  }

  /**
   * Check if an event update is related to popularity metrics
   */
  function isPopularityRelatedUpdate(data: {
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

  return {
    initialize,
    shutdown,
    processEventUpdate,
    handleFilterChanges,
    handleViewportUpdate,
    handleInitialRequest,
    handleUserDisconnection,
    forceProcessBatch,
    updateBatchConfig,
    getStats,
  };
}
