import { In, Repository } from "typeorm";
import { Category } from "../entities/Category";
import type { CategoryCacheService } from "./shared/CategoryCacheService";
import { OpenAIModel, type OpenAIService } from "./shared/OpenAIService";

// Define dependencies interface for cleaner constructor
export interface CategoryProcessingServiceDependencies {
  categoryRepository: Repository<Category>;
  openAIService: OpenAIService;
  categoryCacheService: CategoryCacheService;
}

export class CategoryProcessingService {
  constructor(private dependencies: CategoryProcessingServiceDependencies) {}

  private async normalizeCategoryName(name: string): Promise<string> {
    return name.toLowerCase().trim().replace(/\s+/g, " "); // Replace multiple spaces with single space
  }

  async getOrCreateCategories(categoryNames: string[]): Promise<Category[]> {
    // Normalize all category names in parallel
    const normalizedNames = await Promise.all(
      categoryNames.map((name) => this.normalizeCategoryName(name)),
    );

    // Try to get categories from cache first
    const cachedCategories = await Promise.all(
      normalizedNames.map(async (name) => {
        const cached =
          await this.dependencies.categoryCacheService.getCategory(name);
        return cached;
      }),
    );

    // Filter out cached categories and get names that need to be fetched/created
    const cachedCategoriesMap = new Map(
      cachedCategories
        .filter((cat): cat is Category => cat !== null)
        .map((cat) => [cat.name, cat]),
    );
    const uncachedNames = normalizedNames.filter(
      (name) => !cachedCategoriesMap.has(name),
    );

    if (uncachedNames.length === 0) {
      return Array.from(cachedCategoriesMap.values());
    }

    // Find all existing categories in one query
    const existingCategories = await this.dependencies.categoryRepository.find({
      where: { name: In(uncachedNames) },
    });

    // Cache the existing categories
    await Promise.all(
      existingCategories.map((category) =>
        this.dependencies.categoryCacheService.setCategory(category),
      ),
    );

    // Determine which categories need to be created
    const existingNamesSet = new Set(existingCategories.map((cat) => cat.name));
    const newCategoryNames = uncachedNames.filter(
      (name) => !existingNamesSet.has(name),
    );

    // Create all new categories in one batch
    let newCategories: Category[] = [];
    if (newCategoryNames.length > 0) {
      newCategories = newCategoryNames.map((name) =>
        this.dependencies.categoryRepository.create({ name }),
      );
      newCategories =
        await this.dependencies.categoryRepository.save(newCategories);

      // Cache the new categories
      await Promise.all(
        newCategories.map((category) =>
          this.dependencies.categoryCacheService.setCategory(category),
        ),
      );
    }

    // Return combined list of cached, existing, and new categories
    return [
      ...Array.from(cachedCategoriesMap.values()),
      ...existingCategories,
      ...newCategories,
    ];
  }

  private async findSimilarCategory(
    normalizedName: string,
  ): Promise<Category | null> {
    // First try exact match
    const exactMatch = await this.dependencies.categoryRepository.findOne({
      where: { name: normalizedName },
    });

    if (exactMatch) {
      return exactMatch;
    }

    // If no exact match, use embedding similarity to find similar categories
    const embedding = await this.generateCategoryEmbedding(normalizedName);

    // Get all categories to compare
    const allCategories = await this.dependencies.categoryRepository.find();

    // Generate embeddings for all existing categories
    const categoryEmbeddings = await Promise.all(
      allCategories.map(async (category) => ({
        category,
        embedding: await this.generateCategoryEmbedding(category.name),
      })),
    );

    // Find the most similar category
    let mostSimilar: { category: Category; similarity: number } | null = null;

    for (const {
      category,
      embedding: categoryEmbedding,
    } of categoryEmbeddings) {
      const similarity = this.calculateCosineSimilarity(
        embedding,
        categoryEmbedding,
      );

      if (
        similarity > 0.95 &&
        (!mostSimilar || similarity > mostSimilar.similarity)
      ) {
        mostSimilar = { category, similarity };
      }
    }

    return mostSimilar?.category || null;
  }

  private async generateCategoryEmbedding(text: string): Promise<number[]> {
    return this.dependencies.openAIService.generateEmbedding(text);
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async extractAndProcessCategories(imageText: string): Promise<Category[]> {
    // Check cache first
    const cachedCategories =
      await this.dependencies.categoryCacheService.getCategoryList();
    if (cachedCategories) {
      return cachedCategories;
    }

    const response =
      await this.dependencies.openAIService.executeChatCompletion({
        model: OpenAIModel.GPT4O,
        messages: [
          {
            role: "system",
            content:
              "Extract event categories from the given text. Categories should be specific but not too narrow. Return only the category names in a JSON array.",
          },
          {
            role: "user",
            content: `Extract relevant event categories from this text. Consider the type of event, target audience, and general theme:
                   ${imageText}`,
          },
        ],
        response_format: { type: "json_object" },
      });

    const parsedResponse = JSON.parse(
      response.choices[0]?.message.content || "{}",
    );
    const suggestedCategories: string[] = parsedResponse.categories || [];

    if (suggestedCategories.length === 0) {
      return [];
    }

    // Get or create the categories
    const categories = await this.getOrCreateCategories(suggestedCategories);

    // Cache the results
    await this.dependencies.categoryCacheService.setCategoryList(categories);

    return categories;
  }

  // Add a method to get all categories with caching
  async getAllCategories(): Promise<Category[]> {
    const cachedCategories =
      await this.dependencies.categoryCacheService.getCategoryList();
    if (cachedCategories) {
      return cachedCategories;
    }

    const categories = await this.dependencies.categoryRepository.find({
      order: { name: "ASC" },
    });

    await this.dependencies.categoryCacheService.setCategoryList(categories);
    return categories;
  }

  // Add a method to invalidate category caches
  async invalidateCategoryCaches(categoryIds?: string[]): Promise<void> {
    if (categoryIds) {
      await Promise.all(
        categoryIds.map((id) =>
          this.dependencies.categoryCacheService.invalidateCategory(id),
        ),
      );
    } else {
      await this.dependencies.categoryCacheService.invalidateAllCategories();
    }
  }
}

/**
 * Factory function to create a CategoryProcessingService instance
 */
export function createCategoryProcessingService(
  dependencies: CategoryProcessingServiceDependencies,
): CategoryProcessingService {
  return new CategoryProcessingService(dependencies);
}
