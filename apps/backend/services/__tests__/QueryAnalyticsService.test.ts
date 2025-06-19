import { DataSource } from "typeorm";
import { QueryAnalytics } from "../../entities/QueryAnalytics";
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

describe("QueryAnalyticsService", () => {
  let queryAnalyticsService: QueryAnalyticsService;
  let dataSource: DataSource;
  let mockEmbeddingService: IEmbeddingService;

  beforeEach(async () => {
    // Create in-memory database for testing
    dataSource = new DataSource({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "test",
      password: "test",
      database: "test",
      entities: [QueryAnalytics],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    mockEmbeddingService = createMockEmbeddingService();

    const dependencies: QueryAnalyticsServiceDependencies = {
      dataSource,
      embeddingService: mockEmbeddingService,
    };

    queryAnalyticsService = createQueryAnalyticsService(dependencies);
  });

  afterEach(async () => {
    await dataSource.destroy();
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

      await queryAnalyticsService.trackSearch(searchData);

      const stats = await queryAnalyticsService.getQueryStats("test event");
      expect(stats).not.toBeNull();
      expect(stats?.totalSearches).toBe(1);
      expect(stats?.totalHits).toBe(5);
      expect(stats?.hitRate).toBe(100);
      expect(stats?.averageResults).toBe(5);
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

      await queryAnalyticsService.trackSearch(searchData1);
      await queryAnalyticsService.trackSearch(searchData2);

      const stats = await queryAnalyticsService.getQueryStats("test event");
      expect(stats).not.toBeNull();
      expect(stats?.totalSearches).toBe(2);
      expect(stats?.totalHits).toBe(5);
      expect(stats?.hitRate).toBe(50); // 1 out of 2 searches returned results
      expect(stats?.averageResults).toBe(2.5);
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

      await queryAnalyticsService.trackSearch(searchData1);
      await queryAnalyticsService.trackSearch(searchData2);

      // Both should update the same record due to normalization
      const stats = await queryAnalyticsService.getQueryStats("Test Event");
      expect(stats).not.toBeNull();
      expect(stats?.totalSearches).toBe(2);
      expect(stats?.totalHits).toBe(8);
    });
  });

  describe("getQueryInsights", () => {
    beforeEach(async () => {
      // Create some test data
      const searches = [
        { query: "popular query", resultCount: 10, searches: 20 },
        { query: "low hit query", resultCount: 2, searches: 10 },
        { query: "zero result query", resultCount: 0, searches: 5 },
        { query: "recent query", resultCount: 5, searches: 3 },
      ];

      for (const search of searches) {
        for (let i = 0; i < search.searches; i++) {
          await queryAnalyticsService.trackSearch({
            query: search.query,
            resultCount: search.resultCount,
            eventIds: search.resultCount > 0 ? ["event1"] : [],
            categoryIds: ["cat1"],
            timestamp: new Date(),
          });
        }
      }
    });

    it("should return popular queries", async () => {
      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 5,
      });

      expect(insights.popularQueries).toHaveLength(2); // popular query and low hit query
      expect(insights.popularQueries[0].query).toBe("popular query");
      expect(insights.popularQueries[0].totalSearches).toBe(20);
    });

    it("should return low hit rate queries", async () => {
      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 5,
      });

      expect(insights.lowHitRateQueries).toHaveLength(1);
      expect(insights.lowHitRateQueries[0].query).toBe("low hit query");
      expect(insights.lowHitRateQueries[0].hitRate).toBe(20); // 2/10 = 20%
    });

    it("should return zero result queries", async () => {
      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 1,
      });

      expect(insights.zeroResultQueries).toHaveLength(1);
      expect(insights.zeroResultQueries[0].query).toBe("zero result query");
      expect(insights.zeroResultQueries[0].searchCount).toBe(5);
    });

    it("should return query clusters", async () => {
      const insights = await queryAnalyticsService.getQueryInsights({
        days: 30,
        limit: 10,
        minSearches: 1,
        similarityThreshold: 0.8,
      });

      expect(insights.queryClusters).toBeDefined();
      expect(Array.isArray(insights.queryClusters)).toBe(true);
    });
  });

  describe("getQueryClusters", () => {
    beforeEach(async () => {
      // Create test data with similar queries
      const searches = [
        { query: "coffee shop", resultCount: 5, searches: 10 },
        { query: "cafe", resultCount: 3, searches: 8 },
        { query: "coffee house", resultCount: 2, searches: 5 },
        { query: "music festival", resultCount: 8, searches: 15 },
        { query: "concert event", resultCount: 6, searches: 12 },
        { query: "food truck", resultCount: 1, searches: 3 },
      ];

      for (const search of searches) {
        for (let i = 0; i < search.searches; i++) {
          await queryAnalyticsService.trackSearch({
            query: search.query,
            resultCount: search.resultCount,
            eventIds: search.resultCount > 0 ? ["event1"] : [],
            categoryIds: ["cat1"],
            timestamp: new Date(),
          });
        }
      }
    });

    it("should return query clusters with similar queries", async () => {
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

    it("should group similar queries together", async () => {
      const clusters = await queryAnalyticsService.getQueryClusters(0.8);

      // Find coffee-related cluster
      const coffeeCluster = clusters.find(
        (c) =>
          c.representativeQuery.includes("coffee") ||
          c.similarQueries.some((q) => q.query.includes("coffee")),
      );

      expect(coffeeCluster).toBeDefined();
      expect(coffeeCluster?.similarQueries.length).toBeGreaterThan(1);
    });

    it("should respect similarity threshold", async () => {
      const highThresholdClusters =
        await queryAnalyticsService.getQueryClusters(0.9);
      const lowThresholdClusters =
        await queryAnalyticsService.getQueryClusters(0.7);

      // Higher threshold should result in fewer or same number of clusters
      expect(highThresholdClusters.length).toBeLessThanOrEqual(
        lowThresholdClusters.length,
      );
    });

    it("should calculate cluster metrics correctly", async () => {
      const clusters = await queryAnalyticsService.getQueryClusters(0.8);

      for (const cluster of clusters) {
        expect(cluster.totalSearches).toBeGreaterThan(0);
        expect(cluster.averageHitRate).toBeGreaterThanOrEqual(0);
        expect(cluster.averageHitRate).toBeLessThanOrEqual(100);
        expect(cluster.totalHits).toBeGreaterThanOrEqual(0);
        expect(typeof cluster.needsAttention).toBe("boolean");
      }
    });
  });

  describe("findSimilarQueries", () => {
    beforeEach(async () => {
      // Create test data
      const searches = [
        { query: "coffee shop", resultCount: 5, searches: 10 },
        { query: "cafe", resultCount: 3, searches: 8 },
        { query: "coffee house", resultCount: 2, searches: 5 },
        { query: "music festival", resultCount: 8, searches: 15 },
        { query: "concert event", resultCount: 6, searches: 12 },
      ];

      for (const search of searches) {
        for (let i = 0; i < search.searches; i++) {
          await queryAnalyticsService.trackSearch({
            query: search.query,
            resultCount: search.resultCount,
            eventIds: search.resultCount > 0 ? ["event1"] : [],
            categoryIds: ["cat1"],
            timestamp: new Date(),
          });
        }
      }
    });

    it("should find similar queries", async () => {
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

    it("should respect similarity threshold", async () => {
      const highThresholdResults =
        await queryAnalyticsService.findSimilarQueries("coffee shop", 10, 0.9);
      const lowThresholdResults =
        await queryAnalyticsService.findSimilarQueries("coffee shop", 10, 0.7);

      // Higher threshold should result in fewer or same number of results
      expect(highThresholdResults.length).toBeLessThanOrEqual(
        lowThresholdResults.length,
      );
    });

    it("should respect limit parameter", async () => {
      const limitedResults = await queryAnalyticsService.findSimilarQueries(
        "coffee shop",
        2,
        0.8,
      );

      expect(limitedResults.length).toBeLessThanOrEqual(2);
    });

    it("should return queries sorted by similarity", async () => {
      const similarQueries = await queryAnalyticsService.findSimilarQueries(
        "coffee shop",
        5,
        0.8,
      );

      // Check that results are sorted by similarity (descending)
      for (let i = 1; i < similarQueries.length; i++) {
        expect(similarQueries[i - 1].similarity).toBeGreaterThanOrEqual(
          similarQueries[i].similarity,
        );
      }
    });

    it("should not return the query itself", async () => {
      const similarQueries = await queryAnalyticsService.findSimilarQueries(
        "coffee shop",
        10,
        0.8,
      );

      const selfQuery = similarQueries.find((q) => q.query === "coffee shop");
      expect(selfQuery).toBeUndefined();
    });
  });

  describe("getPopularQueries", () => {
    beforeEach(async () => {
      const searches = [
        { query: "query1", searches: 15 },
        { query: "query2", searches: 10 },
        { query: "query3", searches: 5 },
        { query: "query4", searches: 3 },
      ];

      for (const search of searches) {
        for (let i = 0; i < search.searches; i++) {
          await queryAnalyticsService.trackSearch({
            query: search.query,
            resultCount: 5,
            eventIds: ["event1"],
            categoryIds: ["cat1"],
            timestamp: new Date(),
          });
        }
      }
    });

    it("should return popular queries ordered by total searches", async () => {
      const popularQueries = await queryAnalyticsService.getPopularQueries(10);

      expect(popularQueries).toHaveLength(3); // Only queries with >= 5 searches
      expect(popularQueries[0].query).toBe("query1");
      expect(popularQueries[0].totalSearches).toBe(15);
      expect(popularQueries[1].query).toBe("query2");
      expect(popularQueries[1].totalSearches).toBe(10);
    });

    it("should respect limit parameter", async () => {
      const popularQueries = await queryAnalyticsService.getPopularQueries(2);

      expect(popularQueries).toHaveLength(2);
      expect(popularQueries[0].query).toBe("query1");
      expect(popularQueries[1].query).toBe("query2");
    });
  });

  describe("getLowHitRateQueries", () => {
    beforeEach(async () => {
      const searches = [
        { query: "good query", resultCount: 8, searches: 10 }, // 80% hit rate
        { query: "bad query", resultCount: 2, searches: 10 }, // 20% hit rate
        { query: "ok query", resultCount: 5, searches: 10 }, // 50% hit rate
      ];

      for (const search of searches) {
        for (let i = 0; i < search.searches; i++) {
          await queryAnalyticsService.trackSearch({
            query: search.query,
            resultCount: search.resultCount,
            eventIds: search.resultCount > 0 ? ["event1"] : [],
            categoryIds: ["cat1"],
            timestamp: new Date(),
          });
        }
      }
    });

    it("should return queries with low hit rates", async () => {
      const lowHitQueries =
        await queryAnalyticsService.getLowHitRateQueries(10);

      expect(lowHitQueries).toHaveLength(2); // bad query and ok query (both < 50%)
      expect(lowHitQueries[0].query).toBe("bad query");
      expect(lowHitQueries[0].hitRate).toBe(20);
      expect(lowHitQueries[1].query).toBe("ok query");
      expect(lowHitQueries[1].hitRate).toBe(50);
    });
  });

  describe("getZeroResultQueries", () => {
    beforeEach(async () => {
      const searches = [
        { query: "no results", resultCount: 0, searches: 5 },
        { query: "some results", resultCount: 3, searches: 5 },
        { query: "more no results", resultCount: 0, searches: 3 },
      ];

      for (const search of searches) {
        for (let i = 0; i < search.searches; i++) {
          await queryAnalyticsService.trackSearch({
            query: search.query,
            resultCount: search.resultCount,
            eventIds: search.resultCount > 0 ? ["event1"] : [],
            categoryIds: ["cat1"],
            timestamp: new Date(),
          });
        }
      }
    });

    it("should return queries with zero results", async () => {
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
      const stats = await queryAnalyticsService.getQueryStats("non-existent");
      expect(stats).toBeNull();
    });

    it("should return correct stats for existing query", async () => {
      await queryAnalyticsService.trackSearch({
        query: "test query",
        resultCount: 5,
        eventIds: ["event1", "event2"],
        categoryIds: ["cat1", "cat2"],
        timestamp: new Date(),
      });

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
      // Create a query with many searches (should be marked as popular)
      for (let i = 0; i < 15; i++) {
        await queryAnalyticsService.trackSearch({
          query: "popular query",
          resultCount: 5,
          eventIds: ["event1"],
          categoryIds: ["cat1"],
          timestamp: new Date(),
        });
      }

      // Create a query with low hit rate (should be marked as needs attention)
      for (let i = 0; i < 5; i++) {
        await queryAnalyticsService.trackSearch({
          query: "low hit query",
          resultCount: 0,
          eventIds: [],
          categoryIds: ["cat1"],
          timestamp: new Date(),
        });
      }

      const result = await queryAnalyticsService.updateQueryFlags();
      expect(result.popularQueriesUpdated).toBe(1);
      expect(result.attentionQueriesUpdated).toBe(1);
    });
  });

  describe("embedding service integration", () => {
    it("should use embedding service for similarity calculations", async () => {
      await queryAnalyticsService.trackSearch({
        query: "coffee shop",
        resultCount: 5,
        eventIds: ["event1"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      });

      await queryAnalyticsService.trackSearch({
        query: "cafe",
        resultCount: 3,
        eventIds: ["event2"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      });

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

      await queryAnalyticsService.trackSearch({
        query: "test query",
        resultCount: 5,
        eventIds: ["event1"],
        categoryIds: ["cat1"],
        timestamp: new Date(),
      });

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
    const mockDataSource = {} as DataSource;
    const mockEmbeddingService = createMockEmbeddingService();

    const dependencies: QueryAnalyticsServiceDependencies = {
      dataSource: mockDataSource,
      embeddingService: mockEmbeddingService,
    };

    const service = createQueryAnalyticsService(dependencies);
    expect(service).toBeInstanceOf(QueryAnalyticsServiceImpl);
  });
});
