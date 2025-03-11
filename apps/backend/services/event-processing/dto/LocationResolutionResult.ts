// services/event-processing/dto/LocationResolutionResult.ts

import type { Point } from "geojson";

/**
 * Data transfer object for location resolution results
 * Contains resolved location details and metadata
 */
export interface LocationResolutionResult {
  /**
   * Formatted address of the resolved location
   */
  address: string;

  /**
   * GeoJSON Point with coordinates [longitude, latitude]
   */
  coordinates: Point;

  /**
   * Confidence score from 0 to 1 indicating how confident we are in the resolution
   */
  confidence: number;

  /**
   * IANA timezone identifier for the location (e.g., "America/New_York")
   */
  timezone: string;

  /**
   * ISO timestamp when resolution was performed
   */
  resolvedAt: string;

  /**
   * Error message if resolution failed
   */
  error?: string;
}
