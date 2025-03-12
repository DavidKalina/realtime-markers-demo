import { type Point } from "geojson";
import pgvector from "pgvector";
import { Brackets, DataSource, Repository, type DeepPartial } from "typeorm";
import { Category } from "../entities/Category";
import { Event, EventStatus } from "../entities/Event";
import { UserEventSave } from "../entities/UserEventSave";
import { CacheService } from "./shared/CacheService";
import { OpenAIService } from "./shared/OpenAIService";
import { EnhancedLocationService } from "./shared/LocationService";

interface SearchResult {
  event: Event;
  score: number;
}

interface CreateEventInput {
  emoji: string;
  title: string;
  description?: string;
  eventDate: Date;
  endDate?: Date;
  location: Point;
  categoryIds?: string[];
  confidenceScore?: number;
  address?: string;
  creatorId: string;
  timezone?: string;
  qrDetectedInImage?: boolean; // New field
  detectedQrData?: string;
}

export class EventService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private userEventSaveRepository: Repository<UserEventSave>;
  private locationService: EnhancedLocationService;

  constructor(private dataSource: DataSource) {
    this.eventRepository = dataSource.getRepository(Event);
    this.categoryRepository = dataSource.getRepository(Category);
    this.userEventSaveRepository = dataSource.getRepository(UserEventSave);
    this.locationService = EnhancedLocationService.getInstance();
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const cachedEmbedding = CacheService.getCachedEmbedding(text);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    // If not in cache, generate new embedding
    const openai = OpenAIService.getInstance();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    const embedding = response.data[0].embedding;
    // Save to cache
    CacheService.setCachedEmbedding(text, embedding);

    return embedding;
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
    const evt = await this.eventRepository.findOne({
      where: { id },
      relations: ["categories", "creator"],
    });

    return evt;
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
    // Get the event
    const event = await this.getEventById(eventId);
    if (!event) {
      return null;
    }

    try {
      // Store the detected QR code data
      event.qrCodeData = qrCodeData;
      event.hasQrCode = true;
      event.qrDetectedInImage = true;
      event.detectedQrData = qrCodeData;
      event.qrGeneratedAt = new Date();

      // Save the updated event
      const updatedEvent = await this.eventRepository.save(event);
      return updatedEvent;
    } catch (error) {
      console.error(`Error storing detected QR code for event ${eventId}:`, error);
      return null;
    }
  }

  async createEvent(input: CreateEventInput): Promise<Event> {
    // If timezone is not provided, try to determine it from coordinates
    if (!input.timezone && input.location) {
      try {
        // Get timezone from coordinates
        const timezone = await this.locationService.getTimezoneFromCoordinates(
          input.location.coordinates[1], // latitude
          input.location.coordinates[0] // longitude
        );
        input.timezone = timezone;
        console.log(
          `Determined timezone ${timezone} for event at coordinates [${input.location.coordinates}]`
        );
      } catch (error) {
        console.error("Error determining timezone from coordinates:", error);
        input.timezone = "UTC"; // Default to UTC
      }
    }

    // Generate embedding from title and description
    const textForEmbedding = `${input.title} ${input.description || ""}`.trim();
    const embedding = await this.generateEmbedding(textForEmbedding);

    // Create base event data without relations
    const eventData: DeepPartial<Event> = {
      emoji: input.emoji,
      title: input.title,
      description: input.description,
      confidenceScore: input.confidenceScore,
      eventDate: input.eventDate,
      endDate: input.endDate,
      location: input.location,
      status: EventStatus.PENDING,
      address: input.address,
      embedding: pgvector.toSql(embedding),
      creatorId: input.creatorId,
      timezone: input.timezone || "UTC", // Save the timezone
      qrDetectedInImage: input.qrDetectedInImage || false,
      detectedQrData: input.detectedQrData,
    };

    // Create event instance
    let event = this.eventRepository.create(eventData);

    // Handle categories if provided
    if (input.categoryIds?.length) {
      const categories = await this.categoryRepository.findByIds(input.categoryIds);
      event.categories = categories;
    }

    const savedEvent = await this.eventRepository.save(event);

    await CacheService.invalidateSearchCache();

    return savedEvent;
  }

  async updateEvent(id: string, eventData: Partial<CreateEventInput>): Promise<Event | null> {
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

    await CacheService.invalidateSearchCache();

    return this.eventRepository.save(event);
  }

  // The rest of the methods remain unchanged
  // ...

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
    const normalizedQuery = `Title: ${query}`;
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
    (1 - (embedding <-> :embedding)::float) * 0.6 +
    (CASE 
      WHEN LOWER(event.title) LIKE LOWER(:exactQuery) THEN 1.0
      WHEN LOWER(event.title) LIKE LOWER(:partialQuery) THEN 0.7
      WHEN LOWER(event.description) LIKE LOWER(:exactQuery) THEN 0.5
      WHEN LOWER(event.description) LIKE LOWER(:partialQuery) THEN 0.3
      ELSE 0
    END) * 0.4
  `;

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
        }).orWhere("LOWER(event.description) LIKE LOWER(:partialQuery)", {
          partialQuery: `%${query.toLowerCase()}%`,
        });
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

    // Complete the query - fix the groupBy to match joined tables
    queryBuilder = queryBuilder
      .orderBy("combined_score", "DESC")
      .addOrderBy("event.id", "ASC") // Secondary sort for deterministic pagination
      .limit(limit + 1); // Fetch one extra to determine if there are more results

    // Execute query
    const results = await queryBuilder.getRawAndEntities();

    // Process results
    const searchResults: SearchResult[] = [];

    // Map results ensuring correct score association
    for (let i = 0; i < Math.min(results.entities.length, limit); i++) {
      searchResults.push({
        event: results.entities[i],
        score: parseFloat(results.raw[i].combined_score),
      });
    }

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (results.entities.length > limit) {
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
    const result = await this.eventRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<Event | null> {
    const event = await this.getEventById(id);
    if (!event) return null;

    event.status = status;
    return this.eventRepository.save(event);
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
        saved = true;
      }

      // Save the updated event
      await transactionalEntityManager.save(event);

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
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ events: Event[]; total: number; hasMore: boolean }> {
    const { limit = 10, offset = 0 } = options;

    // Instead of using the query builder, use the repository's find methods
    const saves = await this.userEventSaveRepository.find({
      where: { userId },
      relations: ["event", "event.categories", "event.creator"],
      order: { savedAt: "DESC" },
      skip: offset,
      take: limit,
    });

    const total = await this.userEventSaveRepository.count({
      where: { userId },
    });

    // Extract the events from the saves
    const events = saves.map((save) => save.event);

    return {
      events,
      total,
      hasMore: offset + events.length < total,
    };
  }
}
