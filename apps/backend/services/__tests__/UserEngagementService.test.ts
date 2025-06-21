import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  mock,
} from "bun:test";
import { type Point } from "geojson";

// Mock pgvector before importing it
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

import pgvector from "pgvector";

import {
  createUserEngagementService,
  type UserEngagementService,
  type UserEngagementServiceDependencies,
} from "../UserEngagementService";
import { Event, EventStatus } from "../../entities/Event";
import { User, UserRole, PlanType } from "../../entities/User";
import { UserEventSave } from "../../entities/UserEventSave";
import { UserEventRsvp, RsvpStatus } from "../../entities/UserEventRsvp";
import { UserEventDiscovery } from "../../entities/UserEventDiscovery";
import { UserEventView } from "../../entities/UserEventView";
import { Friendship } from "../../entities/Friendship";
import { Category } from "../../entities/Category";
import type { DataSource, Repository, EntityManager } from "typeorm";
import type { RedisService } from "../shared/RedisService";

describe("UserEngagementService", () => {
  let userEngagementService: UserEngagementService;
  let mockDataSource: DataSource;
  let mockEventRepository: Repository<Event>;
  let mockUserRepository: Repository<User>;
  let mockUserEventSaveRepository: Repository<UserEventSave>;
  let mockUserEventRsvpRepository: Repository<UserEventRsvp>;
  let mockUserEventDiscoveryRepository: Repository<UserEventDiscovery>;
  let mockUserEventViewRepository: Repository<UserEventView>;
  let mockRedisService: RedisService;
  let mockEntityManager: EntityManager;

  // Test data
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    displayName: "Test User",
    currentTitle: "Event Explorer",
    friendCode: "FRIEND123",
    passwordHash: "hashed",
    role: UserRole.USER,
    planType: PlanType.FREE,
    isVerified: false,
    discoveryCount: 0,
    scanCount: 0,
    saveCount: 0,
    viewCount: 0,
    weeklyScanCount: 0,
    totalXp: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    discoveries: [],
    createdEvents: [],
    savedEvents: [],
    viewedEvents: [],
    rsvps: [],
    sentFriendRequests: [],
    receivedFriendRequests: [],
  } as User;

  const mockFriend: User = {
    id: "friend-456",
    email: "friend@example.com",
    displayName: "Friend User",
    currentTitle: "Event Explorer",
    friendCode: "FRIEND456",
    passwordHash: "hashed",
    role: UserRole.USER,
    planType: PlanType.FREE,
    isVerified: false,
    discoveryCount: 0,
    scanCount: 0,
    saveCount: 0,
    viewCount: 0,
    weeklyScanCount: 0,
    totalXp: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    discoveries: [],
    createdEvents: [],
    savedEvents: [],
    viewedEvents: [],
    rsvps: [],
    sentFriendRequests: [],
    receivedFriendRequests: [],
  } as User;

  const mockCategory: Category = {
    id: "category-123",
    name: "Music",
    description: "Music events",
    icon: "🎵",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Category;

  const mockEvent: Event = {
    id: "event-123",
    emoji: "🎵",
    emojiDescription: "Jazz Music",
    title: "Jazz Night",
    description: "Live jazz music performance",
    eventDate: new Date("2024-12-31T20:00:00Z"),
    endDate: new Date("2024-12-31T23:00:00Z"),
    address: "123 Music St, Provo, UT",
    locationNotes: "Downtown venue",
    scanCount: 10,
    saveCount: 5,
    viewCount: 3,
    status: EventStatus.PENDING,
    location: { type: "Point", coordinates: [-111.6585, 40.2338] } as Point,
    creator: mockUser,
    creatorId: mockUser.id,
    categories: [mockCategory],
    timezone: "America/Denver",
    embedding: pgvector.toSql([0.1, 0.2, 0.3]),
    isPrivate: false,
    isRecurring: false,
    qrDetectedInImage: false,
    hasQrCode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Event;

  const mockUserEventSave: UserEventSave = {
    id: "save-123",
    userId: "user-123",
    eventId: "event-123",
    user: mockUser,
    event: mockEvent,
    savedAt: new Date(),
  } as UserEventSave;

  const mockUserEventRsvp: UserEventRsvp = {
    id: "rsvp-123",
    userId: "user-123",
    eventId: "event-123",
    status: RsvpStatus.GOING,
    user: mockUser,
    event: mockEvent,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserEventRsvp;

  const mockUserEventDiscovery: UserEventDiscovery = {
    id: "discovery-123",
    userId: "user-123",
    eventId: "event-123",
    user: mockUser,
    event: mockEvent,
    discoveredAt: new Date(),
  } as UserEventDiscovery;

  beforeEach(() => {
    // Create mocks
    mockEventRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<Event>;

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<User>;

    mockUserEventSaveRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<UserEventSave>;

    mockUserEventRsvpRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    } as unknown as Repository<UserEventRsvp>;

    mockUserEventDiscoveryRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<UserEventDiscovery>;

    mockUserEventViewRepository = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
    } as unknown as Repository<UserEventView>;

    mockRedisService = {
      publish: jest.fn(),
    } as unknown as RedisService;

    mockEntityManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as EntityManager;

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        switch (entity) {
          case Event:
            return mockEventRepository;
          case User:
            return mockUserRepository;
          case UserEventSave:
            return mockUserEventSaveRepository;
          case UserEventRsvp:
            return mockUserEventRsvpRepository;
          case UserEventDiscovery:
            return mockUserEventDiscoveryRepository;
          case UserEventView:
            return mockUserEventViewRepository;
          default:
            throw new Error(`Unknown entity: ${entity.name}`);
        }
      }),
      transaction: jest.fn(),
    } as unknown as DataSource;

    const dependencies: UserEngagementServiceDependencies = {
      dataSource: mockDataSource,
      redisService: mockRedisService,
    };

    userEngagementService = createUserEngagementService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("toggleSaveEvent", () => {
    it("should save an event when not previously saved", async () => {
      const eventWithRelations = {
        ...mockEvent,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const userWithUpdatedCounts = {
        ...mockUser,
        saveCount: 1,
      };

      const eventWithUpdatedCounts = {
        ...eventWithRelations,
        saveCount: 6,
      };

      const mockSave = {
        userId: "user-123",
        eventId: "event-123",
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      // Mock entity manager methods
      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(eventWithRelations) // Event
        .mockResolvedValueOnce(mockUser) // User
        .mockResolvedValueOnce(null); // Existing save

      (mockEntityManager.create as jest.Mock).mockReturnValue(mockSave);
      (mockEntityManager.save as jest.Mock)
        .mockResolvedValueOnce(mockSave) // Save the new save record
        .mockResolvedValueOnce(eventWithUpdatedCounts) // Save the updated event
        .mockResolvedValueOnce(userWithUpdatedCounts); // Save the updated user

      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await userEngagementService.toggleSaveEvent(
        "user-123",
        "event-123",
      );

      expect(result).toEqual({
        saved: true,
        saveCount: 6,
      });

      expect(mockEntityManager.create).toHaveBeenCalledWith(UserEventSave, {
        userId: "user-123",
        eventId: "event-123",
      });

      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({
            id: "event-123",
            saveCount: 6,
          }),
          previousMetrics: {
            saveCount: 5,
            scanCount: 10,
            rsvpCount: 0,
          },
          changeType: "SAVE_ADDED",
          userId: "user-123",
        },
      });
    });

    it("should unsave an event when previously saved", async () => {
      const eventWithRelations = {
        ...mockEvent,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const userWithUpdatedCounts = {
        ...mockUser,
        saveCount: 0,
      };

      const eventWithUpdatedCounts = {
        ...eventWithRelations,
        saveCount: 4,
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      // Mock entity manager methods
      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(eventWithRelations) // Event
        .mockResolvedValueOnce(mockUser) // User
        .mockResolvedValueOnce(mockUserEventSave); // Existing save

      (mockEntityManager.remove as jest.Mock).mockResolvedValue(undefined);
      (mockEntityManager.save as jest.Mock)
        .mockResolvedValueOnce(eventWithUpdatedCounts) // Save the updated event
        .mockResolvedValueOnce(userWithUpdatedCounts); // Save the updated user

      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await userEngagementService.toggleSaveEvent(
        "user-123",
        "event-123",
      );

      expect(result).toEqual({
        saved: false,
        saveCount: 4,
      });

      expect(mockEntityManager.remove).toHaveBeenCalledWith(mockUserEventSave);
    });

    it("should throw error when event not found", async () => {
      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(null); // Event not found

      await expect(
        userEngagementService.toggleSaveEvent("user-123", "nonexistent-event"),
      ).rejects.toThrow("Event not found");
    });

    it("should throw error when user not found", async () => {
      const eventWithRelations = {
        ...mockEvent,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(eventWithRelations) // Event
        .mockResolvedValueOnce(null); // User not found

      await expect(
        userEngagementService.toggleSaveEvent("nonexistent-user", "event-123"),
      ).rejects.toThrow("User not found");
    });

    it("should handle save count going below zero", async () => {
      const eventWithZeroSaves = {
        ...mockEvent,
        saveCount: 0,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const userWithZeroSaves = {
        ...mockUser,
        saveCount: 0,
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(eventWithZeroSaves) // Event
        .mockResolvedValueOnce(userWithZeroSaves) // User
        .mockResolvedValueOnce(mockUserEventSave); // Existing save

      (mockEntityManager.remove as jest.Mock).mockResolvedValue(undefined);
      (mockEntityManager.save as jest.Mock)
        .mockResolvedValueOnce({ ...eventWithZeroSaves, saveCount: 0 }) // Event
        .mockResolvedValueOnce({ ...userWithZeroSaves, saveCount: 0 }); // User

      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await userEngagementService.toggleSaveEvent(
        "user-123",
        "event-123",
      );

      expect(result.saveCount).toBe(0);
    });
  });

  describe("isEventSavedByUser", () => {
    it("should return true when event is saved by user", async () => {
      (mockUserEventSaveRepository.findOne as jest.Mock).mockResolvedValue(
        mockUserEventSave,
      );

      const result = await userEngagementService.isEventSavedByUser(
        "user-123",
        "event-123",
      );

      expect(result).toBe(true);
      expect(mockUserEventSaveRepository.findOne).toHaveBeenCalledWith({
        where: { userId: "user-123", eventId: "event-123" },
      });
    });

    it("should return false when event is not saved by user", async () => {
      (mockUserEventSaveRepository.findOne as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await userEngagementService.isEventSavedByUser(
        "user-123",
        "event-123",
      );

      expect(result).toBe(false);
    });
  });

  describe("getSavedEventsByUser", () => {
    it("should return saved events with pagination", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUserEventSave]),
      };

      (
        mockUserEventSaveRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const result = await userEngagementService.getSavedEventsByUser(
        "user-123",
        { limit: 10 },
      );

      expect(result.events).toEqual([mockEvent]);
      expect(result.nextCursor).toBeUndefined();
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "save.event",
        "event",
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "save.userId = :userId",
        { userId: "user-123" },
      );
    });

    it("should handle cursor pagination", async () => {
      const cursorData = {
        savedAt: new Date("2024-01-01T00:00:00Z"),
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
        getMany: jest.fn().mockResolvedValue([mockUserEventSave]),
      };

      (
        mockUserEventSaveRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      await userEngagementService.getSavedEventsByUser("user-123", {
        limit: 10,
        cursor,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it("should generate next cursor when there are more results", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            mockUserEventSave,
            { ...mockUserEventSave, id: "save-456" },
          ]),
      };

      (
        mockUserEventSaveRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const result = await userEngagementService.getSavedEventsByUser(
        "user-123",
        { limit: 1 },
      );

      expect(result.events).toHaveLength(1);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe("toggleRsvpEvent", () => {
    it("should create new RSVP when none exists", async () => {
      const eventWithRelations = {
        ...mockEvent,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const mockRsvp = {
        userId: "user-123",
        eventId: "event-123",
        status: RsvpStatus.GOING,
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(eventWithRelations) // Event
        .mockResolvedValueOnce(null) // Existing RSVP
        .mockResolvedValueOnce(eventWithRelations); // Updated event

      (mockEntityManager.create as jest.Mock).mockReturnValue(mockRsvp);
      (mockEntityManager.save as jest.Mock).mockResolvedValue(mockRsvp);
      (mockEntityManager.count as jest.Mock)
        .mockResolvedValueOnce(1) // Going count
        .mockResolvedValueOnce(0); // Not going count

      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await userEngagementService.toggleRsvpEvent(
        "user-123",
        "event-123",
        RsvpStatus.GOING,
      );

      expect(result).toEqual({
        status: RsvpStatus.GOING,
        goingCount: 1,
        notGoingCount: 0,
      });

      expect(mockEntityManager.create).toHaveBeenCalledWith(UserEventRsvp, {
        userId: "user-123",
        eventId: "event-123",
        status: RsvpStatus.GOING,
      });

      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({
            id: "event-123",
            rsvpCount: 1,
          }),
          changeType: "RSVP_ADDED",
          userId: "user-123",
        },
      });
    });

    it("should update existing RSVP", async () => {
      const eventWithRelations = {
        ...mockEvent,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const updatedRsvp = {
        ...mockUserEventRsvp,
        status: RsvpStatus.NOT_GOING,
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(eventWithRelations) // Event
        .mockResolvedValueOnce(mockUserEventRsvp) // Existing RSVP
        .mockResolvedValueOnce(eventWithRelations); // Updated event

      (mockEntityManager.save as jest.Mock).mockResolvedValue(updatedRsvp);
      (mockEntityManager.count as jest.Mock)
        .mockResolvedValueOnce(0) // Going count
        .mockResolvedValueOnce(1); // Not going count

      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await userEngagementService.toggleRsvpEvent(
        "user-123",
        "event-123",
        RsvpStatus.NOT_GOING,
      );

      expect(result).toEqual({
        status: RsvpStatus.NOT_GOING,
        goingCount: 0,
        notGoingCount: 1,
      });

      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({
            id: "event-123",
            rsvpCount: 1,
          }),
          changeType: "RSVP_UPDATED",
          userId: "user-123",
        },
      });
    });

    it("should throw error when event not found", async () => {
      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(null); // Event not found

      await expect(
        userEngagementService.toggleRsvpEvent(
          "user-123",
          "nonexistent-event",
          RsvpStatus.GOING,
        ),
      ).rejects.toThrow("Event not found");
    });
  });

  describe("getUserRsvpStatus", () => {
    it("should return RSVP status when exists", async () => {
      (mockUserEventRsvpRepository.findOne as jest.Mock).mockResolvedValue(
        mockUserEventRsvp,
      );

      const result = await userEngagementService.getUserRsvpStatus(
        "user-123",
        "event-123",
      );

      expect(result).toEqual(mockUserEventRsvp);
      expect(mockUserEventRsvpRepository.findOne).toHaveBeenCalledWith({
        where: { userId: "user-123", eventId: "event-123" },
      });
    });

    it("should return null when RSVP does not exist", async () => {
      (mockUserEventRsvpRepository.findOne as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await userEngagementService.getUserRsvpStatus(
        "user-123",
        "event-123",
      );

      expect(result).toBeNull();
    });
  });

  describe("createDiscoveryRecord", () => {
    it("should create discovery record successfully", async () => {
      const updatedEvent = {
        ...mockEvent,
        scanCount: 11,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const updatedUser = {
        ...mockUser,
        scanCount: 1,
        discoveryCount: 1,
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      // Mock the insert query builder for discovery record
      const mockInsertQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the update query builder for user discovery count
      const mockUpdateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };

      (mockEntityManager.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(mockInsertQueryBuilder) // For discovery record insert
        .mockReturnValueOnce(mockUpdateQueryBuilder); // For user update

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser) // User
        .mockResolvedValueOnce(mockEvent); // Event

      (mockEntityManager.save as jest.Mock)
        .mockResolvedValueOnce(updatedUser) // Save updated user
        .mockResolvedValueOnce(updatedEvent); // Save updated event

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        updatedEvent,
      );
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      await userEngagementService.createDiscoveryRecord(
        "user-123",
        "event-123",
      );

      expect(mockEntityManager.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(mockInsertQueryBuilder.insert).toHaveBeenCalled();
      expect(mockUpdateQueryBuilder.update).toHaveBeenCalledWith(User);
      expect(mockUpdateQueryBuilder.set).toHaveBeenCalledWith({
        discoveryCount: expect.any(Function),
      });
      expect(mockUpdateQueryBuilder.where).toHaveBeenCalledWith(
        "id = :userId",
        { userId: "user-123" },
      );
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({
            id: "event-123",
            scanCount: 11,
          }),
          changeType: "SCAN_ADDED",
          userId: "user-123",
        },
      });
    });

    it("should handle errors gracefully and not throw", async () => {
      // Mock transaction to throw error
      (mockDataSource.transaction as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      // Should not throw and should resolve successfully
      await expect(
        userEngagementService.createDiscoveryRecord("user-123", "event-123"),
      ).resolves.toBeUndefined();
    });
  });

  describe("getDiscoveredEventsByUser", () => {
    it("should return discovered events with pagination", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUserEventDiscovery]),
      };

      (
        mockUserEventDiscoveryRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const result = await userEngagementService.getDiscoveredEventsByUser(
        "user-123",
        { limit: 10 },
      );

      expect(result.events).toEqual([mockEvent]);
      expect(result.nextCursor).toBeUndefined();
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "discovery.event",
        "event",
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "discovery.userId = :userId",
        { userId: "user-123" },
      );
    });

    it("should handle cursor pagination", async () => {
      const cursorData = {
        discoveredAt: new Date("2024-01-01T00:00:00Z"),
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
        getMany: jest.fn().mockResolvedValue([mockUserEventDiscovery]),
      };

      (
        mockUserEventDiscoveryRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      await userEngagementService.getDiscoveredEventsByUser("user-123", {
        limit: 10,
        cursor,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe("getFriendsSavedEvents", () => {
    it("should return events saved by friends", async () => {
      const friendSave = {
        ...mockUserEventSave,
        user: mockFriend,
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([friendSave]),
      };

      (
        mockUserEventSaveRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      const result = await userEngagementService.getFriendsSavedEvents(
        "user-123",
        { limit: 10 },
      );

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual(
        expect.objectContaining({
          ...mockEvent,
          savedBy: {
            id: mockFriend.id,
            displayName: mockFriend.displayName,
            email: mockFriend.email,
          },
        }),
      );

      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        Friendship,
        "friendship",
        expect.stringContaining("ACCEPTED"),
        { userId: "user-123" },
      );
    });

    it("should handle cursor pagination", async () => {
      const cursorData = {
        savedAt: new Date("2024-01-01T00:00:00Z"),
        eventId: "event-123",
      };
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (
        mockUserEventSaveRepository.createQueryBuilder as jest.Mock
      ).mockReturnValue(mockQueryBuilder);

      await userEngagementService.getFriendsSavedEvents("user-123", {
        limit: 10,
        cursor,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe("stripEventForRedis", () => {
    it("should remove embedding field from event", () => {
      const eventWithEmbedding = {
        ...mockEvent,
        embedding: pgvector.toSql([0.1, 0.2, 0.3]),
      };

      // Access the private method through the service instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = userEngagementService as any;
      const strippedEvent = service.stripEventForRedis(eventWithEmbedding);

      expect(strippedEvent.embedding).toBeUndefined();
      expect(strippedEvent.id).toBe("event-123");
      expect(strippedEvent.title).toBe("Jazz Night");
    });
  });

  describe("createUserEngagementService", () => {
    it("should create service with correct dependencies", () => {
      const dependencies: UserEngagementServiceDependencies = {
        dataSource: mockDataSource,
        redisService: mockRedisService,
      };

      const service = createUserEngagementService(dependencies);

      expect(service).toBeDefined();
      expect(typeof service.toggleSaveEvent).toBe("function");
      expect(typeof service.isEventSavedByUser).toBe("function");
      expect(typeof service.getSavedEventsByUser).toBe("function");
      expect(typeof service.toggleRsvpEvent).toBe("function");
      expect(typeof service.getUserRsvpStatus).toBe("function");
      expect(typeof service.createDiscoveryRecord).toBe("function");
      expect(typeof service.getDiscoveredEventsByUser).toBe("function");
      expect(typeof service.getFriendsSavedEvents).toBe("function");
      expect(typeof service.getEventEngagement).toBe("function");
    });
  });

  describe("getEventEngagement", () => {
    it("should return comprehensive engagement metrics for an event", async () => {
      const eventWithMetrics = {
        ...mockEvent,
        saveCount: 15,
        scanCount: 42,
        updatedAt: new Date("2024-01-15T10:30:00Z"),
      };

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithMetrics,
      );

      (mockUserEventRsvpRepository.count as jest.Mock)
        .mockResolvedValueOnce(8) // Going count
        .mockResolvedValueOnce(3); // Not going count

      (mockUserEventViewRepository.count as jest.Mock).mockResolvedValue(3); // View count

      const result =
        await userEngagementService.getEventEngagement("event-123");

      expect(result).toEqual({
        eventId: "event-123",
        saveCount: 15,
        scanCount: 42,
        viewCount: 3,
        rsvpCount: 11, // 8 + 3
        goingCount: 8,
        notGoingCount: 3,
        totalEngagement: 71, // 15 + 42 + 3 + 11
        lastUpdated: new Date("2024-01-15T10:30:00Z"),
      });

      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: "event-123" },
      });

      expect(mockUserEventRsvpRepository.count).toHaveBeenCalledWith({
        where: { eventId: "event-123", status: RsvpStatus.GOING },
      });

      expect(mockUserEventRsvpRepository.count).toHaveBeenCalledWith({
        where: { eventId: "event-123", status: RsvpStatus.NOT_GOING },
      });

      expect(mockUserEventViewRepository.count).toHaveBeenCalledWith({
        where: { eventId: "event-123" },
      });
    });

    it("should handle event with zero engagement metrics", async () => {
      const eventWithZeroMetrics = {
        ...mockEvent,
        saveCount: 0,
        scanCount: 0,
        updatedAt: new Date("2024-01-15T10:30:00Z"),
      };

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithZeroMetrics,
      );

      (mockUserEventRsvpRepository.count as jest.Mock)
        .mockResolvedValueOnce(0) // Going count
        .mockResolvedValueOnce(0); // Not going count

      (mockUserEventViewRepository.count as jest.Mock).mockResolvedValue(0); // View count

      const result =
        await userEngagementService.getEventEngagement("event-123");

      expect(result).toEqual({
        eventId: "event-123",
        saveCount: 0,
        scanCount: 0,
        viewCount: 0,
        rsvpCount: 0,
        goingCount: 0,
        notGoingCount: 0,
        totalEngagement: 0,
        lastUpdated: new Date("2024-01-15T10:30:00Z"),
      });
    });

    it("should handle event with null/undefined metrics", async () => {
      const eventWithNullMetrics = {
        ...mockEvent,
        saveCount: null,
        scanCount: null,
        updatedAt: new Date("2024-01-15T10:30:00Z"),
      };

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithNullMetrics,
      );

      (mockUserEventRsvpRepository.count as jest.Mock)
        .mockResolvedValueOnce(0) // Going count
        .mockResolvedValueOnce(0); // Not going count

      (mockUserEventViewRepository.count as jest.Mock).mockResolvedValue(0); // View count

      const result =
        await userEngagementService.getEventEngagement("event-123");

      expect(result).toEqual({
        eventId: "event-123",
        saveCount: 0,
        scanCount: 0,
        viewCount: 0,
        rsvpCount: 0,
        goingCount: 0,
        notGoingCount: 0,
        totalEngagement: 0,
        lastUpdated: new Date("2024-01-15T10:30:00Z"),
      });
    });

    it("should throw error when event not found", async () => {
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        userEngagementService.getEventEngagement("nonexistent-event"),
      ).rejects.toThrow("Event not found");

      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: "nonexistent-event" },
      });

      // Should not call RSVP count methods if event doesn't exist
      expect(mockUserEventRsvpRepository.count).not.toHaveBeenCalled();
      expect(mockUserEventViewRepository.count).not.toHaveBeenCalled();
    });

    it("should handle high engagement numbers correctly", async () => {
      const eventWithHighMetrics = {
        ...mockEvent,
        saveCount: 1000,
        scanCount: 5000,
        updatedAt: new Date("2024-01-15T10:30:00Z"),
      };

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithHighMetrics,
      );

      (mockUserEventRsvpRepository.count as jest.Mock)
        .mockResolvedValueOnce(250) // Going count
        .mockResolvedValueOnce(50); // Not going count

      (mockUserEventViewRepository.count as jest.Mock).mockResolvedValue(100); // View count

      const result =
        await userEngagementService.getEventEngagement("event-123");

      expect(result).toEqual({
        eventId: "event-123",
        saveCount: 1000,
        scanCount: 5000,
        viewCount: 100,
        rsvpCount: 300, // 250 + 50
        goingCount: 250,
        notGoingCount: 50,
        totalEngagement: 6400, // 1000 + 5000 + 100 + 300
        lastUpdated: new Date("2024-01-15T10:30:00Z"),
      });
    });

    it("should handle database errors gracefully", async () => {
      (mockEventRepository.findOne as jest.Mock).mockRejectedValue(
        new Error("Database connection error"),
      );

      await expect(
        userEngagementService.getEventEngagement("event-123"),
      ).rejects.toThrow("Database connection error");
    });

    it("should handle RSVP count errors gracefully", async () => {
      const eventWithMetrics = {
        ...mockEvent,
        saveCount: 10,
        scanCount: 20,
        updatedAt: new Date("2024-01-15T10:30:00Z"),
      };

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithMetrics,
      );

      (mockUserEventRsvpRepository.count as jest.Mock).mockRejectedValue(
        new Error("RSVP count error"),
      );

      await expect(
        userEngagementService.getEventEngagement("event-123"),
      ).rejects.toThrow("RSVP count error");
    });

    it("should handle view count errors gracefully", async () => {
      const eventWithMetrics = {
        ...mockEvent,
        saveCount: 10,
        scanCount: 20,
        updatedAt: new Date("2024-01-15T10:30:00Z"),
      };

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        eventWithMetrics,
      );

      (mockUserEventRsvpRepository.count as jest.Mock)
        .mockResolvedValueOnce(5) // Going count
        .mockResolvedValueOnce(2); // Not going count

      (mockUserEventViewRepository.count as jest.Mock).mockRejectedValue(
        new Error("View count error"),
      );

      await expect(
        userEngagementService.getEventEngagement("event-123"),
      ).rejects.toThrow("View count error");
    });
  });

  describe("createViewRecord", () => {
    it("should create view record successfully", async () => {
      const updatedEvent = {
        ...mockEvent,
        viewCount: 11,
        categories: [mockCategory],
        creator: mockUser,
        shares: [],
        rsvps: [],
      };

      const updatedUser = {
        ...mockUser,
        viewCount: 1,
      };

      // Mock transaction
      (mockDataSource.transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockEntityManager);
        },
      );

      // Mock the insert query builder for view record
      const mockInsertQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };

      (mockEntityManager.createQueryBuilder as jest.Mock).mockReturnValue(
        mockInsertQueryBuilder,
      );

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser) // User
        .mockResolvedValueOnce(mockEvent); // Event

      (mockEntityManager.save as jest.Mock)
        .mockResolvedValueOnce(updatedUser) // Save updated user
        .mockResolvedValueOnce(updatedEvent); // Save updated event

      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(
        updatedEvent,
      );
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);

      await userEngagementService.createViewRecord("user-123", "event-123");

      expect(mockEntityManager.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(mockInsertQueryBuilder.insert).toHaveBeenCalled();
      expect(mockInsertQueryBuilder.into).toHaveBeenCalledWith(
        "user_event_views",
      );
      expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith({
        userId: "user-123",
        eventId: "event-123",
      });
      expect(mockInsertQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({
            id: "event-123",
            viewCount: 11,
          }),
          changeType: "VIEW_ADDED",
          userId: "user-123",
        },
      });
    });

    it("should handle errors gracefully and not throw", async () => {
      // Mock transaction to throw error
      (mockDataSource.transaction as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      // Should not throw
      await expect(
        userEngagementService.createViewRecord("user-123", "event-123"),
      ).resolves.toBeUndefined();
    });
  });
});
