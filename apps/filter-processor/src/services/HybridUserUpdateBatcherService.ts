import { Event, Filter, BoundingBox } from "../types/types";

export interface EventFilteringService {
  calculateAndSendDiff(
    userId: string,
    events: Event[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void>;
}

export interface ViewportProcessor {
  updateUserViewport(userId: string, viewport: BoundingBox): Promise<void>;
}

export interface EventCacheService {
  getEventsInViewport(viewport: BoundingBox): Event[];
  getAllEvents(): Event[];
  getStats(): { spatialIndexSize: number; cacheSize: number };
}

export interface UserStateService {
  getUserViewport(userId: string): BoundingBox | null;
  getUserFilters(userId: string): Filter[];
  hasUserFilters(userId: string): boolean;
  hasUserViewport(userId: string): boolean;
  getStats(): { totalUsers: number };
}

export interface HybridUserUpdateBatcherConfig {
  debounceTimeoutMs?: number;
  sweepIntervalMs?: number;
  maxBatchSize?: number;
  enableBatching?: boolean;
}

export interface HybridUserUpdateBatcherService {
  markUserAsDirty(
    userId: string,
    context?: {
      reason: string;
      eventId?: string;
      operation?: string;
      timestamp?: number;
    },
  ): void;
  forceProcessBatch(): Promise<void>;
  shutdown(): void;
  getStats(): Record<string, unknown>;
}

export function createHybridUserUpdateBatcherService(
  eventFilteringService: EventFilteringService,
  viewportProcessor: ViewportProcessor,
  eventCacheService: EventCacheService,
  getUserFilters: (userId: string) => Filter[],
  getUserViewport: (userId: string) => BoundingBox | null,
  config: HybridUserUpdateBatcherConfig = {},
): HybridUserUpdateBatcherService {
  const {
    debounceTimeoutMs = 200,
    sweepIntervalMs = 5000,
    maxBatchSize = 100,
    enableBatching = true,
  } = config;

  // Internal state
  const dirtyUserIds = new Set<string>();
  const userDebounceTimers = new Map<string, NodeJS.Timeout>();
  let periodicSweeper: NodeJS.Timeout | null = null;
  let isShutdown = false;

  // Stats for monitoring
  const stats = {
    totalUsersMarkedDirty: 0,
    totalUsersProcessed: 0,
    totalBatchesProcessed: 0,
    totalDebounceTimersFired: 0,
    totalSweeperRuns: 0,
    currentDirtyUsers: 0,
    currentActiveTimers: 0,
  };

  /**
   * Mark a user as dirty and set up debounce timer
   */
  function markUserAsDirty(
    userId: string,
    context?: {
      reason: string;
      eventId?: string;
      operation?: string;
      timestamp?: number;
    },
  ): void {
    if (isShutdown) return;

    // Add the user to the set of users needing an update
    dirtyUserIds.add(userId);
    stats.totalUsersMarkedDirty++;
    stats.currentDirtyUsers = dirtyUserIds.size;

    console.log("[HybridBatcher] User marked dirty:", {
      userId,
      context,
      currentDirtyUsers: dirtyUserIds.size,
    });

    if (!enableBatching) {
      // If batching is disabled, process immediately
      processUpdatesForUsers([userId]);
      return;
    }

    // --- Real-Time Part ---
    // If a debounce timer for this user already exists, clear it
    if (userDebounceTimers.has(userId)) {
      clearTimeout(userDebounceTimers.get(userId)!);
    }

    // Set a new short-term timer for this specific user
    const timer = setTimeout(() => {
      // The timer fired, so process this one user now
      stats.totalDebounceTimersFired++;
      stats.currentActiveTimers = userDebounceTimers.size - 1;

      // Remove from dirty set to prevent sweeper from processing again
      dirtyUserIds.delete(userId);

      processUpdatesForUsers([userId]);
    }, debounceTimeoutMs);

    userDebounceTimers.set(userId, timer);
    stats.currentActiveTimers = userDebounceTimers.size;
  }

  /**
   * Start the periodic sweeper timer
   */
  function startPeriodicSweeper(): void {
    if (periodicSweeper) {
      clearInterval(periodicSweeper);
    }

    if (!enableBatching) return;

    // --- Batching Part ---
    // Every sweepIntervalMs, process ALL users who are currently dirty
    periodicSweeper = setInterval(() => {
      if (isShutdown) return;

      // Get a copy of all dirty users and process them
      const usersToProcess = Array.from(dirtyUserIds);
      if (usersToProcess.length > 0) {
        stats.totalSweeperRuns++;
        console.log(
          `[HybridBatcher] Sweeper processing ${usersToProcess.length} dirty users`,
        );
        processUpdatesForUsers(usersToProcess);
      }
    }, sweepIntervalMs);

    console.log(
      `[HybridBatcher] Periodic sweeper started with ${sweepIntervalMs}ms interval`,
    );
  }

  /**
   * Process updates for a batch of users
   */
  async function processUpdatesForUsers(userIds: string[]): Promise<void> {
    if (isShutdown || userIds.length === 0) return;

    const usersToProcess = new Set(userIds);
    const batchSize = Math.min(usersToProcess.size, maxBatchSize);
    const batch = Array.from(usersToProcess).slice(0, batchSize);

    console.log(`[HybridBatcher] Processing batch of ${batch.length} users`);

    const startTime = Date.now();

    for (const userId of batch) {
      try {
        // 1. Remove user from the main dirty set (safe to call multiple times)
        dirtyUserIds.delete(userId);

        // 2. Clear their individual debounce timer so it doesn't fire again
        if (userDebounceTimers.has(userId)) {
          clearTimeout(userDebounceTimers.get(userId)!);
          userDebounceTimers.delete(userId);
        }

        // 3. Get the user's current state (viewport, filters)
        const viewport = getUserViewport(userId);
        const filters = getUserFilters(userId);

        // Note: Users with no filters will get MapMoji-curated events
        // The EventFilteringService handles this case properly

        // 4. Get the relevant events (from EventCacheService)
        const events = viewport
          ? eventCacheService.getEventsInViewport(viewport)
          : eventCacheService.getAllEvents();

        console.log(`[HybridBatcher] Processing user ${userId}:`, {
          viewport: !!viewport,
          filterCount: filters.length,
          eventCount: events.length,
        });

        // 5. Call the EventFilteringService to do the heavy lifting
        await eventFilteringService.calculateAndSendDiff(
          userId,
          events,
          viewport,
          filters,
        );

        stats.totalUsersProcessed++;
      } catch (error) {
        console.error(
          `[HybridBatcher] Error processing user ${userId}:`,
          error,
        );
      }
    }

    stats.totalBatchesProcessed++;
    stats.currentDirtyUsers = dirtyUserIds.size;
    stats.currentActiveTimers = userDebounceTimers.size;

    const processingTime = Date.now() - startTime;
    console.log(`[HybridBatcher] Batch processed in ${processingTime}ms:`, {
      usersProcessed: batch.length,
      remainingDirtyUsers: dirtyUserIds.size,
      activeTimers: userDebounceTimers.size,
    });

    // If there are more users to process, continue with the next batch
    // Calculate remaining users from the original input, not from dirtyUserIds
    const processedUserIds = new Set(batch);
    const remainingUsers = Array.from(usersToProcess).filter(
      (userId) => !processedUserIds.has(userId),
    );

    if (remainingUsers.length > 0) {
      console.log(
        `[HybridBatcher] Scheduling next batch of ${remainingUsers.length} users`,
      );
      // Use setImmediate to avoid blocking the event loop
      setImmediate(() => processUpdatesForUsers(remainingUsers));
    }
  }

  /**
   * Force process the current batch immediately
   */
  async function forceProcessBatch(): Promise<void> {
    console.log("[HybridBatcher] Force processing batch");

    // Clear all pending timers
    for (const timer of userDebounceTimers.values()) {
      clearTimeout(timer);
    }
    userDebounceTimers.clear();

    // Process all dirty users
    const usersToProcess = Array.from(dirtyUserIds);
    if (usersToProcess.length > 0) {
      await processUpdatesForUsers(usersToProcess);
    }
  }

  /**
   * Shutdown the service
   */
  function shutdown(): void {
    console.log("[HybridBatcher] Shutting down");
    isShutdown = true;

    // Clear all timers
    for (const timer of userDebounceTimers.values()) {
      clearTimeout(timer);
    }
    userDebounceTimers.clear();

    if (periodicSweeper) {
      clearInterval(periodicSweeper);
      periodicSweeper = null;
    }

    // Process any remaining dirty users
    const remainingUsers = Array.from(dirtyUserIds);
    if (remainingUsers.length > 0) {
      console.log(
        `[HybridBatcher] Processing ${remainingUsers.length} remaining users during shutdown`,
      );
      processUpdatesForUsers(remainingUsers);
    }
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      currentDirtyUsers: dirtyUserIds.size,
      currentActiveTimers: userDebounceTimers.size,
      config: {
        debounceTimeoutMs,
        sweepIntervalMs,
        maxBatchSize,
        enableBatching,
      },
    };
  }

  // Start the periodic sweeper
  startPeriodicSweeper();

  return {
    markUserAsDirty,
    forceProcessBatch,
    shutdown,
    getStats,
  };
}
