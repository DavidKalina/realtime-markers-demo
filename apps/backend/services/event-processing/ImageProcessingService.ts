// services/event-processing/ImageProcessingService.ts

import { createHash } from "crypto";
import { ImageProcessingCacheService } from "../shared/ImageProcessingCacheService";
import type { IImageProcessingService } from "./interfaces/IImageProcesssingService";
import type { ImageProcessingResult } from "./dto/ImageProcessingResult";
import { OpenAIModel, OpenAIService } from "../shared/OpenAIService";
import jsQR from "jsqr";
import { Jimp } from "jimp";
import { RecurrenceFrequency, DayOfWeek } from "../../entities/Event";

// New interface for multi-event results
export interface MultiEventProcessingResult {
  success: boolean;
  isMultiEvent: boolean;
  events: ImageProcessingResult[];
  extractedAt: string;
  error?: string;
}

// Update the ImageProcessingResult interface to include recurrence info
export interface EventStructuredData {
  title: string;
  dateTime: string;
  timezone?: string;
  venueAddress?: string;
  venueName?: string;
  organizer?: string;
  description?: string;
  contactInfo?: string;
  socialMedia?: string;
  otherDetails?: string;
  // Add recurrence fields
  isRecurring?: boolean;
  recurrencePattern?: string; // Raw text describing the recurrence
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceTime?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number | null;
}

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
    let qrResult: { detected: boolean; data?: string } = {
      detected: false,
      data: undefined,
    };
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

  /**
   * Process an image that may contain multiple events
   * @param imageData Buffer or string containing image data
   * @returns Multi-event processing result with array of events
   */
  public async processMultiEventImage(
    imageData: Buffer | string,
  ): Promise<MultiEventProcessingResult> {
    try {
      // Convert the image data to a base64 string if necessary
      const base64Image = await this.convertToBase64(imageData);

      // Generate a cache key for multi-event processing
      const cacheKey = this.generateMultiEventCacheKey(base64Image);

      // Check if we have this multi-event result in cache
      const cachedResult = await this.getCachedMultiEventResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // First, determine if this image contains multiple events
      const isMulti = await this.checkForMultipleEvents(base64Image);

      let result: MultiEventProcessingResult;

      if (isMulti) {
        // Process as multi-event flyer
        result = await this.processMultiEventFlyer(base64Image);
      } else {
        // Process as single event and wrap in multi-event format
        const singleEvent = await this.processImage(imageData);
        result = {
          success: singleEvent.success,
          isMultiEvent: false,
          events: [singleEvent],
          extractedAt: new Date().toISOString(),
          error: singleEvent.error,
        };
      }

      // Cache the multi-event result
      await this.cacheMultiEventResult(cacheKey, result);

      return result;
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
      const response = await OpenAIService.executeChatCompletion({
        model: this.VISION_MODEL as OpenAIModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image to determine if it contains multiple distinct events or just one event.

Look for indicators of multiple events such as:
- Multiple distinct date/time combinations
- Multiple event titles or headings
- Separate sections with different event information
- Multiple venue locations mentioned for different occasions
- Sequential events (like "Day 1", "Day 2" or multiple dates listed)
- Different event types listed separately

A single event might have multiple sessions, times, or activities, but they would all be part of the same overall event.

Respond with only: "MULTIPLE" if there are multiple distinct events, or "SINGLE" if there is only one event (even if it has multiple sessions/activities).`,
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
        max_tokens: 50,
      });

      const content =
        response.choices[0].message.content?.trim().toLowerCase() || "";
      return content.includes("multiple");
    } catch (error) {
      console.error("Error checking for multiple events:", error);
      // Default to single event if we can't determine
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
      const response = await OpenAIService.executeChatCompletion({
        model: this.VISION_MODEL as OpenAIModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This image contains multiple events. Please extract each event separately and provide them in a structured format.

For EACH event found, extract:
- Check if there's a QR code present in the image (yes/no) - this applies to the entire image
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
- Any other important details

Also include for each event:
Is Recurring: [yes/no]
Recurrence Pattern: [if recurring, describe the pattern in detail]
Recurrence Frequency: [DAILY/WEEKLY/BIWEEKLY/MONTHLY/YEARLY or N/A]
Recurrence Days: [comma-separated list of days if applicable]
Recurrence Time: [time in HH:mm format if applicable]
Recurrence Start Date: [start date of the series if specified]
Recurrence End Date: [end date of the series if specified]
Recurrence Interval: [number for intervals like "every 2 weeks"]

Format your response as:

EVENT_COUNT: [number of events found]

EVENT_1:
QR Code Present: [yes/no]
Event Title: [title]
Date and Time: [full date and time]
Is Recurring: [yes/no]
Recurrence Pattern: [if recurring, describe the pattern in detail]
Recurrence Frequency: [DAILY/WEEKLY/BIWEEKLY/MONTHLY/YEARLY or N/A]
Recurrence Days: [comma-separated list of days if applicable]
Recurrence Time: [time in HH:mm format if applicable]
Recurrence Start Date: [start date of the series if specified]
Recurrence End Date: [end date of the series if specified]
Recurrence Interval: [number for intervals like "every 2 weeks"]
Timezone: [timezone, or N/A]
VENUE ADDRESS: [full address]
VENUE NAME: [venue name, if distinct from address, otherwise N/A]
ORGANIZER: [organization hosting the event]
Description: [event description]
Contact Info: [contact, or N/A]
Social Media: [handles, or N/A]
Other Details: [any other text like welcome message]
Confidence Score: [score between 0 and 1]

EVENT_2:
[repeat same format for each additional event]

Make sure to clearly separate each event and provide confidence scores for each.`,
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
        max_tokens: 2000,
      });

      const content = response.choices[0].message.content || "";
      const events = this.parseMultiEventResponse(content);

      return {
        success: true,
        isMultiEvent: true,
        events: events,
        extractedAt: new Date().toISOString(),
      };
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

  /**
   * Parse the multi-event response from Vision API
   * @param content The response content from Vision API
   * @returns Array of ImageProcessingResult objects
   */
  private parseMultiEventResponse(content: string): ImageProcessingResult[] {
    const events: ImageProcessingResult[] = [];

    try {
      // Extract event count
      const eventCountMatch = content.match(/EVENT_COUNT:\s*(\d+)/i);
      const expectedEventCount = eventCountMatch
        ? parseInt(eventCountMatch[1], 10)
        : 0;

      // Split by EVENT_ markers
      const eventSections = content.split(/EVENT_\d+:/);

      // Skip the first element (everything before first EVENT_)
      const extractedEvents = eventSections.slice(1).map((section) => {
        const confidence = this.extractConfidenceScore(section);
        const qrDetected = /QR code.*?:\s*yes/i.test(section);

        // Extract structured data
        const title = this.extractField(section, "Event Title");
        const dateTime = this.extractField(section, "Date and Time");
        const timezone = this.extractField(section, "Timezone");
        const venueAddress = this.extractField(section, "VENUE ADDRESS");
        const venueName = this.extractField(section, "VENUE NAME");
        const organizer = this.extractField(section, "ORGANIZER");
        const description = this.extractField(section, "Description");
        const contactInfo = this.extractField(section, "Contact Info");
        const socialMedia = this.extractField(section, "Social Media");
        const otherDetails = this.extractField(section, "Other Details");

        return {
          success: true,
          rawText: section.trim(),
          confidence: confidence,
          extractedAt: new Date().toISOString(),
          qrCodeDetected: qrDetected,
          structuredData: {
            title,
            dateTime,
            timezone,
            venueAddress,
            venueName,
            organizer,
            description,
            contactInfo,
            socialMedia,
            otherDetails,
          },
        };
      });

      // Validate that we found the expected number of events
      if (
        expectedEventCount > 0 &&
        extractedEvents.length !== expectedEventCount
      ) {
        console.warn(
          `Expected ${expectedEventCount} events but found ${extractedEvents.length} in the response`,
        );
      }

      events.push(...extractedEvents);
    } catch (error) {
      console.error("Error parsing multi-event response:", error);
    }

    return events;
  }

  /**
   * Extract a field value from the event section
   * @param section The event section text
   * @param fieldName The name of the field to extract
   * @returns The extracted field value or undefined
   */
  private extractField(section: string, fieldName: string): string | undefined {
    const regex = new RegExp(`${fieldName}:\\s*([^\\n]+)`, "i");
    const match = section.match(regex);
    return match ? match[1].trim() : undefined;
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
  ): Promise<ImageProcessingResult | null> {
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
    result: ImageProcessingResult,
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

  /**
   * Call Vision API to extract text and analyze the image
   * @param base64Image Base64 encoded image
   * @returns Processing result with extracted text and confidence
   */
  private async callVisionAPI(
    base64Image: string,
  ): Promise<ImageProcessingResult> {
    try {
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
               - **IMPORTANT: Check for Recurring Event Patterns:**
                 * Look for phrases like "every", "weekly", "monthly", "daily", "bi-weekly"
                 * Look for specific days mentioned (e.g., "every Monday", "Tuesdays and Thursdays")
                 * Look for date ranges or duration (e.g., "through December", "until further notice")
                 * Look for time patterns (e.g., "every day at 7 PM", "weekly at 3 PM")
                 * Look for exceptions or special dates
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

               Format your response with clear separation:
               QR Code Present: [yes/no]
               Event Title: [title]
               Date and Time: [full date and time, paying attention to the 1 vs 7 check]
               Is Recurring: [yes/no]
               Recurrence Pattern: [if recurring, describe the pattern in detail]
               Recurrence Frequency: [DAILY/WEEKLY/BIWEEKLY/MONTHLY/YEARLY or N/A]
               Recurrence Days: [comma-separated list of days if applicable]
               Recurrence Time: [time in HH:mm format if applicable]
               Recurrence Start Date: [start date of the series if specified]
               Recurrence End Date: [end date of the series if specified]
               Recurrence Interval: [number for intervals like "every 2 weeks"]
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

      console.log(`confidence: ${confidence}`);

      // Check if Vision API detected a QR code
      const qrDetected = /QR code.*?:\s*yes/i.test(content);

      // Extract structured data including recurrence information
      const structuredData = this.extractStructuredData(content);

      return {
        success: true,
        rawText: content,
        confidence: confidence,
        extractedAt: new Date().toISOString(),
        qrCodeDetected: qrDetected,
        structuredData,
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

  private extractStructuredData(content: string): EventStructuredData {
    const extractField = (fieldName: string): string | undefined => {
      const regex = new RegExp(`${fieldName}:\\s*([^\\n]+)`, "i");
      const match = content.match(regex);
      return match ? match[1].trim() : undefined;
    };

    // Determine if event is recurring based on explicit "Is Recurring: yes" match
    const isRecurring = /Is Recurring:\s*yes/i.test(content);

    // Extract and normalize recurrence frequency
    const recurrenceFrequencyStr = extractField(
      "Recurrence Frequency",
    )?.toUpperCase();
    let recurrenceFrequency: RecurrenceFrequency | undefined = undefined;
    if (
      recurrenceFrequencyStr &&
      Object.values(RecurrenceFrequency).includes(
        recurrenceFrequencyStr as RecurrenceFrequency,
      )
    ) {
      recurrenceFrequency = recurrenceFrequencyStr as RecurrenceFrequency;
    }

    // Extract and normalize recurrence days
    const recurrenceDaysStr = extractField("Recurrence Days");
    let recurrenceDays: DayOfWeek[] | undefined = undefined;
    if (recurrenceDaysStr) {
      const days = recurrenceDaysStr
        .split(",")
        .map((day) => day.trim().toUpperCase())
        .filter((day) => Object.values(DayOfWeek).includes(day as DayOfWeek))
        .map((day) => day as DayOfWeek);
      recurrenceDays = days.length > 0 ? days : undefined;
    }

    // Extract and normalize recurrence time (must be in HH:mm format)
    const recurrenceTimeStr = extractField("Recurrence Time");
    let recurrenceTime: string | undefined = undefined;
    if (
      recurrenceTimeStr &&
      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(recurrenceTimeStr)
    ) {
      recurrenceTime = recurrenceTimeStr;
    }

    // Extract and normalize recurrence interval
    const recurrenceIntervalStr = extractField("Recurrence Interval");
    let recurrenceInterval: number | undefined = undefined;
    if (recurrenceIntervalStr) {
      const parsed = parseInt(recurrenceIntervalStr, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        recurrenceInterval = parsed;
      }
    }

    // Extract and normalize recurrence dates
    const recurrenceStartDate = extractField("Recurrence Start Date");
    const recurrenceEndDate = extractField("Recurrence End Date");

    return {
      title: extractField("Event Title") || "",
      dateTime: extractField("Date and Time") || "",
      timezone: extractField("Timezone"),
      venueAddress: extractField("VENUE ADDRESS"),
      venueName: extractField("VENUE NAME"),
      organizer: extractField("ORGANIZER"),
      description: extractField("Description"),
      contactInfo: extractField("Contact Info"),
      socialMedia: extractField("Social Media"),
      otherDetails: extractField("Other Details"),
      // Recurrence fields with deterministic values
      isRecurring: isRecurring || false, // Default to false if not explicitly yes
      recurrencePattern: extractField("Recurrence Pattern"),
      recurrenceFrequency, // Will be undefined if not a valid enum value
      recurrenceDays, // Will be undefined if no valid days found
      recurrenceTime, // Will be undefined if not in HH:mm format
      recurrenceStartDate, // Will be undefined if not provided
      recurrenceEndDate, // Will be undefined if not provided
      recurrenceInterval, // Will be undefined if not a positive number
    };
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
