// services/event-processing/interfaces/IImageProcessingService.ts

import type { ImageProcessingResult } from "../dto/ImageProcessingResult";
import type { MultiEventProcessingResult } from "../ImageProcessingService";

/**
 * Interface for image processing services
 * Responsible for converting and extracting text from images
 */
export interface IImageProcessingService {
  /**
   * Process an image and extract text content
   * @param imageData Buffer or string containing image data
   * @returns Image processing result with extracted text and confidence score
   */
  processImage(imageData: Buffer | string): Promise<ImageProcessingResult>;

  /**
   * Process an image that may contain multiple events
   * @param imageData Buffer or string containing image data
   * @returns Multi-event processing result with array of events
   */
  processMultiEventImage(
    imageData: Buffer | string,
  ): Promise<MultiEventProcessingResult>;
}
