import type { Filter, BoundingBox } from "../types/types";
import type { ViewportProcessor } from "../handlers/ViewportProcessor";
import type { EventFilteringService } from "./EventFilteringService";
import type { UnifiedSpatialCacheService } from "./UnifiedSpatialCacheService";

export interface UserUpdateContext {
  reason:
    | "event_update"
    | "filter_change"
    | "viewport_change"
    | "initial_request"
    | "job_completion";
  eventId?: string;
  operation?: string;
  timestamp: number;
}

export interface UserUpdateBatcherServiceConfig {
  debounceTimeoutMs?: number;
  sweepIntervalMs?: number;
  maxBatchSize?: number;
  enableBatching?: boolean;
}

export interface UserUpdateBatcherService {
  markUserAsDirty(
    userId: string,
    context?: {
      reason: string;
      eventId?: string;
      operation?: string;
      timestamp: number;
    },
  ): void;
  forceProcessBatch(): Promise<void>;
  shutdown(): void;
  getStats(): Record<string, unknown>;
}

export function createUserUpdateBatcherService(
  eventFilteringService: EventFilteringService,
  viewportProcessor: ViewportProcessor,
  eventCacheService: UnifiedSpatialCacheService,
  getUserFilters: (userId: string) => Filter[],
  getUserViewport: (userId: string) => BoundingBox | null,
  config: UserUpdateBatcherServiceConfig = {},
): UserUpdateBatcherService {
  const {
    debounceTimeoutMs = 15 * 60 * 1000, // 15 minutes default
    sweepIntervalMs = 15 * 60 * 1000, // 15 minutes default
    maxBatchSize = 1000,
    enableBatching = true,
  } = config;

  // Private state
  const dirtyUsers = new Map<string, UserUpdateContext>();
  let batchTimer: NodeJS.Timeout | null = null;
  let isProcessingBatch = false;

  // Stats for monitoring
  const stats = {
    usersMarkedDirty: 0,
    batchesProcessed: 0,
    totalUsersUpdated: 0,
    averageBatchSize: 0,
    lastBatchTime: 0,
    processingTime: 0,
  };

  /**
   * Mark a user as dirty (needs update)
   */
  function markUserAsDirty(
    userId: string,
    context?: {
      reason: string;
      eventId?: string;
      operation?: string;
      timestamp: number;
    },
  ): void {
    const contextToUse: UserUpdateContext = {
      reason:
        (context?.reason as UserUpdateContext["reason"]) || "event_update",
      eventId: context?.eventId,
      operation: context?.operation,
      timestamp: context?.timestamp || Date.now(),
    };
    markUserDirtyWithContext(userId, contextToUse);
  }

  /**
   * Mark a user as dirty with specific context
   */
  function markUserDirtyWithContext(
    userId: string,
    context: UserUpdateContext,
  ): void {
    if (!enableBatching) {
      return; // Batching disabled, updates should be handled immediately
    }

    dirtyUsers.set(userId, context);
    stats.usersMarkedDirty++;

    console.log("[UserUpdateBatcher] Marked user dirty:", {
      userId,
      reason: context.reason,
      eventId: context.eventId,
      operation: context.operation,
      totalDirtyUsers: dirtyUsers.size,
    });

    // If we've reached max batch size, process immediately
    if (dirtyUsers.size >= maxBatchSize) {
      console.log(
        "[UserUpdateBatcher] Max batch size reached, processing immediately",
      );
      processBatch();
    }
  }

  /**
   * Start the batch timer
   */
  function startBatchTimer(): void {
    if (batchTimer) {
      clearInterval(batchTimer);
    }

    batchTimer = setInterval(() => {
      processBatch();
    }, debounceTimeoutMs);

    console.log("[UserUpdateBatcher] Started batch timer:", {
      intervalMs: debounceTimeoutMs,
      intervalMinutes: debounceTimeoutMs / (1000 * 60),
    });
  }

  /**
   * Process the current batch of dirty users
   */
  async function processBatch(): Promise<void> {
    if (isProcessingBatch || dirtyUsers.size === 0) {
      return;
    }

    isProcessingBatch = true;
    const startTime = Date.now();

    try {
      console.log("[UserUpdateBatcher] Starting batch processing:", {
        dirtyUsers: dirtyUsers.size,
        batchIntervalMs: debounceTimeoutMs,
      });

      // Get all dirty users and clear the set
      const usersToUpdate = Array.from(dirtyUsers.entries());
      dirtyUsers.clear();

      // Group users by update reason for better logging
      const reasonCounts = usersToUpdate.reduce(
        (acc, [, context]) => {
          acc[context.reason] = (acc[context.reason] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      console.log("[UserUpdateBatcher] Batch composition:", {
        total: usersToUpdate.length,
        reasonCounts,
      });

      // Process each user's update
      const updatePromises = usersToUpdate.map(([userId, context]) =>
        processUserUpdate(userId, context),
      );

      await Promise.all(updatePromises);

      // Update stats
      const processingTime = Date.now() - startTime;
      stats.batchesProcessed++;
      stats.totalUsersUpdated += usersToUpdate.length;
      stats.averageBatchSize =
        (stats.averageBatchSize * (stats.batchesProcessed - 1) +
          usersToUpdate.length) /
        stats.batchesProcessed;
      stats.lastBatchTime = Date.now();
      stats.processingTime = processingTime;

      console.log("[UserUpdateBatcher] Batch processing complete:", {
        processingTimeMs: processingTime,
        usersUpdated: usersToUpdate.length,
        stats: {
          batchesProcessed: stats.batchesProcessed,
          totalUsersUpdated: stats.totalUsersUpdated,
          averageBatchSize: stats.averageBatchSize,
        },
      });
    } catch (error) {
      console.error("[UserUpdateBatcher] Error processing batch:", error);
    } finally {
      isProcessingBatch = false;
    }
  }

  /**
   * Process a single user's update
   */
  async function processUserUpdate(
    userId: string,
    context: UserUpdateContext,
  ): Promise<void> {
    try {
      const filters = getUserFilters(userId);
      const viewport = getUserViewport(userId);

      console.log("[UserUpdateBatcher] Processing user update:", {
        userId,
        reason: context.reason,
        eventId: context.eventId,
        operation: context.operation,
        hasViewport: !!viewport,
        filterCount: filters.length,
      });

      if (viewport) {
        // User has a viewport - send viewport-specific events
        const eventsInViewport =
          viewportProcessor.getEventsInViewport(viewport);
        await eventFilteringService.filterAndSendViewportEvents(
          userId,
          viewport,
          filters,
          eventsInViewport,
        );
      } else {
        // User has no viewport - send all events
        const allEvents = eventCacheService.getAllEvents();
        await eventFilteringService.filterAndSendAllEvents(
          userId,
          filters,
          allEvents,
        );
      }

      console.log("[UserUpdateBatcher] User update complete:", {
        userId,
        reason: context.reason,
        eventId: context.eventId,
      });
    } catch (error) {
      console.error(
        `[UserUpdateBatcher] Error processing user update for ${userId}:`,
        error,
      );
    }
  }

  /**
   * Force process the current batch immediately
   */
  async function forceProcessBatch(): Promise<void> {
    console.log("[UserUpdateBatcher] Force processing batch");
    await processBatch();
  }

  /**
   * Shutdown the service
   */
  function shutdown(): void {
    if (batchTimer) {
      clearInterval(batchTimer);
      batchTimer = null;
    }

    // Process any remaining dirty users
    if (dirtyUsers.size > 0) {
      console.log(
        "[UserUpdateBatcher] Processing remaining dirty users on shutdown",
      );
      processBatch();
    }

    console.log("[UserUpdateBatcher] Service shutdown complete");
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      dirtyUsers: dirtyUsers.size,
      isProcessingBatch,
      config: {
        debounceTimeoutMs,
        sweepIntervalMs,
        maxBatchSize,
        enableBatching,
      },
    };
  }

  // Start the batch timer if batching is enabled
  if (enableBatching) {
    startBatchTimer();
  }

  return {
    markUserAsDirty,
    forceProcessBatch,
    shutdown,
    getStats,
  };
}
