// services/event-processing/dto/ImageProcessingResult.ts

import { RecurrenceFrequency, DayOfWeek } from "../../../entities/Event";

/**
 * Structured data extracted from an event image
 */
export interface EventStructuredData {
  /**
   * Event title
   */
  title?: string;

  /**
   * Event date and time as extracted from the image
   */
  dateTime?: string;

  /**
   * Timezone information
   */
  timezone?: string;

  /**
   * Full venue address
   */
  venueAddress?: string;

  /**
   * Venue name if distinct from address
   */
  venueName?: string;

  /**
   * Organization hosting the event
   */
  organizer?: string;

  /**
   * Event description
   */
  description?: string;

  /**
   * Contact information
   */
  contactInfo?: string;

  /**
   * Social media handles
   */
  socialMedia?: string;

  /**
   * Any other important details
   */
  otherDetails?: string;

  // Add recurrence fields
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceTime?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number | null;
}

/**
 * Privacy validation result for event processing
 */
export interface PrivacyValidationResult {
  isPublicEvent: boolean;
  confidence: number;
  reason: string;
  containsPrivateInfo: boolean;
  privateInfoTypes: string[];
  /**
   * Token usage for the privacy validation model call
   */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Represents the result of image processing operations
 * Contains extracted text and metadata about the processing
 */
export interface ImageProcessingResult {
  /**
   * Indicates if the image processing was successful
   */
  success: boolean;

  /**
   * The raw text extracted from the image
   */
  rawText: string;

  /**
   * Confidence score (0-1) indicating likelihood that the content is an event
   */
  confidence: number;

  /**
   * ISO timestamp when extraction was performed
   */
  extractedAt: string;

  /**
   * Error message if processing failed
   */
  error?: string;

  qrCodeDetected?: boolean;

  qrCodeData?: string;

  /**
   * Structured data extracted from the event
   */
  structuredData?: EventStructuredData;

  /**
   * Privacy validation result
   */
  privacyValidation?: PrivacyValidationResult;

  /**
   * Token usage for AI calls used during image processing
   */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
