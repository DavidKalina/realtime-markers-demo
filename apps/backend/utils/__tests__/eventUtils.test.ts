import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import type { StorageService } from "../../services/shared/StorageService";
import type { CategoryProcessingService } from "../../services/CategoryProcessingService";
import type { IEmbeddingService } from "../../services/event-processing/interfaces/IEmbeddingService";
import { RecurrenceFrequency, DayOfWeek } from "../../entities/Event";
import {
  processEventFormData,
  validateEventData,
  processCategories,
  generateEmbedding,
  prepareCreateEventInput,
  type EventDataWithCategories,
} from "../eventUtils";

describe("eventUtils", () => {
  let mockContext: Context<AppContext>;
  let mockStorageService: StorageService;
  let mockCategoryProcessingService: CategoryProcessingService;
  let mockEmbeddingService: IEmbeddingService;
  let mockFormData: FormData;
  let mockFile: File;

  const testUser = {
    userId: "user-123",
    email: "test@example.com",
    role: "user",
  };

  const testEventData: EventDataWithCategories = {
    title: "Test Event",
    description: "A test event description",
    eventDate: new Date("2024-01-01T10:00:00Z"),
    location: {
      type: "Point",
      coordinates: [40.7128, -74.006],
    },
    emoji: "🎉",
    emojiDescription: "Party celebration",
    address: "123 Test St, Test City",
    locationNotes: "Near the park",
    isPrivate: false,
    sharedWithIds: ["user-456", "user-789"],
    categories: [
      { id: "cat-1", name: "Music" },
      { id: "cat-2", name: "Entertainment" },
    ],
  };

  beforeEach(() => {
    // Create mock context
    mockContext = {
      req: {
        header: jest.fn(),
        formData: jest.fn(),
        json: jest.fn(),
      },
    } as unknown as Context<AppContext>;

    // Create mock storage service
    mockStorageService = {
      uploadImage: jest.fn(),
    } as unknown as StorageService;

    // Create mock category processing service
    mockCategoryProcessingService = {
      extractAndProcessCategories: jest.fn(),
    } as unknown as CategoryProcessingService;

    // Create mock embedding service
    mockEmbeddingService = {
      getEmbedding: jest.fn(),
    } as unknown as IEmbeddingService;

    // Create mock FormData
    mockFormData = new FormData();
    mockFormData.set("title", "Test Event");
    mockFormData.set("description", "Test description");
    mockFormData.set("eventDate", "2024-01-01T10:00:00Z");
    mockFormData.set("emoji", "🎉");
    mockFormData.set("lat", "40.7128");
    mockFormData.set("lng", "-74.0060");

    // Create mock file
    const arrayBuffer = new ArrayBuffer(1024);
    mockFile = new File([arrayBuffer], "test-image.jpg", {
      type: "image/jpeg",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("processEventFormData", () => {
    it("should process multipart/form-data with image upload", async () => {
      mockFormData.set("image", mockFile);
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);
      (mockStorageService.uploadImage as jest.Mock).mockResolvedValue(
        "https://example.com/image.jpg",
      );

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data.title).toBe("Test Event");
      expect(result.data.description).toBe("Test description");
      expect(result.data.eventDate).toEqual(new Date("2024-01-01T10:00:00Z"));
      expect(result.data.location).toEqual({
        type: "Point",
        coordinates: [40.7128, -74.006],
      });
      expect(result.originalImageUrl).toBe("https://example.com/image.jpg");
      expect(mockStorageService.uploadImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        "event-images",
        expect.objectContaining({
          filename: "test-image.jpg",
          contentType: "image/jpeg",
          uploadedBy: "user-123",
        }),
      );
    });

    it("should process multipart/form-data without image", async () => {
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data.title).toBe("Test Event");
      expect(result.originalImageUrl).toBeNull();
      expect(mockStorageService.uploadImage).not.toHaveBeenCalled();
    });

    it("should reject invalid file types", async () => {
      const invalidFile = new File(["test"], "test.txt", {
        type: "text/plain",
      });
      mockFormData.set("image", invalidFile);
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      await expect(
        processEventFormData(mockContext, mockStorageService, testUser),
      ).rejects.toThrow(
        "Invalid file type. Only JPEG and PNG files are allowed",
      );
    });

    it("should process JSON data", async () => {
      const jsonData = { title: "JSON Event", description: "JSON description" };
      (mockContext.req.header as jest.Mock).mockReturnValue("application/json");
      (mockContext.req.json as jest.Mock).mockResolvedValue(jsonData);

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data).toEqual(jsonData);
      expect(result.originalImageUrl).toBeNull();
    });

    it("should handle eventData JSON in form data", async () => {
      const eventData = {
        title: "Event Data",
        description: "Event description",
      };
      mockFormData.set("eventData", JSON.stringify(eventData));
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data).toEqual(eventData);
    });

    it("should handle invalid eventData JSON", async () => {
      mockFormData.set("eventData", "invalid json");
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      await expect(
        processEventFormData(mockContext, mockStorageService, testUser),
      ).rejects.toThrow("Invalid event data format");
    });

    it("should handle recurring event fields", async () => {
      mockFormData.set("isRecurring", "true");
      mockFormData.set("recurrenceFrequency", "WEEKLY");
      mockFormData.set("recurrenceTime", "10:00");
      mockFormData.set("recurrenceInterval", "2");
      mockFormData.set("recurrenceStartDate", "2024-01-01T00:00:00Z");
      mockFormData.set("recurrenceEndDate", "2024-12-31T23:59:59Z");
      mockFormData.set(
        "recurrenceDays",
        JSON.stringify([DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY]),
      );

      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data.isRecurring).toBe(true);
      expect(result.data.recurrenceFrequency).toBe(RecurrenceFrequency.WEEKLY);
      expect(result.data.recurrenceTime).toBe("10:00");
      expect(result.data.recurrenceInterval).toBe(2);
      expect(result.data.recurrenceStartDate).toEqual(
        new Date("2024-01-01T00:00:00Z"),
      );
      expect(result.data.recurrenceEndDate).toEqual(
        new Date("2024-12-31T23:59:59Z"),
      );
      expect(result.data.recurrenceDays).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.WEDNESDAY,
      ]);
    });

    it("should handle categories as JSON", async () => {
      const categories = [
        { id: "cat-1", name: "Music" },
        { id: "cat-2", name: "Sports" },
      ];
      mockFormData.set("categories", JSON.stringify(categories));
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data.categories).toEqual(categories);
    });

    it("should handle categories as comma-separated IDs", async () => {
      mockFormData.set("categories", "cat-1,cat-2,cat-3");
      (mockContext.req.header as jest.Mock).mockReturnValue(
        "multipart/form-data; boundary=test",
      );
      (mockContext.req.formData as jest.Mock).mockResolvedValue(mockFormData);

      const result = await processEventFormData(
        mockContext,
        mockStorageService,
        testUser,
      );

      expect(result.data.categoryIds).toEqual(["cat-1", "cat-2", "cat-3"]);
    });
  });

  describe("validateEventData", () => {
    it("should validate complete event data", () => {
      expect(() => validateEventData(testEventData)).not.toThrow();
    });

    it("should throw error for missing title", () => {
      const invalidData = { ...testEventData, title: "" };
      expect(() => validateEventData(invalidData)).toThrow(
        "Missing required fields: title, eventDate, and location coordinates",
      );
    });

    it("should throw error for missing eventDate", () => {
      const invalidData = { ...testEventData, eventDate: undefined };
      expect(() => validateEventData(invalidData)).toThrow(
        "Missing required fields: title, eventDate, and location coordinates",
      );
    });

    it("should throw error for missing location coordinates", () => {
      const invalidData = { ...testEventData, location: undefined };
      expect(() => validateEventData(invalidData)).toThrow(
        "Missing required fields: title, eventDate, and location coordinates",
      );
    });

    it("should ensure location has GeoJSON format", () => {
      const dataWithLocation: EventDataWithCategories = {
        ...testEventData,
        location: { coordinates: [40.7128, -74.006] } as unknown as {
          type: "Point";
          coordinates: [number, number];
        },
      };

      validateEventData(dataWithLocation);

      expect(dataWithLocation.location).toEqual({
        type: "Point",
        coordinates: [40.7128, -74.006],
      });
    });
  });

  describe("processCategories", () => {
    it("should process existing categories", async () => {
      const result = await processCategories(
        testEventData,
        mockCategoryProcessingService,
      );

      expect(result.categoryIds).toEqual(["cat-1", "cat-2"]);
      expect(result.categories).toEqual(testEventData.categories!);
    });

    it("should generate categories when none provided", async () => {
      const dataWithoutCategories = { ...testEventData, categories: undefined };
      const generatedCategories = [
        { id: "gen-1", name: "Generated Category 1" },
        { id: "gen-2", name: "Generated Category 2" },
      ];

      (
        mockCategoryProcessingService.extractAndProcessCategories as jest.Mock
      ).mockResolvedValue(generatedCategories);

      const result = await processCategories(
        dataWithoutCategories,
        mockCategoryProcessingService,
      );

      expect(result.categoryIds).toEqual(["gen-1", "gen-2"]);
      expect(result.categories).toEqual(generatedCategories);
      expect(
        mockCategoryProcessingService.extractAndProcessCategories,
      ).toHaveBeenCalledWith("Test Event\nA test event description");
    });

    it("should handle string category IDs", async () => {
      const dataWithStringCategories: EventDataWithCategories = {
        ...testEventData,
        categories: ["cat-1", "cat-2"] as unknown as Array<{
          id: string;
          name: string;
        }>,
      };

      const result = await processCategories(
        dataWithStringCategories,
        mockCategoryProcessingService,
      );

      expect(result.categoryIds).toEqual(["cat-1", "cat-2"]);
    });

    it("should handle empty categories array", async () => {
      const dataWithEmptyCategories: EventDataWithCategories = {
        ...testEventData,
        categories: [],
      };
      const generatedCategories = [{ id: "gen-1", name: "Generated Category" }];

      (
        mockCategoryProcessingService.extractAndProcessCategories as jest.Mock
      ).mockResolvedValue(generatedCategories);

      const result = await processCategories(
        dataWithEmptyCategories,
        mockCategoryProcessingService,
      );

      expect(result.categoryIds).toEqual(["gen-1"]);
      expect(result.categories).toEqual(generatedCategories);
    });

    it("should handle undefined categoryProcessingService", async () => {
      const dataWithoutCategories: EventDataWithCategories = {
        ...testEventData,
        categories: undefined,
        categoryIds: undefined, // Also clear categoryIds to ensure no processing
      };

      const result = await processCategories(dataWithoutCategories, undefined);

      expect(result.categoryIds).toBeUndefined();
      expect(result.categories).toBeUndefined();
    });

    it("should still process existing categories when categoryProcessingService is undefined", async () => {
      const result = await processCategories(testEventData, undefined);

      expect(result.categoryIds).toEqual(["cat-1", "cat-2"]);
      expect(result.categories).toEqual(testEventData.categories!);
    });
  });

  describe("generateEmbedding", () => {
    it("should generate embedding for event data", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      (mockEmbeddingService.getEmbedding as jest.Mock).mockResolvedValue(
        mockEmbedding,
      );

      const result = await generateEmbedding(
        testEventData,
        mockEmbeddingService,
      );

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("TITLE: Test Event Test Event Test Event"),
      );
    });

    it("should not generate embedding if already present", async () => {
      const dataWithEmbedding = {
        ...testEventData,
        embedding: [0.1, 0.2, 0.3],
      };

      const result = await generateEmbedding(
        dataWithEmbedding,
        mockEmbeddingService,
      );

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbeddingService.getEmbedding).not.toHaveBeenCalled();
    });

    it("should handle embedding generation error gracefully", async () => {
      // Create fresh test data without embedding
      const freshTestData: EventDataWithCategories = {
        ...testEventData,
        embedding: undefined,
      };

      // Reset the mock to clear any previous calls
      jest.clearAllMocks();

      (mockEmbeddingService.getEmbedding as jest.Mock).mockRejectedValue(
        new Error("Embedding service error"),
      );

      const result = await generateEmbedding(
        freshTestData,
        mockEmbeddingService,
      );

      expect(result.embedding).toEqual([]);
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalled();
    });

    it("should format embedding text correctly", async () => {
      // Create fresh test data without embedding
      const dataWithAllFields: EventDataWithCategories = {
        ...testEventData,
        embedding: undefined,
        emojiDescription: "Party celebration",
        address: "123 Test St",
        locationNotes: "Near the park",
      };

      // Reset the mock to clear any previous calls
      jest.clearAllMocks();

      (mockEmbeddingService.getEmbedding as jest.Mock).mockResolvedValue([
        0.1, 0.2, 0.3,
      ]);

      await generateEmbedding(dataWithAllFields, mockEmbeddingService);

      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("TITLE: Test Event Test Event Test Event"),
      );
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("EMOJI: 🎉 - Party celebration"),
      );
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("CATEGORIES: Music, Entertainment"),
      );
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("DESCRIPTION: A test event description"),
      );
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("LOCATION: 123 Test St"),
      );
      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("LOCATION_NOTES: Near the park"),
      );
    });
  });

  describe("prepareCreateEventInput", () => {
    it("should prepare complete CreateEventInput", () => {
      // Create test data without categories to avoid processing
      const testDataWithoutCategories: EventDataWithCategories = {
        ...testEventData,
        categories: undefined,
        categoryIds: undefined,
        embedding: undefined,
      };

      const result = prepareCreateEventInput(
        testDataWithoutCategories,
        testUser,
        "https://example.com/image.jpg",
      );

      expect(result).toEqual({
        emoji: "🎉",
        emojiDescription: "Party celebration",
        title: "Test Event",
        description: "A test event description",
        eventDate: new Date("2024-01-01T10:00:00Z"),
        endDate: undefined,
        location: {
          type: "Point",
          coordinates: [40.7128, -74.006],
        },
        categoryIds: undefined,
        confidenceScore: undefined,
        address: "123 Test St, Test City",
        locationNotes: "Near the park",
        creatorId: "user-123",
        timezone: undefined,
        qrDetectedInImage: undefined,
        detectedQrData: undefined,
        originalImageUrl: "https://example.com/image.jpg",
        embedding: [],
        isPrivate: false,
        sharedWithIds: ["user-456", "user-789"],
        qrUrl: undefined,
        isRecurring: undefined,
        recurrenceFrequency: undefined,
        recurrenceDays: undefined,
        recurrenceTime: undefined,
        recurrenceStartDate: undefined,
        recurrenceEndDate: undefined,
        recurrenceInterval: undefined,
      });
    });

    it("should throw error for missing user ID", () => {
      const userWithoutId = { ...testUser, userId: undefined };

      expect(() =>
        prepareCreateEventInput(testEventData, userWithoutId, null),
      ).toThrow("User ID is required");
    });

    it("should handle string eventDate", () => {
      const dataWithStringDate: EventDataWithCategories = {
        ...testEventData,
        eventDate: "2024-01-01T10:00:00Z" as unknown as Date,
      };

      const result = prepareCreateEventInput(
        dataWithStringDate,
        testUser,
        null,
      );

      expect(result.eventDate).toEqual(new Date("2024-01-01T10:00:00Z"));
    });

    it("should handle string endDate", () => {
      const dataWithStringEndDate: EventDataWithCategories = {
        ...testEventData,
        endDate: "2024-01-01T12:00:00Z" as unknown as Date,
      };

      const result = prepareCreateEventInput(
        dataWithStringEndDate,
        testUser,
        null,
      );

      expect(result.endDate).toEqual(new Date("2024-01-01T12:00:00Z"));
    });

    it("should use default emoji when not provided", () => {
      const dataWithoutEmoji = { ...testEventData, emoji: undefined };

      const result = prepareCreateEventInput(dataWithoutEmoji, testUser, null);

      expect(result.emoji).toBe("📍");
    });

    it("should handle recurring event fields", () => {
      const recurringEventData: EventDataWithCategories = {
        ...testEventData,
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceDays: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
        recurrenceTime: "10:00",
        recurrenceStartDate: new Date("2024-01-01T00:00:00Z"),
        recurrenceEndDate: new Date("2024-12-31T23:59:59Z"),
        recurrenceInterval: 2,
      };

      const result = prepareCreateEventInput(
        recurringEventData,
        testUser,
        null,
      );

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceFrequency).toBe(RecurrenceFrequency.WEEKLY);
      expect(result.recurrenceDays).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.WEDNESDAY,
      ]);
      expect(result.recurrenceTime).toBe("10:00");
      expect(result.recurrenceStartDate).toEqual(
        new Date("2024-01-01T00:00:00Z"),
      );
      expect(result.recurrenceEndDate).toEqual(
        new Date("2024-12-31T23:59:59Z"),
      );
      expect(result.recurrenceInterval).toBe(2);
    });

    it("should use originalImageUrl from data if not provided", () => {
      const dataWithImageUrl = {
        ...testEventData,
        originalImageUrl: "https://data-image.jpg",
      };

      const result = prepareCreateEventInput(dataWithImageUrl, testUser, null);

      expect(result.originalImageUrl).toBe("https://data-image.jpg");
    });

    it("should prioritize provided originalImageUrl over data", () => {
      const dataWithImageUrl = {
        ...testEventData,
        originalImageUrl: "https://data-image.jpg",
      };

      const result = prepareCreateEventInput(
        dataWithImageUrl,
        testUser,
        "https://provided-image.jpg",
      );

      expect(result.originalImageUrl).toBe("https://provided-image.jpg");
    });
  });
});
