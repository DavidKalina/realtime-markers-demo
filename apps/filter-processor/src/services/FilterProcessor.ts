// apps/filter-processor/src/services/FilterProcessor.ts
import Redis from "ioredis";
import { Filter, BoundingBox, Event, CivicEngagement } from "../types/types";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventPublisher } from "../handlers/EventPublisher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { createUnifiedSpatialCacheService } from "./UnifiedSpatialCacheService";
import { createUserStateService } from "./UserStateService";
import { createRelevanceScoringService } from "./RelevanceScoringService";
import { createJobProcessingService } from "./JobProcessingService";
import { createHybridUserUpdateBatcherService } from "./HybridUserUpdateBatcherService";
import { createRedisMessageHandler } from "./RedisMessageHandler";
import { createVectorService } from "./VectorService";

// Entity Registry Integration
import { EntityRegistry } from "./EntityRegistry";
import { UnifiedMessageHandler } from "./UnifiedMessageHandler";
import { LegacyEventCacheHandler as HandlerEventProcessor } from "../handlers/EventProcessor";
import { UnifiedEntityProcessor } from "./processors/UnifiedEntityProcessor";
import { createEntityCacheService } from "./EntityCacheService";
import { createEventInitializationService } from "./EventInitializationService";
import { createCivicEngagementInitializationService } from "./CivicEngagementInitializationService";
import { FilteringStrategyFactory } from "./filtering/FilteringStrategyFactory";
import { createUnifiedFilteringService } from "./UnifiedFilteringService";
import { createClientConfigService } from "./ClientConfigService";

export interface FilterProcessor {
  // Core lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

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
    jobProcessingConfig = {},
    userUpdateBatcherConfig = {},
  } = config;

  // Create core services
  const unifiedSpatialCacheService =
    createUnifiedSpatialCacheService(eventCacheConfig);
  const userStateService = createUserStateService(userStateConfig);
  const relevanceScoringService = createRelevanceScoringService(
    relevanceScoringConfig,
  );

  // Create ViewportProcessor early since UnifiedMessageHandler needs it
  const viewportProcessor = new ViewportProcessor(
    redisPub,
    unifiedSpatialCacheService,
  );

  // Create Entity Registry and Unified Message Handler
  const entityRegistry = new EntityRegistry();

  // Create a callback that will be set after userUpdateBatcherService is created
  // eslint-disable-next-line prefer-const
  let userDirtyCallback:
    | ((
        userId: string,
        context?: {
          reason: string;
          entityId?: string;
          operation?: string;
          timestamp?: number;
        },
      ) => void)
    | undefined;

  const unifiedMessageHandler = new UnifiedMessageHandler(
    entityRegistry,
    redisPub,
    viewportProcessor,
    {
      enableWebSocketNotifications: true,
      enableViewportTracking: true,
      maxAffectedUsersPerUpdate: 1000,
      onUserDirty: (userId: string, context) => {
        userDirtyCallback?.(userId, context);
      },
    },
  );

  // Create entity processors using the unified system
  const handlerEventProcessor = new HandlerEventProcessor(
    unifiedSpatialCacheService,
  );
  const unifiedEntityProcessor = new UnifiedEntityProcessor(
    unifiedSpatialCacheService,
  );

  // Create the real initialization services
  const eventInitializationService = createEventInitializationService(
    handlerEventProcessor,
    eventInitializationConfig,
  );

  const civicEngagementInitializationService =
    createCivicEngagementInitializationService(
      handlerEventProcessor,
      eventInitializationConfig,
    );

  // Create entity-specific services
  const eventEntityCacheService = createEntityCacheService(
    "event",
    unifiedSpatialCacheService,
  );
  const civicEngagementEntityCacheService = createEntityCacheService(
    "civic_engagement",
    unifiedSpatialCacheService,
  );

  // Create filtering strategies
  const eventFilteringStrategy = FilteringStrategyFactory.createStrategy(
    "event",
    "mapmoji",
    eventFilteringConfig,
  );
  const civicEngagementFilteringStrategy =
    FilteringStrategyFactory.createStrategy("civic_engagement", "simple");

  // Register entity types with the registry using the unified system
  entityRegistry.registerEntityType(
    {
      type: "event",
      displayName: "Events",
      hasLocation: true,
      isPublic: true,
      supportsImages: true,
      supportsCategories: true,
      relevanceScoring: {
        enabled: true,
        weights: {
          time: 0.3,
          distance: 0.4,
          popularity: 0.3,
        },
      },
      filtering: {
        supportedFilters: ["category", "date", "distance", "popularity"],
        defaultFilters: {},
        strategy: "mapmoji",
      },
      webSocket: {
        messageTypes: {
          add: "event:created",
          update: "event:updated",
          delete: "event:deleted",
          discovered: "event:discovered",
        },
        redisChannels: {
          changes: redisConfig.channels?.eventChanges || "event_changes",
          discovered: "event_discovered",
        },
      },
    },
    unifiedEntityProcessor,
    eventInitializationService,
    eventEntityCacheService,
    eventFilteringStrategy,
  );

  entityRegistry.registerEntityType(
    {
      type: "civic_engagement",
      displayName: "Civic Engagements",
      hasLocation: true,
      isPublic: true,
      supportsImages: false,
      supportsCategories: true,
      relevanceScoring: {
        enabled: true,
        weights: {
          time: 0.5,
          distance: 0.3,
          popularity: 0.2,
        },
      },
      filtering: {
        supportedFilters: ["category", "status", "priority"],
        defaultFilters: {},
        strategy: "simple",
      },
      webSocket: {
        messageTypes: {
          add: "add-civic-engagement",
          update: "update-civic-engagement",
          delete: "delete-civic-engagement",
          discovered: "civic_engagement_discovered",
        },
        redisChannels: {
          changes: "civic_engagement_changes",
          discovered: "civic_engagement_discovered",
        },
      },
    },
    unifiedEntityProcessor,
    civicEngagementInitializationService,
    civicEngagementEntityCacheService,
    civicEngagementFilteringStrategy,
  );

  // Create handlers with service dependencies
  const vectorService = createVectorService();
  const filterMatcher = new FilterMatcher(vectorService);
  const eventPublisher = new EventPublisher(redisPub);
  const mapMojiFilter = new MapMojiFilterService();

  // Create client configuration service
  const clientConfigService = createClientConfigService({ redis: redisPub });

  // Create unified filtering service that handles both events and civic engagements
  const unifiedFilteringService = createUnifiedFilteringService(
    filterMatcher,
    mapMojiFilter,
    relevanceScoringService,
    eventPublisher,
    clientConfigService,
    {
      mapMojiConfig: eventFilteringConfig.mapMojiConfig,
      maxCivicEngagements: 100,
    },
  );

  // Create user update batcher service (replaces deprecated BatchScoreUpdateService)
  const userUpdateBatcherService = createHybridUserUpdateBatcherService(
    unifiedFilteringService,
    viewportProcessor,
    unifiedSpatialCacheService,
    (userId: string) => userStateService.getUserFilters(userId),
    (userId: string) => userStateService.getUserViewport(userId) || null,
    userUpdateBatcherConfig,
  );

  // Set the callback now that userUpdateBatcherService is available
  userDirtyCallback = (userId: string, context) => {
    userUpdateBatcherService.markUserAsDirty(userId, context);
  };

  const jobProcessingService = createJobProcessingService(
    eventPublisher,
    () => unifiedSpatialCacheService.clearAll(),
    () => userStateService.getAllUserIds(),
    (userId: string) => userUpdateBatcherService.markUserAsDirty(userId),
    (
      userId: string,
      context: { reason: "job_completion"; timestamp: number },
    ) => userUpdateBatcherService.markUserAsDirty(userId, context),
    jobProcessingConfig,
  );

  // Create Redis message handler with unified message handler
  const messageHandlers = {
    onFilterChanges: handleFilterChanges,
    onViewportUpdate: handleViewportUpdate,
    onInitialRequest: handleInitialRequest,
    onEventUpdate: async (data: { operation: string; record: Event }) => {
      const result = await unifiedMessageHandler.handleEntityMessage(
        "event",
        data.operation,
        data.record,
      );

      // Log processing results for monitoring
      if (result.success) {
        console.log(
          `[FilterProcessor] Event ${data.operation} processed successfully: ${result.entityId} (${result.affectedUsersCount} affected users, ${result.processingTimeMs}ms)`,
        );
      } else {
        console.error(
          `[FilterProcessor] Event ${data.operation} failed: ${result.error}`,
        );
      }
    },
    onCivicEngagementUpdate: async (data: {
      operation: string;
      record: CivicEngagement;
    }) => {
      const result = await unifiedMessageHandler.handleEntityMessage(
        "civic_engagement",
        data.operation,
        data.record,
      );

      // Log processing results for monitoring
      if (result.success) {
        console.log(
          `[FilterProcessor] Civic engagement ${data.operation} processed successfully: ${result.entityId} (${result.affectedUsersCount} affected users, ${result.processingTimeMs}ms)`,
        );
      } else {
        console.error(
          `[FilterProcessor] Civic engagement ${data.operation} failed: ${result.error}`,
        );
      }
    },
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

  // Viewport debouncing to prevent excessive processing
  const viewportDebounceTimers = new Map<string, NodeJS.Timeout>();
  const viewportDebounceMs = 500; // 500ms debounce for viewport changes

  /**
   * Initialize the filter processor service.
   */
  async function initialize(): Promise<void> {
    try {
      console.log("🚀 Initializing Filter Processor...");

      // Initialize all entities using the entity registry
      console.log("📦 Initializing entity registry...");
      await entityRegistry.initializeAllEntities();

      // Subscribe to Redis channels
      console.log("🔌 Subscribing to Redis channels...");
      await redisMessageHandler.subscribeToChannels();

      // Start the user update batcher service
      console.log("⚡ Starting user update batcher service...");
      userUpdateBatcherService.startPeriodicSweeper();

      console.log("✅ Filter Processor initialized successfully:", {
        events: unifiedSpatialCacheService.getStats().spatialIndexSize,
        civicEngagements:
          unifiedSpatialCacheService.getStats().civicEngagementCacheSize,
        users: userStateService.getStats().totalUsers,
        entityTypes: entityRegistry.getAllEntityTypes(),
      });
    } catch (error) {
      console.error("❌ Error initializing Filter Processor:", error);
      throw error;
    }
  }

  /**
   * Gracefully shut down the filter processor.
   */
  async function shutdown(): Promise<void> {
    console.log("🛑 Shutting down Filter Processor...");

    // Clear all viewport debounce timers
    for (const timer of viewportDebounceTimers.values()) {
      clearTimeout(timer);
    }
    viewportDebounceTimers.clear();

    console.log("Final stats:", {
      ...stats,
      ...eventPublisher.getStats(),
      ...eventEntityCacheService.getStats(),
      ...userStateService.getStats(),
      ...relevanceScoringService.getStats(),
      ...redisMessageHandler.getStats(),
      ...eventInitializationService.getStats(),
      ...civicEngagementInitializationService.getStats(),
      ...jobProcessingService.getStats(),
      ...userUpdateBatcherService.getStats(),
    });

    // Shutdown user update batcher service
    userUpdateBatcherService.shutdown();

    // Clean up Redis connection
    await redisMessageHandler.unsubscribe();
    await redisMessageHandler.quit();
    await redisPub.quit();
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
    // Clear existing debounce timer for this user
    if (viewportDebounceTimers.has(userId)) {
      clearTimeout(viewportDebounceTimers.get(userId)!);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      try {
        await viewportProcessor.updateUserViewport(userId, viewport);
        userStateService.setUserViewport(userId, viewport);
        stats.viewportUpdatesProcessed++;

        // Track viewport in UnifiedMessageHandler for affected user calculation
        unifiedMessageHandler.trackUserViewport("event", userId, viewport);
        unifiedMessageHandler.trackUserViewport(
          "civic_engagement",
          userId,
          viewport,
        );

        // Mark user as dirty for batch processing
        userUpdateBatcherService.markUserAsDirty(userId, {
          reason: "viewport_change",
          timestamp: Date.now(),
        });

        console.log("[FilterProcessor] Viewport update processed:", {
          userId,
          viewport,
        });
      } catch (error) {
        console.error(
          "[FilterProcessor] Error processing viewport update:",
          error,
        );
      } finally {
        // Clean up timer reference
        viewportDebounceTimers.delete(userId);
      }
    }, viewportDebounceMs);

    viewportDebounceTimers.set(userId, timer);

    console.log("[FilterProcessor] Viewport update debounced:", {
      userId,
      viewport,
      debounceMs: viewportDebounceMs,
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

    // Clean up viewport tracking in UnifiedMessageHandler
    unifiedMessageHandler.removeUserViewport("event", userId);
    unifiedMessageHandler.removeUserViewport("civic_engagement", userId);

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
      ...eventEntityCacheService.getStats(),
      ...userStateService.getStats(),
      ...relevanceScoringService.getStats(),
      ...redisMessageHandler.getStats(),
      ...eventInitializationService.getStats(),
      ...civicEngagementInitializationService.getStats(),
      ...jobProcessingService.getStats(),
      ...userUpdateBatcherService.getStats(),
      unifiedMessageHandler: unifiedMessageHandler.getMetrics(),
      entityRegistry: entityRegistry.getAllStats(),
    };
  }

  return {
    initialize,
    shutdown,
    handleFilterChanges,
    handleViewportUpdate,
    handleInitialRequest,
    handleUserDisconnection,
    forceProcessBatch,
    updateBatchConfig,
    getStats,
  };
}
