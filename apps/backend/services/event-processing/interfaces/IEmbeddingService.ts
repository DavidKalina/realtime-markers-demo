// services/shared/interfaces/IEmbeddingService.ts

import type { EmbeddingInput } from "../../shared/EmbeddingService";

/**
 * Interface for embedding generation services
 * Provides a standardized way to create and manage vector embeddings
 */
export interface IEmbeddingService {
  /**
   * Generate an embedding for text
   * @param text Text to embed
   * @param model Optional model to use
   * @returns Vector embedding
   */
  getEmbedding(text: string, model?: string): Promise<number[]>;

  /**
   * Get embedding in SQL format for database operations
   * @param text Text to embed
   * @param model Optional model to use
   * @returns SQL representation of vector embedding
   */
  getEmbeddingSql(text: string, model?: string): Promise<string>;

  /**
   * Generate a structured embedding from a complex input
   * Creates a weighted text representation that emphasizes certain attributes
   * @param input Structured input with various components
   * @param model Optional model to use
   * @returns Vector embedding
   */
  getStructuredEmbedding(
    input: EmbeddingInput,
    model?: string,
  ): Promise<number[]>;

  /**
   * Get structured embedding in SQL format for database operations
   * @param input Structured input with various components
   * @param model Optional model to use
   * @returns SQL representation of vector embedding
   */
  getStructuredEmbeddingSql(
    input: EmbeddingInput,
    model?: string,
  ): Promise<string>;

  /**
   * Parse SQL embedding string back to number array
   * @param sqlEmbedding SQL representation of embedding
   * @returns Vector embedding as number array
   */
  parseSqlEmbedding(sqlEmbedding: string | null | undefined): number[];

  /**
   * Calculate cosine similarity between two embeddings
   * @param a First embedding
   * @param b Second embedding
   * @returns Similarity score from 0 to 1
   */
  calculateSimilarity(a: number[], b: number[]): number;

  /**
   * Clear embedding cache
   * Useful for testing or when embedding model changes
   */
  clearCache(): void;
}
