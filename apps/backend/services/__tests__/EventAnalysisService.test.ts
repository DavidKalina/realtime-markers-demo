import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";

import {
  createEventAnalysisService,
  type EventAnalysisService,
  type EventAnalysisServiceDependencies,
} from "../EventAnalysisService";
import { Event, EventStatus } from "../../entities/Event";
import { Category } from "../../entities/Category";
import { User, UserRole, PlanType } from "../../entities/User";
import type { DataSource, Repository } from "typeorm";
import type { EventCacheService } from "../shared/EventCacheService";
import type { OpenAIService } from "../shared/OpenAIService";
import type { Point } from "geojson";

describe("EventAnalysisService", () => {
  let eventAnalysisService: EventAnalysisService;
  let mockDataSource: DataSource;
  let mockEventRepository: Repository<Event>;
  let mockCategoryRepository: Repository<Category>;
  let mockUserRepository: Repository<User>;
  let mockEventCacheService: EventCacheService;
  let mockOpenAIService: OpenAIService;

  // Test data
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    displayName: "Test User",
    currentTitle: "Event Creator",
    friendCode: "FRIEND123",
    passwordHash: "hashed",
    role: UserRole.USER,
    planType: PlanType.FREE,
    isVerified: false,
    discoveryCount: 0,
    scanCount: 0,
    saveCount: 0,
    weeklyScanCount: 0,
    totalXp: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    title: "Jazz Night",
    description: "Live jazz music performance",
    eventDate: new Date("2024-12-31T20:00:00Z"),
    address: "123 Music St, Provo, UT",
    locationNotes: "Downtown venue",
    emojiDescription: "🎷 Jazz",
    scanCount: 10,
    saveCount: 5,
    status: EventStatus.VERIFIED,
    location: { type: "Point", coordinates: [-111.6585, 40.2338] } as Point,
    creator: mockUser,
    categories: [mockCategory],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Event;

  const mockEvent2: Event = {
    id: "event-456",
    title: "Rock Concert",
    description: "Rock band performance",
    eventDate: new Date("2024-12-30T19:00:00Z"),
    address: "456 Rock Ave, Provo, UT",
    locationNotes: "Concert hall",
    emojiDescription: "🎸 Rock",
    scanCount: 15,
    saveCount: 8,
    status: EventStatus.VERIFIED,
    location: { type: "Point", coordinates: [-111.6585, 40.2338] } as Point,
    creator: mockUser,
    categories: [mockCategory],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Event;

  const mockEvent3: Event = {
    id: "event-789",
    title: "Classical Music",
    description: "Symphony orchestra",
    eventDate: new Date("2024-12-29T18:00:00Z"),
    address: "789 Classical Blvd, Salt Lake City, UT",
    locationNotes: "Concert hall",
    emojiDescription: "🎻 Classical",
    scanCount: 20,
    saveCount: 12,
    status: EventStatus.VERIFIED,
    location: { type: "Point", coordinates: [-111.891, 40.7608] } as Point,
    creator: mockUser,
    categories: [mockCategory],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Event;

  beforeEach(() => {
    // Create mocks
    mockEventRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<Event>;

    mockCategoryRepository = {
      find: jest.fn(),
    } as unknown as Repository<Category>;

    mockUserRepository = {
      find: jest.fn(),
    } as unknown as Repository<User>;

    mockEventCacheService = {
      getClusterHub: jest.fn(),
      setClusterHub: jest.fn(),
    } as unknown as EventCacheService;

    mockOpenAIService = {
      executeChatCompletion: jest.fn(),
    } as unknown as OpenAIService;

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        switch (entity) {
          case Event:
            return mockEventRepository;
          case Category:
            return mockCategoryRepository;
          case User:
            return mockUserRepository;
          default:
            throw new Error(`Unknown entity: ${entity.name}`);
        }
      }),
    } as unknown as DataSource;

    const dependencies: EventAnalysisServiceDependencies = {
      dataSource: mockDataSource,
      eventCacheService: mockEventCacheService,
      openaiService: mockOpenAIService,
    };

    eventAnalysisService = createEventAnalysisService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getClusterHubData", () => {
    it("should return cached data when available", async () => {
      const cachedData = {
        featuredEvent: mockEvent,
        eventsByCategory: [{ category: mockCategory, events: [mockEvent] }],
        eventsByLocation: [{ location: "Provo, UT", events: [mockEvent] }],
        eventsToday: [],
        clusterName: "Music Hub",
        clusterDescription: "A vibrant music scene",
        clusterEmoji: "🎵",
        featuredCreator: {
          id: mockUser.id,
          displayName: mockUser.displayName!,
          email: mockUser.email,
          eventCount: 1,
          creatorDescription: "Music enthusiast",
          title: mockUser.currentTitle!,
          friendCode: mockUser.friendCode!,
        },
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        cachedData,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
        "event-456",
      ]);

      expect(result).toEqual(cachedData);
      expect(mockEventCacheService.getClusterHub).toHaveBeenCalledWith([
        "event-123",
        "event-456",
      ]);
    });

    it("should return empty data when no events found", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "nonexistent-event",
      ]);

      expect(result).toEqual({
        featuredEvent: null,
        eventsByCategory: [],
        eventsByLocation: [],
        eventsToday: [],
        clusterName: "",
        clusterDescription: "",
        clusterEmoji: "🎉",
      });
    });

    it("should generate cluster data when cache miss", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([mockEvent, mockEvent2, mockEvent3]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Hotspot",
                description: "A vibrant music scene with diverse performances",
                emoji: "🎵",
                creatorDescription: "A passionate music creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
        "event-456",
        "event-789",
      ]);

      expect(result.clusterName).toBe("Music Hotspot");
      expect(result.clusterDescription).toBe(
        "A vibrant music scene with diverse performances",
      );
      expect(result.clusterEmoji).toBe("🎵");
      expect(result.featuredEvent).toBeDefined();
      expect(result.eventsByCategory).toHaveLength(1);
      expect(result.eventsByLocation).toHaveLength(2);
      expect(result.featuredCreator).toBeDefined();
      expect(result.featuredCreator!.id).toBe(mockUser.id);
      expect(result.featuredCreator!.eventCount).toBe(3);
      expect(result.featuredCreator!.displayName).toBe(mockUser.displayName!);
      expect(result.featuredCreator!.email).toBe(mockUser.email);
      expect(mockEventCacheService.setClusterHub).toHaveBeenCalled();
    });

    it("should handle OpenAI service errors gracefully", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockRejectedValue(
        new Error("OpenAI API error"),
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
      ]);

      expect(result.clusterName).toBe("Jazz Night");
      expect(result.clusterDescription).toBe("Live jazz music performance");
      expect(result.clusterEmoji).toBe("🎉");
      expect(result.featuredEvent).toBeDefined();
    });

    it("should handle malformed OpenAI response", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEvent]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: "invalid json",
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
      ]);

      expect(result.clusterName).toBe("Jazz Night");
      expect(result.clusterDescription).toBe("Live jazz music performance");
      expect(result.clusterEmoji).toBe("🎉");
    });

    it("should identify featured creator correctly", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([mockEvent, mockEvent2, mockEvent3]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Hotspot",
                description: "A vibrant music scene",
                emoji: "🎵",
                creatorDescription: "A passionate music creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
        "event-456",
        "event-789",
      ]);

      expect(result.featuredCreator).toBeDefined();
      expect(result.featuredCreator!.id).toBe(mockUser.id);
      expect(result.featuredCreator!.eventCount).toBe(3);
      expect(result.featuredCreator!.displayName).toBe(mockUser.displayName!);
      expect(result.featuredCreator!.email).toBe(mockUser.email);
    });

    it("should group events by category correctly", async () => {
      const differentCategory: Category = {
        id: "category-456",
        name: "Sports",
        description: "Sports events",
        icon: "⚽",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Category;

      const eventWithDifferentCategory: Event = {
        ...mockEvent2,
        id: "event-999",
        categories: [differentCategory],
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            mockEvent,
            mockEvent2,
            eventWithDifferentCategory,
          ]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Mixed Events",
                description: "Various events",
                emoji: "🎯",
                creatorDescription: "Event creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
        "event-456",
        "event-999",
      ]);

      expect(result.eventsByCategory).toHaveLength(2);
      expect(result.eventsByCategory[0].category.name).toBe("Music");
      expect(result.eventsByCategory[0].events).toHaveLength(2);
      expect(result.eventsByCategory[1].category.name).toBe("Sports");
      expect(result.eventsByCategory[1].events).toHaveLength(1);
    });

    it("should group events by location correctly", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([mockEvent, mockEvent2, mockEvent3]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Hotspot",
                description: "A vibrant music scene",
                emoji: "🎵",
                creatorDescription: "A passionate music creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
        "event-456",
        "event-789",
      ]);

      expect(result.eventsByLocation).toHaveLength(2);
      expect(result.eventsByLocation[0].location).toBe("Provo, UT");
      expect(result.eventsByLocation[0].events).toHaveLength(2);
      expect(result.eventsByLocation[1].location).toBe("Salt Lake City, UT");
      expect(result.eventsByLocation[1].events).toHaveLength(1);
    });

    it("should identify events happening today", async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const eventToday: Event = {
        ...mockEvent,
        id: "event-today",
        eventDate: today,
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([eventToday, mockEvent2]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Today's Events",
                description: "Events happening today",
                emoji: "📅",
                creatorDescription: "Event creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-today",
        "event-456",
      ]);

      expect(result.eventsToday).toHaveLength(1);
      expect(result.eventsToday[0].id).toBe("event-today");
    });

    it("should select oldest event as featured event", async () => {
      const olderEvent: Event = {
        ...mockEvent,
        id: "event-older",
        eventDate: new Date("2024-12-28T18:00:00Z"),
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([mockEvent, mockEvent2, olderEvent]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Events",
                description: "Various music events",
                emoji: "🎵",
                creatorDescription: "Event creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-123",
        "event-456",
        "event-older",
      ]);

      expect(result.featuredEvent!.id).toBe("event-older");
    });

    it("should handle events without creators", async () => {
      const eventWithoutCreator: Event = {
        ...mockEvent,
        id: "event-no-creator",
        creator: undefined,
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([eventWithoutCreator]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Event",
                description: "A music event",
                emoji: "🎵",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-no-creator",
      ]);

      expect(result.featuredCreator).toBeUndefined();
      expect(result.clusterName).toBe("Music Event");
    });

    it("should handle events without categories", async () => {
      const eventWithoutCategories: Event = {
        ...mockEvent,
        id: "event-no-categories",
        categories: [],
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([eventWithoutCategories]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "General Event",
                description: "A general event",
                emoji: "🎉",
                creatorDescription: "Event creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-no-categories",
      ]);

      expect(result.eventsByCategory).toHaveLength(0);
    });

    it("should handle events without addresses", async () => {
      const eventWithoutAddress: Event = {
        ...mockEvent,
        id: "event-no-address",
        address: undefined,
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([eventWithoutAddress]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Event",
                description: "A music event",
                emoji: "🎵",
                creatorDescription: "Event creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-no-address",
      ]);

      expect(result.eventsByLocation).toHaveLength(0);
    });

    it("should handle events with malformed addresses", async () => {
      const eventWithMalformedAddress: Event = {
        ...mockEvent,
        id: "event-malformed-address",
        address: "Invalid address format",
      } as Event;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([eventWithMalformedAddress]),
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Music Event",
                description: "A music event",
                emoji: "🎵",
                creatorDescription: "Event creator",
              }),
            },
          },
        ],
      };

      (mockEventCacheService.getClusterHub as jest.Mock).mockResolvedValue(
        null,
      );
      (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        mockOpenAIResponse,
      );

      const result = await eventAnalysisService.getClusterHubData([
        "event-malformed-address",
      ]);

      expect(result.eventsByLocation).toHaveLength(0);
    });
  });

  describe("createEventAnalysisService", () => {
    it("should create an EventAnalysisService instance", () => {
      const dependencies: EventAnalysisServiceDependencies = {
        dataSource: mockDataSource,
        eventCacheService: mockEventCacheService,
        openaiService: mockOpenAIService,
      };

      const service = createEventAnalysisService(dependencies);

      expect(service).toBeDefined();
      expect(typeof service.getClusterHubData).toBe("function");
    });
  });
});
