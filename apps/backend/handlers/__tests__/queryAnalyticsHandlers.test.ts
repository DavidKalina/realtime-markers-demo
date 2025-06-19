import { describe, it, expect, beforeEach, jest } from "bun:test";
import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import type { EventService } from "../../services/EventServiceRefactored";
import {
  getQueryInsightsHandler,
  getPopularQueriesHandler,
  getLowHitRateQueriesHandler,
  getZeroResultQueriesHandler,
  getQueryStatsHandler,
  updateQueryFlagsHandler,
  getQueryClustersHandler,
  findSimilarQueriesHandler,
} from "../queryAnalyticsHandlers";

describe("Query Analytics Handlers", () => {
  let mockContext: Context<AppContext>;
  let mockEventService: Partial<EventService>;

  beforeEach(() => {
    mockEventService = {
      getQueryInsights: jest.fn() as jest.Mock,
      getPopularQueries: jest.fn() as jest.Mock,
      getLowHitRateQueries: jest.fn() as jest.Mock,
      getZeroResultQueries: jest.fn() as jest.Mock,
      getQueryStats: jest.fn() as jest.Mock,
      updateQueryFlags: jest.fn() as jest.Mock,
      getQueryClusters: jest.fn() as jest.Mock,
      findSimilarQueries: jest.fn() as jest.Mock,
    };

    mockContext = {
      req: {
        param: jest.fn(),
        query: jest.fn(),
      },
      get: jest.fn(),
      json: jest.fn(),
      header: jest.fn(),
    } as unknown as Context<AppContext>;
  });

  describe("getQueryInsightsHandler", () => {
    it("should return query insights successfully", async () => {
      const mockInsights = {
        summary: {
          totalQueries: 100,
          totalSearches: 500,
          averageHitRate: 75.5,
          zeroHitQueries: 10,
          lowHitQueries: 15,
        },
        popularQueries: [
          { query: "music", count: 50, hitRate: 80 },
          { query: "food", count: 30, hitRate: 70 },
        ],
        lowHitRateQueries: [{ query: "obscure", count: 5, hitRate: 20 }],
        zeroHitQueries: [{ query: "nonexistent", count: 3, hitRate: 0 }],
      };

      (mockContext.req.query as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case "days":
            return "30";
          case "limit":
            return "10";
          case "minSearches":
            return "3";
          default:
            return null;
        }
      });

      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getQueryInsights as jest.Mock).mockResolvedValue(
        mockInsights,
      );

      await getQueryInsightsHandler(mockContext);

      expect(mockContext.header).toHaveBeenCalledWith(
        "Cache-Control",
        "no-cache, no-store, must-revalidate",
      );
      expect(mockContext.header).toHaveBeenCalledWith("Pragma", "no-cache");
      expect(mockContext.header).toHaveBeenCalledWith("Expires", "0");
      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.getQueryInsights).toHaveBeenCalledWith({
        days: 30,
        limit: 10,
        minSearches: 3,
      });
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        insights: mockInsights,
        filters: {
          days: 30,
          limit: 10,
          minSearches: 3,
        },
        timestamp: expect.any(String),
      });
    });

    it("should handle service errors", async () => {
      const error = new Error("Service error");

      (mockContext.req.query as jest.Mock).mockReturnValue("30");
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getQueryInsights as jest.Mock).mockRejectedValue(error);

      await getQueryInsightsHandler(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "Failed to fetch query insights",
          details: "Service error",
        },
        500,
      );
    });
  });

  describe("getPopularQueriesHandler", () => {
    it("should return popular queries successfully", async () => {
      const mockQueries: Array<{
        query: string;
        count: number;
        hitRate: number;
      }> = [
        { query: "music", count: 50, hitRate: 80 },
        { query: "food", count: 30, hitRate: 70 },
      ];

      (mockContext.req.query as jest.Mock).mockReturnValue("10");
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getPopularQueries as jest.Mock).mockResolvedValue(
        mockQueries,
      );

      await getPopularQueriesHandler(mockContext);

      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.getPopularQueries).toHaveBeenCalledWith(10);
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        popularQueries: mockQueries,
        total: 2,
      });
    });

    it("should use default limit when not provided", async () => {
      const mockQueries: Array<{
        query: string;
        count: number;
        hitRate: number;
      }> = [];

      (mockContext.req.query as jest.Mock).mockReturnValue(null);
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getPopularQueries as jest.Mock).mockResolvedValue(
        mockQueries,
      );

      await getPopularQueriesHandler(mockContext);

      expect(mockEventService.getPopularQueries).toHaveBeenCalledWith(10);
    });
  });

  describe("getLowHitRateQueriesHandler", () => {
    it("should return low hit rate queries successfully", async () => {
      const mockQueries = [
        { query: "obscure", count: 5, hitRate: 20 },
        { query: "rare", count: 3, hitRate: 30 },
      ];

      (mockContext.req.query as jest.Mock).mockReturnValue("10");
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getLowHitRateQueries as jest.Mock).mockResolvedValue(
        mockQueries,
      );

      await getLowHitRateQueriesHandler(mockContext);

      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.getLowHitRateQueries).toHaveBeenCalledWith(10);
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        lowHitRateQueries: mockQueries,
        total: 2,
      });
    });
  });

  describe("getZeroResultQueriesHandler", () => {
    it("should return zero result queries successfully", async () => {
      const mockQueries = [
        { query: "nonexistent", count: 3, hitRate: 0 },
        { query: "invalid", count: 2, hitRate: 0 },
      ];

      (mockContext.req.query as jest.Mock).mockReturnValue("10");
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getZeroResultQueries as jest.Mock).mockResolvedValue(
        mockQueries,
      );

      await getZeroResultQueriesHandler(mockContext);

      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.getZeroResultQueries).toHaveBeenCalledWith(10);
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        zeroResultQueries: mockQueries,
        total: 2,
      });
    });
  });

  describe("getQueryStatsHandler", () => {
    it("should return query stats successfully", async () => {
      const query = "music";
      const mockStats = {
        totalSearches: 50,
        hitRate: 80,
        averageResults: 5.2,
        lastSearched: "2024-01-01T10:00:00Z",
      };

      (mockContext.req.param as jest.Mock).mockReturnValue(query);
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getQueryStats as jest.Mock).mockResolvedValue(
        mockStats,
      );

      await getQueryStatsHandler(mockContext);

      expect(mockContext.req.param).toHaveBeenCalledWith("query");
      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.getQueryStats).toHaveBeenCalledWith(query);
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        query,
        stats: mockStats,
      });
    });

    it("should return 404 when query not found", async () => {
      const query = "nonexistent";

      (mockContext.req.param as jest.Mock).mockReturnValue(query);
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getQueryStats as jest.Mock).mockResolvedValue(null);

      await getQueryStatsHandler(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "Query not found",
        },
        404,
      );
    });
  });

  describe("updateQueryFlagsHandler", () => {
    it("should update query flags successfully", async () => {
      const mockResult = {
        updatedCount: 15,
        flaggedQueries: ["obscure", "rare"],
      };

      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.updateQueryFlags as jest.Mock).mockResolvedValue(
        mockResult,
      );

      await updateQueryFlagsHandler(mockContext);

      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.updateQueryFlags).toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        message: "Query flags updated successfully",
        result: mockResult,
      });
    });
  });

  describe("getQueryClustersHandler", () => {
    it("should return query clusters successfully", async () => {
      const mockClusters: Array<{
        representative: string;
        queries: string[];
        size: number;
      }> = [
        {
          representative: "music",
          queries: ["music", "concert", "band"],
          size: 3,
        },
        {
          representative: "food",
          queries: ["food", "restaurant", "dining"],
          size: 3,
        },
      ];

      (mockContext.req.query as jest.Mock).mockReturnValue("0.8");
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getQueryClusters as jest.Mock).mockResolvedValue(
        mockClusters,
      );

      await getQueryClustersHandler(mockContext);

      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.getQueryClusters).toHaveBeenCalledWith(0.8);
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        clusters: mockClusters,
        total: 2,
        similarityThreshold: 0.8,
      });
    });

    it("should use default similarity threshold when not provided", async () => {
      const mockClusters: Array<{
        representative: string;
        queries: string[];
        size: number;
      }> = [];

      (mockContext.req.query as jest.Mock).mockReturnValue(null);
      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.getQueryClusters as jest.Mock).mockResolvedValue(
        mockClusters,
      );

      await getQueryClustersHandler(mockContext);

      expect(mockEventService.getQueryClusters).toHaveBeenCalledWith(0.8);
    });
  });

  describe("findSimilarQueriesHandler", () => {
    it("should find similar queries successfully", async () => {
      const query = "music";
      const mockSimilarQueries = [
        { query: "concert", similarity: 0.85 },
        { query: "band", similarity: 0.75 },
      ];

      (mockContext.req.param as jest.Mock).mockReturnValue(query);
      (mockContext.req.query as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case "limit":
            return "10";
          case "similarityThreshold":
            return "0.8";
          default:
            return null;
        }
      });

      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.findSimilarQueries as jest.Mock).mockResolvedValue(
        mockSimilarQueries,
      );

      await findSimilarQueriesHandler(mockContext);

      expect(mockContext.req.param).toHaveBeenCalledWith("query");
      expect(mockContext.get).toHaveBeenCalledWith("eventService");
      expect(mockEventService.findSimilarQueries).toHaveBeenCalledWith(
        query,
        10,
        0.8,
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        originalQuery: query,
        similarQueries: mockSimilarQueries,
        total: 2,
        limit: 10,
        similarityThreshold: 0.8,
      });
    });

    it("should use default parameters when not provided", async () => {
      const query = "music";
      const mockSimilarQueries: Array<{ query: string; similarity: number }> =
        [];

      (mockContext.req.param as jest.Mock).mockReturnValue(query);
      (mockContext.req.query as jest.Mock).mockReturnValue(null);

      (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
      (mockEventService.findSimilarQueries as jest.Mock).mockResolvedValue(
        mockSimilarQueries,
      );

      await findSimilarQueriesHandler(mockContext);

      expect(mockEventService.findSimilarQueries).toHaveBeenCalledWith(
        query,
        10,
        0.8,
      );
    });
  });

  describe("Error handling", () => {
    it("should handle service errors consistently across all handlers", async () => {
      const error = new Error("Database connection failed");
      const handlers = [
        { handler: getQueryInsightsHandler, serviceMethod: "getQueryInsights" },
        {
          handler: getPopularQueriesHandler,
          serviceMethod: "getPopularQueries",
        },
        {
          handler: getLowHitRateQueriesHandler,
          serviceMethod: "getLowHitRateQueries",
        },
        {
          handler: getZeroResultQueriesHandler,
          serviceMethod: "getZeroResultQueries",
        },
        { handler: getQueryStatsHandler, serviceMethod: "getQueryStats" },
        { handler: updateQueryFlagsHandler, serviceMethod: "updateQueryFlags" },
        { handler: getQueryClustersHandler, serviceMethod: "getQueryClusters" },
        {
          handler: findSimilarQueriesHandler,
          serviceMethod: "findSimilarQueries",
        },
      ];

      for (const { handler, serviceMethod } of handlers) {
        // Reset mocks
        (mockContext.get as jest.Mock).mockReturnValue(mockEventService);
        (mockContext.req.param as jest.Mock).mockReturnValue("test");
        (mockContext.req.query as jest.Mock).mockReturnValue("10");

        // Mock the service method to throw an error
        (
          mockEventService[serviceMethod as keyof EventService] as jest.Mock
        ).mockRejectedValue(error);

        await handler(mockContext);

        expect(mockContext.json).toHaveBeenCalledWith(
          {
            success: false,
            error: expect.stringContaining("Failed to"),
            details: "Database connection failed",
          },
          500,
        );
      }
    });
  });
});
