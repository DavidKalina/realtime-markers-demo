import { DataSource, Repository, In } from "typeorm";
import { Event, EventShare } from "@realtime-markers/database";
import type { EventCacheService } from "./shared/EventCacheService";
import type { RedisService } from "./shared/RedisService";

export interface EventSharingService {
  shareEventWithUsers(
    eventId: string,
    sharedById: string,
    sharedWithIds: string[],
  ): Promise<void>;

  removeEventShares(eventId: string, sharedWithIds: string[]): Promise<void>;

  getEventSharedWithUsers(eventId: string): Promise<string[]>;

  hasEventAccess(eventId: string, userId: string): Promise<boolean>;

  getEventShares(
    eventId: string,
  ): Promise<{ sharedWithId: string; sharedById: string }[]>;
}

export interface EventSharingServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
  eventCacheService: EventCacheService;
}

export class EventSharingServiceImpl implements EventSharingService {
  private eventRepository: Repository<Event>;
  private eventShareRepository: Repository<EventShare>;
  private redisService: RedisService;
  private eventCacheService: EventCacheService;

  constructor(private dependencies: EventSharingServiceDependencies) {
    this.eventRepository = dependencies.dataSource.getRepository(Event);
    this.eventShareRepository =
      dependencies.dataSource.getRepository(EventShare);
    this.redisService = dependencies.redisService;
    this.eventCacheService = dependencies.eventCacheService;
  }

  /**
   * Share an event with multiple users
   * @param eventId The ID of the event to share
   * @param sharedById The ID of the user doing the sharing
   * @param sharedWithIds Array of user IDs to share the event with
   */
  async shareEventWithUsers(
    eventId: string,
    sharedById: string,
    sharedWithIds: string[],
  ): Promise<void> {
    // Validate inputs
    if (!eventId) {
      throw new Error("Event ID is required for sharing");
    }
    if (!sharedById) {
      throw new Error("Shared By ID is required for sharing");
    }
    if (!sharedWithIds || sharedWithIds.length === 0) {
      throw new Error("Shared With IDs are required for sharing");
    }

    console.log("Sharing event with users:", {
      eventId,
      sharedById,
      sharedWithIds,
    });

    // Create share records for each user
    const shares = sharedWithIds.map((sharedWithId) => ({
      eventId,
      sharedWithId,
      sharedById,
    }));

    // Use a transaction to ensure all shares are created or none
    await this.dependencies.dataSource.transaction(
      async (transactionalEntityManager) => {
        // First verify the event exists
        const event = await transactionalEntityManager.findOne(Event, {
          where: { id: eventId },
        });

        if (!event) {
          throw new Error(`Event with ID ${eventId} not found`);
        }

        // Then create the shares
        const result = await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(EventShare)
          .values(shares)
          .orIgnore() // Ignore if share already exists
          .execute();

        console.log("Share creation result:", result);
      },
    );

    // Invalidate cache for this event
    await this.eventCacheService.invalidateEvent(eventId);
  }

  /**
   * Remove sharing access for specific users
   * @param eventId The ID of the event
   * @param sharedWithIds Array of user IDs to remove access for
   */
  async removeEventShares(
    eventId: string,
    sharedWithIds: string[],
  ): Promise<void> {
    await this.eventShareRepository.delete({
      eventId,
      sharedWithId: In(sharedWithIds),
    });

    // Invalidate cache for this event
    await this.eventCacheService.invalidateEvent(eventId);

    // Get the updated event with its shares
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: [
        "categories",
        "creator",
        "shares",
        "shares.sharedWith",
        "rsvps",
      ],
    });

    if (event) {
      // Publish the updated event to Redis
      await this.redisService.publish("event_changes", {
        type: "UPDATE",
        data: this.stripEventForRedis(event),
      });
    }
  }

  /**
   * Get all users an event is shared with
   * @param eventId The ID of the event
   * @returns Array of user IDs the event is shared with
   */
  async getEventSharedWithUsers(eventId: string): Promise<string[]> {
    const shares = await this.eventShareRepository.find({
      where: { eventId },
      select: ["sharedWithId"],
    });

    return shares.map((share) => share.sharedWithId);
  }

  /**
   * Check if a user has access to a private event
   * @param eventId The ID of the event
   * @param userId The ID of the user to check
   * @returns Boolean indicating if the user has access
   */
  async hasEventAccess(eventId: string, userId: string): Promise<boolean> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ["id", "isPrivate", "creatorId"],
    });

    if (!event) {
      return false;
    }

    // If event is not private, everyone has access
    if (!event.isPrivate) {
      return true;
    }

    // Creator always has access
    if (event.creatorId === userId) {
      return true;
    }

    // Check if user is in the shared list
    const share = await this.eventShareRepository.findOne({
      where: { eventId, sharedWithId: userId },
    });

    return !!share;
  }

  /**
   * Get all shares for an event
   * @param eventId The ID of the event
   * @returns Array of event shares
   */
  async getEventShares(
    eventId: string,
  ): Promise<{ sharedWithId: string; sharedById: string }[]> {
    const shares = await this.dependencies.dataSource
      .getRepository(EventShare)
      .createQueryBuilder("share")
      .where("share.eventId = :eventId", { eventId })
      .select(["share.sharedWithId", "share.sharedById"])
      .getMany();

    return shares;
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
 * Factory function to create an EventSharingService instance
 */
export function createEventSharingService(
  dependencies: EventSharingServiceDependencies,
): EventSharingService {
  return new EventSharingServiceImpl(dependencies);
}
