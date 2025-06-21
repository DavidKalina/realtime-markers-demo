import pgvector from "pgvector";
import { DataSource, Repository, type DeepPartial, In } from "typeorm";
import { Event, EventStatus } from "../entities/Event";
import { Category } from "../entities/Category";
import { LevelingService } from "./LevelingService";
import type { EventCacheService } from "./shared/EventCacheService";
import type { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import type { RedisService } from "./shared/RedisService";
import type { CreateEventInput } from "../types/event";

export interface EventLifecycleService {
  createEvent(input: CreateEventInput): Promise<Event>;

  getEventById(id: string): Promise<Event | null>;

  updateEvent(
    id: string,
    eventData: Partial<CreateEventInput>,
  ): Promise<Event | null>;

  deleteEvent(id: string): Promise<boolean>;

  updateEventStatus(id: string, status: EventStatus): Promise<Event | null>;

  storeDetectedQRCode(
    eventId: string,
    qrCodeData: string,
  ): Promise<Event | null>;
}

export interface EventLifecycleServiceDependencies {
  dataSource: DataSource;
  levelingService: LevelingService;
  eventCacheService: EventCacheService;
  locationService: GoogleGeocodingService;
  redisService: RedisService;
}

export class EventLifecycleServiceImpl implements EventLifecycleService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private levelingService: LevelingService;
  private eventCacheService: EventCacheService;
  private locationService: GoogleGeocodingService;
  private redisService: RedisService;

  constructor(private dependencies: EventLifecycleServiceDependencies) {
    this.eventRepository = dependencies.dataSource.getRepository(Event);
    this.categoryRepository = dependencies.dataSource.getRepository(Category);
    this.levelingService = dependencies.levelingService;
    this.eventCacheService = dependencies.eventCacheService;
    this.locationService = dependencies.locationService;
    this.redisService = dependencies.redisService;
  }

  async createEvent(input: CreateEventInput): Promise<Event> {
    // If timezone is not provided, try to determine it from coordinates
    if (!input.timezone && input.location) {
      try {
        const timezone = await this.locationService.getTimezoneFromCoordinates(
          input.location.coordinates[1],
          input.location.coordinates[0],
        );
        input.timezone = timezone;
      } catch (error) {
        console.error("Error determining timezone:", error);
        input.timezone = "UTC";
      }
    }

    let categories: Category[] = [];
    if (input.categoryIds?.length) {
      categories = await this.categoryRepository.find({
        where: { id: In(input.categoryIds) },
      });
    }

    // Create base event data without relations
    const eventData: DeepPartial<Event> = {
      emoji: input.emoji,
      emojiDescription: input.emojiDescription,
      title: input.title,
      description: input.description,
      confidenceScore: input.confidenceScore,
      eventDate: input.eventDate,
      endDate: input.endDate,
      location: input.location,
      status: EventStatus.PENDING,
      address: input.address,
      locationNotes: input.locationNotes || "",
      embedding: pgvector.toSql(input.embedding),
      creatorId: input.creatorId,
      timezone: input.timezone || "UTC",
      qrDetectedInImage: input.qrDetectedInImage || false,
      detectedQrData: input.detectedQrData,
      originalImageUrl: input.originalImageUrl || undefined,
      isPrivate: input.isPrivate || false,
      qrUrl: input.qrUrl,
      isRecurring: input.isRecurring || false,
      recurrenceFrequency: input.recurrenceFrequency,
      recurrenceDays: input.recurrenceDays,
      recurrenceTime: input.recurrenceTime,
      recurrenceStartDate: input.recurrenceStartDate,
      recurrenceEndDate: input.recurrenceEndDate,
      recurrenceInterval: input.recurrenceInterval,
    };

    // Create event instance
    const event = this.eventRepository.create(eventData);

    if (categories.length) {
      event.categories = categories;
    }

    // Save the event first to get its ID
    const savedEvent = await this.eventRepository.save(event);

    // Award XP for creating an event
    await this.levelingService.awardXp(input.creatorId, 30);

    // Publish the new event to Redis for filter processor
    await this.redisService.publish("event_changes", {
      type: "CREATE",
      data: {
        operation: "CREATE",
        record: this.stripEventForRedis(savedEvent),
        changeType: "EVENT_CREATED",
        userId: input.creatorId,
      },
    });

    await this.eventCacheService.invalidateSearchCache();

    return savedEvent;
  }

  async getEventById(id: string): Promise<Event | null> {
    try {
      // Try to get from cache first
      const cachedEvent = await this.eventCacheService.getEvent(id);
      if (cachedEvent) {
        return cachedEvent;
      }

      // If not in cache, get from database
      const evt = await this.eventRepository.findOne({
        where: { id },
        relations: ["categories", "creator", "shares", "shares.sharedWith"],
      });

      // If found, cache it with a shorter TTL for frequently accessed events
      if (evt) {
        await this.eventCacheService.setEvent(evt, 300); // 5 minutes TTL
      }

      return evt;
    } catch (error) {
      console.error(`Error fetching event ${id}:`, error);
      return null;
    }
  }

  async updateEvent(
    id: string,
    eventData: Partial<CreateEventInput>,
  ): Promise<Event | null> {
    try {
      if (!id) {
        throw new Error("Event ID is required for update");
      }

      console.log("Updating event:", { id, eventData });

      const event = await this.getEventById(id);
      if (!event) {
        console.log("Event not found:", id);
        return null;
      }
      if (!event.creatorId) {
        console.log("Event has no creator ID:", id);
        return null;
      }

      // Store previous values for Redis publishing
      const previousEvent = { ...event };

      // Handle basic fields
      if (eventData.title) event.title = eventData.title;
      if (eventData.emoji) event.emoji = eventData.emoji;
      if (eventData.emojiDescription)
        event.emojiDescription = eventData.emojiDescription;
      if (eventData.description !== undefined)
        event.description = eventData.description;
      if (eventData.eventDate) event.eventDate = eventData.eventDate;
      if (eventData.endDate !== undefined) event.endDate = eventData.endDate;
      if (eventData.location) {
        event.location = eventData.location;

        // If location changed but timezone wasn't specified, try to determine new timezone
        if (!eventData.timezone) {
          try {
            const timezone =
              await this.locationService.getTimezoneFromCoordinates(
                eventData.location.coordinates[1],
                eventData.location.coordinates[0],
              );
            event.timezone = timezone;
          } catch (error) {
            console.error(
              "Error determining timezone from updated coordinates:",
              error,
            );
          }
        }
      }

      // Update timezone if provided
      if (eventData.timezone) {
        event.timezone = eventData.timezone;
      }

      // Handle categories if provided
      if (eventData.categoryIds) {
        const categories = await this.categoryRepository.find({
          where: { id: In(eventData.categoryIds) },
        });
        event.categories = categories;
      }

      // Handle privacy and shares
      if (eventData.isPrivate !== undefined) {
        event.isPrivate = eventData.isPrivate;
      }

      // Save the event first to ensure we have a valid ID
      const savedEvent = await this.eventRepository.save(event);

      // Publish the updated event to Redis for filter processor
      await this.redisService.publish("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: this.stripEventForRedis(savedEvent),
          previousRecord: this.stripEventForRedis(previousEvent),
          changeType: "EVENT_UPDATED",
          userId: savedEvent.creatorId,
        },
      });

      // Invalidate the cache for this event
      await this.eventCacheService.invalidateEvent(savedEvent.id);

      // Invalidate search cache since we updated an event
      await this.eventCacheService.invalidateSearchCache();

      // Invalidate any cluster hub caches that might contain this event
      await this.eventCacheService.invalidateAllClusterHubs();

      return savedEvent;
    } catch (error) {
      console.error(`Error updating event ${id}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      // Get the event before deleting it for Redis publishing
      const eventToDelete = await this.getEventById(id);

      const result = await this.eventRepository.delete(id);

      if (result.affected && result.affected > 0 && eventToDelete) {
        // Publish the deleted event to Redis for filter processor
        await this.redisService.publish("event_changes", {
          type: "DELETE",
          data: {
            operation: "DELETE",
            record: this.stripEventForRedis(eventToDelete),
            changeType: "EVENT_DELETED",
            userId: eventToDelete.creatorId,
          },
        });
      }

      // Invalidate the cache for this event
      await this.eventCacheService.invalidateEvent(id);

      // Invalidate search cache since we deleted an event
      await this.eventCacheService.invalidateSearchCache();

      // Invalidate any cluster hub caches that might contain this event
      await this.eventCacheService.invalidateAllClusterHubs();

      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      console.error(`Error deleting event ${id}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async updateEventStatus(
    id: string,
    status: EventStatus,
  ): Promise<Event | null> {
    try {
      const event = await this.getEventById(id);
      if (!event) return null;

      const previousStatus = event.status;
      event.status = status;
      const updatedEvent = await this.eventRepository.save(event);

      // Publish the status change to Redis for filter processor
      await this.redisService.publish("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: this.stripEventForRedis(updatedEvent),
          previousStatus,
          changeType: "STATUS_CHANGED",
          userId: updatedEvent.creatorId,
        },
      });

      // Invalidate the cache for this event
      await this.eventCacheService.invalidateEvent(id);

      return updatedEvent;
    } catch (error) {
      console.error(`Error updating event status for ${id}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async storeDetectedQRCode(
    eventId: string,
    qrCodeData: string,
  ): Promise<Event | null> {
    try {
      // Get the event
      const event = await this.getEventById(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      // Store the detected QR code data
      event.qrCodeData = qrCodeData;
      event.hasQrCode = true;
      event.qrDetectedInImage = true;
      event.detectedQrData = qrCodeData;
      event.qrGeneratedAt = new Date();

      // Save the updated event
      const updatedEvent = await this.eventRepository.save(event);

      // Publish the QR code detection to Redis for filter processor
      await this.redisService.publish("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: this.stripEventForRedis(updatedEvent),
          changeType: "QR_CODE_DETECTED",
          userId: updatedEvent.creatorId,
        },
      });

      // Invalidate the cache for this event
      await this.eventCacheService.invalidateEvent(eventId);

      return updatedEvent;
    } catch (error) {
      console.error(
        `Error storing detected QR code for event ${eventId}:`,
        error,
      );
      throw error; // Re-throw to handle in the controller
    }
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
 * Factory function to create an EventLifecycleService instance
 */
export function createEventLifecycleService(
  dependencies: EventLifecycleServiceDependencies,
): EventLifecycleService {
  return new EventLifecycleServiceImpl(dependencies);
}
