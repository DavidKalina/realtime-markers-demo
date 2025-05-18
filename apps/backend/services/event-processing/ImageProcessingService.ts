// services/event-processing/ImageProcessingService.ts

import { createHash } from "crypto";
import { CacheService } from "../shared/CacheService";
import type { IImageProcessingService } from "./interfaces/IImageProcesssingService";
import type { ImageProcessingResult } from "./dto/ImageProcessingResult";
import { OpenAIModel, OpenAIService } from "../shared/OpenAIService";
import jsQR from "jsqr";
import { Jimp } from "jimp";

export class ImageProcessingService implements IImageProcessingService {
  private readonly VISION_MODEL = "gpt-4o";
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Process an image and extract text content using Vision API
   * @param imageData Buffer or string containing image data
   * @returns Image processing result with extracted text and confidence score
   */
  public async processImage(
    imageData: Buffer | string,
  ): Promise<ImageProcessingResult> {
    // Convert the image data to a base64 string if necessary
    const base64Image = await this.convertToBase64(imageData);

    // Generate a cache key for this image
    const cacheKey = this.generateCacheKey(base64Image);

    // Check if we have this image processed in cache
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Scan for QR code if input is a buffer
    let qrResult: any = { detected: false, data: undefined };
    if (Buffer.isBuffer(imageData)) {
      qrResult = await this.detectQRCode(imageData);
    }

    // Process with Vision API
    const visionResult = await this.callVisionAPI(base64Image);

    // Combine QR detection with vision results
    const result = {
      ...visionResult,
      qrCodeDetected: qrResult.detected || visionResult.qrCodeDetected || false,
      qrCodeData: qrResult.data || visionResult.qrCodeData,
    };

    // Cache the result for future use
    await this.cacheResult(cacheKey, result);

    return result;
  }

  private async detectQRCode(
    imageData: Buffer,
  ): Promise<{ detected: boolean; data?: string }> {
    try {
      // Convert buffer to format jsQR can process
      const image = await Jimp.read(imageData);
      const { width, height, data } = image.bitmap;

      // Scan for QR code
      const qrCode = jsQR(new Uint8ClampedArray(data.buffer), width, height);

      if (qrCode && qrCode.data) {
        return {
          detected: true,
          data: qrCode.data,
        };
      }

      return { detected: false };
    } catch (error) {
      console.error("Error detecting QR code:", error);
      return { detected: false };
    }
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
      const buffer = await import("fs/promises").then((fs) =>
        fs.readFile(imageData),
      );
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
  private async getCachedResult(
    cacheKey: string,
  ): Promise<ImageProcessingResult | null> {
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
  private async cacheResult(
    cacheKey: string,
    result: ImageProcessingResult,
  ): Promise<void> {
    await CacheService.setCachedData(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );
  }

  /**
   * Call Vision API to extract text and analyze the image
   * @param base64Image Base64 encoded image
   * @returns Processing result with extracted text and confidence
   */
  private async callVisionAPI(
    base64Image: string,
  ): Promise<ImageProcessingResult> {
    try {
      // In the callVisionAPI method, update the prompt:
      // In the callVisionAPI method, update the prompt:
      const response = await OpenAIService.executeChatCompletion({
        model: this.VISION_MODEL as OpenAIModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this event flyer and extract as much detail as possible:
               - Check if there's a QR code present in the image (yes/no)
               - Event Title
               - Event Date and Time (be specific about year, month, day, time):
                 * **CRITICAL CHECK FOR THE HOUR DIGIT:** Meticulously examine the hour digit in the time provided.
                 * **Distinguish 1 vs 7:** Pay extremely close attention to these visual cues:
                    - '1': Primarily a **vertical line**. It might have a small horizontal base or a very small flag/serif at the top.
                    - '7': Has a **distinct, long horizontal line across the top**, connected to a diagonal descending line.
                    - **DO NOT confuse a small top serif/flag on a '1' with the long horizontal top bar of a '7'. Look closely at the image.**
                 * **Plausibility Check:** Assess if the extracted time seems reasonable for this type of event based on the overall context of the flyer.
                 * **Other Digit Checks:** Also verify: 11 vs 1, 12 vs 2, 4 vs 9.
                 * **Format:** Verify AM/PM indicators. Include minutes if present (e.g., :00). State time precisely as seen (e.g., 1:00 PM).
               - Any timezone information (EST, PST, GMT, etc.)
               - Full Location Details:
                 * PRIMARY VENUE: Focus on the most prominently displayed location in the image.
                 * Pay attention to visual hierarchy - larger text for locations is likely the actual venue.
                 * EXACT venue name as written (e.g., "Provo Airport", "Grande Ballroom")
                 * Building/Room number if applicable
                 * Full address if provided
                 * City and State
               - Organizer Information (SEPARATE from venue):
                 * Organization name (e.g., "UVU Career Center", "YSA 36TH WARD")
                 * Note this as the ORGANIZER, not the location, if it appears in a less prominent position (like the top).
                 * Look for logos, smaller text at top/bottom/sides that indicate who is hosting, not where.
               - Complete Description (purpose of the event)
               - Any contact information
               - Any social media handles
               - Any other important details (e.g., "All are welcome...")

               IMPORTANT: For location extraction:
               1. Use the EXACT venue name/address as shown in the image.
               2. Clearly distinguish between the EVENT VENUE (where it happens) and the EVENT ORGANIZER (who is hosting).
               3. Consider VISUAL HIERARCHY - larger, more central text is often the title or venue. Smaller text at the top/bottom is often the organizer.
               4. Report organization details (like "YSA 36TH WARD") as the ORGANIZER.

               Format your response with clear separation:
               QR Code Present: [yes/no]
               Event Title: [title]
               Date and Time: [full date and time, paying attention to the 1 vs 7 check]
               Timezone: [timezone, or N/A]
               VENUE ADDRESS: [full address]
               VENUE NAME: [venue name, if distinct from address, otherwise N/A]
               ORGANIZER: [organization hosting the event]
               Description: [event description]
               Contact Info: [contact, or N/A]
               Social Media: [handles, or N/A]
               Other Details: [any other text like welcome message]

               Also, provide a confidence score between 0 and 1, indicating how confident you are that the extraction is an event.
               Confidence Score: [score]`,
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

      // Check if Vision API detected a QR code
      const qrDetected = /QR code.*?:\s*yes/i.test(content);

      return {
        success: true,
        rawText: content,
        confidence: confidence,
        extractedAt: new Date().toISOString(),
        qrCodeDetected: qrDetected,
      };
    } catch (error) {
      console.error("Error calling Vision API:", error);
      return {
        success: false,
        rawText: "",
        confidence: 0,
        extractedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown error processing image",
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
