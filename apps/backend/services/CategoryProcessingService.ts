import { In, Repository } from "typeorm";
import { Category } from "../entities/Category";
import { CacheService } from "./shared/CacheService";
import { OpenAIService } from "./shared/OpenAIService";

export class CategoryProcessingService {
  constructor(private categoryRepository: Repository<Category>) { }

  private async normalizeCategoryName(name: string): Promise<string> {
    return name.toLowerCase().trim().replace(/\s+/g, " "); // Replace multiple spaces with single space
  }

  async getOrCreateCategories(categoryNames: string[]): Promise<Category[]> {
    // Normalize all category names in parallel
    const normalizedNames = await Promise.all(
      categoryNames.map((name) => this.normalizeCategoryName(name))
    );

    // Find all existing categories in one query
    const existingCategories = await this.categoryRepository.find({
      where: { name: In(normalizedNames) },
    });

    // Determine which categories need to be created
    const existingNamesSet = new Set(existingCategories.map((cat) => cat.name));
    const newCategoryNames = normalizedNames.filter((name) => !existingNamesSet.has(name));

    // Create all new categories in one batch
    let newCategories: Category[] = [];
    if (newCategoryNames.length > 0) {
      newCategories = newCategoryNames.map((name) => this.categoryRepository.create({ name }));
      await this.categoryRepository.save(newCategories);
    }

    // Return combined list
    return [...existingCategories, ...newCategories];
  }

  private async findSimilarCategory(normalizedName: string): Promise<Category | null> {
    // First try exact match
    const exactMatch = await this.categoryRepository.findOne({
      where: { name: normalizedName },
    });

    if (exactMatch) {
      return exactMatch;
    }

    // If no exact match, use embedding similarity to find similar categories
    const embedding = await this.generateCategoryEmbedding(normalizedName);

    // Get all categories to compare
    const allCategories = await this.categoryRepository.find();

    // Generate embeddings for all existing categories
    const categoryEmbeddings = await Promise.all(
      allCategories.map(async (category) => ({
        category,
        embedding: await this.generateCategoryEmbedding(category.name),
      }))
    );

    // Find the most similar category
    let mostSimilar: { category: Category; similarity: number } | null = null;

    for (const { category, embedding: categoryEmbedding } of categoryEmbeddings) {
      const similarity = this.calculateCosineSimilarity(embedding, categoryEmbedding);

      if (similarity > 0.95 && (!mostSimilar || similarity > mostSimilar.similarity)) {
        mostSimilar = { category, similarity };
      }
    }

    return mostSimilar?.category || null;
  }

  private async generateCategoryEmbedding(text: string): Promise<number[]> {
    return OpenAIService.generateEmbedding(text);
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
    const cachedCategories = CacheService.getCachedCategories(imageText);
    if (cachedCategories) {
      return await this.categoryRepository.find({
        where: { name: In(cachedCategories) },
      });
    }

    const response = await OpenAIService.executeChatCompletion({
      model: "gpt-4o",
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

    const parsedResponse = JSON.parse(response.choices[0]?.message.content || "{}");
    const suggestedCategories: string[] = parsedResponse.categories || [];

    // Save to cache
    CacheService.setCachedCategories(imageText, suggestedCategories);

    if (suggestedCategories.length === 0) {
      return [];
    }

    // Normalize all category names in parallel
    const normalizedNames = await Promise.all(
      suggestedCategories.map((name) => this.normalizeCategoryName(name))
    );

    // Find all existing categories in one query
    const existingCategories = await this.categoryRepository.find({
      where: { name: In(normalizedNames) },
    });

    // Determine which categories need to be created
    const existingNamesSet = new Set(existingCategories.map((cat) => cat.name));
    const newCategoryNames = normalizedNames.filter((name) => !existingNamesSet.has(name));

    // Create all new categories in one batch
    let newCategories: Category[] = [];
    if (newCategoryNames.length > 0) {
      newCategories = newCategoryNames.map((name) => this.categoryRepository.create({ name }));
      await this.categoryRepository.save(newCategories);
    }

    // Return combined list
    return [...existingCategories, ...newCategories];
  }
}
