// services/event-processing/interfaces/IEventExtractionService.ts

import type { Category } from "../../../entities/Category";
import type { EventExtractionResult } from "../dto/EventExtractionResult";

/**
 * Interface for event extraction services
 * Responsible for extracting structured event information from text
 */
export interface IEventExtractionService {
  /**
   * Extract structured event details from text
   * @param text Text to extract event details from
   * @param options Optional extraction options
   * @returns Structured event details
   */
  extractEventDetails(
    text: string,
    options?: {
      userCoordinates?: { lat: number; lng: number };
      organizationHints?: string[];
      userCityState?: string;
    },
  ): Promise<EventExtractionResult>;

  /**
   * Extract just the categories from text
   * @param text Text to extract categories from
   * @returns Array of category objects
   */
  extractCategories(text: string): Promise<Category[]>;

  /**
   * Generate an emoji and description for an event based on its title and description
   * @param title The event title
   * @param description The event description
   * @returns Object containing the emoji and its description
   */
  generateEventEmoji(
    title: string,
    description: string,
  ): Promise<{ emoji: string; emojiDescription: string }>;
}
