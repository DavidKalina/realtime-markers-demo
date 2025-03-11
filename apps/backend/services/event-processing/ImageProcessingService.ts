// services/event-processing/ImageProcessingService.ts

import { createHash } from "crypto";
import { CacheService } from "../shared/CacheService";
import type { IImageProcessingService } from "./interfaces/IImageProcesssingService";
import type { ImageProcessingResult } from "./dto/ImageProcessingResult";
import { OpenAIService } from "../shared/OpenAIService";

export class ImageProcessingService implements IImageProcessingService {
  private readonly VISION_MODEL = "gpt-4o";
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Process an image and extract text content using Vision API
   * @param imageData Buffer or string containing image data
   * @returns Image processing result with extracted text and confidence score
   */
  public async processImage(imageData: Buffer | string): Promise<ImageProcessingResult> {
    // Convert the image data to a base64 string if necessary
    const base64Image = await this.convertToBase64(imageData);

    // Generate a cache key for this image
    const cacheKey = this.generateCacheKey(base64Image);

    // Check if we have this image processed in cache
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      console.log("Using cached image processing result");
      return cachedResult;
    }

    // Process with Vision API if not in cache
    const visionResult = await this.callVisionAPI(base64Image);

    // Cache the result for future use
    await this.cacheResult(cacheKey, visionResult);

    return visionResult;
  }

  /**
   * Convert image data to base64 format
   * @param imageData Buffer or string containing image data
   * @returns Base64 encoded image string
   */
  private async convertToBase64(imageData: Buffer | string): Promise<string> {
    // Handle different input types
    if (typeof imageData === "string") {
      // If it's already a base64 data URL, return as is
      if (imageData.startsWith("data:image")) {
        return imageData;
      }
      // If it's a file path, read and convert
      const buffer = await import("fs/promises").then((fs) => fs.readFile(imageData));
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
    // If it's a buffer, convert to base64
    return `data:image/jpeg;base64,${imageData.toString("base64")}`;
  }

  /**
   * Generate a cache key for the given image
   * @param base64Image Base64 encoded image
   * @returns MD5 hash as cache key
   */
  private generateCacheKey(base64Image: string): string {
    // Create a hash for this image to use as cache key
    // Use only first 100 chars of base64 to avoid excessively long keys
    // while still being unique enough to identify the image
    return `vision:${createHash("md5").update(base64Image.substring(0, 100)).digest("hex")}`;
  }

  /**
   * Check if this image has been processed before and is in cache
   * @param cacheKey The cache key for this image
   * @returns Cached result or null if not in cache
   */
  private async getCachedResult(cacheKey: string): Promise<ImageProcessingResult | null> {
    const cachedData = await CacheService.getCachedData(cacheKey);
    if (cachedData) {
      try {
        return JSON.parse(cachedData) as ImageProcessingResult;
      } catch (error) {
        console.error("Error parsing cached image result:", error);
      }
    }
    return null;
  }

  /**
   * Save processing result to cache
   * @param cacheKey The cache key for this image
   * @param result The processing result to cache
   */
  private async cacheResult(cacheKey: string, result: ImageProcessingResult): Promise<void> {
    await CacheService.setCachedData(cacheKey, JSON.stringify(result), this.CACHE_TTL);
  }

  /**
   * Call Vision API to extract text and analyze the image
   * @param base64Image Base64 encoded image
   * @returns Processing result with extracted text and confidence
   */
  private async callVisionAPI(base64Image: string): Promise<ImageProcessingResult> {
    try {
      const response = await OpenAIService.executeChatCompletion({
        model: this.VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this event flyer and extract as much detail as possible:
                     - Event Title
                     - Event Date and Time (be specific about year, month, day, time)
                     - Any timezone information (EST, PST, GMT, etc.)
                     - Full Location Details (venue name, address, city, state)
                     - Complete Description
                     - Any contact information
                     - Any social media handles
                     - Any other important details

                     Also, provide a confidence score between 0 and 1, indicating how confident you are that the extraction is an event.
                     Consider whether there's a date, a time, and a location.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Image,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content || "";

      // Extract confidence score from the response
      const confidence = this.extractConfidenceScore(content);

      return {
        success: true,
        rawText: content,
        confidence: confidence,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error calling Vision API:", error);
      return {
        success: false,
        rawText: "",
        confidence: 0,
        extractedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error processing image",
      };
    }
  }

  /**
   * Extract confidence score from Vision API response text
   * @param text The response text from Vision API
   * @returns Confidence score between 0 and 1
   */
  private extractConfidenceScore(text: string): number {
    const match = text.match(/Confidence Score[^\d]*(\d*\.?\d+)/i);
    return match ? parseFloat(match[1]) : 0.5; // Default to 0.5 if not found
  }
}
