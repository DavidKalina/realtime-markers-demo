// services/event-processing/EventSimilarityService.ts

import { Repository } from "typeorm";
import pgvector from "pgvector";
import { Event } from "../../entities/Event";
import { type IEventSimilarityService } from "./interfaces/IEventSimilarityService";
import { type SimilarityResult } from "./dto/SimilarityResult";
import type { ConfigService } from "../shared/ConfigService";

/**
 * Service for detecting event similarity and duplicates
 */
export class EventSimilarityService implements IEventSimilarityService {
  // Default thresholds from configuration
  private readonly DUPLICATE_SIMILARITY_THRESHOLD: number;
  private readonly SAME_LOCATION_THRESHOLD: number;

  /**
   * Creates a new EventSimilarityService
   * @param eventRepository Repository for Event entities
   * @param configService Optional configuration service
   */
  constructor(private eventRepository: Repository<Event>, configService?: ConfigService) {
    // Get thresholds from config or use defaults
    this.DUPLICATE_SIMILARITY_THRESHOLD =
      configService?.get("eventProcessing.similarityThreshold") || 0.65;
    this.SAME_LOCATION_THRESHOLD = configService?.get("eventProcessing.locationThreshold") || 0.55;
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
      date: string;
      coordinates: [number, number];
      address?: string;
      description?: string;
      timezone?: string;
    }
  ): Promise<SimilarityResult> {
    try {
      // First, use vector search to find potential matches
      const similarEvents = await this.eventRepository
        .createQueryBuilder("event")
        .where("event.embedding IS NOT NULL")
        .orderBy("embedding <-> :embedding")
        .setParameters({ embedding: pgvector.toSql(embedding) })
        .limit(5)
        .getMany();

      if (similarEvents.length === 0) {
        return { score: 0 };
      }

      // Get best match from vector similarity
      const bestMatch = similarEvents[0];

      // Calculate embedding similarity score
      const embeddingScore = this.calculateCosineSimilarity(
        embedding,
        pgvector.fromSql(bestMatch.embedding)
      );

      // ---------- LOCATION SIMILARITY ----------
      // Only consider location if embedding similarity is high enough
      const eventCoords = {
        lat: eventData.coordinates[1],
        lng: eventData.coordinates[0],
      };

      const matchCoords = {
        lat: bestMatch.location?.coordinates?.[1] ?? 0,
        lng: bestMatch.location?.coordinates?.[0] ?? 0,
      };

      const locationSimilarity = this.calculateLocationSimilarity(
        eventCoords,
        matchCoords,
        new Date(eventData.date),
        new Date(bestMatch.eventDate || Date.now())
      );

      // ---------- COMPOSITE SCORE ----------
      // Use a weighted combination of embedding (80%) and location (20%)
      const compositeScore = embeddingScore * 0.8 + locationSimilarity * 0.2;

      // ---------- MATCH REASON ----------
      let matchReason = "";
      if (embeddingScore > 0.85) {
        matchReason = "Very similar content";
        if (locationSimilarity > 0.8) {
          matchReason += " at same location";
        }
      } else if (embeddingScore > 0.75 && locationSimilarity > 0.9) {
        matchReason = "Similar content at same location";
      } else if (compositeScore > 0.7) {
        matchReason = "Multiple similarity factors";
      }

      // Store detailed match data for logging
      const matchDetails = {
        distance: `${this.calculateDistance(eventCoords, matchCoords).toFixed(0)} meters`,
        locationSimilarity: locationSimilarity.toFixed(2),
        embeddingScore: embeddingScore.toFixed(2),
        compositeScore: compositeScore.toFixed(2),
        timezone: eventData.timezone,
        matchTimezone: bestMatch.timezone,
      };

      console.log("Duplicate detection metrics:", {
        eventId: bestMatch.id,
        title: bestMatch.title || "[No title]",
        eventTitle: eventData.title,
        ...matchDetails,
        matchReason,
      });

      // Check if it's a duplicate based on thresholds
      const isDuplicate = this.isDuplicate({
        score: compositeScore,
        matchingEventId: bestMatch.id,
        matchReason,
        matchDetails,
      });

      return {
        score: compositeScore,
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
  public isDuplicate(similarityResult: SimilarityResult, threshold?: number): boolean {
    // Use provided threshold or default
    const duplicateThreshold = threshold || this.DUPLICATE_SIMILARITY_THRESHOLD;

    // Consider it a duplicate if:
    // 1. High embedding similarity (>0.85) OR
    // 2. Good composite score (>threshold) with high location similarity (>0.8)
    return !!(
      (similarityResult.matchDetails?.embeddingScore &&
        parseFloat(similarityResult.matchDetails.embeddingScore) > 0.85) ||
      (similarityResult.score > duplicateThreshold &&
        similarityResult.matchDetails?.locationSimilarity &&
        parseFloat(similarityResult.matchDetails.locationSimilarity) > 0.8)
    );
  }

  /**
   * Handle a duplicate scan by incrementing the scan count
   * @param eventId The ID of the duplicate event detected
   * @returns Promise resolving when operation is complete
   */
  public async handleDuplicateScan(eventId: string): Promise<void> {
    await this.eventRepository.increment({ id: eventId }, "scanCount", 1);
    console.log(`Incremented scan count for duplicate event: ${eventId}`);
  }

  // Helper method to calculate distance between coordinates in meters
  private calculateDistance(
    coords1: { lat: number; lng: number },
    coords2: { lat: number; lng: number }
  ): number {
    // Check for invalid coordinates
    if (isNaN(coords1.lat) || isNaN(coords1.lng) || isNaN(coords2.lat) || isNaN(coords2.lng)) {
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
    eventDate2: Date
  ): number {
    const distance = this.calculateDistance(coords1, coords2);

    // Calculate time difference in hours
    const timeDiffHours = Math.abs(eventDate1.getTime() - eventDate2.getTime()) / (1000 * 60 * 60);

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
}
