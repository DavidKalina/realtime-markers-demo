import { type Point } from "geojson";
import pgvector from "pgvector";
import { Brackets, DataSource, Repository, type DeepPartial } from "typeorm";
import { Category } from "../entities/Category";
import { Event, EventStatus } from "../entities/Event";
import { CacheService } from "./CacheService";
import { OpenAIService } from "./OpenAIService";

interface SearchResult {
  event: Event;
  score: number;
}

interface CreateEventInput {
  emoji: string;
  title: string;
  description?: string;
  eventDate: Date;
  location: Point;
  categoryIds?: string[];
  confidenceScore?: number;
  address?: string; // Add this if you want to store the address
}

export class EventService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;

  constructor(private dataSource: DataSource) {
    this.eventRepository = dataSource.getRepository(Event);
    this.categoryRepository = dataSource.getRepository(Category);
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
    console.log({ eventId: id });
    return this.eventRepository.findOne({
      where: { id },
      relations: ["categories"],
    });
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

  async createEvent(input: CreateEventInput): Promise<Event> {
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
      location: input.location,
      status: EventStatus.PENDING,
      address: input.address,
      embedding: pgvector.toSql(embedding),
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
    if (eventData.location) event.location = eventData.location;

    // Handle categories if provided
    if (eventData.categoryIds) {
      const categories = await this.categoryRepository.findByIds(eventData.categoryIds);
      event.categories = categories;
    }

    await CacheService.invalidateSearchCache();

    return this.eventRepository.save(event);
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
}
