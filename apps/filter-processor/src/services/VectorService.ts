// apps/filter-processor/src/services/VectorService.ts
import pgvector from "pgvector";

/**
 * A lightweight service for vector operations within the filter processor
 * Handles parsing SQL embeddings and calculating vector similarity
 */
export class VectorService {
  private static instance: VectorService;

  /**
   * Get singleton instance
   */
  public static getInstance(): VectorService {
    if (!this.instance) {
      this.instance = new VectorService();
    }
    return this.instance;
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
    try {
      return pgvector.fromSql(sqlEmbedding);
    } catch (error) {
      console.error("Error parsing SQL embedding:", error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a First embedding as number array
   * @param b Second embedding as number array
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
   * Check if two vectors are similar enough based on a threshold
   * @param a First embedding
   * @param b Second embedding
   * @param threshold Similarity threshold (default: 0.7)
   * @returns Boolean indicating if vectors are similar
   */
  public isSimilar(a: number[], b: number[], threshold: number = 0.7): boolean {
    return this.calculateSimilarity(a, b) >= threshold;
  }
}
