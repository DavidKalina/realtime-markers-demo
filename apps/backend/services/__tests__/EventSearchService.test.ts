import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  mock,
} from "bun:test";

// Mock pgvector before importing the service
const mockToSql = mock((embedding: number[]) => {
  // Return a simple string representation of the embedding for testing
  return `[${embedding.join(",")}]`;
});

// Mock the pgvector module
mock.module("pgvector", () => ({
  default: {
    toSql: mockToSql,
  },
}));

import {
  createEventSearchService,
  type EventSearchService,
  type EventSearchServiceDependencies,
} from "../EventSearchService";
import { Event } from "../../entities/Event";
import { Category } from "../../entities/Category";
import type { Filter } from "../../entities/Filter";
import type { DataSource, Repository } from "typeorm";
import type { EventCacheService } from "../shared/EventCacheService";
import type { OpenAIService } from "../shared/OpenAIService";

describe("EventSearchService", () => {
  let eventSearchService: EventSearchService;
  let mockDataSource: DataSource;
  let mockEventRepository: Repository<Event>;
  let mockCategoryRepository: Repository<Category>;
  let mockEventCacheService: EventCacheService;
  let mockOpenAIService: OpenAIService;

  // Test data
  const mockEvent = {
    id: "event-123",
    title: "Test Event",
    description: "Test Description",
    eventDate: new Date("2024-12-31"),
    address: "123 Test St",
    locationNotes: "Near the park",
    emojiDescription: "🎉 Party",
    embedding: [0.1, 0.2, 0.3],
    scanCount: 10,
    saveCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Event;

  const mockFilter: Filter = {
    id: "filter-123",
    name: "Test Filter",
    isActive: true,
    criteria: {
      dateRange: {
        start: "2024-01-01",
        end: "2024-12-31",
      },
      status: ["ACTIVE"],
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        radius: 5000,
      },
    },
    embedding: [0.1, 0.2, 0.3],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Filter;

  beforeEach(() => {
    // Create mocks
    mockEventRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<Event>;

    mockCategoryRepository = {
      find: jest.fn(),
    } as unknown as Repository<Category>;

    mockEventCacheService = {
      getSearchResults: jest.fn(),
      setSearchResults: jest.fn(),
      getCachedEmbedding: jest.fn(),
      setCachedEmbedding: jest.fn(),
    } as unknown as EventCacheService;

    mockOpenAIService = {
      generateEmbedding: jest.fn(),
    } as unknown as OpenAIService;

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === "Event") {
          return mockEventRepository;
        }
        if (entity === "Category") {
          return mockCategoryRepository;
        }
        throw new Error(
          `Unknown entity: ${typeof entity === "string" ? entity : entity?.name || "undefined"}`,
        );
      }),
    } as unknown as DataSource;

    const dependencies: EventSearchServiceDependencies = {
      dataSource: mockDataSource,
      eventCacheService: mockEventCacheService,
      openaiService: mockOpenAIService,
    };

    eventSearchService = createEventSearchService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("searchEvents", () => {
    it("should return empty results for short queries", async () => {
      const result = await eventSearchService.searchEvents("a", 10);

      expect(result.results).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should return empty results for empty queries", async () => {
      const result = await eventSearchService.searchEvents("   ", 10);

      expect(result.results).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should return cached results when available", async () => {
      const cachedResults = {
        results: [{ event: mockEvent, score: 0.8 }],
        nextCursor: "next-cursor",
      };

      (mockEventCacheService.getSearchResults as jest.Mock).mockResolvedValue(
        cachedResults,
      );

      const result = await eventSearchService.searchEvents("test", 10);

      expect(result).toEqual(cachedResults);
      expect(mockEventCacheService.getSearchResults).toHaveBeenCalledWith(
        "search:test:10:null",
      );
    });

    it("should perform semantic search when cache miss", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ ...mockEvent, __score: "0.85" }]),
      };

      (mockEventCacheService.getSearchResults as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventCacheService.getCachedEmbedding as jest.Mock).mockReturnValue(
        mockEmbedding,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.searchEvents("test", 10);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].event).toEqual(mockEvent);
      expect(result.results[0].score).toBe(0.85);
      expect(mockEventCacheService.setSearchResults).toHaveBeenCalled();
    });

    it("should generate embedding when not cached", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (mockEventCacheService.getSearchResults as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventCacheService.getCachedEmbedding as jest.Mock).mockReturnValue(
        null,
      );
      (mockOpenAIService.generateEmbedding as jest.Mock).mockResolvedValue(
        mockEmbedding,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.searchEvents("test", 10);

      expect(mockOpenAIService.generateEmbedding).toHaveBeenCalled();
      expect(mockEventCacheService.setCachedEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("test"),
        mockEmbedding,
      );
    });

    it("should handle cursor-based pagination", async () => {
      const cursorData = { id: "event-123", score: 0.8 };
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (mockEventCacheService.getSearchResults as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventCacheService.getCachedEmbedding as jest.Mock).mockReturnValue([
        0.1, 0.2, 0.3,
      ]);
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.searchEvents("test", 10, cursor);

      expect(mockEventCacheService.getSearchResults).toHaveBeenCalledWith(
        "search:test:10:" + cursor,
      );
    });

    it("should generate next cursor when more results available", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { ...mockEvent, __score: "0.85" },
          { ...mockEvent, id: "event-456", __score: "0.75" },
        ]),
      };

      (mockEventCacheService.getSearchResults as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventCacheService.getCachedEmbedding as jest.Mock).mockReturnValue(
        mockEmbedding,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.searchEvents("test", 1);

      expect(result.results).toHaveLength(1);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe("getNearbyEvents", () => {
    it("should retrieve events within radius", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.getNearbyEvents(
        40.7128,
        -74.006,
        5000,
      );

      expect(result).toEqual([mockEvent]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining("ST_DWithin"),
        { lat: 40.7128, lng: -74.006, radius: 5000 },
      );
    });

    it("should apply date filters when provided", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.getNearbyEvents(
        40.7128,
        -74.006,
        5000,
        startDate,
        endDate,
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.eventDate >= :startDate",
        { startDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.eventDate <= :endDate",
        { endDate },
      );
    });

    it("should use default radius when not provided", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.getNearbyEvents(40.7128, -74.006);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining("ST_DWithin"),
        { lat: 40.7128, lng: -74.006, radius: 5000 },
      );
    });
  });

  describe("getEventsByCategories", () => {
    it("should retrieve events by category IDs", async () => {
      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.getEventsByCategories([
        "category-123",
      ]);

      expect(result.events).toEqual([mockEvent]);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "category.id IN (:...categoryIds)",
        { categoryIds: ["category-123"] },
      );
    });

    it("should apply date filters when provided", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.getEventsByCategories(["category-123"], {
        startDate,
        endDate,
        limit: 10,
        offset: 0,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.eventDate >= :startDate",
        { startDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.eventDate <= :endDate",
        { endDate },
      );
    });

    it("should handle pagination correctly", async () => {
      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 15]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.getEventsByCategories(
        ["category-123"],
        {
          limit: 10,
          offset: 5,
        },
      );

      expect(result.hasMore).toBe(true);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe("getEventsByCategory", () => {
    it("should retrieve events by single category", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result =
        await eventSearchService.getEventsByCategory("category-123");

      expect(result.events).toEqual([mockEvent]);
      expect(result.nextCursor).toBeUndefined();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "category.id = :categoryId",
        { categoryId: "category-123" },
      );
    });

    it("should handle cursor-based pagination", async () => {
      const cursorData = {
        eventDate: new Date("2024-12-31"),
        eventId: "event-123",
      };
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.getEventsByCategory("category-123", { cursor });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it("should generate next cursor when more results available", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([mockEvent, { ...mockEvent, id: "event-456" }]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.getEventsByCategory(
        "category-123",
        { limit: 1 },
      );

      expect(result.events).toHaveLength(1);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe("searchEventsByFilter", () => {
    it("should return empty results when no embedding or criteria", async () => {
      const emptyFilter = {
        ...mockFilter,
        embedding: undefined,
        criteria: {},
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.searchEventsByFilter(emptyFilter);

      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("should perform semantic search with embedding", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.searchEventsByFilter(mockFilter);

      expect(result.events).toEqual([mockEvent]);
      expect(result.total).toBe(1);
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        "(1 - (event.embedding <-> :embedding)::float)",
        "similarity_score",
      );
    });

    it("should apply date range filters", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.searchEventsByFilter(mockFilter);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.eventDate >= :startDate",
        { startDate: new Date("2024-01-01") },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.eventDate <= :endDate",
        { endDate: new Date("2024-12-31") },
      );
    });

    it("should apply status filters", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.searchEventsByFilter(mockFilter);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "event.status IN (:...statuses)",
        { statuses: ["ACTIVE"] },
      );
    });

    it("should apply location filters", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventSearchService.searchEventsByFilter(mockFilter);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("ST_DWithin"),
        {
          latitude: 40.7128,
          longitude: -74.006,
          radius: 5000,
        },
      );
    });

    it("should handle pagination correctly", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 15]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventSearchService.searchEventsByFilter(mockFilter, {
        limit: 10,
        offset: 5,
      });

      expect(result.hasMore).toBe(true);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe("createEventSearchService", () => {
    it("should create an EventSearchService instance", () => {
      const dependencies: EventSearchServiceDependencies = {
        dataSource: mockDataSource,
        eventCacheService: mockEventCacheService,
        openaiService: mockOpenAIService,
      };

      const service = createEventSearchService(dependencies);

      expect(service).toBeDefined();
      expect(typeof service.searchEvents).toBe("function");
      expect(typeof service.getNearbyEvents).toBe("function");
      expect(typeof service.getEventsByCategories).toBe("function");
      expect(typeof service.getEventsByCategory).toBe("function");
      expect(typeof service.searchEventsByFilter).toBe("function");
    });
  });
});
