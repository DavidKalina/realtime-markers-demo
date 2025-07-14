import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import {
  createEventAdminService,
  type EventAdminService,
  type EventAdminServiceDependencies,
} from "../EventAdminService";
import { Event } from "@realtime-markers/database";
import { Event";
import { Category } from "@realtime-markers/database";
import { Category";
import { UserEventSave } from "@realtime-markers/database";
import { UserEventSave";
import { UserEventDiscovery } from "@realtime-markers/database";
import { UserEventDiscovery";
import { User } from "@realtime-markers/database";
import { User";
import type { DataSource, Repository } from "typeorm";
import type { EventCacheService } from "../shared/EventCacheService";
import type { RedisService } from "../shared/RedisService";

describe("EventAdminService", () => {
  let eventAdminService: EventAdminService;
  let mockDataSource: DataSource;
  let mockEventRepository: Repository<Event>;
  let mockCategoryRepository: Repository<Category>;
  let mockUserEventSaveRepository: Repository<UserEventSave>;
  let mockUserEventDiscoveryRepository: Repository<UserEventDiscovery>;
  let mockUserRepository: Repository<User>;
  let mockEventCacheService: EventCacheService;
  let mockRedisService: RedisService;

  // Test data
  const mockEvent = {
    id: "event-123",
    title: "Test Event",
    description: "Test Description",
    eventDate: new Date("2024-12-31"),
    isRecurring: false,
    recurrenceEndDate: null,
    creatorId: "user-123",
    scanCount: 10,
    saveCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Event;

  const mockRecurringEvent = {
    id: "event-456",
    title: "Recurring Event",
    description: "Recurring Description",
    eventDate: new Date("2024-01-01"),
    isRecurring: true,
    recurrenceEndDate: new Date("2024-06-30"),
    creatorId: "user-456",
    scanCount: 20,
    saveCount: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Event;

  const mockCategory = {
    id: "category-123",
    name: "Test Category",
    description: "Test Category Description",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Category;

  beforeEach(() => {
    // Create mocks
    mockEventRepository = {
      createQueryBuilder: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    } as unknown as Repository<Event>;

    mockCategoryRepository = {
      find: jest.fn(),
    } as unknown as Repository<Category>;

    mockUserEventSaveRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<UserEventSave>;

    mockUserEventDiscoveryRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<UserEventDiscovery>;

    mockUserRepository = {
      update: jest.fn(),
    } as unknown as Repository<User>;

    mockEventCacheService = {
      invalidateEvent: jest.fn(),
      invalidateSearchCache: jest.fn(),
      invalidateAllClusterHubs: jest.fn(),
    } as unknown as EventCacheService;

    mockRedisService = {
      publish: jest.fn(),
    } as unknown as RedisService;

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        switch (entity) {
          case Event:
            return mockEventRepository;
          case Category:
            return mockCategoryRepository;
          case UserEventSave:
            return mockUserEventSaveRepository;
          case UserEventDiscovery:
            return mockUserEventDiscoveryRepository;
          case User:
            return mockUserRepository;
          default:
            throw new Error(`Unknown entity: ${entity.name}`);
        }
      }),
    } as unknown as DataSource;

    const dependencies: EventAdminServiceDependencies = {
      dataSource: mockDataSource,
      eventCacheService: mockEventCacheService,
      redisService: mockRedisService,
    };

    eventAdminService = createEventAdminService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("cleanupOutdatedEvents", () => {
    it("should delete outdated non-recurring events", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockEventRepository.delete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      const result = await eventAdminService.cleanupOutdatedEvents(100);

      expect(result.deletedEvents).toEqual([mockEvent]);
      expect(result.deletedCount).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockEventRepository.delete).toHaveBeenCalledWith([mockEvent.id]);
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        mockEvent.id,
      );
      expect(mockEventCacheService.invalidateSearchCache).toHaveBeenCalled();
      expect(mockEventCacheService.invalidateAllClusterHubs).toHaveBeenCalled();
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: expect.objectContaining({
            id: mockEvent.id,
            title: mockEvent.title,
          }),
          changeType: "EVENT_CLEANUP",
          userId: mockEvent.creatorId,
        },
      });
    });

    it("should delete outdated recurring events", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRecurringEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockEventRepository.delete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      const result = await eventAdminService.cleanupOutdatedEvents(100);

      expect(result.deletedEvents).toEqual([mockRecurringEvent]);
      expect(result.deletedCount).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should handle batch processing with hasMore flag", async () => {
      const events = Array.from({ length: 101 }, (_, i) => ({
        ...mockEvent,
        id: `event-${i}`,
      }));

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(events),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockEventRepository.delete as jest.Mock).mockResolvedValue({
        affected: 100,
      });

      const result = await eventAdminService.cleanupOutdatedEvents(100);

      expect(result.deletedEvents).toHaveLength(100);
      expect(result.deletedCount).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it("should return empty result when no events to delete", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventAdminService.cleanupOutdatedEvents(100);

      expect(result.deletedEvents).toEqual([]);
      expect(result.deletedCount).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(mockEventRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("getEvents", () => {
    it("should retrieve events with default options", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventAdminService.getEvents();

      expect(result).toEqual([mockEvent]);
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "event.categories",
        "category",
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "event.creator",
        "creator",
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "event.shares",
        "shares",
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "shares.sharedWith",
        "sharedWith",
      );
    });

    it("should apply limit and offset when provided", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await eventAdminService.getEvents({ limit: 10, offset: 20 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
    });

    it("should handle errors gracefully", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new Error("Database error")),
      };

      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await expect(eventAdminService.getEvents()).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getAllCategories", () => {
    it("should retrieve all categories ordered by name", async () => {
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([
        mockCategory,
      ]);

      const result = await eventAdminService.getAllCategories();

      expect(result).toEqual([mockCategory]);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({
        order: {
          name: "ASC",
        },
      });
    });

    it("should return empty array when no categories exist", async () => {
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await eventAdminService.getAllCategories();

      expect(result).toEqual([]);
    });
  });

  describe("recalculateCounts", () => {
    it("should recalculate event and user counts", async () => {
      // Mock event scan counts
      const mockEventScanQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ eventId: "event-123", scanCount: "10" }]),
      };

      // Mock event save counts
      const mockEventSaveQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ eventId: "event-123", saveCount: "5" }]),
      };

      // Mock user scan counts
      const mockUserScanQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ userId: "user-123", scanCount: "15" }]),
      };

      // Mock user save counts
      const mockUserSaveQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ userId: "user-123", saveCount: "7" }]),
      };

      (mockUserEventDiscoveryRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(mockEventScanQueryBuilder)
        .mockReturnValueOnce(mockUserScanQueryBuilder);

      (mockUserEventSaveRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(mockEventSaveQueryBuilder)
        .mockReturnValueOnce(mockUserSaveQueryBuilder);

      (mockEventRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });
      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      const result = await eventAdminService.recalculateCounts();

      expect(result.eventsUpdated).toBe(2); // 1 scan count + 1 save count
      expect(result.usersUpdated).toBe(2); // 1 scan count + 1 save count

      // Verify event updates
      expect(mockEventRepository.update).toHaveBeenCalledWith("event-123", {
        scanCount: 10,
      });
      expect(mockEventRepository.update).toHaveBeenCalledWith("event-123", {
        saveCount: 5,
      });

      // Verify user updates
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        scanCount: 15,
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        saveCount: 7,
      });
    });

    it("should handle empty results", async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      (
        mockUserEventDiscoveryRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);
      (
        mockUserEventSaveRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const result = await eventAdminService.recalculateCounts();

      expect(result.eventsUpdated).toBe(0);
      expect(result.usersUpdated).toBe(0);
    });

    it("should handle errors during recalculation", async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockRejectedValue(new Error("Database error")),
      };

      (
        mockUserEventDiscoveryRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      await expect(eventAdminService.recalculateCounts()).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("createEventAdminService", () => {
    it("should create an EventAdminService instance", () => {
      const dependencies: EventAdminServiceDependencies = {
        dataSource: mockDataSource,
        eventCacheService: mockEventCacheService,
        redisService: mockRedisService,
      };

      const service = createEventAdminService(dependencies);

      expect(service).toBeDefined();
      expect(typeof service.cleanupOutdatedEvents).toBe("function");
      expect(typeof service.getEvents).toBe("function");
      expect(typeof service.getAllCategories).toBe("function");
      expect(typeof service.recalculateCounts).toBe("function");
    });
  });
});
