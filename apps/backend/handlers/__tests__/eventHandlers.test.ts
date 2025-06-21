import { describe, it, expect, beforeEach, jest } from "bun:test";
import { trackEventViewHandler } from "../eventHandlers";
import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import type { EventService } from "../../services/EventServiceRefactored";
import { createEventHandler } from "../eventHandlers";
import type { StorageService } from "../../services/shared/StorageService";
import type { IEmbeddingService } from "../../services/event-processing/interfaces/IEmbeddingService";
import type { RedisService } from "../../services/shared/RedisService";
import type { CategoryProcessingService } from "../../services/CategoryProcessingService";

describe("trackEventViewHandler", () => {
  let mockContext: Context<AppContext>;
  let mockEventService: Partial<EventService>;
  let mockUser: { id: string };

  beforeEach(() => {
    mockEventService = {
      getEventById: jest.fn() as jest.Mock,
      createViewRecord: jest.fn() as jest.Mock,
    };
    mockUser = { id: "user-456" };
    mockContext = {
      req: {
        param: jest.fn(),
      },
      get: jest.fn(),
      json: jest.fn(),
    } as unknown as Context<AppContext>;
  });

  it("should track event view successfully", async () => {
    const eventId = "event-123";
    const mockEvent = { id: eventId, title: "Test Event" };
    (mockContext.req.param as jest.Mock).mockReturnValue(eventId);
    (mockContext.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "user") return mockUser;
      if (key === "eventService") return mockEventService;
      return undefined;
    });
    (mockEventService.getEventById as jest.Mock).mockResolvedValue(mockEvent);
    (mockEventService.createViewRecord as jest.Mock).mockResolvedValue(
      undefined,
    );
    await trackEventViewHandler(mockContext);
    expect(mockContext.get).toHaveBeenCalledWith("user");
    expect(mockContext.get).toHaveBeenCalledWith("eventService");
    expect(mockEventService.getEventById).toHaveBeenCalledWith(eventId);
    expect(mockEventService.createViewRecord).toHaveBeenCalledWith(
      mockUser.id,
      eventId,
    );
    expect(mockContext.json).toHaveBeenCalledWith({
      success: true,
      message: "Event view tracked successfully",
    });
  });

  it("should return error when user is not authenticated", async () => {
    const eventId = "event-123";
    (mockContext.req.param as jest.Mock).mockReturnValue(eventId);
    (mockContext.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "user") return null;
      if (key === "eventService") return mockEventService;
      return undefined;
    });
    await trackEventViewHandler(mockContext);
    expect(mockContext.json).toHaveBeenCalledWith(
      { error: "Authentication required" },
      401,
    );
  });

  it("should return error when event ID is missing", async () => {
    (mockContext.req.param as jest.Mock).mockReturnValue(null);
    (mockContext.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "user") return mockUser;
      if (key === "eventService") return mockEventService;
      return undefined;
    });
    await trackEventViewHandler(mockContext);
    expect(mockContext.json).toHaveBeenCalledWith(
      { error: "Missing required parameter: id" },
      400,
    );
  });

  it("should return error when event not found", async () => {
    const eventId = "event-123";
    (mockContext.req.param as jest.Mock).mockReturnValue(eventId);
    (mockContext.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "user") return mockUser;
      if (key === "eventService") return mockEventService;
      return undefined;
    });
    (mockEventService.getEventById as jest.Mock).mockResolvedValue(null);
    await trackEventViewHandler(mockContext);
    expect(mockContext.json).toHaveBeenCalledWith(
      { error: "Event not found" },
      404,
    );
  });
});

describe("createEventHandler", () => {
  let mockContext: Context<AppContext>;
  let mockEventService: Partial<EventService>;
  let mockStorageService: Partial<StorageService>;
  let mockIEmbeddingService: Partial<IEmbeddingService>;
  let mockRedisService: Partial<RedisService>;
  let mockCategoryProcessingService: Partial<CategoryProcessingService>;
  let mockUser: { id: string; userId: string };

  beforeEach(() => {
    mockEventService = {
      createEvent: jest.fn() as jest.Mock,
      createDiscoveryRecord: jest.fn() as jest.Mock,
    };
    mockStorageService = {
      uploadImage: jest.fn() as jest.Mock,
    };
    mockIEmbeddingService = {
      getEmbedding: jest.fn() as jest.Mock,
    };
    mockRedisService = {
      publish: jest.fn() as jest.Mock,
    };
    mockCategoryProcessingService = {
      extractAndProcessCategories: jest.fn().mockResolvedValue([]),
    };
    mockUser = { id: "user-123", userId: "user-123" };
    mockContext = {
      req: {
        header: jest.fn(),
        formData: jest.fn(),
        json: jest.fn(),
      },
      get: jest.fn(),
      json: jest.fn(),
    } as unknown as Context<AppContext>;
  });

  it("should create event with image upload", async () => {
    const mockFile = {
      name: "test-image.jpg",
      type: "image/jpeg",
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
    };
    const mockFormData = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "image":
            return mockFile;
          case "title":
            return "Test Event";
          case "description":
            return "Test Description";
          case "eventDate":
            return "2024-01-01T10:00:00Z";
          case "emoji":
            return "📍";
          case "address":
            return "Test Address";
          case "lat":
            return "40.7128";
          case "lng":
            return "-74.0060";
          default:
            return null;
        }
      }),
      keys: jest
        .fn()
        .mockReturnValue(
          [
            "image",
            "title",
            "description",
            "eventDate",
            "emoji",
            "address",
            "lat",
            "lng",
          ][Symbol.iterator](),
        ),
    };
    const mockEvent = { id: "event-123", title: "Test Event" };
    (mockContext.req.header as jest.Mock).mockReturnValue(
      "multipart/form-data",
    );
    (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);
    (mockContext.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "eventService") return mockEventService;
      if (key === "embeddingService") return mockIEmbeddingService;
      if (key === "redisClient") return mockRedisService;
      if (key === "storageService") return mockStorageService;
      if (key === "user") return mockUser;
      if (key === "categoryProcessingService")
        return mockCategoryProcessingService;
      return undefined;
    });
    (mockStorageService.uploadImage as jest.Mock).mockResolvedValue(
      "https://example.com/image.jpg",
    );
    (mockIEmbeddingService.getEmbedding as jest.Mock).mockResolvedValue([
      0.1, 0.2, 0.3,
    ]);
    (mockEventService.createEvent as jest.Mock).mockResolvedValue(mockEvent);
    (mockEventService.createDiscoveryRecord as jest.Mock).mockResolvedValue(
      undefined,
    );
    await createEventHandler(mockContext);
    expect(mockStorageService.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      "event-images",
      expect.objectContaining({
        filename: "test-image.jpg",
        contentType: "image/jpeg",
      }),
    );
    expect(mockEventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Event",
        originalImageUrl: "https://example.com/image.jpg",
        emoji: "📍",
        description: "Test Description",
        address: "Test Address",
        location: {
          type: "Point",
          coordinates: [40.7128, -74.006],
        },
        creatorId: "user-123",
        embedding: [0.1, 0.2, 0.3],
      }),
    );
  });

  it("should create event without image upload (JSON)", async () => {
    const eventData = {
      title: "Test Event",
      eventDate: "2024-01-01T10:00:00Z",
      location: { type: "Point", coordinates: [40.7128, -74.006] },
    };
    const mockEvent = { id: "event-123", title: "Test Event" };
    (mockContext.req.header as jest.Mock).mockReturnValue("application/json");
    (mockContext.req.json as jest.Mock).mockResolvedValue(eventData);
    (mockContext.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "eventService") return mockEventService;
      if (key === "embeddingService") return mockIEmbeddingService;
      if (key === "redisClient") return mockRedisService;
      if (key === "storageService") return mockStorageService;
      if (key === "user") return mockUser;
      if (key === "categoryProcessingService")
        return mockCategoryProcessingService;
      return undefined;
    });
    (mockIEmbeddingService.getEmbedding as jest.Mock).mockResolvedValue([
      0.1, 0.2, 0.3,
    ]);
    (mockEventService.createEvent as jest.Mock).mockResolvedValue(mockEvent);
    (mockEventService.createDiscoveryRecord as jest.Mock).mockResolvedValue(
      undefined,
    );
    await createEventHandler(mockContext);
    expect(mockStorageService.uploadImage).not.toHaveBeenCalled();
    expect(mockEventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Event",
        originalImageUrl: undefined,
      }),
    );
  });
});
