import { Repository } from "typeorm";
import { OpenAI } from "openai";
import { Category } from "../entities/Category";

export class CategoryProcessingService {
  constructor(private openai: OpenAI, private categoryRepository: Repository<Category>) {}

  private async normalizeCategoryName(name: string): Promise<string> {
    return name.toLowerCase().trim().replace(/\s+/g, " "); // Replace multiple spaces with single space
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
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async extractAndProcessCategories(imageText: string): Promise<Category[]> {
    // Extract categories using GPT-4
    const response = await this.openai.chat.completions.create({
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

    const processedCategories: Category[] = [];

    for (const categoryName of suggestedCategories) {
      const normalizedName = await this.normalizeCategoryName(categoryName);

      // Check for similar existing category
      const existingCategory = await this.findSimilarCategory(normalizedName);

      if (existingCategory) {
        processedCategories.push(existingCategory);
      } else {
        // Create new category
        const newCategory = this.categoryRepository.create({
          name: normalizedName,
          // You could also generate a description using GPT if desired
        });

        await this.categoryRepository.save(newCategory);
        processedCategories.push(newCategory);
      }
    }

    return processedCategories;
  }
}
