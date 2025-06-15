import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock pgvector before importing the service
const mockFromSql = mock((sqlEmbedding: string) => {
  // Simulate parsing SQL embedding string to number array
  if (sqlEmbedding === "[1,2,3]") {
    return [1, 2, 3];
  }
  if (sqlEmbedding === "[0.5,0.8,0.2]") {
    return [0.5, 0.8, 0.2];
  }
  if (sqlEmbedding === "[0,0,0]") {
    return [0, 0, 0];
  }
  if (sqlEmbedding === "[1,0,0]") {
    return [1, 0, 0];
  }
  if (sqlEmbedding === "[0.8,0,0]") {
    return [0.8, 0, 0];
  }
  if (sqlEmbedding === "[0.5,0,0]") {
    return [0.5, 0, 0];
  }
  if (sqlEmbedding === "[0,1,0]") {
    return [0, 1, 0];
  }
  if (sqlEmbedding === "[0.707,0.707,0]") {
    return [0.707, 0.707, 0];
  }
  throw new Error("Invalid SQL embedding");
});

// Mock the pgvector module
mock.module("pgvector", () => ({
  default: {
    fromSql: mockFromSql,
  },
}));

// Import the service after mocking
import { createVectorService } from "../src/services/VectorService";

// Type for VectorService stats
interface VectorServiceStats {
  embeddingsParsed: number;
  similaritiesCalculated: number;
  similarityChecks: number;
  errors: number;
  config: {
    defaultSimilarityThreshold: number;
    enableLogging: boolean;
  };
}

describe("VectorService", () => {
  let vectorService: ReturnType<typeof createVectorService>;

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Create a new instance for each test
    vectorService = createVectorService({
      defaultSimilarityThreshold: 0.7,
      enableLogging: false,
    });
  });

  describe("parseSqlEmbedding", () => {
    test("should parse valid SQL embedding string", () => {
      const result = vectorService.parseSqlEmbedding("[1,2,3]");
      expect(result).toEqual([1, 2, 3]);
      expect(mockFromSql).toHaveBeenCalledWith("[1,2,3]");
    });

    test("should return empty array for null input", () => {
      const result = vectorService.parseSqlEmbedding(null);
      expect(result).toEqual([]);
    });

    test("should return empty array for undefined input", () => {
      const result = vectorService.parseSqlEmbedding(undefined);
      expect(result).toEqual([]);
    });

    test("should return empty array for empty string", () => {
      const result = vectorService.parseSqlEmbedding("");
      expect(result).toEqual([]);
    });

    test("should handle parsing errors gracefully", () => {
      const result = vectorService.parseSqlEmbedding("invalid");
      expect(result).toEqual([]);
    });

    test("should update stats when parsing embeddings", () => {
      vectorService.parseSqlEmbedding("[1,2,3]");
      const stats = vectorService.getStats() as unknown as VectorServiceStats;
      expect(stats.embeddingsParsed).toBe(1);
    });

    test("should update error stats when parsing fails", () => {
      vectorService.parseSqlEmbedding("invalid");
      const stats = vectorService.getStats() as unknown as VectorServiceStats;
      expect(stats.errors).toBe(1);
    });
  });

  describe("calculateSimilarity", () => {
    test("should calculate cosine similarity correctly", () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const result = vectorService.calculateSimilarity(a, b);
      expect(result).toBe(1); // Perfect similarity
    });

    test("should calculate similarity for orthogonal vectors", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const result = vectorService.calculateSimilarity(a, b);
      expect(result).toBe(0); // No similarity
    });

    test("should calculate similarity for partially similar vectors", () => {
      const a = [1, 0, 0];
      const b = [0.707, 0.707, 0]; // 45 degrees
      const result = vectorService.calculateSimilarity(a, b);
      expect(result).toBeCloseTo(0.707, 3);
    });

    test("should return 0 for vectors of different lengths", () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      const result = vectorService.calculateSimilarity(a, b);
      expect(result).toBe(0);
    });

    test("should return 0 for empty vectors", () => {
      const a: number[] = [];
      const b: number[] = [];
      const result = vectorService.calculateSimilarity(a, b);
      expect(result).toBe(0);
    });

    test("should return 0 for zero magnitude vectors", () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      const result = vectorService.calculateSimilarity(a, b);
      expect(result).toBe(0);
    });

    test("should update stats when calculating similarity", () => {
      vectorService.calculateSimilarity([1, 0, 0], [1, 0, 0]);
      const stats = vectorService.getStats() as unknown as VectorServiceStats;
      expect(stats.similaritiesCalculated).toBe(1);
    });

    test("should handle calculation errors gracefully", () => {
      // This test would need more complex mocking to trigger an error
      // For now, we'll test that the function doesn't throw
      expect(() => {
        vectorService.calculateSimilarity([1, 0, 0], [1, 0, 0]);
      }).not.toThrow();
    });
  });

  describe("isSimilar", () => {
    test("should return true for similar vectors above threshold", () => {
      const a = [1, 0, 0];
      const b = [0.9, 0.1, 0]; // Slightly different direction but still similar
      const result = vectorService.isSimilar(a, b, 0.8);
      expect(result).toBe(true);
    });

    test("should return false for vectors below threshold", () => {
      const a = [1, 0, 0];
      const b = [0.5, 0.5, 0]; // 45 degrees - similarity should be ~0.707
      const result = vectorService.isSimilar(a, b, 0.8);
      expect(result).toBe(false);
    });

    test("should use default threshold when not specified", () => {
      const a = [1, 0, 0];
      const b = [0.8, 0.2, 0]; // Similar direction
      const result = vectorService.isSimilar(a, b);
      expect(result).toBe(true); // Should be above default 0.7 threshold
    });

    test("should return false for orthogonal vectors", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const result = vectorService.isSimilar(a, b, 0.5);
      expect(result).toBe(false);
    });

    test("should update similarity check stats", () => {
      vectorService.isSimilar([1, 0, 0], [1, 0, 0]);
      const stats = vectorService.getStats() as unknown as VectorServiceStats;
      expect(stats.similarityChecks).toBe(1);
    });
  });

  describe("getStats", () => {
    test("should return initial stats", () => {
      const stats = vectorService.getStats() as unknown as VectorServiceStats;
      expect(stats).toEqual({
        embeddingsParsed: 0,
        similaritiesCalculated: 0,
        similarityChecks: 0,
        errors: 0,
        config: {
          defaultSimilarityThreshold: 0.7,
          enableLogging: false,
        },
      });
    });

    test("should return updated stats after operations", () => {
      vectorService.parseSqlEmbedding("[1,2,3]");
      vectorService.calculateSimilarity([1, 0, 0], [1, 0, 0]);
      vectorService.isSimilar([1, 0, 0], [1, 0, 0]);

      const stats = vectorService.getStats() as unknown as VectorServiceStats;
      expect(stats.embeddingsParsed).toBe(1);
      expect(stats.similaritiesCalculated).toBe(2); // Called by both calculateSimilarity and isSimilar
      expect(stats.similarityChecks).toBe(1);
      expect(stats.errors).toBe(0);
    });

    test("should include config in stats", () => {
      const customService = createVectorService({
        defaultSimilarityThreshold: 0.9,
        enableLogging: true,
      });

      const stats = customService.getStats() as unknown as VectorServiceStats;
      expect(stats.config.defaultSimilarityThreshold).toBe(0.9);
      expect(stats.config.enableLogging).toBe(true);
    });
  });

  describe("Configuration", () => {
    test("should use custom default similarity threshold", () => {
      const customService = createVectorService({
        defaultSimilarityThreshold: 0.9,
      });

      const a = [1, 0, 0];
      const b = [0.5, 0.5, 0]; // 45 degrees - similarity should be ~0.707
      const result = customService.isSimilar(a, b); // Should use 0.9 threshold
      expect(result).toBe(false); // 0.707 < 0.9
    });

    test("should use default threshold when not specified", () => {
      const defaultService = createVectorService();
      const stats = defaultService.getStats() as unknown as VectorServiceStats;
      expect(stats.config.defaultSimilarityThreshold).toBe(0.7);
    });

    test("should enable logging when configured", () => {
      const loggingService = createVectorService({
        enableLogging: true,
      });

      const stats = loggingService.getStats() as unknown as VectorServiceStats;
      expect(stats.config.enableLogging).toBe(true);
    });
  });

  describe("Integration", () => {
    test("should work end-to-end with SQL embedding parsing and similarity", () => {
      const embedding1 = vectorService.parseSqlEmbedding("[1,0,0]");
      const embedding2 = vectorService.parseSqlEmbedding("[0.707,0.707,0]"); // 45 degrees

      const similarity = vectorService.calculateSimilarity(
        embedding1,
        embedding2,
      );
      const isSimilar = vectorService.isSimilar(embedding1, embedding2, 0.7);

      expect(embedding1).toEqual([1, 0, 0]);
      expect(embedding2).toEqual([0.707, 0.707, 0]);
      expect(similarity).toBeCloseTo(0.707, 3); // cos(45°) ≈ 0.707
      expect(isSimilar).toBe(true); // 0.707 >= 0.7
    });
  });
});
