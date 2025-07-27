import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { type Point } from "geojson";
import pgvector from "pgvector";

import {
  createEventLifecycleService,
  type EventLifecycleService,
  type EventLifecycleServiceDependencies,
} from "../EventLifecycleService";
import {
  Event,
  EventStatus,
  RecurrenceFrequency,
  DayOfWeek,
} from "@realtime-markers/database";
import { Event";
import { Category } from "@realtime-markers/database";
import { Category";
import { User, UserRole } from "@realtime-markers/database";
import { User";
import type { DataSource, Repository } from "typeorm";
import type { EventCacheService } from "../shared/EventCacheService";
import type { GoogleGeocodingService } from "../shared/GoogleGeocodingService";
import type { RedisService } from "../shared/RedisService";

describe("EventLifecycleService", () => {
  let eventLifecycleService: EventLifecycleService;
  let mockDataSource: DataSource;
  let mockEventRepository: Repository<Event>;
  let mockCategoryRepository: Repository<Category>;
  let mockEventCacheService: EventCacheService;
  let mockLocationService: GoogleGeocodingService;
  let mockRedisService: RedisService;

  // Test data
  const mockUser: User = {
    id: "user-123",
    email: "user@example.com",
    passwordHash: "hashed",
    role: UserRole.USER,
    isVerified: false,
    discoveryCount: 0,
    scanCount: 0,
    saveCount: 0,
    viewCount: 0,
    weeklyScanCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    discoveries: [],
    createdEvents: [],
    savedEvents: [],
    viewedEvents: [],
    rsvps: [],
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

  const mockCreateEventInput = {
    emoji: "🎵",
    emojiDescription: "Jazz Music",
    title: "Jazz Night",
    description: "Live jazz music performance",
    eventDate: new Date("2024-12-31T20:00:00Z"),
    endDate: new Date("2024-12-31T23:00:00Z"),
    location: { type: "Point", coordinates: [-111.6585, 40.2338] } as Point,
    categoryIds: ["category-123"],
    confidenceScore: 0.95,
    address: "123 Music St, Provo, UT",
    locationNotes: "Downtown venue",
    creatorId: "user-123",
    timezone: "America/Denver",
    embedding: [0.1, 0.2, 0.3],
    isPrivate: false,
    isRecurring: false,
  };

  beforeEach(() => {
    // Create mocks
    mockEventRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      findByIds: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<Event>;

    mockCategoryRepository = {
      findByIds: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<Category>;

    mockEventCacheService = {
      getEvent: jest.fn(),
      setEvent: jest.fn(),
      invalidateEvent: jest.fn(),
      invalidateSearchCache: jest.fn(),
      invalidateAllClusterHubs: jest.fn(),
    } as unknown as EventCacheService;

    mockLocationService = {
      getTimezoneFromCoordinates: jest.fn(),
    } as unknown as GoogleGeocodingService;

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
          default:
            throw new Error(`Unknown entity: ${entity.name}`);
        }
      }),
    } as unknown as DataSource;

    const dependencies: EventLifecycleServiceDependencies = {
      dataSource: mockDataSource,
      eventCacheService: mockEventCacheService,
      locationService: mockLocationService,
      redisService: mockRedisService,
    };

    eventLifecycleService = createEventLifecycleService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createEvent", () => {
    it("should create an event successfully", async () => {
      const createdEvent = { ...mockEvent };
      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockCategoryRepository.findByIds as jest.Mock).mockResolvedValue([
        mockCategory,
      ]);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result =
        await eventLifecycleService.createEvent(mockCreateEventInput);

      expect(result).toEqual(createdEvent);
      expect(mockEventRepository.create).toHaveBeenCalledWith({
        emoji: mockCreateEventInput.emoji,
        emojiDescription: mockCreateEventInput.emojiDescription,
        title: mockCreateEventInput.title,
        description: mockCreateEventInput.description,
        confidenceScore: mockCreateEventInput.confidenceScore,
        eventDate: mockCreateEventInput.eventDate,
        endDate: mockCreateEventInput.endDate,
        location: mockCreateEventInput.location,
        status: EventStatus.PENDING,
        address: mockCreateEventInput.address,
        locationNotes: mockCreateEventInput.locationNotes,
        embedding: pgvector.toSql(mockCreateEventInput.embedding),
        creatorId: mockCreateEventInput.creatorId,
        timezone: mockCreateEventInput.timezone,
        qrDetectedInImage: false,
        detectedQrData: undefined,
        originalImageUrl: undefined,
        isPrivate: mockCreateEventInput.isPrivate,
        isRecurring: mockCreateEventInput.isRecurring,
        recurrenceFrequency: undefined,
        recurrenceDays: undefined,
        recurrenceTime: undefined,
        recurrenceStartDate: undefined,
        recurrenceEndDate: undefined,
        recurrenceInterval: undefined,
      });
      expect(mockEventRepository.save).toHaveBeenCalledWith(createdEvent);
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "CREATE",
        data: {
          operation: "CREATE",
          record: expect.objectContaining({ id: createdEvent.id }),
          changeType: "EVENT_CREATED",
          userId: "user-123",
        },
      });
      expect(mockEventCacheService.invalidateSearchCache).toHaveBeenCalled();
    });

    it("should determine timezone from coordinates when not provided", async () => {
      const inputWithoutTimezone = {
        ...mockCreateEventInput,
        timezone: undefined,
      };
      const createdEvent = { ...mockEvent };

      (
        mockLocationService.getTimezoneFromCoordinates as jest.Mock
      ).mockResolvedValue("America/Denver");
      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockCategoryRepository.findByIds as jest.Mock).mockResolvedValue([
        mockCategory,
      ]);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      await eventLifecycleService.createEvent(inputWithoutTimezone);

      expect(
        mockLocationService.getTimezoneFromCoordinates,
      ).toHaveBeenCalledWith(40.2338, -111.6585);
      expect(mockEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: "America/Denver" }),
      );
    });

    it("should use UTC timezone when timezone determination fails", async () => {
      const inputWithoutTimezone = {
        ...mockCreateEventInput,
        timezone: undefined,
      };
      const createdEvent = { ...mockEvent };

      (
        mockLocationService.getTimezoneFromCoordinates as jest.Mock
      ).mockRejectedValue(new Error("API Error"));
      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockCategoryRepository.findByIds as jest.Mock).mockResolvedValue([
        mockCategory,
      ]);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      await eventLifecycleService.createEvent(inputWithoutTimezone);

      expect(mockEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: "UTC" }),
      );
    });

    it("should handle recurring events", async () => {
      const recurringInput = {
        ...mockCreateEventInput,
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceDays: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
        recurrenceTime: "20:00",
        recurrenceStartDate: new Date("2024-01-01"),
        recurrenceEndDate: new Date("2024-12-31"),
        recurrenceInterval: 1,
      };
      const createdEvent = {
        ...mockEvent,
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceDays: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
        recurrenceTime: "20:00",
        recurrenceStartDate: new Date("2024-01-01"),
        recurrenceEndDate: new Date("2024-12-31"),
        recurrenceInterval: 1,
      };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockCategoryRepository.findByIds as jest.Mock).mockResolvedValue([
        mockCategory,
      ]);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(recurringInput);

      expect(result).toEqual(createdEvent);
      expect(mockEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecurring: true,
          recurrenceFrequency: RecurrenceFrequency.WEEKLY,
          recurrenceDays: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
          recurrenceTime: "20:00",
          recurrenceStartDate: new Date("2024-01-01"),
          recurrenceEndDate: new Date("2024-12-31"),
          recurrenceInterval: 1,
        }),
      );
    });

    it("should handle private events with sharing", async () => {
      const privateInput = {
        ...mockCreateEventInput,
        isPrivate: true,
        sharedWithIds: ["user-456", "user-789"],
      };
      const createdEvent = {
        ...mockEvent,
        isPrivate: true,
        sharedWithIds: ["user-456", "user-789"],
      };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockCategoryRepository.findByIds as jest.Mock).mockResolvedValue([
        mockCategory,
      ]);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(privateInput);

      expect(result).toEqual(createdEvent);
      expect(mockEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPrivate: true }),
      );
    });

    it("should handle empty category IDs array", async () => {
      const inputWithEmptyCategories = {
        ...mockCreateEventInput,
        categoryIds: [],
      };
      const createdEvent = { ...mockEvent, categories: [] };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(
        inputWithEmptyCategories,
      );

      expect(result).toEqual(createdEvent);
      expect(mockCategoryRepository.findByIds).not.toHaveBeenCalled();
    });

    it("should handle optional fields properly", async () => {
      const minimalInput = {
        emoji: "🎵",
        title: "Minimal Event",
        eventDate: new Date(),
        location: { type: "Point", coordinates: [0, 0] } as Point,
        creatorId: "user-123",
        embedding: [0.1, 0.2, 0.3],
      };
      const createdEvent = {
        ...mockEvent,
        emoji: "🎵",
        title: "Minimal Event",
        eventDate: new Date(),
        location: { type: "Point", coordinates: [0, 0] } as Point,
        creatorId: "user-123",
      };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(minimalInput);

      expect(result).toEqual(createdEvent);
      expect(mockEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          emoji: "🎵",
          title: "Minimal Event",
          description: undefined,
          endDate: undefined,
          confidenceScore: undefined,
          address: undefined,
          locationNotes: "",
          timezone: "UTC",
          qrDetectedInImage: false,
          detectedQrData: undefined,
          originalImageUrl: undefined,
          isPrivate: false,
          isRecurring: false,
          recurrenceFrequency: undefined,
          recurrenceDays: undefined,
          recurrenceTime: undefined,
          recurrenceStartDate: undefined,
          recurrenceEndDate: undefined,
          recurrenceInterval: undefined,
        }),
      );
    });
  });

  describe("getEventById", () => {
    it("should return cached event when available", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );

      const result = await eventLifecycleService.getEventById("event-123");

      expect(result).toEqual(mockEvent);
      expect(mockEventCacheService.getEvent).toHaveBeenCalledWith("event-123");
      expect(mockEventRepository.findOne).not.toHaveBeenCalled();
    });

    it("should fetch from database when not cached", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(null);
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(mockEvent);
      (mockEventCacheService.setEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await eventLifecycleService.getEventById("event-123");

      expect(result).toEqual(mockEvent);
      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: "event-123" },
        relations: ["categories", "creator", "shares", "shares.sharedWith"],
      });
      expect(mockEventCacheService.setEvent).toHaveBeenCalledWith(
        mockEvent,
        300,
      );
    });

    it("should return null when event not found", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(null);
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await eventLifecycleService.getEventById("nonexistent");

      expect(result).toBeNull();
      expect(mockEventCacheService.setEvent).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(null);
      (mockEventRepository.findOne as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await eventLifecycleService.getEventById("event-123");

      expect(result).toBeNull();
    });
  });

  describe("updateEvent", () => {
    it("should update an event successfully", async () => {
      const updatedEvent = { ...mockEvent, title: "Updated Jazz Night" };
      const updateData = { title: "Updated Jazz Night" };

      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockEventRepository.save as jest.Mock).mockResolvedValue(updatedEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventCacheService.invalidateEvent as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateAllClusterHubs as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.updateEvent(
        "event-123",
        updateData,
      );

      expect(result).toEqual(updatedEvent);
      expect(mockEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated Jazz Night" }),
      );
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({ id: "event-123" }),
          previousRecord: expect.objectContaining({ id: "event-123" }),
          changeType: "EVENT_UPDATED",
          userId: "user-123",
        },
      });
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        "event-123",
      );
      expect(mockEventCacheService.invalidateSearchCache).toHaveBeenCalled();
      expect(mockEventCacheService.invalidateAllClusterHubs).toHaveBeenCalled();
    });

    it("should return null when event not found", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(null);
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await eventLifecycleService.updateEvent("nonexistent", {
        title: "New Title",
      });

      expect(result).toBeNull();
    });

    it("should return null when event has no creator ID", async () => {
      const eventWithoutCreator = { ...mockEvent, creatorId: undefined };
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        eventWithoutCreator,
      );

      const result = await eventLifecycleService.updateEvent("event-123", {
        title: "New Title",
      });

      expect(result).toBeNull();
    });

    it("should determine timezone when location changes", async () => {
      const newLocation = {
        type: "Point",
        coordinates: [-122.4194, 37.7749],
      } as Point;
      const updateData = { location: newLocation };
      const updatedEvent = {
        ...mockEvent,
        location: newLocation,
        timezone: "America/Los_Angeles",
      };

      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (
        mockLocationService.getTimezoneFromCoordinates as jest.Mock
      ).mockResolvedValue("America/Los_Angeles");
      (mockEventRepository.save as jest.Mock).mockResolvedValue(updatedEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventCacheService.invalidateEvent as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateAllClusterHubs as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.updateEvent(
        "event-123",
        updateData,
      );

      expect(result).toEqual(updatedEvent);
      expect(
        mockLocationService.getTimezoneFromCoordinates,
      ).toHaveBeenCalledWith(37.7749, -122.4194);
      expect(mockEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: "America/Los_Angeles" }),
      );
    });

    it("should handle category updates", async () => {
      const newCategories = [
        { ...mockCategory, id: "category-456", name: "Rock" },
      ];
      const updateData = { categoryIds: ["category-456"] };
      const updatedEvent = { ...mockEvent, categories: newCategories };

      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue(
        newCategories,
      );
      (mockEventRepository.save as jest.Mock).mockResolvedValue(updatedEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventCacheService.invalidateEvent as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateAllClusterHubs as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.updateEvent(
        "event-123",
        updateData,
      );

      expect(result).toEqual(updatedEvent);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({
        where: { id: expect.any(Object) },
      });
    });

    it("should throw error when ID is missing", async () => {
      await expect(
        eventLifecycleService.updateEvent("", { title: "New Title" }),
      ).rejects.toThrow("Event ID is required for update");
    });
  });

  describe("deleteEvent", () => {
    it("should delete an event successfully", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockEventRepository.delete as jest.Mock).mockResolvedValue({
        affected: 1,
      });
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventCacheService.invalidateEvent as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateAllClusterHubs as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.deleteEvent("event-123");

      expect(result).toBe(true);
      expect(mockEventRepository.delete).toHaveBeenCalledWith("event-123");
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: expect.objectContaining({ id: "event-123" }),
          changeType: "EVENT_DELETED",
          userId: "user-123",
        },
      });
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        "event-123",
      );
      expect(mockEventCacheService.invalidateSearchCache).toHaveBeenCalled();
      expect(mockEventCacheService.invalidateAllClusterHubs).toHaveBeenCalled();
    });

    it("should return false when event not found", async () => {
      (mockEventRepository.delete as jest.Mock).mockResolvedValue({
        affected: 0,
      });

      const result = await eventLifecycleService.deleteEvent("nonexistent");

      expect(result).toBe(false);
      expect(mockRedisService.publish).not.toHaveBeenCalled();
    });

    it("should handle deletion errors", async () => {
      (mockEventRepository.delete as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        eventLifecycleService.deleteEvent("event-123"),
      ).rejects.toThrow("Database error");
    });
  });

  describe("updateEventStatus", () => {
    it("should update event status successfully", async () => {
      const updatedEvent = { ...mockEvent, status: EventStatus.VERIFIED };

      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockEventRepository.save as jest.Mock).mockResolvedValue(updatedEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventCacheService.invalidateEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await eventLifecycleService.updateEventStatus(
        "event-123",
        EventStatus.VERIFIED,
      );

      expect(result).toEqual(updatedEvent);
      expect(mockEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EventStatus.VERIFIED }),
      );
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({ id: "event-123" }),
          previousStatus: EventStatus.PENDING,
          changeType: "STATUS_CHANGED",
          userId: "user-123",
        },
      });
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        "event-123",
      );
    });

    it("should return null when event not found", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(null);
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await eventLifecycleService.updateEventStatus(
        "nonexistent",
        EventStatus.VERIFIED,
      );

      expect(result).toBeNull();
    });

    it("should handle status update errors", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockEventRepository.save as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        eventLifecycleService.updateEventStatus(
          "event-123",
          EventStatus.VERIFIED,
        ),
      ).rejects.toThrow("Database error");
    });
  });

  describe("storeDetectedQRCode", () => {
    it("should store QR code data successfully", async () => {
      const qrCodeData = "https://example.com/event-123";
      const updatedEvent = {
        ...mockEvent,
        qrCodeData,
        hasQrCode: true,
        qrDetectedInImage: true,
        detectedQrData: qrCodeData,
        qrGeneratedAt: expect.any(Date),
      };

      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockEventRepository.save as jest.Mock).mockResolvedValue(updatedEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventCacheService.invalidateEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await eventLifecycleService.storeDetectedQRCode(
        "event-123",
        qrCodeData,
      );

      expect(result).toEqual(updatedEvent);
      expect(mockEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          qrCodeData,
          hasQrCode: true,
          qrDetectedInImage: true,
          detectedQrData: qrCodeData,
          qrGeneratedAt: expect.any(Date),
        }),
      );
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "UPDATE",
        data: {
          operation: "UPDATE",
          record: expect.objectContaining({ id: "event-123" }),
          changeType: "QR_CODE_DETECTED",
          userId: "user-123",
        },
      });
      expect(mockEventCacheService.invalidateEvent).toHaveBeenCalledWith(
        "event-123",
      );
    });

    it("should throw error when event not found", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(null);
      (mockEventRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        eventLifecycleService.storeDetectedQRCode("nonexistent", "qr-data"),
      ).rejects.toThrow("Event nonexistent not found");
    });

    it("should handle QR code storage errors", async () => {
      (mockEventCacheService.getEvent as jest.Mock).mockResolvedValue(
        mockEvent,
      );
      (mockEventRepository.save as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        eventLifecycleService.storeDetectedQRCode("event-123", "qr-data"),
      ).rejects.toThrow("Database error");
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle missing category IDs gracefully", async () => {
      const inputWithoutCategories = {
        ...mockCreateEventInput,
        categoryIds: undefined,
      };
      const createdEvent = { ...mockEvent, categories: [] };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(
        inputWithoutCategories,
      );

      expect(result).toEqual(createdEvent);
      expect(mockCategoryRepository.findByIds).not.toHaveBeenCalled();
    });

    it("should handle empty category IDs array", async () => {
      const inputWithEmptyCategories = {
        ...mockCreateEventInput,
        categoryIds: [],
      };
      const createdEvent = { ...mockEvent, categories: [] };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(
        inputWithEmptyCategories,
      );

      expect(result).toEqual(createdEvent);
      expect(mockCategoryRepository.findByIds).not.toHaveBeenCalled();
    });

    it("should handle optional fields properly", async () => {
      const minimalInput = {
        emoji: "🎵",
        title: "Minimal Event",
        eventDate: new Date(),
        location: { type: "Point", coordinates: [0, 0] } as Point,
        creatorId: "user-123",
        embedding: [0.1, 0.2, 0.3],
      };
      const createdEvent = {
        ...mockEvent,
        emoji: "🎵",
        title: "Minimal Event",
        eventDate: new Date(),
        location: { type: "Point", coordinates: [0, 0] } as Point,
        creatorId: "user-123",
      };

      (mockEventRepository.create as jest.Mock).mockReturnValue(createdEvent);
      (mockEventRepository.save as jest.Mock).mockResolvedValue(createdEvent);
      (mockRedisService.publish as jest.Mock).mockResolvedValue(undefined);
      (
        mockEventCacheService.invalidateSearchCache as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await eventLifecycleService.createEvent(minimalInput);

      expect(result).toEqual(createdEvent);
      expect(mockEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          emoji: "🎵",
          title: "Minimal Event",
          description: undefined,
          endDate: undefined,
          confidenceScore: undefined,
          address: undefined,
          locationNotes: "",
          timezone: "UTC",
          qrDetectedInImage: false,
          detectedQrData: undefined,
          originalImageUrl: undefined,
          isPrivate: false,
          isRecurring: false,
          recurrenceFrequency: undefined,
          recurrenceDays: undefined,
          recurrenceTime: undefined,
          recurrenceStartDate: undefined,
          recurrenceEndDate: undefined,
          recurrenceInterval: undefined,
        }),
      );
    });
  });
});
