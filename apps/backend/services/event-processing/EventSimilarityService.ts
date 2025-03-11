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
      configService?.get("eventProcessing.similarityThreshold") || 0.72;
    this.SAME_LOCATION_THRESHOLD = configService?.get("eventProcessing.locationThreshold") || 0.65;
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

      // ---------- TITLE SIMILARITY ----------
      // Calculate title similarity using Jaccard index for word overlap
      const titleSimilarity = this.getJaccardSimilarity(
        eventData.title.toLowerCase(),
        (bestMatch.title || "").toLowerCase()
      );

      // ---------- LOCATION SIMILARITY ----------
      // Generate coordinate points for distance calculation
      const eventCoords = {
        lat: eventData.coordinates[1],
        lng: eventData.coordinates[0],
      };

      const matchCoords = {
        lat: bestMatch.location?.coordinates?.[1] ?? 0,
        lng: bestMatch.location?.coordinates?.[0] ?? 0,
      };

      // Calculate distance between coordinates in meters
      const distanceInMeters = this.calculateDistance(eventCoords, matchCoords);

      // Convert distance to a similarity score (closer = higher score)
      // Events within 100m get a score of 1.0, decreasing as distance increases
      const locationSimilarity = Math.max(0, Math.min(1, 1 - distanceInMeters / 1000));

      // ---------- DATE SIMILARITY ----------
      // Check for date similarity if dates are within 1 day
      const eventDate = new Date(eventData.date);
      const matchDate = new Date(bestMatch.eventDate || Date.now()); // Fallback to now
      const dateDiffMs = Math.abs(eventDate.getTime() - matchDate.getTime());
      const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);
      const dateSimilarity = dateDiffDays <= 1 ? 1 : Math.max(0, 1 - dateDiffDays / 7);

      // ---------- ADDRESS SIMILARITY ----------
      // Check if addresses match closely, handling undefined addresses
      const eventAddress = eventData.address || "";
      const matchAddress = bestMatch.address || "";

      const addressSimilarity = this.getSimilarityScore(
        eventAddress.toLowerCase(),
        matchAddress.toLowerCase()
      );

      // ---------- TIMEZONE SIMILARITY ----------
      // Add timezone matching to improve event comparison
      const eventTimezone = eventData.timezone || "UTC";
      const matchTimezone = bestMatch.timezone || "UTC";
      const timezoneSimilarity = eventTimezone === matchTimezone ? 1.0 : 0.5;

      // ---------- COMPOSITE SCORE ----------
      // Calculate weighted composite score
      // Prioritize location (35%), then title (25%), then date (20%), then address (10%), timezone (5%), then embedding (5%)
      const compositeScore =
        locationSimilarity * 0.35 +
        titleSimilarity * 0.25 +
        dateSimilarity * 0.2 +
        addressSimilarity * 0.1 +
        timezoneSimilarity * 0.05 +
        embeddingScore * 0.05;

      // ---------- MATCH REASON ----------
      // Determine match reason for transparency
      let matchReason = "";

      if (locationSimilarity > 0.95) {
        // Essentially same location (within ~50 meters)
        if (dateSimilarity > 0.9) {
          matchReason = "Same location and same date";
          if (titleSimilarity > 0.6) matchReason += " with similar title";
        } else {
          matchReason = "Same location, different date";
        }
      } else if (locationSimilarity > 0.8 && dateSimilarity > 0.9) {
        matchReason = "Same date at nearby location";
      } else if (titleSimilarity > 0.8 && dateSimilarity > 0.8) {
        matchReason = "Similar title on same date";
      } else if (embeddingScore > 0.85) {
        matchReason = "Very similar overall content";
      } else if (compositeScore > 0.78) {
        matchReason = "Multiple similarity factors";
      }

      // Store detailed match data for logging
      const matchDetails = {
        distance: `${distanceInMeters.toFixed(0)} meters`,
        locationSimilarity: locationSimilarity.toFixed(2),
        titleSimilarity: titleSimilarity.toFixed(2),
        dateSimilarity: dateSimilarity.toFixed(2),
        dateDiffDays: dateDiffDays.toFixed(1),
        addressSimilarity: addressSimilarity.toFixed(2),
        timezoneSimilarity: timezoneSimilarity.toFixed(2),
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
    const locationThreshold = this.SAME_LOCATION_THRESHOLD;

    return !!(
      (similarityResult.score > duplicateThreshold && !!similarityResult.matchingEventId) ||
      (similarityResult.matchReason?.includes("Same location") &&
        similarityResult.score > locationThreshold)
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

  // Helper method to calculate Jaccard similarity for text
  private getJaccardSimilarity(text1: string, text2: string): number {
    // Handle undefined or empty inputs
    if (!text1 || !text2) return 0;

    // Convert texts to word sets
    const words1 = new Set(text1.split(/\s+/).filter(Boolean));
    const words2 = new Set(text2.split(/\s+/).filter(Boolean));

    // Handle empty sets
    if (words1.size === 0 || words2.size === 0) return 0;

    // Count intersection and union
    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    // Return Jaccard index
    return intersection.size / union.size;
  }

  // Helper method to calculate string similarity
  private getSimilarityScore(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    // Simple implementation - calculate percentage of matching words
    const words1 = str1.split(/\s+/).filter(Boolean);
    const words2 = str2.split(/\s+/).filter(Boolean);

    // Handle empty strings
    if (words1.length === 0 || words2.length === 0) return 0;

    // Count matching words
    let matches = 0;
    for (const word of words1) {
      if (words2.includes(word)) matches++;
    }

    // Return percentage of matches
    return matches / Math.max(words1.length, words2.length);
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
