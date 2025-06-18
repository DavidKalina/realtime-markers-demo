import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import {
  CategoryProcessingService,
  createCategoryProcessingService,
} from "../CategoryProcessingService";
import { OpenAIModel } from "../shared/OpenAIService";
import type { Repository } from "typeorm";
import type { OpenAIService } from "../shared/OpenAIService";
import type { CategoryCacheService } from "../shared/CategoryCacheService";
import type { Category } from "../../entities/Category";

describe("CategoryProcessingService", () => {
  let categoryProcessingService: CategoryProcessingService;
  let mockCategoryRepository: Repository<Category>;
  let mockOpenAIService: OpenAIService;
  let mockCategoryCacheService: CategoryCacheService;

  beforeEach(() => {
    // Create mocks with proper jest typing
    mockCategoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<Category>;

    mockOpenAIService = {
      generateEmbedding: jest.fn(),
      executeChatCompletion: jest.fn(),
    } as unknown as OpenAIService;

    mockCategoryCacheService = {
      getCategory: jest.fn(),
      setCategory: jest.fn(),
      getCategoryList: jest.fn(),
      setCategoryList: jest.fn(),
      invalidateCategory: jest.fn(),
      invalidateAllCategories: jest.fn(),
    } as unknown as CategoryCacheService;

    categoryProcessingService = new CategoryProcessingService({
      categoryRepository: mockCategoryRepository,
      openAIService: mockOpenAIService,
      categoryCacheService: mockCategoryCacheService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrCreateCategories", () => {
    it("should return cached categories when all are available", async () => {
      const mockCategories: Category[] = [
        {
          id: "cat-1",
          name: "music",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "sports",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      (mockCategoryCacheService.getCategory as jest.Mock)
        .mockResolvedValueOnce(mockCategories[0])
        .mockResolvedValueOnce(mockCategories[1]);

      const result = await categoryProcessingService.getOrCreateCategories([
        "Music",
        "Sports",
      ]);

      expect(result).toEqual(mockCategories);
      expect(mockCategoryRepository.find).not.toHaveBeenCalled();
      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it("should create new categories when none exist", async () => {
      const categoryNames = ["New Category", "Another Category"];
      const createdCategories: Category[] = [
        {
          id: "cat-1",
          name: "new category",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "another category",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      (mockCategoryCacheService.getCategory as jest.Mock).mockResolvedValue(
        null,
      );
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([]);
      (mockCategoryRepository.create as jest.Mock)
        .mockReturnValueOnce(createdCategories[0])
        .mockReturnValueOnce(createdCategories[1]);
      (mockCategoryRepository.save as jest.Mock).mockResolvedValue(
        createdCategories,
      );
      (mockCategoryCacheService.setCategory as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result =
        await categoryProcessingService.getOrCreateCategories(categoryNames);

      expect(result).toEqual(createdCategories);
      expect(mockCategoryRepository.create).toHaveBeenCalledTimes(2);
      expect(mockCategoryRepository.save).toHaveBeenCalledWith(
        createdCategories,
      );
      expect(mockCategoryCacheService.setCategory).toHaveBeenCalledTimes(2);
    });

    it("should mix cached, existing, and new categories", async () => {
      const cachedCategory: Category = {
        id: "cat-1",
        name: "music",
        createdAt: new Date(),
        updatedAt: new Date(),
        events: [],
      } as Category;
      const existingCategory: Category = {
        id: "cat-2",
        name: "sports",
        createdAt: new Date(),
        updatedAt: new Date(),
        events: [],
      } as Category;
      const newCategory: Category = {
        id: "cat-3",
        name: "art",
        createdAt: new Date(),
        updatedAt: new Date(),
        events: [],
      } as Category;

      (mockCategoryCacheService.getCategory as jest.Mock)
        .mockResolvedValueOnce(cachedCategory) // "Music" -> cached
        .mockResolvedValueOnce(null) // "Sports" -> not cached
        .mockResolvedValueOnce(null); // "Art" -> not cached

      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([
        existingCategory,
      ]);
      (mockCategoryRepository.create as jest.Mock).mockReturnValue(newCategory);
      (mockCategoryRepository.save as jest.Mock).mockResolvedValue([
        newCategory,
      ]);
      (mockCategoryCacheService.setCategory as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await categoryProcessingService.getOrCreateCategories([
        "Music",
        "Sports",
        "Art",
      ]);

      expect(result).toEqual([cachedCategory, existingCategory, newCategory]);
      expect(mockCategoryRepository.create).toHaveBeenCalledTimes(1);
      expect(mockCategoryRepository.save).toHaveBeenCalledWith([newCategory]);
    });

    it("should normalize category names", async () => {
      const categoryNames = ["  MUSIC  ", "Sports & Games", "  ART  "];
      const createdCategories: Category[] = [
        {
          id: "cat-1",
          name: "music",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "sports & games",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-3",
          name: "art",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      (mockCategoryCacheService.getCategory as jest.Mock).mockResolvedValue(
        null,
      );
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([]);
      (mockCategoryRepository.create as jest.Mock)
        .mockReturnValueOnce(createdCategories[0])
        .mockReturnValueOnce(createdCategories[1])
        .mockReturnValueOnce(createdCategories[2]);
      (mockCategoryRepository.save as jest.Mock).mockResolvedValue(
        createdCategories,
      );
      (mockCategoryCacheService.setCategory as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result =
        await categoryProcessingService.getOrCreateCategories(categoryNames);

      expect(result).toEqual(createdCategories);
      expect(mockCategoryRepository.create).toHaveBeenCalledWith({
        name: "music",
      });
      expect(mockCategoryRepository.create).toHaveBeenCalledWith({
        name: "sports & games",
      });
      expect(mockCategoryRepository.create).toHaveBeenCalledWith({
        name: "art",
      });
    });
  });

  describe("extractAndProcessCategories", () => {
    it("should always extract categories from text (no global cache)", async () => {
      const imageText = "Join us for a live music concert in the park";
      const aiResponse = {
        choices: [
          {
            message: {
              content:
                // eslint-disable-next-line quotes
                `{"categories": ["Music", "Outdoor Events", "Entertainment"]}`,
            },
          },
        ],
      };
      const processedCategories: Category[] = [
        {
          id: "cat-1",
          name: "music",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "outdoor events",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-3",
          name: "entertainment",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      // The method should always call AI service, regardless of cache
      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        aiResponse,
      );
      (mockCategoryCacheService.getCategory as jest.Mock).mockResolvedValue(
        null,
      );
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([]);
      (mockCategoryRepository.create as jest.Mock)
        .mockReturnValueOnce(processedCategories[0])
        .mockReturnValueOnce(processedCategories[1])
        .mockReturnValueOnce(processedCategories[2]);
      (mockCategoryRepository.save as jest.Mock).mockResolvedValue(
        processedCategories,
      );
      (mockCategoryCacheService.setCategory as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result =
        await categoryProcessingService.extractAndProcessCategories(imageText);

      expect(result).toEqual(processedCategories);
      expect(mockOpenAIService.executeChatCompletion).toHaveBeenCalledWith({
        model: OpenAIModel.GPT4O,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("Extract event categories"),
          }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(imageText),
          }),
        ]),
        response_format: { type: "json_object" },
      });
      // Should not call setCategoryList since we're not caching global results
      expect(mockCategoryCacheService.setCategoryList).not.toHaveBeenCalled();
    });

    it("should extract and process categories from text", async () => {
      const imageText = "Join us for a live music concert in the park";
      const aiResponse = {
        choices: [
          {
            message: {
              content:
                // eslint-disable-next-line quotes
                `{"categories": ["Music", "Outdoor Events", "Entertainment"]}`,
            },
          },
        ],
      };
      const processedCategories: Category[] = [
        {
          id: "cat-1",
          name: "music",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "outdoor events",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-3",
          name: "entertainment",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        aiResponse,
      );
      (mockCategoryCacheService.getCategory as jest.Mock).mockResolvedValue(
        null,
      );
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue([]);
      (mockCategoryRepository.create as jest.Mock)
        .mockReturnValueOnce(processedCategories[0])
        .mockReturnValueOnce(processedCategories[1])
        .mockReturnValueOnce(processedCategories[2]);
      (mockCategoryRepository.save as jest.Mock).mockResolvedValue(
        processedCategories,
      );
      (mockCategoryCacheService.setCategory as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result =
        await categoryProcessingService.extractAndProcessCategories(imageText);

      expect(result).toEqual(processedCategories);
      expect(mockOpenAIService.executeChatCompletion).toHaveBeenCalledWith({
        model: OpenAIModel.GPT4O,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("Extract event categories"),
          }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(imageText),
          }),
        ]),
        response_format: { type: "json_object" },
      });
      // Should not call setCategoryList since we're not caching global results
      expect(mockCategoryCacheService.setCategoryList).not.toHaveBeenCalled();
    });

    it("should return empty array when AI returns no categories", async () => {
      const imageText = "some text";
      const aiResponse = {
        choices: [
          {
            message: {
              // eslint-disable-next-line quotes
              content: `{"categories": []}`,
            },
          },
        ],
      };

      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        aiResponse,
      );

      const result =
        await categoryProcessingService.extractAndProcessCategories(imageText);

      expect(result).toEqual([]);
      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it("should handle malformed AI response", async () => {
      const imageText = "some text";
      const aiResponse = {
        choices: [
          {
            message: {
              content: "invalid json",
            },
          },
        ],
      };

      (mockOpenAIService.executeChatCompletion as jest.Mock).mockResolvedValue(
        aiResponse,
      );

      await expect(
        categoryProcessingService.extractAndProcessCategories(imageText),
      ).rejects.toThrow("Unexpected identifier");
    });
  });

  describe("getAllCategories", () => {
    it("should return cached categories when available", async () => {
      const cachedCategories: Category[] = [
        {
          id: "cat-1",
          name: "art",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "music",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-3",
          name: "sports",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      (mockCategoryCacheService.getCategoryList as jest.Mock).mockResolvedValue(
        cachedCategories,
      );

      const result = await categoryProcessingService.getAllCategories();

      expect(result).toEqual(cachedCategories);
      expect(mockCategoryRepository.find).not.toHaveBeenCalled();
    });

    it("should fetch and cache categories when not cached", async () => {
      const categories: Category[] = [
        {
          id: "cat-1",
          name: "art",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-2",
          name: "music",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
        {
          id: "cat-3",
          name: "sports",
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        } as Category,
      ];

      (mockCategoryCacheService.getCategoryList as jest.Mock).mockResolvedValue(
        null,
      );
      (mockCategoryRepository.find as jest.Mock).mockResolvedValue(categories);
      (mockCategoryCacheService.setCategoryList as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await categoryProcessingService.getAllCategories();

      expect(result).toEqual(categories);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({
        order: { name: "ASC" },
      });
      expect(mockCategoryCacheService.setCategoryList).toHaveBeenCalledWith(
        categories,
      );
    });
  });

  describe("invalidateCategoryCaches", () => {
    it("should invalidate specific categories when IDs provided", async () => {
      const categoryIds = ["cat-1", "cat-2"];
      (
        mockCategoryCacheService.invalidateCategory as jest.Mock
      ).mockResolvedValue(undefined);

      await categoryProcessingService.invalidateCategoryCaches(categoryIds);

      expect(mockCategoryCacheService.invalidateCategory).toHaveBeenCalledTimes(
        2,
      );
      expect(mockCategoryCacheService.invalidateCategory).toHaveBeenCalledWith(
        "cat-1",
      );
      expect(mockCategoryCacheService.invalidateCategory).toHaveBeenCalledWith(
        "cat-2",
      );
      expect(
        mockCategoryCacheService.invalidateAllCategories,
      ).not.toHaveBeenCalled();
    });

    it("should invalidate all categories when no IDs provided", async () => {
      (
        mockCategoryCacheService.invalidateAllCategories as jest.Mock
      ).mockResolvedValue(undefined);

      await categoryProcessingService.invalidateCategoryCaches();

      expect(
        mockCategoryCacheService.invalidateAllCategories,
      ).toHaveBeenCalled();
      expect(
        mockCategoryCacheService.invalidateCategory,
      ).not.toHaveBeenCalled();
    });
  });

  describe("createCategoryProcessingService factory", () => {
    it("should create CategoryProcessingService instance", () => {
      const dependencies = {
        categoryRepository: mockCategoryRepository,
        openAIService: mockOpenAIService,
        categoryCacheService: mockCategoryCacheService,
      };

      const service = createCategoryProcessingService(dependencies);

      expect(service).toBeInstanceOf(CategoryProcessingService);
    });
  });
});
