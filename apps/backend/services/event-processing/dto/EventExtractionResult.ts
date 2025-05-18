// services/event-processing/dto/EventExtractionResult.ts

import type { Point } from "geojson";
import type { Category } from "../../../entities/Category";

/**
 * Data transfer object for event extraction results
 * Contains structured event details and metadata
 */
export interface EventExtractionResult {
  /**
   * The raw data extracted from the text
   * Contains all fields returned by the extraction API
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawExtractedData: Record<string, any>;

  /**
   * The structured event data
   */
  event: {
    /**
     * Emoji representing the event
     */
    emoji: string;

    /**
     * Text description of what the emoji represents
     */
    emojiDescription?: string;

    /**
     * Event title
     */
    title: string;

    /**
     * ISO formatted event start date and time
     */
    date: string;

    /**
     * ISO formatted event end date and time (optional)
     */
    endDate?: string;

    /**
     * Formatted address of the event
     */
    address: string;

    /**
     * GeoJSON Point with coordinates [longitude, latitude]
     */
    location: Point;

    /**
     * Event description
     */
    description: string;

    /**
     * Event categories
     */
    categories: Category[];

    /**
     * IANA timezone identifier (e.g., "America/New_York")
     */
    timezone: string;

    /**
     * Additional location context like building names, room numbers, etc.
     */
    locationNotes?: string;
  };

  /**
   * Details about location resolution
   */
  locationDetails: {
    /**
     * Confidence score for location resolution (0-1)
     */
    confidence: number;

    /**
     * When the location was resolved
     */
    resolvedAt: string;

    /**
     * Location clues used for resolution
     */
    clues: string[];
  };
}
