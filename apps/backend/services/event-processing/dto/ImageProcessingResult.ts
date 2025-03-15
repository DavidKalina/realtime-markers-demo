// services/event-processing/dto/ImageProcessingResult.ts

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

  originalImageUrl?: string | null;
  preprocessedImageUrl?: string | null;
}
