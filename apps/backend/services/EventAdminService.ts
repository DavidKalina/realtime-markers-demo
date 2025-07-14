import { DataSource, Repository } from "typeorm";
import {
  Event,
  EventStatus,
  Category,
  UserEventSave,
  UserEventDiscovery,
  User,
} from "@realtime-markers/database";
import type { EventCacheService } from "./shared/EventCacheService";
import type { RedisService } from "./shared/RedisService";

export interface EventAdminService {
  cleanupOutdatedEvents(batchSize?: number): Promise<{
    deletedEvents: Event[];
    deletedCount: number;
    hasMore: boolean;
  }>;

  getEvents(options?: {
    limit?: number;
    offset?: number;
    userId?: string;
  }): Promise<Event[]>;

  getAllCategories(): Promise<Category[]>;

  recalculateCounts(): Promise<{ eventsUpdated: number; usersUpdated: number }>;
}

export interface EventAdminServiceDependencies {
  dataSource: DataSource;
  eventCacheService: EventCacheService;
  redisService: RedisService;
}

export class EventAdminServiceImpl implements EventAdminService {
  private eventRepository?: Repository<Event>;
  private categoryRepository?: Repository<Category>;
  private userEventSaveRepository?: Repository<UserEventSave>;
  private userEventDiscoveryRepository?: Repository<UserEventDiscovery>;
  private userRepository?: Repository<User>;
  private eventCacheService: EventCacheService;
  private redisService: RedisService;

  constructor(private dependencies: EventAdminServiceDependencies) {
    this.eventCacheService = dependencies.eventCacheService;
    this.redisService = dependencies.redisService;
  }

  // Lazy getter for repositories to ensure DataSource is initialized
  private get eventRepo(): Repository<Event> {
    if (!this.eventRepository) {
      this.eventRepository = this.dependencies.dataSource.getRepository(Event);
    }
    return this.eventRepository;
  }

  private get categoryRepo(): Repository<Category> {
    if (!this.categoryRepository) {
      this.categoryRepository =
        this.dependencies.dataSource.getRepository(Category);
    }
    return this.categoryRepository;
  }

  private get userEventSaveRepo(): Repository<UserEventSave> {
    if (!this.userEventSaveRepository) {
      this.userEventSaveRepository =
        this.dependencies.dataSource.getRepository(UserEventSave);
    }
    return this.userEventSaveRepository;
  }

  private get userEventDiscoveryRepo(): Repository<UserEventDiscovery> {
    if (!this.userEventDiscoveryRepository) {
      this.userEventDiscoveryRepository =
        this.dependencies.dataSource.getRepository(UserEventDiscovery);
    }
    return this.userEventDiscoveryRepository;
  }

  private get userRepo(): Repository<User> {
    if (!this.userRepository) {
      this.userRepository = this.dependencies.dataSource.getRepository(User);
    }
    return this.userRepository;
  }

  async cleanupOutdatedEvents(batchSize = 100): Promise<{
    deletedEvents: Event[];
    deletedCount: number;
    hasMore: boolean;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    const eventsToDelete = await this.eventRepo
      .createQueryBuilder("event")
      .where("event.eventDate < :cutoffDate", { cutoffDate })
      .andWhere("event.status IN (:...statuses)", {
        statuses: [EventStatus.PENDING, EventStatus.REJECTED],
      })
      .andWhere("event.scanCount = 1") // Only events that have been scanned once
      .andWhere("event.saveCount = 0") // And not saved by anyone
      .orderBy("event.eventDate", "ASC")
      .take(batchSize + 1) // Get one extra to check if there are more
      .getMany();

    const hasMore = eventsToDelete.length > batchSize;
    const toDelete = hasMore
      ? eventsToDelete.slice(0, batchSize)
      : eventsToDelete;

    if (toDelete.length === 0) {
      return { deletedEvents: [], deletedCount: 0, hasMore: false };
    }

    const ids = toDelete.map((e) => e.id);
    await this.eventRepo.delete(ids);

    // Publish cleanup events to Redis for filter processor
    for (const deletedEvent of toDelete) {
      await this.redisService.publish("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: this.stripEventForRedis(deletedEvent),
          changeType: "EVENT_CLEANUP",
          userId: deletedEvent.creatorId,
        },
      });

      // Invalidate the cache for this specific event
      await this.eventCacheService.invalidateEvent(deletedEvent.id);
    }

    // Invalidate search cache since we deleted events
    await this.eventCacheService.invalidateSearchCache();

    // Invalidate any cluster hub caches that might contain these events
    await this.eventCacheService.invalidateAllClusterHubs();

    return {
      deletedEvents: toDelete,
      deletedCount: toDelete.length,
      hasMore,
    };
  }

  async getEvents(
    options: {
      limit?: number;
      offset?: number;
      userId?: string;
    } = {},
  ): Promise<Event[]> {
    try {
      const queryBuilder = this.eventRepo
        .createQueryBuilder("event")
        .leftJoinAndSelect("event.categories", "category")
        .leftJoinAndSelect("event.creator", "creator")
        .leftJoinAndSelect("event.shares", "shares")
        .leftJoinAndSelect("shares.sharedWith", "sharedWith");

      if (options.limit) {
        queryBuilder.take(options.limit);
      }

      if (options.offset) {
        queryBuilder.skip(options.offset);
      }

      const events = await queryBuilder.getMany();
      console.log(`Retrieved ${events.length} events from database`);

      return events;
    } catch (error) {
      console.error("Error in getEvents:", error);
      throw error;
    }
  }

  // Add method to get all categories
  async getAllCategories() {
    return await this.categoryRepo.find({
      order: {
        name: "ASC",
      },
    });
  }

  /**
   * Recalculate and sync scan and save counts from actual relationships
   * This ensures data consistency between counter fields and actual relationships
   */
  async recalculateCounts(): Promise<{
    eventsUpdated: number;
    usersUpdated: number;
  }> {
    let eventsUpdated = 0;
    let usersUpdated = 0;

    try {
      // Recalculate event scan counts from UserEventDiscovery
      const eventScanCounts = await this.dependencies.dataSource
        .getRepository(UserEventDiscovery)
        .createQueryBuilder("discovery")
        .select("discovery.eventId", "eventId")
        .addSelect("COUNT(*)", "scanCount")
        .groupBy("discovery.eventId")
        .getRawMany();

      // Update event scan counts
      for (const { eventId, scanCount } of eventScanCounts) {
        await this.eventRepo.update(eventId, {
          scanCount: parseInt(scanCount),
        });
        eventsUpdated++;
      }

      // Recalculate event save counts from UserEventSave
      const eventSaveCounts = await this.dependencies.dataSource
        .getRepository(UserEventSave)
        .createQueryBuilder("save")
        .select("save.eventId", "eventId")
        .addSelect("COUNT(*)", "saveCount")
        .groupBy("save.eventId")
        .getRawMany();

      // Update event save counts
      for (const { eventId, saveCount } of eventSaveCounts) {
        await this.eventRepo.update(eventId, {
          saveCount: parseInt(saveCount),
        });
        eventsUpdated++;
      }

      // Recalculate user scan counts from UserEventDiscovery
      const userScanCounts = await this.dependencies.dataSource
        .getRepository(UserEventDiscovery)
        .createQueryBuilder("discovery")
        .select("discovery.userId", "userId")
        .addSelect("COUNT(*)", "scanCount")
        .groupBy("discovery.userId")
        .getRawMany();

      // Update user scan counts
      for (const { userId, scanCount } of userScanCounts) {
        await this.dependencies.dataSource.getRepository(User).update(userId, {
          scanCount: parseInt(scanCount),
        });
        usersUpdated++;
      }

      // Recalculate user save counts from UserEventSave
      const userSaveCounts = await this.dependencies.dataSource
        .getRepository(UserEventSave)
        .createQueryBuilder("save")
        .select("save.userId", "userId")
        .addSelect("COUNT(*)", "saveCount")
        .groupBy("save.userId")
        .getRawMany();

      // Update user save counts
      for (const { userId, saveCount } of userSaveCounts) {
        await this.dependencies.dataSource.getRepository(User).update(userId, {
          saveCount: parseInt(saveCount),
        });
        usersUpdated++;
      }

      console.log(
        `Recalculated counts: ${eventsUpdated} events, ${usersUpdated} users updated`,
      );
    } catch (error) {
      console.error("Error recalculating counts:", error);
      throw error;
    }

    return { eventsUpdated, usersUpdated };
  }

  /**
   * Strip sensitive and large fields from an event for Redis publishing
   * This keeps the payload lightweight while preserving necessary data for filtering
   */
  private stripEventForRedis(event: Event): Partial<Event> {
    // Create a copy of the event without the embedding field
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding, ...strippedEvent } = event;
    return strippedEvent;
  }
}

/**
 * Factory function to create an EventAdminService instance
 */
export function createEventAdminService(
  dependencies: EventAdminServiceDependencies,
): EventAdminService {
  return new EventAdminServiceImpl(dependencies);
}
