// services/event-processing/dto/SimilarityResult.ts

/**
 * Result of an event similarity comparison
 * Contains score and matching event information
 */
export interface SimilarityResult {
  /**
   * Composite similarity score from 0 to 1
   * Higher scores indicate greater similarity
   */
  score: number;

  /**
   * ID of the matching event if found
   */
  matchingEventId?: string;

  /**
   * Human-readable explanation of the match
   */
  matchReason?: string;

  /**
   * Detailed metrics about the match for debugging
   */
  matchDetails?: {
    distance?: string;
    locationSimilarity?: string;
    titleSimilarity?: string;
    dateSimilarity?: string;
    dateDiffDays?: string;
    addressSimilarity?: string;
    timezoneSimilarity?: string;
    embeddingScore?: string;
    compositeScore?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };

  /**
   * Boolean flag indicating if this is a duplicate event
   */
  isDuplicate?: boolean;
}
