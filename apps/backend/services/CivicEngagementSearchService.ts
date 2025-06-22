import pgvector from "pgvector";
import { Brackets, DataSource, Repository } from "typeorm";
import type { CivicEngagement } from "../entities/CivicEngagement";
import type { User } from "../entities/User";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { CivicEngagementCacheService } from "./shared/CivicEngagementCacheService";

interface SearchResult {
  civicEngagement: CivicEngagement;
  score: number;
}

export interface CivicEngagementSearchService {
  searchCivicEngagements(
    query: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ results: SearchResult[]; nextCursor?: string }>;

  getNearbyCivicEngagements(
    lat: number,
    lng: number,
    radius?: number,
  ): Promise<CivicEngagement[]>;

  getCivicEngagementsByType(
    type: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }>;

  getCivicEngagementsByStatus(
    status: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }>;

  getCivicEngagementsByCreator(
    creatorId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }>;

  getRecentCivicEngagements(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }>;

  getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recentActivity: number;
  }>;
}

export interface CivicEngagementSearchServiceDependencies {
  dataSource: DataSource;
  embeddingService: IEmbeddingService;
  civicEngagementCacheService: CivicEngagementCacheService;
}

export class CivicEngagementSearchServiceImpl
  implements CivicEngagementSearchService
{
  private civicEngagementRepository: Repository<CivicEngagement>;
  private userRepository: Repository<User>;
  private embeddingService: IEmbeddingService;
  private civicEngagementCacheService: CivicEngagementCacheService;

  constructor(private dependencies: CivicEngagementSearchServiceDependencies) {
    this.civicEngagementRepository =
      dependencies.dataSource.getRepository("CivicEngagement");
    this.userRepository = dependencies.dataSource.getRepository("User");
    this.embeddingService = dependencies.embeddingService;
    this.civicEngagementCacheService = dependencies.civicEngagementCacheService;
  }

  async searchCivicEngagements(
    query: string,
    limit: number = 10,
    cursor?: string,
  ): Promise<{ results: SearchResult[]; nextCursor?: string }> {
    // Basic validation
    if (!query.trim() || query.length < 2) {
      return { results: [] };
    }

    const cacheKey = `civic_search:${query.toLowerCase()}:${limit}:${cursor || "null"}`;

    // Check if we have cached results for this exact search
    const cachedResults = await this.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      console.log(`Cache hit for civic engagement search: "${query}"`);
      return cachedResults;
    }

    console.log(`Cache miss for civic engagement search: "${query}"`);

    // Generate embedding for the search query
    const searchEmbedding = await this.embeddingService.getEmbedding(query);

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

    // Define our score expression for civic engagements
    const scoreExpression = `
    (
      -- Semantic similarity (50% weight)
      (1 - (embedding <-> :embedding)::float) * 0.5 +
      
      -- Text matching (35% weight)
      (
        CASE 
          WHEN LOWER(civic_engagement.title) LIKE LOWER(:exactQuery) THEN 1.0
          WHEN LOWER(civic_engagement.title) LIKE LOWER(:partialQuery) THEN 0.7
          WHEN LOWER(civic_engagement.description) LIKE LOWER(:exactQuery) THEN 0.5
          WHEN LOWER(civic_engagement.description) LIKE LOWER(:partialQuery) THEN 0.3
          WHEN LOWER(civic_engagement.address) LIKE LOWER(:exactQuery) THEN 0.5
          WHEN LOWER(civic_engagement.address) LIKE LOWER(:partialQuery) THEN 0.3
          WHEN LOWER(civic_engagement.locationNotes) LIKE LOWER(:exactQuery) THEN 0.5
          WHEN LOWER(civic_engagement.locationNotes) LIKE LOWER(:partialQuery) THEN 0.3
          ELSE 0
        END
      ) * 0.35 +
      
      -- Type matching (10% weight)
      (
        CASE 
          WHEN LOWER(civic_engagement.type::text) LIKE LOWER(:exactQuery) THEN 0.8
          WHEN LOWER(civic_engagement.type::text) LIKE LOWER(:partialQuery) THEN 0.4
          ELSE 0
        END
      ) * 0.1 +
      
      -- Recency boost (5% weight)
      (
        CASE 
          WHEN civic_engagement.createdAt > NOW() - INTERVAL '7 days' THEN 1.0
          WHEN civic_engagement.createdAt > NOW() - INTERVAL '30 days' THEN 0.8
          WHEN civic_engagement.createdAt > NOW() - INTERVAL '90 days' THEN 0.6
          ELSE 0.4
        END
      ) * 0.05
    )`;

    // Build query
    let queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .leftJoinAndSelect("civic_engagement.creator", "creator")
      .where("civic_engagement.embedding IS NOT NULL");

    // Add text matching conditions for better performance pre-filter
    queryBuilder = queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where("LOWER(civic_engagement.title) LIKE LOWER(:partialQuery)", {
          partialQuery: `%${query.toLowerCase()}%`,
        })
          .orWhere(
            "LOWER(civic_engagement.description) LIKE LOWER(:partialQuery)",
            {
              partialQuery: `%${query.toLowerCase()}%`,
            },
          )
          .orWhere(
            "LOWER(civic_engagement.address) LIKE LOWER(:partialQuery)",
            {
              partialQuery: `%${query.toLowerCase()}%`,
            },
          )
          .orWhere(
            "LOWER(civic_engagement.locationNotes) LIKE LOWER(:partialQuery)",
            {
              partialQuery: `%${query.toLowerCase()}%`,
            },
          )
          .orWhere(
            "LOWER(civic_engagement.type::text) LIKE LOWER(:partialQuery)",
            {
              partialQuery: `%${query.toLowerCase()}%`,
            },
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
                .andWhere("civic_engagement.id > :cursorId", {
                  cursorId: cursorData.id,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const civicEngagements = await queryBuilder
      .addSelect(`(${scoreExpression})`, "score")
      .orderBy("score", "DESC")
      .addOrderBy("civic_engagement.id", "ASC")
      .limit(limit + 1)
      .getMany();

    // Process results
    const searchResults: SearchResult[] = civicEngagements
      .slice(0, limit)
      .map((civicEngagement) => {
        // Extract score and remove it from the civic engagement object
        const score = parseFloat(
          (civicEngagement as unknown as { __score: string }).__score,
        );
        const civicEngagementWithoutScore = Object.fromEntries(
          Object.entries(
            civicEngagement as unknown as CivicEngagement & { __score: string },
          ).filter(([key]) => key !== "__score"),
        ) as CivicEngagement;

        return {
          civicEngagement: civicEngagementWithoutScore,
          score,
        };
      });

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (civicEngagements.length > limit) {
      const lastResult = searchResults[searchResults.length - 1];
      const cursorObj = {
        id: lastResult.civicEngagement.id,
        score: lastResult.score,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    // Store in cache
    const resultObject = { results: searchResults, nextCursor };
    await this.setCachedSearchResults(cacheKey, resultObject);

    return resultObject;
  }

  async getNearbyCivicEngagements(
    lat: number,
    lng: number,
    radius: number = 5000, // Default 5km radius
  ): Promise<CivicEngagement[]> {
    return await this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .leftJoinAndSelect("civic_engagement.creator", "creator")
      .where(
        "ST_DWithin(civic_engagement.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
        { lat, lng, radius },
      )
      .orderBy("civic_engagement.createdAt", "DESC")
      .getMany();
  }

  async getCivicEngagementsByType(
    type: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .leftJoinAndSelect("civic_engagement.creator", "creator")
      .where("civic_engagement.type = :type", { type });

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("civic_engagement.createdAt < :createdAt", {
            createdAt: cursorData.createdAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("civic_engagement.createdAt = :createdAt", {
                  createdAt: cursorData.createdAt,
                })
                .andWhere("civic_engagement.id < :id", {
                  id: cursorData.id,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const civicEngagements = await queryBuilder
      .orderBy("civic_engagement.createdAt", "DESC")
      .addOrderBy("civic_engagement.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = civicEngagements.length > limit;
    const results = civicEngagements.slice(0, limit);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        createdAt: lastResult.createdAt,
        id: lastResult.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      civicEngagements: results,
      nextCursor,
    };
  }

  async getCivicEngagementsByStatus(
    status: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .leftJoinAndSelect("civic_engagement.creator", "creator")
      .where("civic_engagement.status = :status", { status });

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("civic_engagement.createdAt < :createdAt", {
            createdAt: cursorData.createdAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("civic_engagement.createdAt = :createdAt", {
                  createdAt: cursorData.createdAt,
                })
                .andWhere("civic_engagement.id < :id", {
                  id: cursorData.id,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const civicEngagements = await queryBuilder
      .orderBy("civic_engagement.createdAt", "DESC")
      .addOrderBy("civic_engagement.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = civicEngagements.length > limit;
    const results = civicEngagements.slice(0, limit);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        createdAt: lastResult.createdAt,
        id: lastResult.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      civicEngagements: results,
      nextCursor,
    };
  }

  async getCivicEngagementsByCreator(
    creatorId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .leftJoinAndSelect("civic_engagement.creator", "creator")
      .where("civic_engagement.creatorId = :creatorId", { creatorId });

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("civic_engagement.createdAt < :createdAt", {
            createdAt: cursorData.createdAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("civic_engagement.createdAt = :createdAt", {
                  createdAt: cursorData.createdAt,
                })
                .andWhere("civic_engagement.id < :id", {
                  id: cursorData.id,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const civicEngagements = await queryBuilder
      .orderBy("civic_engagement.createdAt", "DESC")
      .addOrderBy("civic_engagement.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = civicEngagements.length > limit;
    const results = civicEngagements.slice(0, limit);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        createdAt: lastResult.createdAt,
        id: lastResult.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      civicEngagements: results,
      nextCursor,
    };
  }

  async getRecentCivicEngagements(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }> {
    const { limit = 10, cursor } = options;

    // Parse cursor if provided
    let cursorData: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
        cursorData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Invalid cursor format:", e);
      }
    }

    // Build query
    let queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .leftJoinAndSelect("civic_engagement.creator", "creator");

    // Add cursor conditions if cursor is provided
    if (cursorData) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("civic_engagement.createdAt < :createdAt", {
            createdAt: cursorData.createdAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("civic_engagement.createdAt = :createdAt", {
                  createdAt: cursorData.createdAt,
                })
                .andWhere("civic_engagement.id < :id", {
                  id: cursorData.id,
                });
            }),
          );
        }),
      );
    }

    // Execute query
    const civicEngagements = await queryBuilder
      .orderBy("civic_engagement.createdAt", "DESC")
      .addOrderBy("civic_engagement.id", "DESC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = civicEngagements.length > limit;
    const results = civicEngagements.slice(0, limit);

    // Generate next cursor if we have more results
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      const cursorObj = {
        createdAt: lastResult.createdAt,
        id: lastResult.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return {
      civicEngagements: results,
      nextCursor,
    };
  }

  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recentActivity: number;
  }> {
    // Get total count
    const total = await this.civicEngagementRepository.count();

    // Get counts by type
    const byTypeResults = await this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .select("civic_engagement.type", "type")
      .addSelect("COUNT(*)", "count")
      .groupBy("civic_engagement.type")
      .getRawMany();

    const byType: Record<string, number> = {};
    byTypeResults.forEach((result) => {
      byType[result.type] = parseInt(result.count);
    });

    // Get counts by status
    const byStatusResults = await this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .select("civic_engagement.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("civic_engagement.status")
      .getRawMany();

    const byStatus: Record<string, number> = {};
    byStatusResults.forEach((result) => {
      byStatus[result.status] = parseInt(result.count);
    });

    // Get recent activity (last 7 days)
    const recentActivity = await this.civicEngagementRepository
      .createQueryBuilder("civic_engagement")
      .where("civic_engagement.createdAt > NOW() - INTERVAL '7 days'")
      .getCount();

    return {
      total,
      byType,
      byStatus,
      recentActivity,
    };
  }

  // Cache methods
  private async getCachedSearchResults(
    cacheKey: string,
  ): Promise<{ results: SearchResult[]; nextCursor?: string } | null> {
    try {
      const cached =
        await this.civicEngagementCacheService.getSearchResults(cacheKey);
      return cached;
    } catch (error) {
      console.error("Error getting cached search results:", error);
      return null;
    }
  }

  private async setCachedSearchResults(
    cacheKey: string,
    results: { results: SearchResult[]; nextCursor?: string },
  ): Promise<void> {
    try {
      // Cache for 5 minutes
      await this.civicEngagementCacheService.setSearchResults(
        cacheKey,
        results,
        300,
      );
    } catch (error) {
      console.error("Error setting cached search results:", error);
    }
  }
}

/**
 * Factory function to create a CivicEngagementSearchService instance
 */
export function createCivicEngagementSearchService(
  dependencies: CivicEngagementSearchServiceDependencies,
): CivicEngagementSearchService {
  return new CivicEngagementSearchServiceImpl(dependencies);
}
