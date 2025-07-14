// services/event-processing/EventSimilarityService.ts

import { Repository } from "typeorm";
import pgvector from "pgvector";
import { Event } from "@realtime-markers/database";
import { Event";
import { type IEventSimilarityService } from "./interfaces/IEventSimilarityService";
import { type SimilarityResult } from "./dto/SimilarityResult";
import type { ConfigService } from "../shared/ConfigService";
import { Brackets } from "typeorm";

/**
 * Service for detecting event similarity and duplicates
 */
export class EventSimilarityService implements IEventSimilarityService {
  // Default thresholds from configuration
  private readonly DUPLICATE_SIMILARITY_THRESHOLD: number;
  private readonly SAME_LOCATION_THRESHOLD: number;
  private readonly TITLE_SIMILARITY_THRESHOLD: number;

  /**
   * Creates a new EventSimilarityService
   * @param eventRepository Repository for Event entities
   * @param configService Optional configuration service
   */
  constructor(
    private eventRepository: Repository<Event>,
    configService?: ConfigService,
  ) {
    // Lower thresholds to catch more potential duplicates
    this.DUPLICATE_SIMILARITY_THRESHOLD =
      configService?.get("eventProcessing.similarityThreshold") || 0.55; // Reduced from 0.65
    this.SAME_LOCATION_THRESHOLD =
      configService?.get("eventProcessing.locationThreshold") || 0.45; // Reduced from 0.55
    this.TITLE_SIMILARITY_THRESHOLD =
      configService?.get("eventProcessing.titleThreshold") || 0.8;
  }

  /**
   * Find similar events based on embedding and event details
   * @param embedding Vector embedding of the event
   * @param eventData Data about the event to check for similarity
   * @returns Result with similarity score and matching event info if found
   */
  public async findSimilarEvents(
    embedding: number[],
    eventData: {
      title: string;
      address?: string;
      description?: string;
      locationNotes?: string;
      emoji?: string;
    },
  ): Promise<SimilarityResult> {
    try {
      // Early return for invalid events
      if (!embedding || embedding.length === 0) {
        return { score: 0 };
      }

      // Check for black image or invalid event cases
      if (
        eventData.description?.toLowerCase().includes("black") ||
        eventData.description?.toLowerCase().includes("invalid") ||
        eventData.description?.toLowerCase().includes("cannot extract")
      ) {
        return { score: 0 };
      }

      // Use vector search with text-based pre-filtering
      const similarEvents = await this.eventRepository
        .createQueryBuilder("event")
        .where("event.embedding IS NOT NULL")
        .andWhere(
          new Brackets((qb) => {
            qb.where("LOWER(event.title) LIKE LOWER(:title)");
          }),
        )
        // Combine vector similarity with text matching score
        .addSelect(
          `(
            -- Vector similarity (70% weight)
            (1 - (event.embedding::vector <-> :embedding::vector)::float) * 0.7 +
            
            -- Title match (30% weight)
            CASE 
              WHEN LOWER(event.title) = LOWER(:title) THEN 0.3
              WHEN LOWER(event.title) LIKE LOWER(:titleLike) THEN 0.15
              ELSE 0
            END
          )`,
          "similarity_score",
        )
        .orderBy("similarity_score", "DESC")
        .setParameters({
          embedding: pgvector.toSql(embedding),
          title: eventData.title.toLowerCase(),
          titleLike: `%${eventData.title.toLowerCase()}%`,
        })
        .limit(5)
        .getMany();

      if (similarEvents.length === 0) {
        return { score: 0 };
      }

      const bestMatch = similarEvents[0];
      const embeddingScore = this.calculateCosineSimilarity(
        embedding,
        pgvector.fromSql(bestMatch.embedding),
      );

      // Enhanced match reason logic
      let matchReason = "";
      const titleSimilarity = this.calculateStringSimilarity(
        bestMatch.title.toLowerCase(),
        eventData.title.toLowerCase(),
      );

      if (embeddingScore > 0.8) {
        matchReason = "Very similar content";
      } else if (
        titleSimilarity > this.TITLE_SIMILARITY_THRESHOLD &&
        bestMatch.address?.toLowerCase() === eventData.address?.toLowerCase()
      ) {
        matchReason = "Similar title at same location";
      } else if (embeddingScore > 0.65) {
        matchReason = "Similar content";
      } else if (titleSimilarity > this.TITLE_SIMILARITY_THRESHOLD) {
        matchReason = "Similar title";
      } else if (
        bestMatch.address?.toLowerCase() === eventData.address?.toLowerCase() &&
        bestMatch.emoji === eventData.emoji
      ) {
        matchReason = "Same location and event type";
      }

      const matchDetails = {
        embeddingScore: embeddingScore.toFixed(2),
        titleSimilarity: titleSimilarity.toFixed(2),
        titleMatch:
          bestMatch.title.toLowerCase() === eventData.title.toLowerCase(),
        addressMatch:
          bestMatch.address?.toLowerCase() === eventData.address?.toLowerCase(),
        locationNotesMatch:
          bestMatch.locationNotes?.toLowerCase() ===
          eventData.locationNotes?.toLowerCase(),
        emojiMatch: bestMatch.emoji === eventData.emoji,
      };

      const isDuplicate = this.isDuplicate({
        score: embeddingScore,
        matchingEventId: bestMatch.id,
        matchReason,
        matchDetails,
      });

      return {
        score: embeddingScore,
        matchingEventId: bestMatch.id,
        matchReason,
        matchDetails,
        isDuplicate,
      };
    } catch (error) {
      console.error("Error in findSimilarEvents:", error);
      return { score: 0 };
    }
  }

  /**
   * Check if an event is a duplicate using similarity information
   * @param similarityResult The similarity information
   * @param threshold Optional custom threshold to override default
   * @returns Boolean indicating if event is a duplicate
   */
  public isDuplicate(
    similarityResult: SimilarityResult,
    threshold?: number,
  ): boolean {
    // Use provided threshold or default
    const duplicateThreshold = threshold || this.DUPLICATE_SIMILARITY_THRESHOLD;

    // Enhanced duplicate detection logic
    // Consider it a duplicate if ANY of these conditions are met:
    return !!(
      // 1. Very high embedding similarity
      (
        (similarityResult.matchDetails?.embeddingScore &&
          parseFloat(similarityResult.matchDetails.embeddingScore) > 0.8) ||
        // 2. Good composite score with location match
        (similarityResult.score > duplicateThreshold &&
          similarityResult.matchDetails?.addressMatch) ||
        // 3. Very similar title with same location
        (similarityResult.matchDetails?.titleSimilarity &&
          parseFloat(similarityResult.matchDetails.titleSimilarity) >
            this.TITLE_SIMILARITY_THRESHOLD &&
          similarityResult.matchDetails?.addressMatch) ||
        // 4. Same location, same emoji, and moderate similarity
        (similarityResult.matchDetails?.addressMatch &&
          similarityResult.matchDetails?.emojiMatch &&
          similarityResult.score > this.SAME_LOCATION_THRESHOLD)
      )
    );
  }

  /**
   * Handle a duplicate scan by incrementing the scan count
   * @param eventId The ID of the duplicate event detected
   * @returns Promise resolving when operation is complete
   */
  public async handleDuplicateScan(eventId: string): Promise<void> {
    await this.eventRepository.increment({ id: eventId }, "scanCount", 1);
  }

  // Helper method to calculate distance between coordinates in meters
  private calculateDistance(
    coords1: { lat: number; lng: number },
    coords2: { lat: number; lng: number },
  ): number {
    // Check for invalid coordinates
    if (
      isNaN(coords1.lat) ||
      isNaN(coords1.lng) ||
      isNaN(coords2.lat) ||
      isNaN(coords2.lng)
    ) {
      return 10000; // Return large distance if coordinates are invalid
    }

    // Haversine formula for accurate earth distance
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters

    const dLat = toRad(coords2.lat - coords1.lat);
    const dLng = toRad(coords2.lng - coords1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coords1.lat)) *
        Math.cos(toRad(coords2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // Distance in meters
  }

  // Helper method to calculate location similarity score
  private calculateLocationSimilarity(
    coords1: { lat: number; lng: number },
    coords2: { lat: number; lng: number },
    eventDate1: Date,
    eventDate2: Date,
  ): number {
    const distance = this.calculateDistance(coords1, coords2);

    // Calculate time difference in hours
    const timeDiffHours =
      Math.abs(eventDate1.getTime() - eventDate2.getTime()) / (1000 * 60 * 60);

    // Define distance thresholds based on time difference
    let maxDistance: number;
    if (timeDiffHours <= 1) {
      // Same hour: very strict (50m)
      maxDistance = 50;
    } else if (timeDiffHours <= 24) {
      // Same day: moderate (200m)
      maxDistance = 200;
    } else if (timeDiffHours <= 168) {
      // 1 week
      // Same week: more lenient (500m)
      maxDistance = 500;
    } else {
      // Different weeks: most lenient (1000m)
      maxDistance = 1000;
    }

    // Calculate similarity score with exponential decay
    const similarity = Math.exp(-distance / maxDistance);

    // Add a small penalty for time difference
    const timePenalty = Math.min(1, timeDiffHours / 24);

    return similarity * (1 - timePenalty * 0.2); // 20% max penalty for time difference
  }

  // Helper method to calculate cosine similarity between vectors
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  // New helper method to calculate string similarity using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  // Helper method to calculate Levenshtein distance
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] =
            1 +
            Math.min(
              dp[i - 1][j], // deletion
              dp[i][j - 1], // insertion
              dp[i - 1][j - 1], // substitution
            );
        }
      }
    }

    return dp[m][n];
  }
}
