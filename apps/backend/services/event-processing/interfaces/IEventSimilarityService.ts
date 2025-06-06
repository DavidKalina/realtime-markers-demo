// services/event-processing/interfaces/IEventSimilarityService.ts

import type { SimilarityResult } from "../dto/SimilarityResult";
import { RecurrenceFrequency, DayOfWeek } from "../../../entities/Event";

export interface EventComparisonData {
  title: string;
  date: string;
  endDate?: string;
  coordinates: [number, number];
  address?: string;
  description?: string;
  timezone?: string;
  // Add recurrence fields
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceTime?: string;
}

/**
 * Interface for event similarity detection and duplicate handling
 */
export interface IEventSimilarityService {
  /**
   * Find similar events based on embedding and event details
   * @param embedding Vector embedding of the event
   * @param eventData Data about the event to check for similarity
   * @returns Result with similarity score and matching event info if found
   */
  findSimilarEvents(
    embedding: number[],
    eventData: EventComparisonData,
  ): Promise<SimilarityResult>;

  /**
   * Check if an event is a duplicate using similarity information
   * @param similarityResult The similarity information
   * @param threshold Optional custom threshold to override default
   * @returns Boolean indicating if event is a duplicate
   */
  isDuplicate(similarityResult: SimilarityResult, threshold?: number): boolean;

  /**
   * Handle a duplicate scan by incrementing the scan count
   * @param eventId The ID of the duplicate event detected
   * @returns Promise resolving when operation is complete
   */
  handleDuplicateScan(eventId: string): Promise<void>;
}
