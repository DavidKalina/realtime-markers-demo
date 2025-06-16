import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import {
  EventSharingServiceImpl,
  createEventSharingService,
} from "../EventSharingService";
import type { DataSource, Repository, EntityManager } from "typeorm";
import type { EventCacheService } from "../shared/EventCacheService";
import type { RedisService } from "../shared/RedisService";

// Mock types to avoid circular dependencies
interface MockEvent {
  id: string;
  title: string;
  isPrivate: boolean;
  creatorId?: string;
  embedding?: string;
  categories: unknown[];
  creator?: { id: string };
  shares: unknown[];
  rsvps: unknown[];
  eventDate: Date;
  location: { type: string; coordinates: number[] };
  scanCount: number;
  saveCount: number;
  status: string;
  hasQrCode: boolean;
  qrDetectedInImage: boolean;
  createdAt: Date;
  updatedAt: Date;
  isRecurring: boolean;
}

interface MockEventShare {
  id: string;
  eventId: string;
  sharedWithId: string;
  sharedById: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mock the entities with proper typing
const mockEvent: MockEvent = {
  id: "event-123",
  title: "Test Event",
  isPrivate: true,
  creatorId: "creator-456",
  embedding: "test-embedding",
  categories: [],
  creator: { id: "creator-456" },
  shares: [],
  rsvps: [],
  eventDate: new Date(),
  location: { type: "Point", coordinates: [0, 0] },
  scanCount: 1,
  saveCount: 0,
  status: "PENDING",
  hasQrCode: false,
  qrDetectedInImage: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  isRecurring: false,
};

const mockPublicEvent: MockEvent = {
  id: "event-789",
  title: "Public Event",
  isPrivate: false,
  creatorId: "creator-456",
  embedding: "test-embedding",
  categories: [],
  creator: { id: "creator-456" },
  shares: [],
  rsvps: [],
  eventDate: new Date(),
  location: { type: "Point", coordinates: [0, 0] },
  scanCount: 1,
  saveCount: 0,
  status: "PENDING",
  hasQrCode: false,
  qrDetectedInImage: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  isRecurring: false,
};

const mockEventShare: MockEventShare = {
  id: "share-123",
  eventId: "event-123",
  sharedWithId: "user-789",
  sharedById: "creator-456",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("EventSharingService", () => {
  let eventSharingService: EventSharingServiceImpl;
  let mockDataSource: DataSource;
  let mockEventRepository: Repository<MockEvent>;
  let mockEventShareRepository: Repository<MockEventShare>;
  let mockRedisService: RedisService;
  let mockEventCacheService: EventCacheService;
  let mockTransactionalEntityManager: EntityManager;

  beforeEach(() => {
    // Create mocks with proper jest typing
    mockEventRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<MockEvent>;

    mockEventShareRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    } as unknown as Repository<MockEventShare>;

    mockRedisService = {
      publish: jest.fn(),
    } as unknown as RedisService;

    mockEventCacheService = {
      invalidateEvent: jest.fn(),
    } as unknown as EventCacheService;

    mockTransactionalEntityManager = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          into: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              orIgnore: jest.fn().mockReturnValue({
                execute: jest.fn().mockResolvedValue({}),
              }),
            }),
          }),
        }),
      }),
    } as unknown as EntityManager;

    mockDataSource = {
      getRepository: jest.fn((entity) => {
        // Return appropriate repository based on entity name
        if (entity.name === "Event" || entity === "Event")
          return mockEventRepository;
        if (entity.name === "EventShare" || entity === "EventShare")
          return mockEventShareRepository;
        return mockEventRepository; // fallback
      }),
      transaction: jest.fn((callback) =>
        callback(mockTransactionalEntityManager),
      ),
    } as unknown as DataSource;

    eventSharingService = new EventSharingServiceImpl({
      dataSource: mockDataSource,
      redisService: mockRedisService,
      eventCacheService: mockEventCacheService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("shareEventWithUsers", () => {
    it("should successfully share an event with users", async () => {
      // Arrange
      const eventId = "event-123";
      const sharedById = "creator-456";
      const sharedWithIds = ["user-789", "user-101"];

      (mockTransactionalEntityManager.findOne as jest.Mock).mockResolvedValue(
        mockEvent,
      );

      // Act
      await eventSharingService.shareEventWithUsers(
        eventId,
        sharedById,
        sharedWithIds,
      );

      // Assert
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockTransactionalEntityManager.findOne).toHaveBeenCalledWith(
        expect.any(Function),
        {
          where: { id: eventId },
        },
      );
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        eventId,
      );
    });

    it("should throw error when event ID is missing", async () => {
      // Act & Assert
      await expect(
        eventSharingService.shareEventWithUsers("", "creator-456", [
          "user-789",
        ]),
      ).rejects.toThrow("Event ID is required for sharing");
    });

    it("should throw error when shared by ID is missing", async () => {
      // Act & Assert
      await expect(
        eventSharingService.shareEventWithUsers("event-123", "", ["user-789"]),
      ).rejects.toThrow("Shared By ID is required for sharing");
    });

    it("should throw error when shared with IDs are missing", async () => {
      // Act & Assert
      await expect(
        eventSharingService.shareEventWithUsers("event-123", "creator-456", []),
      ).rejects.toThrow("Shared With IDs are required for sharing");
    });

    it("should throw error when shared with IDs are null", async () => {
      // Act & Assert
      await expect(
        eventSharingService.shareEventWithUsers(
          "event-123",
          "creator-456",
          null as unknown as string[],
        ),
      ).rejects.toThrow("Shared With IDs are required for sharing");
    });

    it("should throw error when event does not exist", async () => {
      // Arrange
      (mockTransactionalEntityManager.findOne as jest.Mock).mockResolvedValue(
        null,
      );

      // Act & Assert
      await expect(
        eventSharingService.shareEventWithUsers(
          "nonexistent-event",
          "creator-456",
          ["user-789"],
        ),
      ).rejects.toThrow("Event with ID nonexistent-event not found");
    });

    it("should handle transaction rollback on error", async () => {
      // Arrange
      (mockTransactionalEntityManager.findOne as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(
        eventSharingService.shareEventWithUsers("event-123", "creator-456", [
          "user-789",
        ]),
      ).rejects.toThrow("Database error");

      expect(mockEventCacheService.invalidateEvent).not.toHaveBeenCalled();
    });
  });

  describe("removeEventShares", () => {
    it("should successfully remove event shares", async () => {
      // Arrange
      const eventId = "event-123";
      const sharedWithIds = ["user-789", "user-101"];

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(mockEvent);
      (mockEventShareRepository.delete as jest.Mock).mockResolvedValue({
        affected: 2,
      });

      // Act
      await eventSharingService.removeEventShares(eventId, sharedWithIds);

      // Assert
      expect(mockEventShareRepository.delete).toHaveBeenCalledWith({
        eventId,
        sharedWithId: expect.any(Object), // In operator
      });
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        eventId,
      );
      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: eventId },
        relations: [
          "categories",
          "creator",
          "shares",
          "shares.sharedWith",
          "rsvps",
        ],
      });
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: expect.objectContaining({
          id: eventId,
          title: "Test Event",
        }),
      });
    });

    it("should handle case when event is not found after share removal", async () => {
      // Arrange
      const eventId = "event-123";
      const sharedWithIds = ["user-789"];

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockEventShareRepository.delete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      // Act
      await eventSharingService.removeEventShares(eventId, sharedWithIds);

      // Assert
      expect(mockEventShareRepository.delete).toHaveBeenCalled();
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        eventId,
      );
      expect(mockRedisService.publish).not.toHaveBeenCalled();
    });

    it("should handle empty shared with IDs array", async () => {
      // Arrange
      const eventId = "event-123";
      const sharedWithIds: string[] = [];

      // Act
      await eventSharingService.removeEventShares(eventId, sharedWithIds);

      // Assert
      expect(mockEventShareRepository.delete).toHaveBeenCalledWith({
        eventId,
        sharedWithId: expect.any(Object),
      });
    });
  });

  describe("getEventSharedWithUsers", () => {
    it("should return array of user IDs the event is shared with", async () => {
      // Arrange
      const eventId = "event-123";
      const mockShares = [
        { sharedWithId: "user-789" },
        { sharedWithId: "user-101" },
      ];

      (mockEventShareRepository.find as jest.Mock).mockResolvedValue(
        mockShares as MockEventShare[],
      );

      // Act
      const result = await eventSharingService.getEventSharedWithUsers(eventId);

      // Assert
      expect(result).toEqual(["user-789", "user-101"]);
      expect(mockEventShareRepository.find).toHaveBeenCalledWith({
        where: { eventId },
        select: ["sharedWithId"],
      });
    });

    it("should return empty array when no shares exist", async () => {
      // Arrange
      const eventId = "event-123";
      (mockEventShareRepository.find as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await eventSharingService.getEventSharedWithUsers(eventId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("hasEventAccess", () => {
    it("should return true for public events", async () => {
      // Arrange
      const eventId = "event-789";
      const userId = "user-123";

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        mockPublicEvent,
      );

      // Act
      const result = await eventSharingService.hasEventAccess(eventId, userId);

      // Assert
      expect(result).toBe(true);
      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: eventId },
        select: ["id", "isPrivate", "creatorId"],
      });
    });

    it("should return true for event creator", async () => {
      // Arrange
      const eventId = "event-123";
      const userId = "creator-456";

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(mockEvent);
      (mockEventShareRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await eventSharingService.hasEventAccess(eventId, userId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true for user with shared access", async () => {
      // Arrange
      const eventId = "event-123";
      const userId = "user-789";

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(mockEvent);
      (mockEventShareRepository.findOne as jest.Mock).mockResolvedValue(
        mockEventShare,
      );

      // Act
      const result = await eventSharingService.hasEventAccess(eventId, userId);

      // Assert
      expect(result).toBe(true);
      expect(mockEventShareRepository.findOne).toHaveBeenCalledWith({
        where: { eventId, sharedWithId: userId },
      });
    });

    it("should return false for user without access to private event", async () => {
      // Arrange
      const eventId = "event-123";
      const userId = "user-999";

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(mockEvent);
      (mockEventShareRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await eventSharingService.hasEventAccess(eventId, userId);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when event does not exist", async () => {
      // Arrange
      const eventId = "nonexistent-event";
      const userId = "user-123";

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await eventSharingService.hasEventAccess(eventId, userId);

      // Assert
      expect(result).toBe(false);
      expect(mockEventShareRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe("getEventShares", () => {
    it("should return array of event shares", async () => {
      // Arrange
      const eventId = "event-123";
      const mockShares = [
        { sharedWithId: "user-789", sharedById: "creator-456" },
        { sharedWithId: "user-101", sharedById: "creator-456" },
      ];

      // Mock the query builder
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockShares),
      };

      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      });

      // Act
      const result = await eventSharingService.getEventShares(eventId);

      // Assert
      expect(result).toEqual(mockShares);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "share.eventId = :eventId",
        { eventId },
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        "share.sharedWithId",
        "share.sharedById",
      ]);
    });

    it("should return empty array when no shares exist", async () => {
      // Arrange
      const eventId = "event-123";

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      });

      // Act
      const result = await eventSharingService.getEventShares(eventId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("stripEventForRedis", () => {
    it("should remove embedding field from event", async () => {
      // Arrange
      const eventWithEmbedding = {
        ...mockEvent,
        embedding: "sensitive-embedding-data",
      };

      // Act - we need to access the private method through reflection or by calling a public method that uses it
      // Since stripEventForRedis is private, we'll test it indirectly through removeEventShares
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithEmbedding,
      );
      (mockEventShareRepository.delete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await eventSharingService.removeEventShares("event-123", ["user-789"]);

      // Assert
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: expect.not.objectContaining({
          embedding: "sensitive-embedding-data",
        }),
      });
    });
  });

  describe("createEventSharingService factory", () => {
    it("should create EventSharingService instance", () => {
      // Arrange
      const dependencies = {
        dataSource: mockDataSource,
        redisService: mockRedisService,
        eventCacheService: mockEventCacheService,
      };

      // Act
      const service = createEventSharingService(dependencies);

      // Assert
      expect(service).toBeInstanceOf(EventSharingServiceImpl);
    });
  });
});
