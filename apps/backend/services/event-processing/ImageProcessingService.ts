// services/event-processing/ImageProcessingService.ts

import { createHash } from "crypto";
import { CacheService } from "../shared/CacheService";
import type { IImageProcessingService } from "./interfaces/IImageProcesssingService";
import type { ImageProcessingResult } from "./dto/ImageProcessingResult";
import { OpenAIService } from "../shared/OpenAIService";
import jsQR from "jsqr";
import { Jimp } from "jimp";
import { StorageService } from "../shared/StorageService";

export class ImageProcessingService implements IImageProcessingService {
  private readonly VISION_MODEL = "gpt-4o";
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

  private async preprocessImage(imageBuffer: Buffer, forQR: boolean = false): Promise<Buffer> {
    const sharp = require("sharp");
    let processor = sharp(imageBuffer);

    if (forQR) {
      // Optimize for QR detection
      processor = processor
        .grayscale()
        .sharpen(1, 2, 0.5) // Moderate sharpening
        .normalize() // Normalize contrast
        .threshold(128); // Binary threshold for clearer edges
    } else {
      // Optimize for text extraction
      processor = processor
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: false })
        .modulate({ brightness: 1.05, saturation: 0.8 })
        .sharpen(1, 1, 0.7)
        .normalize();
    }

    return processor.toBuffer();
  }

  /**
   * Process an image and extract text content using Vision API
   * @param imageData Buffer or string containing image data
   * @returns Image processing result with extracted text and confidence score
   */
  // Update processImage method to handle both QR detection and Vision API processing with preprocessed images
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

  private async detectQRCode(imageData: Buffer): Promise<{
    detected: boolean;
    data?: string;
    imageUrls?: { original: string | null; preprocessed: string | null };
  }> {
    try {
      // Get storage service instance
      const storageService = StorageService.getInstance();

      // First preprocess the image optimized for QR detection
      const preprocessedBuffer = await this.preprocessImage(imageData, true);

      // Store both images non-blockingly
      const imageUrls = storageService.storeProcessedImages(
        imageData,
        preprocessedBuffer,
        "qr-detection",
        {
          purpose: "QR code detection",
          timestamp: new Date().toISOString(),
        }
      );

      // Try with preprocessed image first
      try {
        const image = await Jimp.read(preprocessedBuffer);
        const { width, height, data } = image.bitmap;

        // Scan for QR code with preprocessed image
        const qrCode = jsQR(new Uint8ClampedArray(data.buffer), width, height);

        if (qrCode && qrCode.data) {
          console.log("QR code detected with preprocessed image:", qrCode.data);
          return {
            detected: true,
            data: qrCode.data,
            imageUrls: await imageUrls, // await the URL promise here
          };
        }
      } catch (preprocessError) {
        console.error(
          "Error processing QR from preprocessed image, falling back to original:",
          preprocessError
        );
      }

      // Fall back to original image if preprocessing failed or no QR detected
      const image = await Jimp.read(imageData);
      const { width, height, data } = image.bitmap;

      // Scan for QR code with original image
      const qrCode = jsQR(new Uint8ClampedArray(data.buffer), width, height);

      if (qrCode && qrCode.data) {
        console.log("QR code detected with original image:", qrCode.data);
        return {
          detected: true,
          data: qrCode.data,
          imageUrls: await imageUrls, // await the URL promise here
        };
      }

      return {
        detected: false,
        imageUrls: await imageUrls, // await the URL promise here even for failures
      };
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
  // And update the callVisionAPI method:
  private async callVisionAPI(base64Image: string): Promise<ImageProcessingResult> {
    try {
      // If the base64Image is a data URL, extract the data part
      let imageBuffer: Buffer;
      if (base64Image.startsWith("data:image")) {
        const base64Data = base64Image.split(",")[1];
        imageBuffer = Buffer.from(base64Data, "base64");
      } else {
        // Handle case where it's already just base64 data
        imageBuffer = Buffer.from(base64Image, "base64");
      }

      // Get storage service instance
      const storageService = StorageService.getInstance();

      // Preprocess the image for text extraction
      const preprocessedBuffer = await this.preprocessImage(imageBuffer, false);

      // Store both images non-blockingly
      const imageUrls = storageService.storeProcessedImages(
        imageBuffer,
        preprocessedBuffer,
        "vision-api",
        {
          purpose: "Vision API processing",
          timestamp: new Date().toISOString(),
        }
      );

      process.stdout.write(`Debug: ${JSON.stringify(imageUrls)}\n`);

      // Convert back to base64 for the API call
      const preprocessedBase64 = `data:image/jpeg;base64,${preprocessedBuffer.toString("base64")}`;

      const response = await OpenAIService.executeChatCompletion({
        model: this.VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this event flyer and extract as much detail as possible:
                   - Check if there's a QR code present in the image (yes/no)
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
                  url: preprocessedBase64,
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

      // Get the image URLs (non-blocking resolution)
      const urls = await imageUrls;

      return {
        success: true,
        rawText: content,
        confidence: confidence,
        extractedAt: new Date().toISOString(),
        qrCodeDetected: qrDetected,
        // Add URLs to the result
        originalImageUrl: urls.original,
        preprocessedImageUrl: urls.preprocessed,
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
