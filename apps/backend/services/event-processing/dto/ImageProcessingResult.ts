// services/event-processing/dto/ImageProcessingResult.ts

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
}
