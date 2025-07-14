import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import type { DataSource, Repository } from "typeorm";
import { QueryAnalytics } from "@realtime-markers/database";
import { QueryAnalytics";
import { Event } from "@realtime-markers/database";
import { Event";
import { Category } from "@realtime-markers/database";
import { Category";
import {
  QueryAnalyticsServiceImpl,
  createQueryAnalyticsService,
  type QueryAnalyticsService,
  type QueryAnalyticsServiceDependencies,
  type QueryAnalyticsData,
} from "../QueryAnalyticsService";
import type { IEmbeddingService } from "../event-processing/interfaces/IEmbeddingService";

// Mock embedding service for testing
const createMockEmbeddingService = (): IEmbeddingService => ({
  getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  getEmbeddingSql: jest.fn().mockResolvedValue("[0.1,0.2,0.3,0.4,0.5]"),
  getStructuredEmbedding: jest
    .fn()
    .mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  getStructuredEmbeddingSql: jest
    .fn()
    .mockResolvedValue("[0.1,0.2,0.3,0.4,0.5]"),
  parseSqlEmbedding: jest.fn().mockReturnValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  calculateSimilarity: jest.fn().mockImplementation((a, b) => {
    // Mock similarity calculation based on query content
    if (a.length === 0 || b.length === 0) return 0;

    // For testing, return high similarity for queries with similar words
    const queryA = a.join("").toLowerCase();
    const queryB = b.join("").toLowerCase();

    if (queryA.includes("coffee") && queryB.includes("coffee")) return 0.85;
    if (queryA.includes("music") && queryB.includes("music")) return 0.82;
    if (queryA.includes("food") && queryB.includes("food")) return 0.88;
    if (queryA === queryB) return 1.0;

    return 0.3; // Default low similarity
  }),
  clearCache: jest.fn(),
});

// Helper function to create a proper mock query builder
const createMockQueryBuilder = (
  mockData: Record<string, unknown>[] = [],
  mockCount?: Record<string, unknown>,
) => {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    getRawMany: jest.fn().mockResolvedValue(mockData),
    getRawOne: jest.fn().mockResolvedValue(mockCount),
  };
};

describe("QueryAnalyticsService", () => {
  let queryAnalyticsService: QueryAnalyticsService;
  let mockDataSource: DataSource;
  let mockQueryAnalyticsRepository: Repository<QueryAnalytics>;
  let mockEventRepository: Repository<Event>;
  let mockCategoryRepository: Repository<Category>;
  let mockEmbeddingService: IEmbeddingService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock repositories
    mockQueryAnalyticsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<QueryAnalytics>;

    mockEventRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<Event>;

    mockCategoryRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<Category>;

    // Create mock data source
    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === QueryAnalytics) return mockQueryAnalyticsRepository;
        if (entity === Event) return mockEventRepository;
        if (entity === Category) return mockCategoryRepository;
        return null;
      }),
    } as unknown as DataSource;

    mockEmbeddingService = createMockEmbeddingService();

    const dependencies: QueryAnalyticsServiceDependencies = {
      dataSource: mockDataSource,
      embeddingService: mockEmbeddingService,
    };

    queryAnalyticsService = createQueryAnalyticsService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("trackSearch", () => {
    it("should create new analytics record for first search", async () => {
      const searchData: QueryAnalyticsData = {
        query: "test event",
        resultCount: 5,
        eventIds: ["event1", "event2"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      };

      // Mock repository responses
      (mockQueryAnalyticsRepository.findOne as jest.Mock).mockResolvedValue(
        null,
      );
      (mockQueryAnalyticsRepository.create as jest.Mock).mockReturnValue({
        query: searchData.query,
        normalizedQuery: "test event",
        totalSearches: 0,
        totalHits: 0,
        zeroResultSearches: 0,
        averageResultsPerSearch: 0,
        hitRate: 0,
        firstSearchedAt: searchData.timestamp,
        lastSearchedAt: searchData.timestamp,
        topResults: [],
        searchCategories: [],
      });
      (mockQueryAnalyticsRepository.save as jest.Mock).mockResolvedValue({
        query: searchData.query,
        totalSearches: 1,
        totalHits: 5,
        hitRate: 100,
        averageResultsPerSearch: 5,
      });

      await queryAnalyticsService.trackSearch(searchData);

      expect(mockQueryAnalyticsRepository.findOne).toHaveBeenCalledWith({
        where: { normalizedQuery: "test event" },
      });
      expect(mockQueryAnalyticsRepository.create).toHaveBeenCalled();
      expect(mockQueryAnalyticsRepository.save).toHaveBeenCalled();
    });

    it("should update existing analytics record for subsequent searches", async () => {
      const searchData1: QueryAnalyticsData = {
        query: "test event",
        resultCount: 5,
        eventIds: ["event1", "event2"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      };

      const searchData2: QueryAnalyticsData = {
        query: "test event",
        resultCount: 0,
        eventIds: [],
        categoryIds: [],
        timestamp: new Date(),
      };

      const existingAnalytics = {
        query: "test event",
        normalizedQuery: "test event",
        totalSearches: 1,
        totalHits: 5,
        zeroResultSearches: 0,
        averageResultsPerSearch: 5,
        hitRate: 100,
        firstSearchedAt: searchData1.timestamp,
        lastSearchedAt: searchData1.timestamp,
        topResults: ["event1", "event2"],
        searchCategories: ["cat1"],
      };

      // Mock repository responses
      (mockQueryAnalyticsRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(existingAnalytics)
        .mockResolvedValueOnce({
          ...existingAnalytics,
          totalSearches: 2,
          totalHits: 5,
          hitRate: 50,
          averageResultsPerSearch: 2.5,
        });
      (mockQueryAnalyticsRepository.save as jest.Mock).mockResolvedValue({});

      await queryAnalyticsService.trackSearch(searchData1);
      await queryAnalyticsService.trackSearch(searchData2);

      expect(mockQueryAnalyticsRepository.save).toHaveBeenCalledTimes(2);
    });

    it("should normalize queries correctly", async () => {
      const searchData1: QueryAnalyticsData = {
        query: "Test Event",
        resultCount: 5,
        eventIds: ["event1"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      };

      const searchData2: QueryAnalyticsData = {
        query: "test event",
        resultCount: 3,
        eventIds: ["event2"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      };

      // Mock repository responses
      (mockQueryAnalyticsRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          query: "Test Event",
          normalizedQuery: "test event",
          totalSearches: 1,
          totalHits: 5,
        });
      (mockQueryAnalyticsRepository.create as jest.Mock).mockReturnValue({});
      (mockQueryAnalyticsRepository.save as jest.Mock).mockResolvedValue({});

      await queryAnalyticsService.trackSearch(searchData1);
      await queryAnalyticsService.trackSearch(searchData2);

      // Both should look for the same normalized query
      expect(mockQueryAnalyticsRepository.findOne).toHaveBeenCalledWith({
        where: { normalizedQuery: "test event" },
      });
    });
  });

  describe("getQueryInsights", () => {
    it("should return popular queries", async () => {
      const mockQueries = [
        {
          qa_query: "popular query",
          total_searches: "20",
          hit_rate: "80",
          average_results_per_search: "5",
        },
        {
          qa_query: "low hit query",
          total_searches: "10",
          hit_rate: "20",
          average_results_per_search: "2",
        },
      ];

      const mockSummary = {
        total_queries: "2",
        total_searches: "30",
        avg_hit_rate: "50",
        zero_hit_queries: "0",
        low_hit_queries: "1",
      };

      // Mock the query builder for summary stats
      const mockSummaryBuilder = createMockQueryBuilder([], mockSummary);

      // Mock the query builder for popular queries
      const mockPopularBuilder = createMockQueryBuilder(mockQueries);

      // Mock the query builder for low hit rate queries
      const mockLowHitBuilder = createMockQueryBuilder([]);

      // Mock the query builder for zero result queries
      const mockZeroResultBuilder = createMockQueryBuilder([]);

      // Mock the query builder for trending queries
      const mockTrendingBuilder = createMockQueryBuilder([]);

      (mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(mockSummaryBuilder) // Summary stats
        .mockReturnValueOnce(mockPopularBuilder) // Popular queries
        .mockReturnValueOnce(mockLowHitBuilder) // Low hit rate queries
        .mockReturnValueOnce(mockZeroResultBuilder) // Zero result queries
        .mockReturnValueOnce(mockTrendingBuilder); // Trending queries

      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 5,
      });

      expect(insights.popularQueries).toHaveLength(2);
      expect(insights.popularQueries[0].query).toBe("popular query");
      expect(insights.popularQueries[0].totalSearches).toBe(20);
    });

    it("should return low hit rate queries", async () => {
      const mockQueries = [
        {
          qa_query: "low hit query",
          total_searches: "10",
          hit_rate: "20",
          last_searched_at: "2023-01-01",
        },
      ];

      const mockSummary = {
        total_queries: "1",
        total_searches: "10",
        avg_hit_rate: "20",
        zero_hit_queries: "0",
        low_hit_queries: "1",
      };

      // Mock the query builders
      const mockSummaryBuilder = createMockQueryBuilder([], mockSummary);
      const mockPopularBuilder = createMockQueryBuilder([]);
      const mockLowHitBuilder = createMockQueryBuilder(mockQueries);
      const mockZeroResultBuilder = createMockQueryBuilder([]);
      const mockTrendingBuilder = createMockQueryBuilder([]);

      (mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(mockSummaryBuilder)
        .mockReturnValueOnce(mockPopularBuilder)
        .mockReturnValueOnce(mockLowHitBuilder)
        .mockReturnValueOnce(mockZeroResultBuilder)
        .mockReturnValueOnce(mockTrendingBuilder);

      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 5,
      });

      expect(insights.lowHitRateQueries).toHaveLength(1);
      expect(insights.lowHitRateQueries[0].query).toBe("low hit query");
      expect(insights.lowHitRateQueries[0].hitRate).toBe(20);
    });

    it("should return zero result queries", async () => {
      const mockQueries = [
        {
          qa_query: "zero result query",
          zero_result_searches: "5",
          last_searched_at: "2023-01-01",
        },
      ];

      const mockSummary = {
        total_queries: "1",
        total_searches: "5",
        avg_hit_rate: "0",
        zero_hit_queries: "1",
        low_hit_queries: "1",
      };

      // Mock the query builders
      const mockSummaryBuilder = createMockQueryBuilder([], mockSummary);
      const mockPopularBuilder = createMockQueryBuilder([]);
      const mockLowHitBuilder = createMockQueryBuilder([]);
      const mockZeroResultBuilder = createMockQueryBuilder(mockQueries);
      const mockTrendingBuilder = createMockQueryBuilder([]);

      (mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(mockSummaryBuilder)
        .mockReturnValueOnce(mockPopularBuilder)
        .mockReturnValueOnce(mockLowHitBuilder)
        .mockReturnValueOnce(mockZeroResultBuilder)
        .mockReturnValueOnce(mockTrendingBuilder);

      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 1,
      });

      expect(insights.zeroResultQueries).toHaveLength(1);
      expect(insights.zeroResultQueries[0].query).toBe("zero result query");
      expect(insights.zeroResultQueries[0].searchCount).toBe(5);
    });
  });

  describe("getQueryClusters", () => {
    it("should return query clusters with similar queries", async () => {
      const mockQueries = [
        {
          qa_query: "coffee shop",
          total_searches: "10",
          hit_rate: "80",
          total_hits: "8",
        },
        {
          qa_query: "cafe",
          total_searches: "8",
          hit_rate: "75",
          total_hits: "6",
        },
        {
          qa_query: "coffee house",
          total_searches: "5",
          hit_rate: "70",
          total_hits: "3",
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const clusters = await queryAnalyticsService.getQueryClusters(0.8);

      expect(clusters).toBeDefined();
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBeGreaterThan(0);

      // Check that clusters have the expected structure
      const firstCluster = clusters[0];
      expect(firstCluster).toHaveProperty("representativeQuery");
      expect(firstCluster).toHaveProperty("similarQueries");
      expect(firstCluster).toHaveProperty("totalSearches");
      expect(firstCluster).toHaveProperty("averageHitRate");
      expect(firstCluster).toHaveProperty("totalHits");
      expect(firstCluster).toHaveProperty("needsAttention");
    });
  });

  describe("findSimilarQueries", () => {
    it("should find similar queries", async () => {
      const mockQueries = [
        { qa_query: "coffee shop", total_searches: "10", hit_rate: "80" },
        { qa_query: "cafe", total_searches: "8", hit_rate: "75" },
        { qa_query: "coffee house", total_searches: "5", hit_rate: "70" },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const similarQueries = await queryAnalyticsService.findSimilarQueries(
        "coffee shop",
        5,
        0.8,
      );

      expect(similarQueries).toBeDefined();
      expect(Array.isArray(similarQueries)).toBe(true);
      expect(similarQueries.length).toBeGreaterThan(0);

      // Check structure of returned queries
      const firstSimilar = similarQueries[0];
      expect(firstSimilar).toHaveProperty("query");
      expect(firstSimilar).toHaveProperty("similarity");
      expect(firstSimilar).toHaveProperty("totalSearches");
      expect(firstSimilar).toHaveProperty("hitRate");
    });

    it("should respect limit parameter", async () => {
      const mockQueries = [
        { qa_query: "cafe", total_searches: "8", hit_rate: "75" },
        { qa_query: "coffee house", total_searches: "5", hit_rate: "70" },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const limitedResults = await queryAnalyticsService.findSimilarQueries(
        "coffee shop",
        2,
        0.8,
      );

      expect(limitedResults.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getPopularQueries", () => {
    it("should return popular queries ordered by total searches", async () => {
      const mockQueries = [
        {
          qa_query: "query1",
          total_searches: "15",
          hit_rate: "80",
          average_results_per_search: "5",
        },
        {
          qa_query: "query2",
          total_searches: "10",
          hit_rate: "70",
          average_results_per_search: "3",
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const popularQueries = await queryAnalyticsService.getPopularQueries(10);

      expect(popularQueries).toHaveLength(2);
      expect(popularQueries[0].query).toBe("query1");
      expect(popularQueries[0].totalSearches).toBe(15);
      expect(popularQueries[1].query).toBe("query2");
      expect(popularQueries[1].totalSearches).toBe(10);
    });

    it("should respect limit parameter", async () => {
      const mockQueries = [
        {
          qa_query: "query1",
          total_searches: "15",
          hit_rate: "80",
          average_results_per_search: "5",
        },
        {
          qa_query: "query2",
          total_searches: "10",
          hit_rate: "70",
          average_results_per_search: "3",
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const popularQueries = await queryAnalyticsService.getPopularQueries(2);

      expect(popularQueries).toHaveLength(2);
      expect(popularQueries[0].query).toBe("query1");
      expect(popularQueries[1].query).toBe("query2");
    });
  });

  describe("getLowHitRateQueries", () => {
    it("should return queries with low hit rates", async () => {
      const mockQueries = [
        {
          qa_query: "bad query",
          total_searches: "10",
          hit_rate: "20",
          last_searched_at: "2023-01-01",
        },
        {
          qa_query: "ok query",
          total_searches: "10",
          hit_rate: "50",
          last_searched_at: "2023-01-01",
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const lowHitQueries =
        await queryAnalyticsService.getLowHitRateQueries(10);

      expect(lowHitQueries).toHaveLength(2);
      expect(lowHitQueries[0].query).toBe("bad query");
      expect(lowHitQueries[0].hitRate).toBe(20);
      expect(lowHitQueries[1].query).toBe("ok query");
      expect(lowHitQueries[1].hitRate).toBe(50);
    });
  });

  describe("getZeroResultQueries", () => {
    it("should return queries with zero results", async () => {
      const mockQueries = [
        {
          qa_query: "no results",
          zero_result_searches: "5",
          last_searched_at: "2023-01-01",
        },
        {
          qa_query: "more no results",
          zero_result_searches: "3",
          last_searched_at: "2023-01-01",
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const zeroResultQueries =
        await queryAnalyticsService.getZeroResultQueries(10);

      expect(zeroResultQueries).toHaveLength(2);
      expect(zeroResultQueries[0].query).toBe("no results");
      expect(zeroResultQueries[0].searchCount).toBe(5);
      expect(zeroResultQueries[1].query).toBe("more no results");
      expect(zeroResultQueries[1].searchCount).toBe(3);
    });
  });

  describe("getQueryStats", () => {
    it("should return null for non-existent query", async () => {
      (mockQueryAnalyticsRepository.findOne as jest.Mock).mockResolvedValue(
        null,
      );

      const stats = await queryAnalyticsService.getQueryStats("non-existent");
      expect(stats).toBeNull();
    });

    it("should return correct stats for existing query", async () => {
      const mockAnalytics = {
        query: "test query",
        totalSearches: 1,
        totalHits: 5,
        hitRate: 100,
        averageResultsPerSearch: 5,
        firstSearchedAt: new Date(),
        lastSearchedAt: new Date(),
        topResults: ["event1", "event2"],
        searchCategories: ["cat1", "cat2"],
      };

      (mockQueryAnalyticsRepository.findOne as jest.Mock).mockResolvedValue(
        mockAnalytics,
      );

      const stats = await queryAnalyticsService.getQueryStats("test query");
      expect(stats).not.toBeNull();
      expect(stats?.totalSearches).toBe(1);
      expect(stats?.totalHits).toBe(5);
      expect(stats?.hitRate).toBe(100);
      expect(stats?.averageResults).toBe(5);
      expect(stats?.topResults).toContain("event1");
      expect(stats?.topResults).toContain("event2");
      expect(stats?.searchCategories).toContain("cat1");
      expect(stats?.searchCategories).toContain("cat2");
    });
  });

  describe("updateQueryFlags", () => {
    it("should update popular and attention flags", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const result = await queryAnalyticsService.updateQueryFlags();
      expect(result.popularQueriesUpdated).toBe(1);
      expect(result.attentionQueriesUpdated).toBe(1);
    });
  });

  describe("embedding service integration", () => {
    it("should use embedding service for similarity calculations", async () => {
      const mockQueries = [
        { qa_query: "coffee shop", total_searches: "10", hit_rate: "80" },
        { qa_query: "cafe", total_searches: "8", hit_rate: "75" },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const similarQueries = await queryAnalyticsService.findSimilarQueries(
        "coffee shop",
        5,
        0.8,
      );

      // Verify that embedding service methods were called
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalled();
      expect(mockEmbeddingService.calculateSimilarity).toHaveBeenCalled();
      expect(similarQueries).toBeDefined();
    });

    it("should handle embedding service errors gracefully", async () => {
      // Mock embedding service to throw an error
      (mockEmbeddingService.getEmbedding as jest.Mock).mockRejectedValue(
        new Error("Embedding service error"),
      );

      const mockQueries = [
        { qa_query: "test query", total_searches: "5", hit_rate: "80" },
      ];

      const mockQueryBuilder = createMockQueryBuilder(mockQueries);
      (
        mockQueryAnalyticsRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      // Should not throw error, should return empty results
      const similarQueries = await queryAnalyticsService.findSimilarQueries(
        "test query",
        5,
        0.8,
      );

      // Explicitly use the variable to satisfy linter
      expect(similarQueries).toBeDefined();
      expect(similarQueries).toEqual([]);
    });
  });
});

describe("createQueryAnalyticsService", () => {
  it("should create a QueryAnalyticsService instance", () => {
    const mockDataSource = {
      getRepository: jest.fn(),
    } as unknown as DataSource;
    const mockEmbeddingService = createMockEmbeddingService();

    const dependencies: QueryAnalyticsServiceDependencies = {
      dataSource: mockDataSource,
      embeddingService: mockEmbeddingService,
    };

    const service = createQueryAnalyticsService(dependencies);
    expect(service).toBeInstanceOf(QueryAnalyticsServiceImpl);
  });
});
