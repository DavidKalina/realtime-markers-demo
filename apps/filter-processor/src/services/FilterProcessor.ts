// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import { Filter, BoundingBox, Event } from "../types/types";
import { EventProcessor } from "../handlers/EventProcessor";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventPublisher } from "../handlers/EventPublisher";
import { MapMojiFilterService } from "./MapMojiFilterService";
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
import { createHybridUserUpdateBatcherService } from "./HybridUserUpdateBatcherService";
import { createVectorService } from "./VectorService";

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
    debounceTimeoutMs?: number;
    sweepIntervalMs?: number;
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
  userUpdateBatcherConfig?: {
    debounceTimeoutMs?: number;
    sweepIntervalMs?: number;
    maxBatchSize?: number;
    enableBatching?: boolean;
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
    eventFilteringConfig = {},
    redisConfig = {},
    eventInitializationConfig = {},
    userNotificationConfig = {},
    jobProcessingConfig = {},
    userUpdateBatcherConfig = {},
  } = config;

  // Create core services
  const eventCacheService = createEventCacheService(eventCacheConfig);
  const userStateService = createUserStateService(userStateConfig);
  const relevanceScoringService = createRelevanceScoringService(
    relevanceScoringConfig,
  );

  // Create handlers with service dependencies
  const vectorService = createVectorService();
  const eventProcessor = new EventProcessor(eventCacheService);
  const filterMatcher = new FilterMatcher(vectorService);
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
    (userId: string) => userUpdateBatcherService.markUserAsDirty(userId),
    (
      userId: string,
      context: { reason: "job_completion"; timestamp: number },
    ) => userUpdateBatcherService.markUserAsDirty(userId, context),
    jobProcessingConfig,
  );

  // Create user update batcher service (replaces BatchScoreUpdateService)
  const userUpdateBatcherService = createHybridUserUpdateBatcherService(
    eventFilteringService,
    viewportProcessor,
    eventCacheService,
    (userId: string) => userStateService.getUserFilters(userId),
    (userId: string) => userStateService.getUserViewport(userId) || null,
    userUpdateBatcherConfig,
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
        ...eventCacheService.getStats(),
        ...userStateService.getStats(),
        ...relevanceScoringService.getStats(),
        ...eventFilteringService.getStats(),
        ...redisMessageHandler.getStats(),
        ...eventInitializationService.getStats(),
        ...userNotificationService.getStats(),
        ...jobProcessingService.getStats(),
        ...userUpdateBatcherService.getStats(),
      });
    }

    // Shutdown user update batcher service
    userUpdateBatcherService.shutdown();

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

      console.log("[FilterProcessor] Processing event update:", {
        eventId: record.id,
        operation,
        spatialIndexSize: eventCacheService.getStats().spatialIndexSize,
        cacheSize: eventCacheService.getStats().cacheSize,
      });

      // Process the event (this updates both spatial index and cache)
      await eventProcessor.processEvent(eventData);
      stats.eventsProcessed++;

      console.log("[FilterProcessor] Event processed, spatial index updated:", {
        eventId: record.id,
        operation,
        newSpatialIndexSize: eventCacheService.getStats().spatialIndexSize,
        newCacheSize: eventCacheService.getStats().cacheSize,
      });

      // For popularity updates, verify the spatial index was updated correctly
      const isPopularityUpdate = isPopularityRelatedUpdate(eventData);
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

      // Mark affected users as dirty for batch processing
      const affectedUsers =
        await userNotificationService.getAffectedUsers(record);
      for (const userId of affectedUsers) {
        userUpdateBatcherService.markUserAsDirty(userId, {
          reason: "event_update",
          eventId: record.id,
          operation,
          timestamp: Date.now(),
        });
      }

      console.log("[FilterProcessor] Event processed and users marked dirty:", {
        eventId: record.id,
        operation,
        affectedUsers: affectedUsers.size,
        isPopularityUpdate,
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

    // Mark user as dirty for batch processing
    userUpdateBatcherService.markUserAsDirty(userId, {
      reason: "filter_change",
      timestamp: Date.now(),
    });

    console.log("[FilterProcessor] Filter changes processed:", {
      userId,
      filterCount: filters.length,
    });
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

    // Mark user as dirty for batch processing
    userUpdateBatcherService.markUserAsDirty(userId, {
      reason: "viewport_change",
      timestamp: Date.now(),
    });

    console.log("[FilterProcessor] Viewport update processed:", {
      userId,
      viewport,
    });
  }

  /**
   * Handle initial request for a user
   */
  async function handleInitialRequest(userId: string): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Received request for initial events for user ${userId}`);
    }

    if (userId) {
      if (!userStateService.hasUserFilters(userId)) {
        userStateService.setUserFilters(userId, []);
      }

      // Mark user as dirty for batch processing
      userUpdateBatcherService.markUserAsDirty(userId, {
        reason: "initial_request",
        timestamp: Date.now(),
      });

      console.log("[FilterProcessor] Initial request processed:", {
        userId,
      });
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
    await userUpdateBatcherService.forceProcessBatch();
  }

  /**
   * Update batch configuration
   */
  function updateBatchConfig(config: {
    debounceTimeoutMs?: number;
    sweepIntervalMs?: number;
    maxBatchSize?: number;
    enableBatching?: boolean;
  }): void {
    console.log("[FilterProcessor] Updating batch configuration:", config);
    // Note: The HybridUserUpdateBatcherService doesn't support runtime config updates
    // This would need to be implemented if needed
    console.warn(
      "[FilterProcessor] Runtime batch config updates not yet implemented",
    );
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      ...eventPublisher.getStats(),
      ...eventCacheService.getStats(),
      ...userStateService.getStats(),
      ...relevanceScoringService.getStats(),
      ...eventFilteringService.getStats(),
      ...redisMessageHandler.getStats(),
      ...eventInitializationService.getStats(),
      ...userNotificationService.getStats(),
      ...jobProcessingService.getStats(),
      ...userUpdateBatcherService.getStats(),
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
