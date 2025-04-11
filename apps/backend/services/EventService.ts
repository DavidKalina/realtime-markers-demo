import { type Point } from "geojson";
import pgvector from "pgvector";
import { Brackets, DataSource, Repository, type DeepPartial } from "typeorm";
import { Category } from "../entities/Category";
import { Event, EventStatus } from "../entities/Event";
import { UserEventSave } from "../entities/UserEventSave";
import { CacheService } from "./shared/CacheService";
import { OpenAIService, OpenAIModel } from "./shared/OpenAIService";
import type { Filter } from "../entities/Filter";
import { User } from "../entities/User";
import { UserEventDiscovery } from "../entities/UserEventDiscovery";
import { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import { EventSimilarityService } from "./event-processing/EventSimilarityService";
import { GeocodingService } from "./GeocodingService";

interface SearchResult {
  event: Event;
  score: number;
}

interface CreateEventInput {
  emoji: string;
  emojiDescription?: string;
  title: string;
  description?: string;
  eventDate: Date;
  endDate?: Date;
  location: Point;
  categoryIds?: string[];
  confidenceScore?: number;
  address?: string;
  locationNotes?: string;
  creatorId: string;
  timezone?: string;
  qrDetectedInImage?: boolean;
  detectedQrData?: string;
  originalImageUrl?: string | null;
  embedding: number[];
}

export class EventService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private userEventSaveRepository: Repository<UserEventSave>;
  private locationService: GoogleGeocodingService;
  private eventSimilarityService: EventSimilarityService;

  constructor(private dataSource: DataSource) {
    this.eventRepository = dataSource.getRepository(Event);
    this.categoryRepository = dataSource.getRepository(Category);
    this.userEventSaveRepository = dataSource.getRepository(UserEventSave);
    this.locationService = GoogleGeocodingService.getInstance();
    this.eventSimilarityService = new EventSimilarityService(this.eventRepository);
  }

  async cleanupOutdatedEvents(
    batchSize = 100
  ): Promise<{ deletedEvents: Event[]; deletedCount: number; hasMore: boolean }> {
    const now = new Date();

    // Find events that are outdated:
    // 1. Any event that has passed its start date
    const eventsToDelete = await this.eventRepository
      .createQueryBuilder("event")
      .where("event.event_date < :now", { now })
      .take(batchSize + 1) // Get one extra to check if there are more
      .getMany();

    const hasMore = eventsToDelete.length > batchSize;
    const toDelete = hasMore ? eventsToDelete.slice(0, batchSize) : eventsToDelete;

    if (toDelete.length === 0) {
      return { deletedEvents: [], deletedCount: 0, hasMore: false };
    }

    const ids = toDelete.map((e) => e.id);
    await this.eventRepository.delete(ids);

    return {
      deletedEvents: toDelete,
      deletedCount: toDelete.length,
      hasMore,
    };
  }

  async getEvents(options: { limit?: number; offset?: number } = {}) {
    const { limit = 10, offset = 0 } = options;

    return this.eventRepository.find({
      relations: ["categories"],
      take: limit,
      skip: offset,
      order: {
        eventDate: "DESC",
      },
    });
  }

  async getEventById(id: string): Promise<Event | null> {
    try {
      // Try to get from cache first
      const cachedEvent = await CacheService.getCachedEvent(id);
      if (cachedEvent) {
        return cachedEvent;
      }

      // If not in cache, get from database
      const evt = await this.eventRepository.findOne({
        where: { id },
        relations: ["categories", "creator"],
      });

      // If found, cache it with a shorter TTL for frequently accessed events
      if (evt) {
        await CacheService.setCachedEvent(id, evt, 300); // 5 minutes TTL
      }

      return evt;
    } catch (error) {
      console.error(`Error fetching event ${id}:`, error);
      return null;
    }
  }

  async getNearbyEvents(
    lat: number,
    lng: number,
    radius: number = 5000, // Default 5km radius
    startDate?: Date,
    endDate?: Date
  ): Promise<Event[]> {
    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .where(
        "ST_DWithin(event.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
        { lat, lng, radius }
      );

    if (startDate) {
      query.andWhere("event.eventDate >= :startDate", { startDate });
    }
    if (endDate) {
      query.andWhere("event.eventDate <= :endDate", { endDate });
    }

    return query.getMany();
  }

  async storeDetectedQRCode(eventId: string, qrCodeData: string): Promise<Event | null> {
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

      // Invalidate the cache for this event
      await CacheService.invalidateEventCache(eventId);

      return updatedEvent;
    } catch (error) {
      console.error(`Error storing detected QR code for event ${eventId}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async createEvent(input: CreateEventInput): Promise<Event> {
    // If timezone is not provided, try to determine it from coordinates
    if (!input.timezone && input.location) {
      try {
        const timezone = await this.locationService.getTimezoneFromCoordinates(
          input.location.coordinates[1],
          input.location.coordinates[0]
        );
        input.timezone = timezone;
      } catch (error) {
        console.error("Error determining timezone:", error);
        input.timezone = "UTC";
      }
    }

    let categories: any = [];
    if (input.categoryIds?.length) {
      categories = await this.categoryRepository.findByIds(input.categoryIds);
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
    };

    // Create event instance
    let event = this.eventRepository.create(eventData);

    if (categories.length) {
      event.categories = categories;
    }

    const savedEvent = await this.eventRepository.save(event);

    await CacheService.invalidateSearchCache();

    return savedEvent;
  }

  async updateEvent(id: string, eventData: Partial<CreateEventInput>): Promise<Event | null> {
    try {
      const event = await this.getEventById(id);
      if (!event) return null;

      // Handle basic fields
      if (eventData.title) event.title = eventData.title;
      if (eventData.description !== undefined) event.description = eventData.description;
      if (eventData.eventDate) event.eventDate = eventData.eventDate;
      if (eventData.endDate !== undefined) event.endDate = eventData.endDate;
      if (eventData.location) {
        event.location = eventData.location;

        // If location changed but timezone wasn't specified, try to determine new timezone
        if (!eventData.timezone) {
          try {
            const timezone = await this.locationService.getTimezoneFromCoordinates(
              eventData.location.coordinates[1],
              eventData.location.coordinates[0]
            );
            event.timezone = timezone;
          } catch (error) {
            console.error("Error determining timezone from updated coordinates:", error);
          }
        }
      }

      // Update timezone if provided
      if (eventData.timezone) {
        event.timezone = eventData.timezone;
      }

      // Handle categories if provided
      if (eventData.categoryIds) {
        const categories = await this.categoryRepository.findByIds(eventData.categoryIds);
        event.categories = categories;
      }

      const updatedEvent = await this.eventRepository.save(event);

      // Invalidate the cache for this event
      await CacheService.invalidateEventCache(id);

      // Invalidate search cache since we updated an event
      await CacheService.invalidateSearchCache();

      // Invalidate any cluster hub caches that might contain this event
      // We don't know which clusters contain this event, so we'll need to invalidate all cluster hub caches
      // This is a bit heavy-handed but ensures consistency
      await CacheService.invalidateAllClusterHubCaches();

      return updatedEvent;
    } catch (error) {
      console.error(`Error updating event ${id}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async searchEvents(
    query: string,
    limit: number = 10,
    cursor?: string
  ): Promise<{ results: SearchResult[]; nextCursor?: string }> {
    // Basic validation
    if (!query.trim() || query.length < 2) {
      return { results: [] };
    }

    const cacheKey = `search:${query.toLowerCase()}:${limit}:${cursor || "null"}`;

    // Check if we have cached results for this exact search
    const cachedResults = await CacheService.getCachedSearch(cacheKey);
    if (cachedResults) {
      console.log(`Cache hit for search: "${query}"`);
      return cachedResults;
    }

    console.log(`Cache miss for search: "${query}"`);

    // Check if we have the embedding cached
    const normalizedQuery = `
    TITLE: ${query}
    EMOJI_DESCRIPTION: ${query}
    CATEGORIES: ${query}
    DESCRIPTION: ${query}
    LOCATION: ${query}
    ADDRESS: ${query}
    LOCATION_NOTES: ${query}
    `.trim();
    let searchEmbedding = CacheService.getCachedEmbedding(normalizedQuery);

    if (!searchEmbedding) {
      // Generate new embedding if not in cache
      const openai = OpenAIService.getInstance();
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: normalizedQuery,
        encoding_format: "float",
      });
      searchEmbedding = embeddingResponse.data[0].embedding;

      // Cache the embedding
      CacheService.setCachedEmbedding(normalizedQuery, searchEmbedding);
    }

    // Parse cursor if provided
    let cursorData: { id: string; score: number } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Define our score expression for consistency
    const scoreExpression = `
    (
      -- Semantic similarity (40% weight)
      (1 - (embedding <-> :embedding)::float) * 0.4 +
      
      -- Text matching (35% weight)
      (
        CASE 
          WHEN LOWER(event.title) LIKE LOWER(:exactQuery) THEN 1.0
          WHEN LOWER(event.title) LIKE LOWER(:partialQuery) THEN 0.7
          WHEN LOWER(event.description) LIKE LOWER(:exactQuery) THEN 0.5
          WHEN LOWER(event.description) LIKE LOWER(:partialQuery) THEN 0.3
          WHEN LOWER(event.address) LIKE LOWER(:exactQuery) THEN 0.5
          WHEN LOWER(event.address) LIKE LOWER(:partialQuery) THEN 0.3
          WHEN LOWER(event.locationNotes) LIKE LOWER(:exactQuery) THEN 0.5
          WHEN LOWER(event.locationNotes) LIKE LOWER(:partialQuery) THEN 0.3
          WHEN LOWER(event.emojiDescription) LIKE LOWER(:exactQuery) THEN 0.8
          WHEN LOWER(event.emojiDescription) LIKE LOWER(:partialQuery) THEN 0.6
          ELSE 0
        END
      ) * 0.35 +
      
      -- Category matching (15% weight)
      (
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM categories c
            WHERE c.id = ANY(SELECT category_id FROM event_categories WHERE event_id = event.id)
            AND LOWER(c.name) LIKE LOWER(:exactQuery)
          ) THEN 0.8
          WHEN EXISTS (
            SELECT 1 FROM categories c
            WHERE c.id = ANY(SELECT category_id FROM event_categories WHERE event_id = event.id)
            AND LOWER(c.name) LIKE LOWER(:partialQuery)
          ) THEN 0.4
          ELSE 0
        END
      ) * 0.15 +
      
      -- Recency boost (10% weight)
      (
        CASE 
          WHEN event.eventDate > NOW() THEN 1.0
          WHEN event.eventDate > NOW() - INTERVAL '7 days' THEN 0.8
          WHEN event.eventDate > NOW() - INTERVAL '30 days' THEN 0.6
          WHEN event.eventDate > NOW() - INTERVAL '90 days' THEN 0.4
          ELSE 0.2
        END
      ) * 0.1
    )`;

    // Build query
    let queryBuilder = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .where("event.embedding IS NOT NULL");

    // Add text matching conditions for a better performance pre-filter
    queryBuilder = queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where("LOWER(event.title) LIKE LOWER(:partialQuery)", {
          partialQuery: `%${query.toLowerCase()}%`,
        })
          .orWhere("LOWER(event.description) LIKE LOWER(:partialQuery)", {
            partialQuery: `%${query.toLowerCase()}%`,
          })
          .orWhere("LOWER(event.address) LIKE LOWER(:partialQuery)", {
            partialQuery: `%${query.toLowerCase()}%`,
          })
          .orWhere("LOWER(event.locationNotes) LIKE LOWER(:partialQuery)", {
            partialQuery: `%${query.toLowerCase()}%`,
          })
          .orWhere("LOWER(event.emojiDescription) LIKE LOWER(:partialQuery)", {
            partialQuery: `%${query.toLowerCase()}%`,
          })
          .orWhere(
            "EXISTS (SELECT 1 FROM categories WHERE category.id = ANY(SELECT category_id FROM event_categories WHERE event_id = event.id) AND LOWER(category.name) LIKE LOWER(:partialQuery))",
            { partialQuery: `%${query.toLowerCase()}%` }
          );
      })
    );

    // Add score calculation using our expression
    queryBuilder = queryBuilder.addSelect(scoreExpression, "combined_score");

    // Add parameters
    queryBuilder = queryBuilder.setParameters({
      embedding: pgvector.toSql(searchEmbedding),
      exactQuery: query.toLowerCase(),
      partialQuery: `%${query.toLowerCase()}%`,
    });

    // Add cursor-based pagination if provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where(`${scoreExpression} < :cursorScore`, {
            cursorScore: cursorData.score,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where(`${scoreExpression} = :cursorScore`, {
                  cursorScore: cursorData.score,
                })
                .andWhere("event.id > :cursorId", {
                  cursorId: cursorData.id,
                });
            })
          );
        })
      );
    }

    // Execute query
    const events = await queryBuilder
      .select("event")
      .addSelect(`(${scoreExpression})`, "score")
      .orderBy("score", "DESC")
      .addOrderBy("event.id", "ASC")
      .limit(limit + 1)
      .getMany();

    // Process results
    const searchResults: SearchResult[] = events.slice(0, limit).map((event) => ({
      event,
      score: parseFloat((event as any).__score),
    }));

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (events.length > limit) {
      const lastResult = searchResults[searchResults.length - 1];
      const cursorObj = {
        id: lastResult.event.id,
        score: lastResult.score,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    // Store in cache
    const resultObject = { results: searchResults, nextCursor };
    await CacheService.setCachedSearch(cacheKey, resultObject);

    return resultObject;
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      const result = await this.eventRepository.delete(id);

      // Invalidate the cache for this event
      await CacheService.invalidateEventCache(id);

      // Invalidate search cache since we deleted an event
      await CacheService.invalidateSearchCache();

      // Invalidate any cluster hub caches that might contain this event
      await CacheService.invalidateAllClusterHubCaches();

      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      console.error(`Error deleting event ${id}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<Event | null> {
    try {
      const event = await this.getEventById(id);
      if (!event) return null;

      event.status = status;
      const updatedEvent = await this.eventRepository.save(event);

      // Invalidate the cache for this event
      await CacheService.invalidateEventCache(id);

      return updatedEvent;
    } catch (error) {
      console.error(`Error updating event status for ${id}:`, error);
      throw error; // Re-throw to handle in the controller
    }
  }

  async getEventsByCategories(
    categoryIds: string[],
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { startDate, endDate, limit = 10, offset = 0 } = options;

    const query = this.eventRepository
      .createQueryBuilder("event")
      .innerJoinAndSelect("event.categories", "category")
      .where("category.id IN (:...categoryIds)", { categoryIds })
      .skip(offset)
      .take(limit)
      .orderBy("event.eventDate", "DESC");

    if (startDate) {
      query.andWhere("event.eventDate >= :startDate", { startDate });
    }

    if (endDate) {
      query.andWhere("event.eventDate <= :endDate", { endDate });
    }

    const [events, total] = await query.getManyAndCount();

    return {
      events,
      total,
      hasMore: offset + events.length < total,
    };
  }

  // Add method to get all categories
  async getAllCategories() {
    return await this.categoryRepository.find({
      order: {
        name: "ASC",
      },
    });
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
    eventId: string
  ): Promise<{
    saved: boolean;
    saveCount: number;
  }> {
    // Start a transaction to ensure data consistency
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if the event exists
      const event = await transactionalEntityManager.findOne(Event, {
        where: { id: eventId },
      });

      if (!event) {
        throw new Error("Event not found");
      }

      // Get the user to update their save count
      const user = await transactionalEntityManager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Check if a save relationship already exists
      const existingSave = await transactionalEntityManager.findOne(UserEventSave, {
        where: { userId, eventId },
      });

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
      }

      // Save both the updated event and user
      await transactionalEntityManager.save(event);
      await transactionalEntityManager.save(user);

      return {
        saved,
        saveCount: event.saveCount,
      };
    });
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
    options: { limit?: number; cursor?: string } = {}
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
    let queryBuilder = this.dataSource
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
            })
          );
        })
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
   * Search events using a semantic filter
   * @param filter The filter to apply
   * @param options Additional search options
   */
  async searchEventsByFilter(
    filter: Filter,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ events: Event[]; total: number; hasMore: boolean }> {
    const { limit = 10, offset = 0 } = options;

    // Parse the embedding from string
    const embedding = filter.embedding;
    if (!embedding && !filter.criteria) {
      return { events: [], total: 0, hasMore: false };
    }

    // Start building the query
    let queryBuilder = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category");

    // If we have a semantic embedding, use it
    if (embedding) {
      queryBuilder = queryBuilder
        .where("event.embedding IS NOT NULL")
        .addSelect(`(1 - (event.embedding <-> :embedding)::float)`, "similarity_score")
        .setParameter("embedding", embedding)
        .orderBy("similarity_score", "DESC");
    }

    // Apply additional filters from criteria
    if (filter.criteria) {
      // Date range filtering
      if (filter.criteria.dateRange?.start) {
        queryBuilder = queryBuilder.andWhere("event.eventDate >= :startDate", {
          startDate: new Date(filter.criteria.dateRange.start),
        });
      }

      if (filter.criteria.dateRange?.end) {
        queryBuilder = queryBuilder.andWhere("event.eventDate <= :endDate", {
          endDate: new Date(filter.criteria.dateRange.end),
        });
      }

      // Status filtering
      if (filter.criteria.status && filter.criteria.status.length > 0) {
        queryBuilder = queryBuilder.andWhere("event.status IN (:...statuses)", {
          statuses: filter.criteria.status,
        });
      }

      // Location-based filtering
      if (
        filter.criteria.location?.latitude &&
        filter.criteria.location?.longitude &&
        filter.criteria.location?.radius
      ) {
        queryBuilder = queryBuilder.andWhere(
          `ST_DWithin(
          event.location::geography, 
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, 
          :radius
        )`,
          {
            latitude: filter.criteria.location.latitude,
            longitude: filter.criteria.location.longitude,
            radius: filter.criteria.location.radius,
          }
        );
      }
    }

    // Apply pagination
    queryBuilder = queryBuilder.skip(offset).take(limit);

    // If no semantic search, order by date
    if (!embedding) {
      queryBuilder = queryBuilder.orderBy("event.eventDate", "DESC");
    }

    // Execute the query
    const [events, total] = await queryBuilder.getManyAndCount();

    return {
      events,
      total,
      hasMore: offset + events.length < total,
    };
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
    options: { limit?: number; cursor?: string } = {}
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
    let queryBuilder = this.dataSource
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
            })
          );
        })
      );

      // Log the generated SQL query
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
   * Create a discovery record for a user scanning an event
   * @param userId The ID of the user who scanned the event
   * @param eventId The ID of the event that was discovered
   */
  async createDiscoveryRecord(userId: string, eventId: string): Promise<void> {
    try {
      // Create the discovery record
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into("user_event_discoveries")
        .values({
          userId,
          eventId,
        })
        .orIgnore() // Ignore if record already exists
        .execute();

      // Increment the user's discovery count
      await this.dataSource
        .createQueryBuilder()
        .update(User)
        .set({
          discoveryCount: () => "discovery_count + 1",
        })
        .where("id = :userId", { userId })
        .execute();
    } catch (error) {
      console.error(`Error creating discovery record for user ${userId}:`, error);
      // Don't throw the error - we don't want to fail the scan if discovery recording fails
    }
  }

  async getClusterHubData(markerIds: string[]): Promise<{
    featuredEvent: Event | null;
    eventsByCategory: { category: Category; events: Event[] }[];
    eventsByLocation: { location: string; events: Event[] }[];
    eventsToday: Event[];
    clusterName: string;
    clusterDescription: string;
    clusterEmoji: string;
  }> {
    // Try to get from cache first
    const cachedData = await CacheService.getCachedClusterHub(markerIds);
    if (cachedData) {
      return cachedData;
    }

    // Get all events from the marker IDs
    const events = await this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .where("event.id IN (:...markerIds)", { markerIds })
      .getMany();

    if (events.length === 0) {
      return {
        featuredEvent: null,
        eventsByCategory: [],
        eventsByLocation: [],
        eventsToday: [],
        clusterName: "",
        clusterDescription: "",
        clusterEmoji: "🎉",
      };
    }

    // Generate cluster name and description using 4o-mini model
    let clusterName = "";
    let clusterDescription = "";
    let clusterEmoji = "🎉";
    try {
      // Combine event names and descriptions to create context
      const eventContext = events
        .slice(0, 10) // Take up to 10 events for more comprehensive context
        .map((event) => `${event.title}${event.description ? `: ${event.description}` : ''}`)
        .join('\n');

      const response = await OpenAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content: `You are a creative tagline and emoji generator. Create a short, engaging description and matching emoji for a cluster of events.
            Respond with a JSON object in this exact format:
            {
              "name": "A short, catchy name (2-3 words) that captures the essence of these events",
              "description": "A concise, engaging tagline (1-2 sentences max) that sparks interest and highlights what makes these events special",
              "emoji": "A single, relevant emoji that visually represents the cluster theme"
            }
            
            The name should be memorable and relevant to the events' themes.
            The description should be punchy and intriguing - think of it like a movie tagline that makes people want to learn more.
            The emoji should be a single, well-known emoji that clearly represents the cluster's theme or mood.`
          },
          {
            role: "user",
            content: `Based on these events, create a name, tagline, and emoji for this cluster:\n\n${eventContext}`
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      clusterName = result.name || "";
      clusterDescription = result.description || "";
      clusterEmoji = result.emoji || "🎉"; // Default to party emoji if none provided
    } catch (error) {
      console.error("Error generating cluster name and description:", error);
      // Fallback to using the first event's title and description
      clusterName = events[0]?.title || "";
      clusterDescription = events[0]?.description || "";
    }

    // 1. Get featured event (oldest event for now)
    const featuredEvent = events.reduce((oldest, current) => {
      return oldest.eventDate < current.eventDate ? oldest : current;
    });

    // 2. Get events by category
    const categoryMap = new Map<string, { category: Category; events: Event[] }>();
    events.forEach((event) => {
      event.categories.forEach((category) => {
        if (!categoryMap.has(category.id)) {
          categoryMap.set(category.id, { category, events: [] });
        }
        categoryMap.get(category.id)!.events.push(event);
      });
    });

    // Sort categories by number of events and take top 4
    const eventsByCategory = Array.from(categoryMap.values())
      .sort((a, b) => b.events.length - a.events.length)
      .slice(0, 4);

    // 3. Get events by location
    const locationMap = new Map<string, Event[]>();
    events.forEach((event) => {
      if (event.address) {
        // Extract city and state from address
        const locationMatch = event.address.match(/([^,]+),\s*([A-Z]{2})/);
        if (locationMatch) {
          const location = locationMatch[0]; // e.g., "Provo, UT"
          if (!locationMap.has(location)) {
            locationMap.set(location, []);
          }
          locationMap.get(location)!.push(event);
        }
      }
    });

    // Convert to array and sort by number of events
    const eventsByLocation = Array.from(locationMap.entries())
      .map(([location, events]) => ({ location, events }))
      .sort((a, b) => b.events.length - a.events.length);

    // 4. Get events happening today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const eventsToday = events.filter((event) => {
      const eventDate = new Date(event.eventDate);
      return eventDate >= today && eventDate < tomorrow;
    });

    const result = {
      featuredEvent,
      eventsByCategory,
      eventsByLocation,
      eventsToday,
      clusterName,
      clusterDescription,
      clusterEmoji,
    };

    // Cache the result for 5 minutes
    await CacheService.setCachedClusterHub(markerIds, result);

    return result;
  }
}
