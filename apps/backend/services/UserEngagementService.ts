import { DataSource, Repository, Brackets } from "typeorm";
import { Event } from "../entities/Event";
import { User } from "../entities/User";
import { UserEventSave } from "../entities/UserEventSave";
import { UserEventRsvp, RsvpStatus } from "../entities/UserEventRsvp";
import { UserEventDiscovery } from "../entities/UserEventDiscovery";
import { Friendship } from "../entities/Friendship";
import { LevelingService } from "./LevelingService";
import type { RedisService } from "./shared/RedisService";

export interface UserEngagementService {
  toggleSaveEvent(
    userId: string,
    eventId: string,
  ): Promise<{ saved: boolean; saveCount: number }>;

  isEventSavedByUser(userId: string, eventId: string): Promise<boolean>;

  getSavedEventsByUser(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: Event[]; nextCursor?: string }>;

  toggleRsvpEvent(
    userId: string,
    eventId: string,
    status: RsvpStatus,
  ): Promise<{
    status: RsvpStatus;
    goingCount: number;
    notGoingCount: number;
  }>;

  getUserRsvpStatus(
    userId: string,
    eventId: string,
  ): Promise<UserEventRsvp | null>;

  createDiscoveryRecord(userId: string, eventId: string): Promise<void>;

  getDiscoveredEventsByUser(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: Event[]; nextCursor?: string }>;

  getFriendsSavedEvents(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: Event[]; nextCursor?: string }>;
}

export interface UserEngagementServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
  levelingService: LevelingService;
}

export class UserEngagementServiceImpl implements UserEngagementService {
  private eventRepository: Repository<Event>;
  private userRepository: Repository<User>;
  private userEventSaveRepository: Repository<UserEventSave>;
  private userEventRsvpRepository: Repository<UserEventRsvp>;
  private userEventDiscoveryRepository: Repository<UserEventDiscovery>;
  private redisService: RedisService;
  private levelingService: LevelingService;

  constructor(private dependencies: UserEngagementServiceDependencies) {
    this.eventRepository = dependencies.dataSource.getRepository(Event);
    this.userRepository = dependencies.dataSource.getRepository(User);
    this.userEventSaveRepository =
      dependencies.dataSource.getRepository(UserEventSave);
    this.userEventRsvpRepository =
      dependencies.dataSource.getRepository(UserEventRsvp);
    this.userEventDiscoveryRepository =
      dependencies.dataSource.getRepository(UserEventDiscovery);
    this.redisService = dependencies.redisService;
    this.levelingService = dependencies.levelingService;
  }

  /**
   * Toggle save/unsave of an event for a user
   * If the event is already saved, it will be unsaved
   * If the event is not saved, it will be saved
   *
   * @param userId The ID of the user saving/unsaving the event
   * @param eventId The ID of the event to save/unsave
   * @returns An object containing the save status and the updated save count
   */
  async toggleSaveEvent(
    userId: string,
    eventId: string,
  ): Promise<{
    saved: boolean;
    saveCount: number;
  }> {
    // Start a transaction to ensure data consistency
    return this.dependencies.dataSource.transaction(
      async (transactionalEntityManager) => {
        // Check if the event exists
        const event = await transactionalEntityManager.findOne(Event, {
          where: { id: eventId },
          relations: [
            "categories",
            "creator",
            "shares",
            "shares.sharedWith",
            "rsvps",
          ],
        });

        if (!event) {
          throw new Error("Event not found");
        }

        // Store previous values for logging
        const previousSaveCount = event.saveCount || 0;
        const previousScanCount = event.scanCount || 0;
        const previousRsvpCount = event.rsvps?.length || 0;

        // Get the user to update their save count
        const user = await transactionalEntityManager.findOne(User, {
          where: { id: userId },
        });

        if (!user) {
          throw new Error("User not found");
        }

        // Check if a save relationship already exists
        const existingSave = await transactionalEntityManager.findOne(
          UserEventSave,
          {
            where: { userId, eventId },
          },
        );

        let saved: boolean;

        if (existingSave) {
          // If it exists, delete it (unsave)
          await transactionalEntityManager.remove(existingSave);

          // Decrement the save count on the event
          event.saveCount = Math.max(0, event.saveCount - 1);
          // Decrement the user's save count
          user.saveCount = Math.max(0, user.saveCount - 1);
          saved = false;
        } else {
          // If it doesn't exist, create it (save)
          const newSave = transactionalEntityManager.create(UserEventSave, {
            userId,
            eventId,
          });

          await transactionalEntityManager.save(newSave);

          // Increment the save count on the event
          event.saveCount = (event.saveCount || 0) + 1;
          // Increment the user's save count
          user.saveCount = (user.saveCount || 0) + 1;
          saved = true;

          // Award XP for saving an event
          await this.levelingService.awardXp(userId, 5);
        }

        // Save both the updated event and user
        await transactionalEntityManager.save(event);
        await transactionalEntityManager.save(user);

        // Publish the updated event to Redis for filter processor to recalculate popularity scores
        await this.redisService.publish("event_changes", {
          type: "UPDATE",
          data: {
            operation: "UPDATE",
            record: this.stripEventForRedis(event),
            previousMetrics: {
              saveCount: previousSaveCount,
              scanCount: previousScanCount,
              rsvpCount: previousRsvpCount,
            },
            changeType: saved ? "SAVE_ADDED" : "SAVE_REMOVED",
            userId: userId,
          },
        });

        return {
          saved,
          saveCount: event.saveCount,
        };
      },
    );
  }

  /**
   * Check if an event is saved by a user
   *
   * @param userId The ID of the user
   * @param eventId The ID of the event
   * @returns Boolean indicating if the event is saved by the user
   */
  async isEventSavedByUser(userId: string, eventId: string): Promise<boolean> {
    const save = await this.userEventSaveRepository.findOne({
      where: { userId, eventId },
    });

    return !!save;
  }

  /**
   * Get all events saved by a user
   *
   * @param userId The ID of the user
   * @param options Pagination options
   * @returns An array of saved events with pagination info
   */
  async getSavedEventsByUser(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ events: Event[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { savedAt: Date; eventId: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.dependencies.dataSource
      .getRepository(UserEventSave)
      .createQueryBuilder("save")
      .leftJoinAndSelect("save.event", "event")
      .leftJoinAndSelect("event.categories", "categories")
      .leftJoinAndSelect("event.creator", "creator")
      .where("save.userId = :userId", { userId });

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      console.log("Cursor data received:", {
        savedAt: cursorData.savedAt,
        eventId: cursorData.eventId,
      });

      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("save.savedAt < :savedAt", {
            savedAt: cursorData.savedAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("save.savedAt = :savedAt", {
                  savedAt: cursorData.savedAt,
                })
                .andWhere("event.id < :eventId", {
                  eventId: cursorData.eventId,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const saves = await queryBuilder
      .orderBy("save.savedAt", "DESC")
      .addOrderBy("event.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = saves.length > limit;
    const results = saves.slice(0, limit);

    // Extract events from saves
    const events = results.map((save) => save.event);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        savedAt: lastResult.savedAt,
        eventId: lastResult.eventId,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      events,
      nextCursor,
    };
  }

  /**
   * Toggle RSVP status for an event
   * @param userId The ID of the user
   * @param eventId The ID of the event
   * @param status The RSVP status to set
   * @returns An object containing the RSVP status and counts
   */
  async toggleRsvpEvent(
    userId: string,
    eventId: string,
    status: RsvpStatus,
  ): Promise<{
    status: RsvpStatus;
    goingCount: number;
    notGoingCount: number;
  }> {
    // Start a transaction to ensure data consistency
    return this.dependencies.dataSource.transaction(
      async (transactionalEntityManager) => {
        // Check if the event exists
        const event = await transactionalEntityManager.findOne(Event, {
          where: { id: eventId },
          relations: [
            "categories",
            "creator",
            "shares",
            "shares.sharedWith",
            "rsvps",
          ],
        });

        if (!event) {
          throw new Error("Event not found");
        }

        // Store previous values for logging
        const previousSaveCount = event.saveCount || 0;
        const previousScanCount = event.scanCount || 0;
        const previousRsvpCount = event.rsvps?.length || 0;

        // Check if an RSVP already exists
        const existingRsvp = await transactionalEntityManager.findOne(
          UserEventRsvp,
          {
            where: { userId, eventId },
          },
        );

        let changeType = "RSVP_UPDATED";

        if (existingRsvp) {
          // Update existing RSVP
          existingRsvp.status = status;
          await transactionalEntityManager.save(existingRsvp);
        } else {
          // Create new RSVP
          const newRsvp = transactionalEntityManager.create(UserEventRsvp, {
            userId,
            eventId,
            status,
          });
          await transactionalEntityManager.save(newRsvp);
          changeType = "RSVP_ADDED";

          // Award XP for RSVPing to an event
          await this.levelingService.awardXp(userId, 5);
        }

        // Get updated counts
        const [goingCount, notGoingCount] = await Promise.all([
          transactionalEntityManager.count(UserEventRsvp, {
            where: { eventId, status: RsvpStatus.GOING },
          }),
          transactionalEntityManager.count(UserEventRsvp, {
            where: { eventId, status: RsvpStatus.NOT_GOING },
          }),
        ]);

        // Reload the event with updated RSVP data for Redis publishing
        const updatedEvent = await transactionalEntityManager.findOne(Event, {
          where: { id: eventId },
          relations: [
            "categories",
            "creator",
            "shares",
            "shares.sharedWith",
            "rsvps",
          ],
        });

        // Publish the updated event to Redis for filter processor to recalculate popularity scores
        if (updatedEvent) {
          await this.redisService.publish("event_changes", {
            type: "UPDATE",
            data: {
              operation: "UPDATE",
              record: this.stripEventForRedis(updatedEvent),
              previousMetrics: {
                saveCount: previousSaveCount,
                scanCount: previousScanCount,
                rsvpCount: previousRsvpCount,
              },
              changeType: changeType,
              userId: userId,
              rsvpStatus: status,
            },
          });
        }

        return {
          status,
          goingCount,
          notGoingCount,
        };
      },
    );
  }

  /**
   * Get a user's RSVP status for an event
   * @param userId The ID of the user
   * @param eventId The ID of the event
   * @returns The RSVP status or null if no RSVP exists
   */
  async getUserRsvpStatus(
    userId: string,
    eventId: string,
  ): Promise<UserEventRsvp | null> {
    return this.dependencies.dataSource.getRepository(UserEventRsvp).findOne({
      where: { userId, eventId },
    });
  }

  /**
   * Create a discovery record for a user scanning an event
   * @param userId The ID of the user who scanned the event
   * @param eventId The ID of the event that was discovered
   */
  async createDiscoveryRecord(userId: string, eventId: string): Promise<void> {
    try {
      // Start a transaction to ensure data consistency
      await this.dependencies.dataSource.transaction(
        async (transactionalEntityManager) => {
          // Create the discovery record
          await transactionalEntityManager
            .createQueryBuilder()
            .insert()
            .into("user_event_discoveries")
            .values({
              userId,
              eventId,
            })
            .orIgnore() // Ignore if record already exists
            .execute();

          // Get the user to update their scan count
          const user = await transactionalEntityManager.findOne(User, {
            where: { id: userId },
          });

          if (user) {
            // Increment the user's scan count
            user.scanCount = (user.scanCount || 0) + 1;
            await transactionalEntityManager.save(user);
          }

          // Get the event to update its scan count
          const event = await transactionalEntityManager.findOne(Event, {
            where: { id: eventId },
          });

          if (event) {
            // Increment the event's scan count
            event.scanCount = (event.scanCount || 0) + 1;
            await transactionalEntityManager.save(event);
          }

          // Also increment the user's discovery count
          await transactionalEntityManager
            .createQueryBuilder()
            .update(User)
            .set({
              discoveryCount: () => "discovery_count + 1",
            })
            .where("id = :userId", { userId })
            .execute();
        },
      );

      // Get the updated event with scan count and publish to Redis for filter processor
      const updatedEvent = await this.eventRepository.findOne({
        where: { id: eventId },
        relations: [
          "categories",
          "creator",
          "shares",
          "shares.sharedWith",
          "rsvps",
        ],
      });

      if (updatedEvent) {
        // Publish the updated event to Redis for filter processor to recalculate popularity scores
        await this.redisService.publish("event_changes", {
          type: "UPDATE",
          data: {
            operation: "UPDATE",
            record: this.stripEventForRedis(updatedEvent),
            changeType: "SCAN_ADDED",
            userId: userId,
          },
        });
      }
    } catch (error) {
      console.error(
        `Error creating discovery record for user ${userId}:`,
        error,
      );
      // Don't throw the error - we don't want to fail the scan if discovery recording fails
    }
  }

  /**
   * Get all events discovered by a user
   *
   * @param userId The ID of the user
   * @param options Pagination options
   * @returns An array of discovered events with pagination info
   */
  async getDiscoveredEventsByUser(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ events: Event[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { discoveredAt: Date; eventId: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.dependencies.dataSource
      .getRepository(UserEventDiscovery)
      .createQueryBuilder("discovery")
      .leftJoinAndSelect("discovery.event", "event")
      .leftJoinAndSelect("event.categories", "categories")
      .leftJoinAndSelect("event.creator", "creator")
      .where("discovery.userId = :userId", { userId })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select("d2.id")
          .from(UserEventDiscovery, "d2")
          .where("d2.userId = :userId")
          .andWhere("d2.eventId = discovery.eventId")
          .orderBy("d2.discoveredAt", "DESC")
          .limit(1)
          .getQuery();
        return "discovery.id = " + subQuery;
      });

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("discovery.discoveredAt < :discoveredAt", {
            discoveredAt: cursorData.discoveredAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("discovery.discoveredAt = :discoveredAt", {
                  discoveredAt: cursorData.discoveredAt,
                })
                .andWhere("event.id < :eventId", {
                  eventId: cursorData.eventId,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const discoveries = await queryBuilder
      .orderBy("discovery.discoveredAt", "DESC")
      .addOrderBy("event.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = discoveries.length > limit;
    const results = discoveries.slice(0, limit);

    // Extract events from discoveries
    const events = results.map((discovery) => discovery.event);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        discoveredAt: lastResult.discoveredAt,
        eventId: lastResult.eventId,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      events,
      nextCursor,
    };
  }

  /**
   * Get events saved by user's friends
   *
   * @param userId The ID of the user
   * @param options Pagination options
   * @returns An array of events saved by friends with pagination info
   */
  async getFriendsSavedEvents(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ events: Event[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { savedAt: Date; eventId: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query to get events saved by friends
    let queryBuilder = this.dependencies.dataSource
      .getRepository(UserEventSave)
      .createQueryBuilder("save")
      .leftJoinAndSelect("save.event", "event")
      .leftJoinAndSelect("event.categories", "categories")
      .leftJoinAndSelect("event.creator", "creator")
      .leftJoinAndSelect("save.user", "saver")
      // Join with friendships to get events saved by friends
      .innerJoin(
        Friendship,
        "friendship",
        "(friendship.requesterId = :userId AND friendship.addresseeId = save.userId AND friendship.status = 'ACCEPTED') OR " +
          "(friendship.addresseeId = :userId AND friendship.requesterId = save.userId AND friendship.status = 'ACCEPTED')",
        { userId },
      )
      .where("save.userId != :userId", { userId }); // Exclude user's own saves

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("save.savedAt < :savedAt", {
            savedAt: cursorData.savedAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("save.savedAt = :savedAt", {
                  savedAt: cursorData.savedAt,
                })
                .andWhere("event.id < :eventId", {
                  eventId: cursorData.eventId,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const saves = await queryBuilder
      .orderBy("save.savedAt", "DESC")
      .addOrderBy("event.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = saves.length > limit;
    const results = saves.slice(0, limit);

    // Extract events and add saver information
    const events = results.map((save) => {
      const event = save.event;
      // Add who saved it
      (
        event as unknown as {
          savedBy: { id: string; displayName: string; email: string };
        }
      ).savedBy = {
        id: save.user.id,
        displayName: save.user.displayName || save.user.email,
        email: save.user.email,
      };
      return event;
    });

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        savedAt: lastResult.savedAt,
        eventId: lastResult.eventId,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      events,
      nextCursor,
    };
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
 * Factory function to create a UserEngagementService instance
 */
export function createUserEngagementService(
  dependencies: UserEngagementServiceDependencies,
): UserEngagementService {
  return new UserEngagementServiceImpl(dependencies);
}
