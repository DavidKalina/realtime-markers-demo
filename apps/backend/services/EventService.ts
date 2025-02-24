import { Brackets, DataSource, Repository, type DeepPartial } from "typeorm";
import { Event, EventStatus } from "../entities/Event";
import { type Point } from "geojson";
import { Category } from "../entities/Category";
import { ThirdSpace } from "../entities/ThirdSpace";
import pgvector from "pgvector";
import OpenAI from "openai";

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
  thirdSpaceId?: string;
  confidenceScore?: number;
  address?: string; // Add this if you want to store the address
}

export class EventService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private thirdSpaceRepository: Repository<ThirdSpace>;

  constructor(private dataSource: DataSource) {
    this.eventRepository = dataSource.getRepository(Event);
    this.categoryRepository = dataSource.getRepository(Category);
    this.thirdSpaceRepository = dataSource.getRepository(ThirdSpace);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  }

  async getEvents(): Promise<Event[]> {
    return this.eventRepository.find({
      relations: ["categories", "thirdSpace"],
    });
  }

  async getEventById(id: string): Promise<Event | null> {
    return this.eventRepository.findOne({
      where: { id },
      relations: ["categories", "thirdSpace"],
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
      .leftJoinAndSelect("event.thirdSpace", "space")
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
    console.log("Input categoryIds:", input.categoryIds);

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
      console.log("Fetching categories for IDs:", input.categoryIds);
      const categories = await this.categoryRepository.findByIds(input.categoryIds);
      console.log("Found categories:", categories);
      event.categories = categories;
    }

    // Handle thirdSpace if provided
    if (input.thirdSpaceId) {
      const space = await this.thirdSpaceRepository.findOneBy({ id: input.thirdSpaceId });
      if (space) {
        event.thirdSpace = space;
      }
    }

    const savedEvent = await this.eventRepository.save(event);
    console.log("Saved event categories:", savedEvent.categories);
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

    // Handle thirdSpace if provided
    if (eventData.thirdSpaceId) {
      const space = await this.thirdSpaceRepository.findOneBy({ id: eventData.thirdSpaceId });
      if (space) {
        event.thirdSpace = space;
      }
    }

    return this.eventRepository.save(event);
  }

  async searchEvents(query: string, limit: number = 10): Promise<SearchResult[]> {
    // Basic validation
    if (!query.trim() || query.length < 2) {
      return [];
    }

    // Generate embedding for vector search
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `Title: ${query}`, // Structure the query like our stored embeddings
      encoding_format: "float",
    });
    const searchEmbedding = embeddingResponse.data[0].embedding;

    // Combine vector similarity with text matching
    const results = await this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.thirdSpace", "space")
      .where("event.embedding IS NOT NULL")
      .andWhere(
        new Brackets((qb) => {
          // Text matching conditions
          qb.where("LOWER(event.title) LIKE LOWER(:query)", {
            query: `%${query}%`,
          }).orWhere("LOWER(event.description) LIKE LOWER(:query)", {
            query: `%${query}%`,
          });
        })
      )
      .addSelect(
        `
      -- Vector similarity (normalized to 0-1)
      (1 - (embedding <-> :embedding)::float) * 0.6 +
      -- Text matching score (normalized to 0-1)
      (CASE 
        WHEN LOWER(event.title) LIKE LOWER(:exactQuery) THEN 1.0
        WHEN LOWER(event.title) LIKE LOWER(:partialQuery) THEN 0.7
        WHEN LOWER(event.description) LIKE LOWER(:exactQuery) THEN 0.5
        WHEN LOWER(event.description) LIKE LOWER(:partialQuery) THEN 0.3
        ELSE 0
      END) * 0.4
    `,
        "combined_score"
      )
      .setParameters({
        embedding: pgvector.toSql(searchEmbedding),
        exactQuery: query.toLowerCase(),
        partialQuery: `%${query.toLowerCase()}%`,
      })
      .groupBy("event.id")
      .addGroupBy("category.id")
      .addGroupBy("space.id")
      .orderBy("combined_score", "DESC")
      .limit(limit)
      .getRawAndEntities();

    return results.entities.map((event, index) => ({
      event,
      score: parseFloat(results.raw[index].combined_score),
    }));
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
    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.thirdSpace", "thirdSpace")
      .where("category.id IN (:...categoryIds)", { categoryIds })
      .orderBy("event.eventDate", "ASC");

    // Add date filtering if provided
    if (options.startDate) {
      query.andWhere("event.eventDate >= :startDate", { startDate: options.startDate });
    }
    if (options.endDate) {
      query.andWhere("event.eventDate <= :endDate", { endDate: options.endDate });
    }

    // Add pagination
    if (options.limit) {
      query.take(options.limit);
    }
    if (options.offset) {
      query.skip(options.offset);
    }

    // Get both events and total count
    const [events, total] = await query.getManyAndCount();

    return {
      events,
      total,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: options.limit ? total > (options.offset || 0) + options.limit : false,
      },
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
