import pgvector from "pgvector";
import { Brackets, DataSource, Repository } from "typeorm";
import type { Category } from "../entities/Category";
import type { Event } from "../entities/Event";
import type { Filter } from "../entities/Filter";
import type { EventCacheService } from "./shared/EventCacheService";
import type { OpenAIService } from "./shared/OpenAIService";
import type { QueryAnalyticsService } from "./QueryAnalyticsService";

interface SearchResult {
  event: Event;
  score: number;
}

export interface EventSearchService {
  searchEvents(
    query: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ results: SearchResult[]; nextCursor?: string }>;

  getNearbyEvents(
    lat: number,
    lng: number,
    radius?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Event[]>;

  getEventsByCategories(
    categoryIds: string[],
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ events: Event[]; total: number; hasMore: boolean }>;

  getEventsByCategory(
    categoryId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: Event[]; nextCursor?: string }>;

  searchEventsByFilter(
    filter: Filter,
    options?: { limit?: number; offset?: number },
  ): Promise<{ events: Event[]; total: number; hasMore: boolean }>;

  getLandingPageData(options?: {
    featuredLimit?: number;
    upcomingLimit?: number;
    communityLimit?: number;
    userLat?: number;
    userLng?: number;
  }): Promise<{
    featuredEvents: Event[];
    upcomingEvents: Event[];
    communityEvents: Event[];
    popularCategories: Category[];
  }>;
}

export interface EventSearchServiceDependencies {
  dataSource: DataSource;
  eventCacheService: EventCacheService;
  openaiService: OpenAIService;
  queryAnalyticsService: QueryAnalyticsService;
}

export class EventSearchServiceImpl implements EventSearchService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private eventCacheService: EventCacheService;
  private openaiService: OpenAIService;
  private queryAnalyticsService: QueryAnalyticsService;

  constructor(private dependencies: EventSearchServiceDependencies) {
    this.eventRepository = dependencies.dataSource.getRepository("Event");
    this.categoryRepository = dependencies.dataSource.getRepository("Category");
    this.eventCacheService = dependencies.eventCacheService;
    this.openaiService = dependencies.openaiService;
    this.queryAnalyticsService = dependencies.queryAnalyticsService;
  }

  async searchEvents(
    query: string,
    limit: number = 10,
    cursor?: string,
  ): Promise<{ results: SearchResult[]; nextCursor?: string }> {
    // Basic validation
    if (!query.trim() || query.length < 2) {
      return { results: [] };
    }

    const cacheKey = `search:${query.toLowerCase()}:${limit}:${cursor || "null"}`;

    // Check if we have cached results for this exact search
    const cachedResults =
      await this.eventCacheService.getSearchResults(cacheKey);
    if (cachedResults) {
      console.log(`Cache hit for search: "${query}"`);

      // Track analytics even for cached results
      this.trackSearchAnalytics(
        query,
        cachedResults.results.length,
        cachedResults.results,
      );

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
    let searchEmbedding =
      this.eventCacheService.getCachedEmbedding(normalizedQuery);

    if (!searchEmbedding) {
      // Generate new embedding if not in cache
      searchEmbedding =
        await this.openaiService.generateEmbedding(normalizedQuery);

      // Cache the embedding
      if (searchEmbedding) {
        this.eventCacheService.setCachedEmbedding(
          normalizedQuery,
          searchEmbedding,
        );
      }
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
            { partialQuery: `%${query.toLowerCase()}%` },
          );
      }),
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
            }),
          );
        }),
      );
    }

    // Execute query
    const events = await queryBuilder
      .addSelect(`(${scoreExpression})`, "score")
      .orderBy("score", "DESC")
      .addOrderBy("event.id", "ASC")
      .limit(limit + 1)
      .getMany();

    // Process results
    const searchResults: SearchResult[] = events
      .slice(0, limit)
      .map((event) => {
        // Extract score and remove it from the event object
        const score = parseFloat(
          (event as unknown as { __score: string }).__score,
        );
        const eventWithoutScore = Object.fromEntries(
          Object.entries(
            event as unknown as Event & { __score: string },
          ).filter(([key]) => key !== "__score"),
        ) as Event;

        return {
          event: eventWithoutScore,
          score,
        };
      });

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
    await this.eventCacheService.setSearchResults(cacheKey, resultObject);

    // Track analytics for the search
    this.trackSearchAnalytics(query, searchResults.length, searchResults);

    return resultObject;
  }

  async getNearbyEvents(
    lat: number,
    lng: number,
    radius: number = 5000, // Default 5km radius
    startDate?: Date,
    endDate?: Date,
  ): Promise<Event[]> {
    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .where(
        "ST_DWithin(event.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
        { lat, lng, radius },
      );

    if (startDate) {
      query.andWhere("event.eventDate >= :startDate", { startDate });
    }
    if (endDate) {
      query.andWhere("event.eventDate <= :endDate", { endDate });
    }

    return query.getMany();
  }

  async getEventsByCategories(
    categoryIds: string[],
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {},
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

  async getEventsByCategory(
    categoryId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ events: Event[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { eventDate: Date; eventId: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator")
      .where("category.id = :categoryId", { categoryId });

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("event.eventDate < :eventDate", {
            eventDate: cursorData.eventDate,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("event.eventDate = :eventDate", {
                  eventDate: cursorData.eventDate,
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
    const events = await queryBuilder
      .orderBy("event.eventDate", "DESC")
      .addOrderBy("event.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = events.length > limit;
    const results = events.slice(0, limit);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        eventDate: lastResult.eventDate,
        eventId: lastResult.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      events: results,
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
    options: { limit?: number; offset?: number } = {},
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
        .addSelect(
          "(1 - (event.embedding <-> :embedding)::float)",
          "similarity_score",
        )
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
          },
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
   * Track search analytics for a query
   */
  private async trackSearchAnalytics(
    query: string,
    resultCount: number,
    results: SearchResult[],
  ): Promise<void> {
    try {
      // Extract event IDs and category IDs from results
      const eventIds = results.map((result) => result.event.id);
      const categoryIds = results.flatMap(
        (result) => result.event.categories?.map((cat) => cat.id) || [],
      );

      // Track the search analytics
      await this.queryAnalyticsService.trackSearch({
        query,
        resultCount,
        eventIds,
        categoryIds,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error tracking search analytics:", error);
      // Don't throw - analytics tracking shouldn't break the search functionality
    }
  }

  async getLandingPageData(
    options: {
      featuredLimit?: number;
      upcomingLimit?: number;
      communityLimit?: number;
      userLat?: number;
      userLng?: number;
    } = {},
  ): Promise<{
    featuredEvents: Event[];
    upcomingEvents: Event[];
    communityEvents: Event[];
    popularCategories: Category[];
  }> {
    const {
      featuredLimit = 5,
      upcomingLimit = 10,
      communityLimit = 5,
      userLat,
      userLng,
    } = options;

    // Create a cache key based on the parameters
    const cacheKey = `landing:${featuredLimit}:${upcomingLimit}:${communityLimit}:${userLat || "null"}:${userLng || "null"}`;

    // Check if we have cached results
    const cachedResults =
      await this.eventCacheService.getLandingPageData(cacheKey);
    if (cachedResults && cachedResults.communityEvents !== undefined) {
      console.log(`Cache hit for landing page data: ${cacheKey}`);
      return {
        featuredEvents: cachedResults.featuredEvents,
        upcomingEvents: cachedResults.upcomingEvents,
        communityEvents: cachedResults.communityEvents,
        popularCategories: cachedResults.popularCategories,
      };
    }

    console.log(`Cache miss for landing page data: ${cacheKey}`);

    // Get featured events (official events with high engagement)
    const featuredEvents = await this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator")
      .where("event.isOfficial = :isOfficial", { isOfficial: true })
      .andWhere("event.status = :status", { status: "VERIFIED" })
      .andWhere("event.eventDate > NOW()")
      .andWhere("event.isPrivate = :isPrivate", { isPrivate: false })
      .orderBy("event.saveCount", "DESC")
      .addOrderBy("event.viewCount", "DESC")
      .addOrderBy("event.eventDate", "ASC")
      .limit(featuredLimit)
      .getMany();

    // Get upcoming events (official events happening soon)
    const upcomingQuery = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator")
      .where("event.isOfficial = :isOfficial", { isOfficial: true })
      .andWhere("event.status = :status", { status: "VERIFIED" })
      .andWhere("event.eventDate > NOW()")
      .andWhere("event.isPrivate = :isPrivate", { isPrivate: false })
      .orderBy("event.eventDate", "ASC")
      .limit(upcomingLimit);

    // If user location is provided, prioritize nearby events
    if (userLat && userLng) {
      upcomingQuery.addSelect(
        `ST_Distance(
          event.location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        "distance",
      );
      upcomingQuery.setParameter("lat", userLat);
      upcomingQuery.setParameter("lng", userLng);
      upcomingQuery.addOrderBy("distance", "ASC");
    }

    const upcomingEvents = await upcomingQuery.getMany();

    // Get community events (non-official events with originalImageUrl)
    const communityEvents = await this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator")
      .where("event.isOfficial = :isOfficial", { isOfficial: false })
      .andWhere("event.status = :status", { status: "VERIFIED" })
      .andWhere("event.eventDate > NOW()")
      .andWhere("event.isPrivate = :isPrivate", { isPrivate: false })
      .andWhere("event.originalImageUrl IS NOT NULL")
      .orderBy("event.saveCount", "DESC")
      .addOrderBy("event.viewCount", "DESC")
      .addOrderBy("event.eventDate", "ASC")
      .limit(communityLimit)
      .getMany();

    console.log(`Found ${communityEvents.length} community events`);

    // Get popular categories from official events
    const popularCategories = await this.categoryRepository
      .createQueryBuilder("category")
      .innerJoin("category.events", "event")
      .where("event.isOfficial = :isOfficial", { isOfficial: true })
      .andWhere("event.status = :status", { status: "VERIFIED" })
      .andWhere("event.eventDate > NOW()")
      .andWhere("event.isPrivate = :isPrivate", { isPrivate: false })
      .select("category.id", "id")
      .addSelect("category.name", "name")
      .addSelect("category.icon", "icon")
      .addSelect("COUNT(event.id)", "eventcount")
      .groupBy("category.id")
      .addGroupBy("category.name")
      .addGroupBy("category.icon")
      .orderBy("eventcount", "DESC")
      .limit(8)
      .getRawMany();

    // Convert raw results to Category objects
    const categories = popularCategories.map((raw) => ({
      id: raw.id,
      name: raw.name,
      icon: raw.icon,
      createdAt: new Date(),
      updatedAt: new Date(),
      events: [],
    })) as Category[];

    const result = {
      featuredEvents,
      upcomingEvents,
      communityEvents,
      popularCategories: categories,
    };

    console.log("Landing page result:", {
      featuredEventsCount: featuredEvents.length,
      upcomingEventsCount: upcomingEvents.length,
      communityEventsCount: communityEvents.length,
      popularCategoriesCount: categories.length,
    });

    // Cache the results
    await this.eventCacheService.setLandingPageData(cacheKey, result);

    return result;
  }
}

/**
 * Factory function to create an EventSearchService instance
 */
export function createEventSearchService(
  dependencies: EventSearchServiceDependencies,
): EventSearchService {
  return new EventSearchServiceImpl(dependencies);
}
