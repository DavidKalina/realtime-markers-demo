// services/shared/EmbeddingService.ts

import pgvector from "pgvector";
import type { OpenAIService, OpenAIModel } from "./OpenAIService";

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

  timezone?: string;

  locationNotes?: string;

  address?: string;

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
    locationNotes?: number;
  };
}

// Define dependencies interface for cleaner constructor
export interface EmbeddingServiceDependencies {
  openAIService: OpenAIService;
}

/**
 * Service for generating and managing text embeddings.
 * Delegates caching to OpenAIService's built-in MemoryCache.
 */
export class EmbeddingService {
  // Default embedding model
  private readonly DEFAULT_MODEL: OpenAIModel;

  // Default weights for different input components
  private readonly DEFAULT_WEIGHTS = {
    title: 6,
    date: 3,
    coordinates: 0.5,
    address: 4,
    timezone: 0.5,
    text: 3,
    locationNotes: 3,
  };

  constructor(private dependencies: EmbeddingServiceDependencies) {
    this.DEFAULT_MODEL =
      (process.env.EMBEDDING_MODEL as OpenAIModel) || "text-embedding-3-small";
  }

  /**
   * Generate an embedding for text
   */
  public async getEmbedding(
    text: string,
    model?: OpenAIModel,
  ): Promise<number[]> {
    const normalizedText = this.normalizeTextForEmbedding(text);
    return this.dependencies.openAIService.generateEmbedding(
      normalizedText,
      model || this.DEFAULT_MODEL,
    );
  }

  /**
   * Get embedding in SQL format for database operations
   */
  public async getEmbeddingSql(
    text: string,
    model?: OpenAIModel,
  ): Promise<string> {
    const embedding = await this.getEmbedding(text, model);
    return pgvector.toSql(embedding);
  }

  /**
   * Generate a structured embedding from a complex input.
   * Creates a weighted text representation that emphasizes certain attributes.
   */
  public async getStructuredEmbedding(
    input: EmbeddingInput,
    model?: OpenAIModel,
  ): Promise<number[]> {
    const structuredText = this.createWeightedText(input);
    return this.getEmbedding(structuredText, model);
  }

  /**
   * Get structured embedding in SQL format for database operations
   */
  public async getStructuredEmbeddingSql(
    input: EmbeddingInput,
    model?: OpenAIModel,
  ): Promise<string> {
    const embedding = await this.getStructuredEmbedding(input, model);
    return pgvector.toSql(embedding);
  }

  /**
   * Parse SQL embedding string back to number array
   */
  public parseSqlEmbedding(sqlEmbedding: string | null | undefined): number[] {
    if (!sqlEmbedding) {
      return [];
    }
    return pgvector.fromSql(sqlEmbedding);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  public calculateSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0 || b.length === 0) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Normalize text for consistent embedding
   */
  private normalizeTextForEmbedding(text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }

  /**
   * Create a weighted text representation for structured inputs.
   * Repeats important elements to give them more weight in the embedding.
   */
  private createWeightedText(input: EmbeddingInput): string {
    const weights = {
      ...this.DEFAULT_WEIGHTS,
      ...(input.weights || {}),
    };

    let dateStr = "";
    if (input.date) {
      try {
        const date =
          input.date instanceof Date ? input.date : new Date(input.date);
        if (!isNaN(date.getTime())) {
          dateStr = date.toISOString().split("T")[0];
        } else {
          dateStr = String(input.date);
        }
      } catch (e) {
        dateStr = String(input.date);
      }
    }

    let coordsStr = "";
    if (input.coordinates) {
      const roundedCoords = [
        Math.round(input.coordinates[0] * 1000) / 1000,
        Math.round(input.coordinates[1] * 1000) / 1000,
      ];
      coordsStr = roundedCoords.join(",");
    }

    const components: string[] = [];

    if (input.title) {
      components.push(`TITLE: ${input.title.repeat(weights.title)}`);
    }

    if (dateStr) {
      components.push(`DATE: ${dateStr.repeat(weights.date)}`);
    }

    if (input.timezone) {
      components.push(`TIMEZONE: ${input.timezone.repeat(weights.timezone)}`);
    }

    if (coordsStr) {
      components.push(`COORDS: ${coordsStr}`.repeat(weights.coordinates));
    }

    if (input.address) {
      components.push(`ADDRESS: ${input.address.repeat(weights.address)}`);
    }

    if (input.locationNotes) {
      components.push(
        `LOCATION_NOTES: ${input.locationNotes.repeat(weights.locationNotes)}`,
      );
    }

    components.push(`CONTENT: ${input.text.repeat(weights.text)}`);

    return components.filter(Boolean).join("\n\n");
  }
}
