import { BoundingBox } from "../types/types";
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
  sendViewportEvents: (userId: string, viewport: BoundingBox) => Promise<void>,
  sendAllFilteredEvents: (userId: string) => Promise<void>,
  getUserViewport: (userId: string) => BoundingBox | undefined,
  config: JobProcessingServiceConfig = {},
): JobProcessingService {
  const { enableEventCacheClearing = true, enableUserNotifications = true } =
    config;

  // Stats for monitoring
  const stats = {
    jobsCreated: 0,
    jobsCompleted: 0,
    eventsDeleted: 0,
    usersNotified: 0,
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
          // Notify all connected users that they need to refresh their events
          const userIds = getAllUserIds();
          for (const userId of userIds) {
            await eventPublisher.publishFilteredEvents(
              userId,
              "replace-all",
              [],
            );
            stats.usersNotified++;
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
        // Notify all users to refresh their events
        const userIds = getAllUserIds();
        for (const userId of userIds) {
          const viewport = getUserViewport(userId);
          if (viewport) {
            await sendViewportEvents(userId, viewport);
          } else {
            await sendAllFilteredEvents(userId);
          }
          stats.usersNotified++;
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
