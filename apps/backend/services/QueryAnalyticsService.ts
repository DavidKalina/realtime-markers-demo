import { DataSource, Repository } from "typeorm";
import { QueryAnalytics } from "../entities/QueryAnalytics";
import { Event } from "../entities/Event";
import { Category } from "../entities/Category";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";

export interface QueryAnalyticsData {
  query: string;
  resultCount: number;
  eventIds: string[];
  categoryIds: string[];
  timestamp: Date;
}

export interface QueryCluster {
  representativeQuery: string;
  similarQueries: Array<{
    query: string;
    similarity: number;
    totalSearches: number;
    hitRate: number;
  }>;
  totalSearches: number;
  averageHitRate: number;
  totalHits: number;
  needsAttention: boolean;
}

export interface QueryInsights {
  summary: {
    totalQueries: number;
    totalSearches: number;
    averageHitRate: number;
    zeroHitQueries: number;
    lowHitQueries: number;
  };
  popularQueries: Array<{
    query: string;
    totalSearches: number;
    hitRate: number;
    averageResults: number;
  }>;
  lowHitRateQueries: Array<{
    query: string;
    totalSearches: number;
    hitRate: number;
    lastSearched: Date;
  }>;
  trendingQueries: Array<{
    query: string;
    recentSearches: number;
    growthRate: number;
  }>;
  zeroResultQueries: Array<{
    query: string;
    searchCount: number;
    lastSearched: Date;
  }>;
  queryClusters: QueryCluster[];
}

export interface QueryAnalyticsService {
  trackSearch(data: QueryAnalyticsData): Promise<void>;

  getQueryInsights(options?: {
    days?: number;
    limit?: number;
    minSearches?: number;
    similarityThreshold?: number;
  }): Promise<QueryInsights>;

  getPopularQueries(limit?: number): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      averageResults: number;
    }>
  >;

  getLowHitRateQueries(limit?: number): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      lastSearched: Date;
    }>
  >;

  getZeroResultQueries(limit?: number): Promise<
    Array<{
      query: string;
      searchCount: number;
      lastSearched: Date;
    }>
  >;

  getQueryStats(query: string): Promise<{
    totalSearches: number;
    totalHits: number;
    hitRate: number;
    averageResults: number;
    firstSearched: Date | null;
    lastSearched: Date | null;
    topResults: string[];
    searchCategories: string[];
  } | null>;

  getQueryClusters(similarityThreshold?: number): Promise<QueryCluster[]>;

  findSimilarQueries(
    query: string,
    limit?: number,
    similarityThreshold?: number,
  ): Promise<
    Array<{
      query: string;
      similarity: number;
      totalSearches: number;
      hitRate: number;
    }>
  >;

  updateQueryFlags(): Promise<{
    popularQueriesUpdated: number;
    attentionQueriesUpdated: number;
  }>;
}

export interface QueryAnalyticsServiceDependencies {
  dataSource: DataSource;
  embeddingService: IEmbeddingService;
}

export class QueryAnalyticsServiceImpl implements QueryAnalyticsService {
  private queryAnalyticsRepository: Repository<QueryAnalytics>;
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private embeddingService: IEmbeddingService;

  constructor(private dependencies: QueryAnalyticsServiceDependencies) {
    this.queryAnalyticsRepository =
      dependencies.dataSource.getRepository(QueryAnalytics);
    this.eventRepository = dependencies.dataSource.getRepository(Event);
    this.categoryRepository = dependencies.dataSource.getRepository(Category);
    this.embeddingService = dependencies.embeddingService;
  }

  async trackSearch(data: QueryAnalyticsData): Promise<void> {
    try {
      const normalizedQuery = this.normalizeQuery(data.query);

      // Find existing analytics record or create new one
      let analytics = await this.queryAnalyticsRepository.findOne({
        where: { normalizedQuery },
      });

      if (!analytics) {
        analytics = this.queryAnalyticsRepository.create({
          query: data.query,
          normalizedQuery,
          totalSearches: 0,
          totalHits: 0,
          zeroResultSearches: 0,
          averageResultsPerSearch: 0,
          hitRate: 0,
          firstSearchedAt: data.timestamp,
          lastSearchedAt: data.timestamp,
          topResults: [],
          searchCategories: [],
        });
      }

      // Update analytics
      analytics.totalSearches += 1;
      analytics.totalHits += data.resultCount;
      analytics.lastSearchedAt = data.timestamp;

      if (data.resultCount === 0) {
        analytics.zeroResultSearches += 1;
      }

      // Update average results per search
      analytics.averageResultsPerSearch =
        analytics.totalHits / analytics.totalSearches;

      // Update hit rate (percentage of searches that returned results)
      analytics.hitRate =
        ((analytics.totalSearches - analytics.zeroResultSearches) /
          analytics.totalSearches) *
        100;

      // Update top results (keep track of most commonly returned events)
      if (data.eventIds.length > 0) {
        const currentTopResults = analytics.topResults || [];
        const newTopResults = [...currentTopResults, ...data.eventIds];

        // Count occurrences and keep top 10 most frequent
        const resultCounts = new Map<string, number>();
        newTopResults.forEach((id) => {
          resultCounts.set(id, (resultCounts.get(id) || 0) + 1);
        });

        analytics.topResults = Array.from(resultCounts.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([id]) => id);
      }

      // Update search categories
      if (data.categoryIds.length > 0) {
        const currentCategories = analytics.searchCategories || [];
        const newCategories = [...currentCategories, ...data.categoryIds];

        // Count occurrences and keep top 5 most frequent
        const categoryCounts = new Map<string, number>();
        newCategories.forEach((id) => {
          categoryCounts.set(id, (categoryCounts.get(id) || 0) + 1);
        });

        analytics.searchCategories = Array.from(categoryCounts.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([id]) => id);
      }

      await this.queryAnalyticsRepository.save(analytics);
    } catch (error) {
      console.error("Error tracking search analytics:", error);
      // Don't throw - analytics tracking shouldn't break the search functionality
    }
  }

  async getQueryInsights(
    options: {
      days?: number;
      limit?: number;
      minSearches?: number;
      similarityThreshold?: number;
    } = {},
  ): Promise<QueryInsights> {
    const {
      days = 30,
      limit = 10,
      minSearches = 3,
      similarityThreshold = 0.8,
    } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get overall summary statistics
    const summaryStats = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select([
        "COUNT(*) as total_queries",
        "SUM(qa.total_searches) as total_searches",
        "AVG(qa.hit_rate) as avg_hit_rate",
        "COUNT(CASE WHEN qa.hit_rate = 0 THEN 1 END) as zero_hit_queries",
        "COUNT(CASE WHEN qa.hit_rate < 50 THEN 1 END) as low_hit_queries",
      ])
      .where("qa.last_searched_at >= :cutoffDate", { cutoffDate })
      .andWhere("LENGTH(qa.query) >= 3")
      .getRawOne();

    // Get popular queries
    const popularQueries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select([
        "qa.query",
        "qa.total_searches",
        "qa.hit_rate",
        "qa.average_results_per_search",
      ])
      .where("qa.total_searches >= :minSearches", { minSearches })
      .andWhere("qa.last_searched_at >= :cutoffDate", { cutoffDate })
      .andWhere("LENGTH(qa.query) >= 3") // Exclude very short queries (likely typos)
      .orderBy("qa.total_searches", "DESC")
      .limit(limit)
      .getRawMany();

    // Get low hit rate queries
    const lowHitRateQueries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select([
        "qa.query",
        "qa.total_searches",
        "qa.hit_rate",
        "qa.last_searched_at",
      ])
      .where("qa.total_searches >= :minSearches", { minSearches })
      .andWhere("qa.hit_rate < 50") // Less than 50% hit rate
      .andWhere("qa.last_searched_at >= :cutoffDate", { cutoffDate })
      .andWhere("LENGTH(qa.query) >= 3") // Exclude very short queries
      .orderBy("qa.total_searches", "DESC")
      .limit(limit)
      .getRawMany();

    // Get zero result queries
    const zeroResultQueries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select(["qa.query", "qa.zero_result_searches", "qa.last_searched_at"])
      .where("qa.zero_result_searches > 0")
      .andWhere("qa.last_searched_at >= :cutoffDate", { cutoffDate })
      .andWhere("LENGTH(qa.query) >= 3") // Exclude very short queries
      .orderBy("qa.zero_result_searches", "DESC")
      .limit(limit)
      .getRawMany();

    // Calculate trending queries (queries with recent growth)
    const trendingQueries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select(["qa.query", "qa.total_searches", "qa.last_searched_at"])
      .where("qa.last_searched_at >= :cutoffDate", { cutoffDate })
      .andWhere("qa.total_searches >= 3") // At least 3 searches to be considered trending
      .andWhere("LENGTH(qa.query) >= 3") // Exclude very short queries
      .orderBy("qa.last_searched_at", "DESC")
      .limit(limit)
      .getRawMany();

    // Get query clusters using embeddings
    const queryClusters = await this.getQueryClusters(similarityThreshold);

    const result = {
      summary: {
        totalQueries: parseInt(summaryStats.total_queries),
        totalSearches: parseInt(summaryStats.total_searches),
        averageHitRate: parseFloat(summaryStats.avg_hit_rate),
        zeroHitQueries: parseInt(summaryStats.zero_hit_queries),
        lowHitQueries: parseInt(summaryStats.low_hit_queries),
      },
      popularQueries: popularQueries.map((q) => ({
        query: q.qa_query,
        totalSearches: parseInt(q.total_searches),
        hitRate: parseFloat(q.hit_rate),
        averageResults: parseFloat(q.average_results_per_search),
      })),
      lowHitRateQueries: lowHitRateQueries.map((q) => ({
        query: q.qa_query,
        totalSearches: parseInt(q.total_searches),
        hitRate: parseFloat(q.hit_rate),
        lastSearched: new Date(q.last_searched_at),
      })),
      trendingQueries: trendingQueries.map((q) => ({
        query: q.qa_query,
        recentSearches: parseInt(q.total_searches),
        growthRate: 0, // Could be calculated by comparing with previous period
      })),
      zeroResultQueries: zeroResultQueries.map((q) => ({
        query: q.qa_query,
        searchCount: parseInt(q.zero_result_searches),
        lastSearched: new Date(q.last_searched_at),
      })),
      queryClusters,
    };

    return result;
  }

  async getQueryClusters(
    similarityThreshold: number = 0.8,
  ): Promise<QueryCluster[]> {
    try {
      // Get all queries with sufficient search volume
      const queries = await this.queryAnalyticsRepository
        .createQueryBuilder("qa")
        .select([
          "qa.query",
          "qa.total_searches",
          "qa.hit_rate",
          "qa.total_hits",
        ])
        .where("qa.total_searches >= 3") // Only cluster queries with at least 3 searches
        .orderBy("qa.total_searches", "DESC")
        .getRawMany();

      if (queries.length === 0) {
        return [];
      }

      const clusters: QueryCluster[] = [];
      const processedQueries = new Set<string>();

      for (const query of queries) {
        if (processedQueries.has(query.qa_query)) {
          continue;
        }

        // Find similar queries using embeddings
        const similarQueries = await this.findSimilarQueries(
          query.qa_query,
          20,
          similarityThreshold,
        );

        if (similarQueries.length > 1) {
          // Create a cluster
          const cluster: QueryCluster = {
            representativeQuery: query.qa_query,
            similarQueries: similarQueries,
            totalSearches: similarQueries.reduce(
              (sum, q) => sum + q.totalSearches,
              0,
            ),
            averageHitRate:
              similarQueries.reduce((sum, q) => sum + q.hitRate, 0) /
              similarQueries.length,
            totalHits: similarQueries.reduce(
              (sum, q) => sum + (q.totalSearches * q.hitRate) / 100,
              0,
            ),
            needsAttention: similarQueries.some((q) => q.hitRate < 30),
          };

          clusters.push(cluster);

          // Mark all similar queries as processed
          similarQueries.forEach((q) => processedQueries.add(q.query));
        } else {
          // Single query (no similar queries found)
          processedQueries.add(query.qa_query);
        }
      }

      // Sort clusters by total searches
      return clusters.sort((a, b) => b.totalSearches - a.totalSearches);
    } catch (error) {
      console.error("Error generating query clusters:", error);
      return [];
    }
  }

  async findSimilarQueries(
    query: string,
    limit: number = 10,
    similarityThreshold: number = 0.8,
  ): Promise<
    Array<{
      query: string;
      similarity: number;
      totalSearches: number;
      hitRate: number;
    }>
  > {
    try {
      // Get embedding for the input query
      const queryEmbedding = await this.embeddingService.getEmbedding(query);

      // Get all queries to compare against
      const allQueries = await this.queryAnalyticsRepository
        .createQueryBuilder("qa")
        .select(["qa.query", "qa.total_searches", "qa.hit_rate"])
        .where("qa.total_searches >= 1")
        .getRawMany();

      const similarities: Array<{
        query: string;
        similarity: number;
        totalSearches: number;
        hitRate: number;
      }> = [];

      // Calculate similarities (this could be optimized with vector similarity in the database)
      for (const q of allQueries) {
        if (q.qa_query === query) {
          continue; // Skip the query itself
        }

        const qEmbedding = await this.embeddingService.getEmbedding(q.qa_query);
        const similarity = this.embeddingService.calculateSimilarity(
          queryEmbedding,
          qEmbedding,
        );

        if (similarity >= similarityThreshold) {
          similarities.push({
            query: q.qa_query,
            similarity,
            totalSearches: parseInt(q.total_searches),
            hitRate: parseFloat(q.hit_rate),
          });
        }
      }

      // Sort by similarity and limit results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error("Error finding similar queries:", error);
      return [];
    }
  }

  async getPopularQueries(limit: number = 10): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      averageResults: number;
    }>
  > {
    const queries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select([
        "qa.query",
        "qa.total_searches",
        "qa.hit_rate",
        "qa.average_results_per_search",
      ])
      .where("qa.total_searches >= 5")
      .orderBy("qa.total_searches", "DESC")
      .limit(limit)
      .getRawMany();

    return queries.map((q) => ({
      query: q.qa_query,
      totalSearches: parseInt(q.total_searches),
      hitRate: parseFloat(q.hit_rate),
      averageResults: parseFloat(q.average_results_per_search),
    }));
  }

  async getLowHitRateQueries(limit: number = 10): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      lastSearched: Date;
    }>
  > {
    const queries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select([
        "qa.query",
        "qa.total_searches",
        "qa.hit_rate",
        "qa.last_searched_at",
      ])
      .where("qa.total_searches >= 3")
      .andWhere("qa.hit_rate < 50")
      .orderBy("qa.total_searches", "DESC")
      .limit(limit)
      .getRawMany();

    return queries.map((q) => ({
      query: q.qa_query,
      totalSearches: parseInt(q.total_searches),
      hitRate: parseFloat(q.hit_rate),
      lastSearched: new Date(q.last_searched_at),
    }));
  }

  async getZeroResultQueries(limit: number = 10): Promise<
    Array<{
      query: string;
      searchCount: number;
      lastSearched: Date;
    }>
  > {
    const queries = await this.queryAnalyticsRepository
      .createQueryBuilder("qa")
      .select(["qa.query", "qa.zero_result_searches", "qa.last_searched_at"])
      .where("qa.zero_result_searches > 0")
      .orderBy("qa.zero_result_searches", "DESC")
      .limit(limit)
      .getRawMany();

    return queries.map((q) => ({
      query: q.qa_query,
      searchCount: parseInt(q.zero_result_searches),
      lastSearched: new Date(q.last_searched_at),
    }));
  }

  async getQueryStats(query: string): Promise<{
    totalSearches: number;
    totalHits: number;
    hitRate: number;
    averageResults: number;
    firstSearched: Date | null;
    lastSearched: Date | null;
    topResults: string[];
    searchCategories: string[];
  } | null> {
    const analytics = await this.queryAnalyticsRepository.findOne({
      where: { normalizedQuery: this.normalizeQuery(query) },
    });

    if (!analytics) {
      return null;
    }

    return {
      totalSearches: analytics.totalSearches,
      totalHits: analytics.totalHits,
      hitRate: analytics.hitRate,
      averageResults: analytics.averageResultsPerSearch,
      firstSearched: analytics.firstSearchedAt,
      lastSearched: analytics.lastSearchedAt,
      topResults: analytics.topResults || [],
      searchCategories: analytics.searchCategories || [],
    };
  }

  async updateQueryFlags(): Promise<{
    popularQueriesUpdated: number;
    attentionQueriesUpdated: number;
  }> {
    // Update popular queries flag (searched more than 10 times in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const popularQueriesResult = await this.queryAnalyticsRepository
      .createQueryBuilder()
      .update(QueryAnalytics)
      .set({ isPopular: true })
      .where("totalSearches >= 10")
      .andWhere("lastSearchedAt >= :thirtyDaysAgo", { thirtyDaysAgo })
      .execute();

    // Update needs attention flag (low hit rate and searched recently)
    const attentionQueriesResult = await this.queryAnalyticsRepository
      .createQueryBuilder()
      .update(QueryAnalytics)
      .set({ needsAttention: true })
      .where("hitRate < 30")
      .andWhere("totalSearches >= 3")
      .andWhere("lastSearchedAt >= :thirtyDaysAgo", { thirtyDaysAgo })
      .execute();

    return {
      popularQueriesUpdated: popularQueriesResult.affected || 0,
      attentionQueriesUpdated: attentionQueriesResult.affected || 0,
    };
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/[^\w\s]/g, ""); // Remove special characters except spaces
  }
}

/**
 * Factory function to create a QueryAnalyticsService instance
 */
export function createQueryAnalyticsService(
  dependencies: QueryAnalyticsServiceDependencies,
): QueryAnalyticsService {
  return new QueryAnalyticsServiceImpl(dependencies);
}
