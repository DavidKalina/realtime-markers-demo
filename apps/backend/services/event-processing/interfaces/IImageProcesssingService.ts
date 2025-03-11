// services/event-processing/interfaces/IImageProcessingService.ts

import type { ImageProcessingResult } from "../dto/ImageProcessingResult";

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
}
