// services/shared/EmbeddingService.ts

import pgvector from "pgvector";
import { OpenAIService } from "./OpenAIService";
import { CacheService } from "./CacheService";
import type { ConfigService } from "./ConfigService";
import type { IEmbeddingService } from "../event-processing/interfaces/IEmbeddingService";

/**
 * Input for generating embeddings
 */
export interface EmbeddingInput {
  /**
   * Primary text content to embed
   */
  text: string;

  /**
   * Optional title to include in the embedding
   */
  title?: string;

  /**
   * Optional date to include in the embedding (ISO string or Date object)
   */
  date?: string | Date;

  endDate?: string | Date;

  /**
   * Optional coordinates to include in the embedding [longitude, latitude]
   */
  coordinates?: [number, number];

  /**
   * Optional address to include in the embedding
   */
  address?: string;

  /**
   * Optional timezone to include in the embedding
   */
  timezone?: string;

  /**
   * Optional custom weighting configuration (overrides defaults)
   */
  weights?: {
    title?: number;
    date?: number;
    coordinates?: number;
    address?: number;
    timezone?: number;
    text?: number;
  };
}

/**
 * Service for generating and managing text embeddings
 * Provides a standardized interface for embedding generation across the application
 * Uses caching for performance optimization
 */
export class EmbeddingService implements IEmbeddingService {
  private static instance: EmbeddingService;

  // Default embedding model
  private readonly DEFAULT_MODEL: string;

  // Default TTL for cache entries in seconds
  private readonly CACHE_TTL: number;

  // Default weights for different input components
  private readonly DEFAULT_WEIGHTS = {
    title: 4,
    date: 2,
    coordinates: 2,
    address: 5,
    timezone: 1,
    text: 1,
  };

  /**
   * Private constructor for singleton pattern
   * @param configService Optional configuration service
   */
  private constructor(private configService?: ConfigService) {
    // Initialize with config or defaults
    this.DEFAULT_MODEL = configService?.get("openai.embeddingModel") || "text-embedding-3-small";
    this.CACHE_TTL = configService?.get("cache.ttl") || 86400; // 24 hours
  }

  /**
   * Get the singleton instance
   * @param configService Optional configuration service
   */
  public static getInstance(configService?: ConfigService): EmbeddingService {
    if (!this.instance) {
      this.instance = new EmbeddingService(configService);
    }
    return this.instance;
  }

  /**
   * Generate an embedding for text
   * @param text Text to embed
   * @param model Optional model to use (defaults to configured default)
   * @returns Vector embedding
   */
  public async getEmbedding(text: string, model?: string): Promise<number[]> {
    const normalizedText = this.normalizeTextForEmbedding(text);
    const cacheKey = this.generateCacheKey(normalizedText);

    // Check cache
    const cachedEmbedding = CacheService.getCachedEmbedding(normalizedText);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    // Generate embedding with the specified or default model
    const embedding = await OpenAIService.generateEmbedding(
      normalizedText,
      model || this.DEFAULT_MODEL
    );

    // Cache the result
    CacheService.setCachedEmbedding(normalizedText, embedding);

    return embedding;
  }

  /**
   * Get embedding in SQL format for database operations
   * @param text Text to embed
   * @param model Optional model to use
   * @returns SQL representation of vector embedding
   */
  public async getEmbeddingSql(text: string, model?: string): Promise<string> {
    const embedding = await this.getEmbedding(text, model);
    return pgvector.toSql(embedding);
  }

  /**
   * Generate a structured embedding from a complex input
   * Creates a weighted text representation that emphasizes certain attributes
   * @param input Structured input with various components
   * @param model Optional model to use
   * @returns Vector embedding
   */
  public async getStructuredEmbedding(input: EmbeddingInput, model?: string): Promise<number[]> {
    const structuredText = this.createWeightedText(input);
    return this.getEmbedding(structuredText, model);
  }

  /**
   * Get structured embedding in SQL format for database operations
   * @param input Structured input with various components
   * @param model Optional model to use
   * @returns SQL representation of vector embedding
   */
  public async getStructuredEmbeddingSql(input: EmbeddingInput, model?: string): Promise<string> {
    const embedding = await this.getStructuredEmbedding(input, model);
    return pgvector.toSql(embedding);
  }

  /**
   * Parse SQL embedding string back to number array
   * @param sqlEmbedding SQL representation of embedding
   * @returns Vector embedding as number array
   */
  public parseSqlEmbedding(sqlEmbedding: string | null | undefined): number[] {
    if (!sqlEmbedding) {
      return [];
    }
    return pgvector.fromSql(sqlEmbedding);
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a First embedding
   * @param b Second embedding
   * @returns Similarity score from 0 to 1
   */
  public calculateSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0 || b.length === 0) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Normalize text for consistent embedding
   * @param text Text to normalize
   * @returns Normalized text
   */
  private normalizeTextForEmbedding(text: string): string {
    // Remove excess whitespace and normalize
    return text.trim().replace(/\s+/g, " ");
  }

  /**
   * Generate a cache key for text
   * @param text Text to generate key for
   * @returns Cache key
   */
  private generateCacheKey(text: string): string {
    return CacheService.getCacheKey(text);
  }

  /**
   * Create a weighted text representation for structured inputs
   * Repeats important elements to give them more weight in the embedding
   * @param input Structured input
   * @returns Weighted text representation
   */
  private createWeightedText(input: EmbeddingInput): string {
    // Apply custom weights or use defaults
    const weights = {
      ...this.DEFAULT_WEIGHTS,
      ...(input.weights || {}),
    };

    // Format date if provided
    let dateStr = "";
    if (input.date) {
      try {
        const date = input.date instanceof Date ? input.date : new Date(input.date);
        if (!isNaN(date.getTime())) {
          // Format as YYYY-MM-DD
          dateStr = date.toISOString().split("T")[0];
        } else {
          dateStr = String(input.date);
        }
      } catch (e) {
        // If date parsing fails, use the original string
        dateStr = String(input.date);
      }
    }

    // Format coordinates with consistent precision
    let coordsStr = "";
    if (input.coordinates) {
      const roundedCoords = [
        Math.round(input.coordinates[0] * 1000) / 1000, // Round to 3 decimal places (~110m precision)
        Math.round(input.coordinates[1] * 1000) / 1000,
      ];
      coordsStr = roundedCoords.join(",");
    }

    // Create weighted components
    const components: string[] = [];

    // Add title with weight
    if (input.title) {
      components.push(`TITLE: ${input.title.repeat(weights.title)}`);
    }

    // Add date with weight
    if (dateStr) {
      components.push(`DATE: ${dateStr.repeat(weights.date)}`);
    }

    // Add timezone
    if (input.timezone) {
      components.push(`TIMEZONE: ${input.timezone.repeat(weights.timezone)}`);
    }

    // Add coordinates with weight
    if (coordsStr) {
      components.push(`COORDS: ${coordsStr}`.repeat(weights.coordinates));
    }

    // Add address with weight
    if (input.address) {
      components.push(`ADDRESS: ${input.address.repeat(weights.address)}`);
    }

    // Add main text
    components.push(`CONTENT: ${input.text.repeat(weights.text)}`);

    // Join with double newlines for clear section separation
    return components.filter(Boolean).join("\n\n");
  }

  /**
   * Clear embedding cache
   * Useful for testing or when embedding model changes
   */
  public clearCache(): void {
    // This would ideally clear only embeddings, not all cache
    console.log("Clearing embedding cache");
    CacheService.monitorMemoryUsage();
  }
}
