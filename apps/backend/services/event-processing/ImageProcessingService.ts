// services/event-processing/ImageProcessingService.ts

import { createHash } from "crypto";
import { ImageProcessingCacheService } from "../shared/ImageProcessingCacheService";
import type { IImageProcessingService } from "./interfaces/IImageProcesssingService";
import type { ImageProcessingResult } from "./dto/ImageProcessingResult";
import { OpenAIModel, OpenAIService } from "../shared/OpenAIService";
import jsQR from "jsqr";
import { Jimp } from "jimp";
import { RecurrenceFrequency, DayOfWeek } from "../../entities/Event";
import { AiService, type AIResponse } from "../AIService";
import { z } from "zod";

// Define Zod schemas for our data structures
const RecurrenceFrequencyEnum = z.nativeEnum(RecurrenceFrequency);
const DayOfWeekEnum = z.nativeEnum(DayOfWeek);

const EventStructuredDataSchema = z.object({
  title: z.string().optional(),
  dateTime: z.string().optional(),
  timezone: z.string().optional(),
  venueAddress: z.string().optional(),
  venueName: z.string().optional(),
  organizer: z.string().optional(),
  description: z.string().optional(),
  contactInfo: z.string().optional(),
  socialMedia: z.string().optional(),
  otherDetails: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.string().optional(),
  recurrenceFrequency: RecurrenceFrequencyEnum.optional(),
  recurrenceDays: z.array(DayOfWeekEnum).optional(),
  recurrenceTime: z.string().optional(),
  recurrenceStartDate: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
  recurrenceInterval: z.number().nullable().optional(),
});

const EventSchema = z.object({
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  qrCodeDetected: z.boolean().optional(),
  qrCodeData: z.string().optional(),
  structuredData: EventStructuredDataSchema.optional(),
});

const ProcessingResultSchema = z.object({
  success: z.boolean(),
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  extractedAt: z.string(),
  qrCodeDetected: z.boolean().optional(),
  qrCodeData: z.string().optional(),
  error: z.string().optional(),
  isMultiEvent: z.boolean().optional(),
  events: z.array(EventSchema).optional(),
  structuredData: EventStructuredDataSchema.optional(),
});

const MultiEventProcessingResultSchema = z.object({
  success: z.boolean(),
  isMultiEvent: z.boolean(),
  events: z.array(ProcessingResultSchema),
  extractedAt: z.string(),
  error: z.string().optional(),
});

export type EventStructuredData = z.infer<typeof EventStructuredDataSchema>;
export type MultiEventProcessingResult = z.infer<
  typeof MultiEventProcessingResultSchema
>;

export type ProcessingResult = z.infer<typeof ProcessingResultSchema>;

const createErrorResult = (error: unknown): ProcessingResult => ({
  success: false,
  rawText: "",
  confidence: 0,
  extractedAt: new Date().toISOString(),
  qrCodeDetected: false,
  error: error instanceof Error ? error.message : "Failed to process image",
  structuredData: {
    title: "",
    dateTime: new Date().toISOString(),
  },
});

export class ImageProcessingService implements IImageProcessingService {
  private readonly VISION_MODEL = "gpt-4o";
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

  private static instance: ImageProcessingService;

  private constructor() {}

  public static getInstance(): ImageProcessingService {
    if (!this.instance) {
      this.instance = new ImageProcessingService();
    }
    return this.instance;
  }

  /**
   * Process an image and extract text content using Vision API
   * @param imageData Buffer or string containing image data
   * @returns Image processing result with extracted text and confidence score
   */
  public async processImage(
    imageData: Buffer | string,
  ): Promise<ProcessingResult> {
    const base64Image = await this.convertToBase64(imageData);
    const cacheKey = this.generateCacheKey(base64Image);

    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const qrResult = { detected: false, data: undefined as string | undefined };
    if (Buffer.isBuffer(imageData)) {
      const qr = await this.detectQRCode(imageData);
      qrResult.detected = qr.detected;
      qrResult.data = qr.data;
    }

    const result = await this.processImageWithAI(base64Image, qrResult);
    await this.cacheResult(cacheKey, result);

    return result;
  }

  /**
   * Process an image that may contain multiple events
   * @param imageData Buffer or string containing image data
   * @returns Multi-event processing result with array of events
   */
  public async processMultiEventImage(
    imageData: Buffer | string,
  ): Promise<MultiEventProcessingResult> {
    try {
      const base64Image = await this.convertToBase64(imageData);
      const cacheKey = this.generateMultiEventCacheKey(base64Image);

      const cachedResult = await this.getCachedMultiEventResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const isMulti = await this.checkForMultipleEvents(base64Image);
      let result: MultiEventProcessingResult;

      if (isMulti) {
        result = await this.processMultiEventFlyer(base64Image);
      } else {
        const singleEvent = await this.processImage(imageData);
        result = {
          success: singleEvent.success,
          isMultiEvent: false,
          events: [singleEvent],
          extractedAt: new Date().toISOString(),
          error: singleEvent.error,
        };
      }

      await this.cacheMultiEventResult(cacheKey, result);
      return MultiEventProcessingResultSchema.parse(result);
    } catch (error) {
      console.error("Error processing multi-event image:", error);
      return {
        success: false,
        isMultiEvent: false,
        events: [],
        extractedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown error processing multi-event image",
      };
    }
  }

  /**
   * Check if an image contains multiple events
   * @param base64Image Base64 encoded image
   * @returns Boolean indicating if multiple events are present
   */
  private async checkForMultipleEvents(base64Image: string): Promise<boolean> {
    try {
      const response = await AiService.describeImage(
        Buffer.from(base64Image.split(",")[1], "base64"),
      );
      const object = response.object as unknown as AIResponse;
      return object.isMultiEvent ?? false;
    } catch (error) {
      console.error("Error checking for multiple events:", error);
      return false;
    }
  }

  /**
   * Process a flyer containing multiple events
   * @param base64Image Base64 encoded image
   * @returns Multi-event processing result
   */
  private async processMultiEventFlyer(
    base64Image: string,
  ): Promise<MultiEventProcessingResult> {
    try {
      const response = await AiService.describeImage(
        Buffer.from(base64Image.split(",")[1], "base64"),
      );
      const object = response.object as unknown as AIResponse;

      if (!object.events) {
        throw new Error("No events found in multi-event response");
      }

      const events = object.events.map((event) => {
        const structuredData = EventStructuredDataSchema.parse(
          event.structuredData,
        );
        return ProcessingResultSchema.parse({
          success: true,
          rawText: event.rawText,
          confidence: event.confidence,
          extractedAt: new Date().toISOString(),
          qrCodeDetected: event.qrCodeDetected || false,
          qrCodeData: event.qrCodeData,
          structuredData,
        });
      });

      return MultiEventProcessingResultSchema.parse({
        success: true,
        isMultiEvent: true,
        events,
        extractedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error processing multi-event flyer:", error);
      return {
        success: false,
        isMultiEvent: true,
        events: [],
        extractedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown error processing multi-event flyer",
      };
    }
  }

  private async processImageWithAI(
    base64Image: string,
    qrResult: { detected: boolean; data?: string },
  ): Promise<ProcessingResult> {
    try {
      const response = await AiService.describeImage(
        Buffer.from(base64Image.split(",")[1], "base64"),
      );
      const object = response.object as unknown as AIResponse;

      const structuredData = EventStructuredDataSchema.parse(
        object.structuredData,
      );

      const result = {
        success: true,
        rawText: object.rawText,
        confidence: object.confidence,
        extractedAt: new Date().toISOString(),
        qrCodeDetected: qrResult.detected || object.qrCodeDetected || false,
        qrCodeData: qrResult.data || object.qrCodeData,
        structuredData,
      };

      return ProcessingResultSchema.parse(result);
    } catch (error) {
      console.error("Error processing image with AI:", error);
      return {
        success: false,
        rawText: "",
        confidence: 0,
        extractedAt: new Date().toISOString(),
        qrCodeDetected: qrResult.detected,
        qrCodeData: qrResult.data,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error processing image",
      };
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
   * Generate a cache key for multi-event processing
   * @param base64Image Base64 encoded image
   * @returns MD5 hash as cache key for multi-event processing
   */
  private generateMultiEventCacheKey(base64Image: string): string {
    return `multi-vision:${createHash("md5").update(base64Image.substring(0, 100)).digest("hex")}`;
  }

  /**
   * Check if this image has been processed before and is in cache
   * @param cacheKey The cache key for this image
   * @returns Cached result or null if not in cache
   */
  private async getCachedResult(
    cacheKey: string,
  ): Promise<ProcessingResult | null> {
    return ImageProcessingCacheService.getProcessingResult(cacheKey);
  }

  /**
   * Check if this multi-event image has been processed before and is in cache
   * @param cacheKey The cache key for this multi-event image
   * @returns Cached multi-event result or null if not in cache
   */
  private async getCachedMultiEventResult(
    cacheKey: string,
  ): Promise<MultiEventProcessingResult | null> {
    return ImageProcessingCacheService.getMultiEventResult(cacheKey);
  }

  /**
   * Save processing result to cache
   * @param cacheKey The cache key for this image
   * @param result The processing result to cache
   */
  private async cacheResult(
    cacheKey: string,
    result: ProcessingResult,
  ): Promise<void> {
    await ImageProcessingCacheService.setProcessingResult(cacheKey, result);
  }

  /**
   * Save multi-event processing result to cache
   * @param cacheKey The cache key for this multi-event image
   * @param result The multi-event processing result to cache
   */
  private async cacheMultiEventResult(
    cacheKey: string,
    result: MultiEventProcessingResult,
  ): Promise<void> {
    await ImageProcessingCacheService.setMultiEventResult(cacheKey, result);
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
}
