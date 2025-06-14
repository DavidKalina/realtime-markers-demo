import { EventPublisher } from "../handlers/EventPublisher";

export interface JobProcessingService {
  handleJobCreated(data: {
    type: string;
    data: { jobId: string; jobType?: string };
  }): Promise<void>;

  handleJobUpdate(data: {
    jobId: string;
    status: string;
    result?: { deletedCount?: number };
  }): Promise<void>;

  getStats(): Record<string, unknown>;
}

export interface JobProcessingServiceConfig {
  enableEventCacheClearing?: boolean;
  enableUserNotifications?: boolean;
}

export function createJobProcessingService(
  eventPublisher: EventPublisher,
  clearEventCache: () => void,
  getAllUserIds: () => string[],
  markUserDirty: (userId: string) => void,
  markUserDirtyWithContext: (
    userId: string,
    context: { reason: "job_completion"; timestamp: number },
  ) => void,
  config: JobProcessingServiceConfig = {},
): JobProcessingService {
  const { enableEventCacheClearing = true, enableUserNotifications = true } =
    config;

  // Stats for monitoring
  const stats = {
    jobsCreated: 0,
    jobsCompleted: 0,
    eventsDeleted: 0,
    usersMarkedDirty: 0,
    cacheClears: 0,
  };

  /**
   * Handle job created notifications
   */
  async function handleJobCreated(data: {
    type: string;
    data: { jobId: string; jobType?: string };
  }): Promise<void> {
    if (
      data.type === "JOB_CREATED" &&
      data.data.jobType === "cleanup_outdated_events"
    ) {
      console.log("[JobProcessing] Received cleanup job:", data.data.jobId);
      stats.jobsCreated++;

      if (enableEventCacheClearing) {
        // When a cleanup job is created, we should clear our spatial index and event cache
        // since events will be deleted from the database
        clearEventCache();
        stats.cacheClears++;

        if (enableUserNotifications) {
          // Mark all connected users as dirty for batch processing
          const userIds = getAllUserIds();
          for (const userId of userIds) {
            markUserDirtyWithContext(userId, {
              reason: "job_completion",
              timestamp: Date.now(),
            });
            stats.usersMarkedDirty++;
          }
        }
      }
    }
  }

  /**
   * Handle job update notifications
   */
  async function handleJobUpdate(data: {
    jobId: string;
    status: string;
    result?: { deletedCount?: number };
  }): Promise<void> {
    if (data.status === "completed" && data.result?.deletedCount) {
      console.log("[JobProcessing] Cleanup job completed:", {
        jobId: data.jobId,
        deletedCount: data.result.deletedCount,
      });

      stats.jobsCompleted++;
      stats.eventsDeleted += data.result.deletedCount;

      if (enableUserNotifications) {
        // Mark all users as dirty for batch processing
        const userIds = getAllUserIds();
        for (const userId of userIds) {
          markUserDirtyWithContext(userId, {
            reason: "job_completion",
            timestamp: Date.now(),
          });
          stats.usersMarkedDirty++;
        }
      }
    }
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
    };
  }

  return {
    handleJobCreated,
    handleJobUpdate,
    getStats,
  };
}
