// apps/filter-processor/src/services/VectorService.ts
import pgvector from "pgvector";

export interface VectorService {
  parseSqlEmbedding(sqlEmbedding: string | null | undefined): number[];
  calculateSimilarity(a: number[], b: number[]): number;
  isSimilar(a: number[], b: number[], threshold?: number): boolean;
  getStats(): Record<string, unknown>;
}

export interface VectorServiceConfig {
  defaultSimilarityThreshold?: number;
  enableLogging?: boolean;
}

/**
 * A lightweight service for vector operations within the filter processor
 * Handles parsing SQL embeddings and calculating vector similarity
 */
export function createVectorService(
  config: VectorServiceConfig = {},
): VectorService {
  const { defaultSimilarityThreshold = 0.7, enableLogging = false } = config;

  // Stats for monitoring
  const stats = {
    embeddingsParsed: 0,
    similaritiesCalculated: 0,
    similarityChecks: 0,
    errors: 0,
  };

  /**
   * Parse SQL embedding string back to number array
   * @param sqlEmbedding SQL representation of embedding
   * @returns Vector embedding as number array
   */
  function parseSqlEmbedding(
    sqlEmbedding: string | null | undefined,
  ): number[] {
    if (!sqlEmbedding) {
      return [];
    }
    try {
      const embedding = pgvector.fromSql(sqlEmbedding);
      stats.embeddingsParsed++;

      if (enableLogging) {
        console.log("[VectorService] Parsed embedding:", {
          length: embedding.length,
          totalParsed: stats.embeddingsParsed,
        });
      }

      return embedding;
    } catch (error) {
      console.error("[VectorService] Error parsing SQL embedding:", error);
      stats.errors++;
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a First embedding as number array
   * @param b Second embedding as number array
   * @returns Similarity score from 0 to 1
   */
  function calculateSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0 || b.length === 0) {
      if (enableLogging) {
        console.log(
          "[VectorService] Invalid vectors for similarity calculation:",
          {
            aLength: a.length,
            bLength: b.length,
          },
        );
      }
      return 0;
    }

    try {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

      // Avoid division by zero
      if (magnitudeA === 0 || magnitudeB === 0) {
        if (enableLogging) {
          console.log("[VectorService] Zero magnitude vector detected");
        }
        return 0;
      }

      const similarity = dotProduct / (magnitudeA * magnitudeB);
      stats.similaritiesCalculated++;

      if (enableLogging) {
        console.log("[VectorService] Calculated similarity:", {
          similarity: similarity.toFixed(4),
          totalCalculated: stats.similaritiesCalculated,
        });
      }

      return similarity;
    } catch (error) {
      console.error("[VectorService] Error calculating similarity:", error);
      stats.errors++;
      return 0;
    }
  }

  /**
   * Check if two vectors are similar enough based on a threshold
   * @param a First embedding
   * @param b Second embedding
   * @param threshold Similarity threshold (default: 0.7)
   * @returns Boolean indicating if vectors are similar
   */
  function isSimilar(
    a: number[],
    b: number[],
    threshold: number = defaultSimilarityThreshold,
  ): boolean {
    const similarity = calculateSimilarity(a, b);
    const isSimilarResult = similarity >= threshold;
    stats.similarityChecks++;

    if (enableLogging) {
      console.log("[VectorService] Similarity check:", {
        similarity: similarity.toFixed(4),
        threshold,
        isSimilar: isSimilarResult,
        totalChecks: stats.similarityChecks,
      });
    }

    return isSimilarResult;
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      config: {
        defaultSimilarityThreshold,
        enableLogging,
      },
    };
  }

  return {
    parseSqlEmbedding,
    calculateSimilarity,
    isSimilar,
    getStats,
  };
}
