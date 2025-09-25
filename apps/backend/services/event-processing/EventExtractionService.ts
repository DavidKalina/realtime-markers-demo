// services/event-processing/EventExtractionService.ts

import { parseISO } from "date-fns";
import { format, fromZonedTime } from "date-fns-tz";
import type { Category } from "@realtime-markers/database";
import type { CategoryProcessingService } from "../CategoryProcessingService";
import type { ConfigService } from "../shared/ConfigService";
import { OpenAIModel, type OpenAIService } from "../shared/OpenAIService";
import { fromOpenAIUsage, addTokenUsage } from "../../types/TokenUsage";
import type { EventExtractionResult } from "./dto/EventExtractionResult";
import type { IEventExtractionService } from "./interfaces/IEventExtractionService";
import type { ILocationResolutionService } from "./interfaces/ILocationResolutionService";

/**
 * Service for extracting structured event data from text
 * Responsible for parsing dates, extracting event details, and categorizing events
 */
export class EventExtractionService implements IEventExtractionService {
  private readonly defaultEmoji: string;
  private readonly extractionModel: string;

  constructor(
    private categoryProcessingService: CategoryProcessingService,
    private locationResolutionService: ILocationResolutionService,
    private openAIService: OpenAIService,
    private configService?: ConfigService,
  ) {
    // Initialize with config or defaults
    this.defaultEmoji =
      configService?.get("eventProcessing.defaultEmoji") || "📍";
    this.extractionModel =
      configService?.get("openai.extractionModel") || "gpt-4o";
  }

  /**
   * Extract structured event details from text
   * @param text Text to extract event details from
   * @param options Optional extraction options
   * @returns Structured event details
   */
  public async extractEventDetails(
    text: string,
    options?: {
      userCoordinates?: { lat: number; lng: number };
      organizationHints?: string[];
      userCityState?: string;
    },
  ): Promise<EventExtractionResult> {
    console.log("options", options);
    // Get current date to provide as context
    const currentDate = new Date().toISOString();

    // First, try to get user's city and state if coordinates are provided
    let userCityState = options?.userCityState || "";
    if (!userCityState && options?.userCoordinates) {
      try {
        // Use the LocationResolutionService for reverse geocoding
        userCityState =
          await this.locationResolutionService.reverseGeocodeCityState(
            options.userCoordinates.lat,
            options.userCoordinates.lng,
          );
      } catch (error) {
        console.error("Error reverse geocoding user coordinates:", error);
      }
    }

    // Build location context for the prompt
    const userLocationPrompt = userCityState
      ? `The user is currently in ${userCityState}. Consider this for location inference.`
      : options?.userCoordinates
        ? `The user is currently located near latitude ${options.userCoordinates.lat}, longitude ${options.userCoordinates.lng}.`
        : "";

    // Extract event details with enhanced location awareness
    const response = await this.openAIService.executeChatCompletion({
      model: this.extractionModel as OpenAIModel,
      messages: [
        {
          role: "system",
          content: `You are a precise event information extractor with location and timezone awareness.
            Extract event details from flyers and promotional materials.
            For dates, always return them in ISO-8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
            If timezone information is available on the flyer, include it in the date format.
            
            IMPORTANT: Always generate a relevant emoji for every event. The emoji should be a single, well-known emoji that clearly represents the event's theme, mood, or type of activity.
            
            ${userLocationPrompt}
            
            When extracting locations:
            - Look for explicit addresses in standard format
            - Identify organization names, institution logos, venue details
            - Notice building codes and room numbers as location clues
            - Use the user's current location to help resolve ambiguous locations
            - For university events (with codes like "LC 301"), connect them to the appropriate campus
            
            When extracting dates:
            - Look for explicit start and end dates/times
            - If an event spans multiple days, capture both start and end dates
            - Use common formats like "Jan 1-3, 2025" or "From 7PM to 9PM"
            - Identify date ranges and recurring patterns`,
        },
        {
          role: "user",
          content: `Extract the following details from this text in a JSON format:
           - emoji: A single, relevant emoji that represents the event theme or mood (REQUIRED - always provide an emoji)
           - emojiDescription: A brief text description of what the emoji represents (e.g. "party popper" for 🎉)
           - title: The event title
           - date: The event start date and time in ISO-8601 format
           - endDate: The event end date and time in ISO-8601 format (if available)
           - timezone: Any timezone information provided (e.g., "EST", "PDT", "UTC")
           - organization: The organization hosting the event
           - venue: The specific venue or room information
           - description: Full description of the event
           - categoryNames: Array of 2-5 category names that best describe this event
           - locationClues: Array of all possible clues about the location (building codes, room numbers, logos, etc.)
           
           Today's date is: ${currentDate}
           
           Text to extract from:
           ${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsedDetails = JSON.parse(
      response.choices[0]?.message.content?.trim() ?? "{}",
    );
    const tokenUsage = fromOpenAIUsage(response.usage);

    console.log("[EventExtractionService] Parsed details:", parsedDetails);
    console.log(
      "[EventExtractionService] Extracted emoji:",
      parsedDetails.emoji,
    );
    console.log("[EventExtractionService] Default emoji:", this.defaultEmoji);

    // Collect all location clues
    const locationClues = [
      parsedDetails.organization || "",
      parsedDetails.venue || "",
      ...(Array.isArray(parsedDetails.locationClues)
        ? parsedDetails.locationClues
        : []),
      ...(options?.organizationHints || []),
    ].filter(Boolean);

    // Use the location resolution service to resolve the address and coordinates
    const resolvedLocation =
      await this.locationResolutionService.resolveLocation(locationClues, {
        cityState: userCityState,
        coordinates: options?.userCoordinates,
      });

    // Create Point from resolved coordinates
    const location = resolvedLocation.coordinates;

    // Get timezone from the location service
    const timezone = resolvedLocation.timezone;

    // Process dates with timezone awareness
    const eventDate = this.processEventDate(
      parsedDetails.date,
      parsedDetails.timezone,
      timezone,
    );
    const eventEndDate = parsedDetails.endDate
      ? this.processEventDate(
          parsedDetails.endDate,
          parsedDetails.timezone,
          timezone,
        )
      : undefined;

    // Process categories
    let categories: Category[] = [];
    if (
      parsedDetails.categoryNames &&
      Array.isArray(parsedDetails.categoryNames)
    ) {
      // Get existing categories or create new ones
      categories = await this.categoryProcessingService.getOrCreateCategories(
        parsedDetails.categoryNames,
      );
    }

    const eventDetails = {
      emoji:
        parsedDetails.emoji && parsedDetails.emoji.trim() !== ""
          ? parsedDetails.emoji
          : this.defaultEmoji,
      emojiDescription: parsedDetails.emojiDescription || "",
      title: parsedDetails.title || "",
      date: eventDate,
      endDate: eventEndDate,
      address: resolvedLocation.address,
      location: location,
      description: parsedDetails.description || "",
      categories: categories,
      timezone: timezone,
      locationNotes: resolvedLocation.locationNotes || "",
    };

    return {
      rawExtractedData: parsedDetails,
      event: eventDetails,
      locationDetails: {
        confidence: resolvedLocation.confidence,
        resolvedAt: resolvedLocation.resolvedAt,
        clues: locationClues,
      },
      tokenUsage,
    };
  }

  /**
   * Process and normalize event date with timezone awareness
   * @param dateString Original date string from extraction
   * @param explicitTimezone Explicit timezone from extraction
   * @param resolvedTimezone Resolved timezone from location
   * @returns Normalized ISO date string
   */
  private processEventDate(
    dateString?: string,
    explicitTimezone?: string,
    resolvedTimezone: string = "UTC",
  ): string {
    try {
      // Check if we have a valid date string
      if (!dateString) {
        return new Date().toISOString();
      }

      // First try to parse the date directly
      const parsedDate = new Date(dateString);

      // If we can't parse it or it's invalid, handle that case
      if (isNaN(parsedDate.getTime())) {
        return new Date().toISOString();
      }

      // Check for specific timezone info in the API response or use our resolved timezone
      const timezone = explicitTimezone || resolvedTimezone;

      // If the date string already contains timezone info (like Z or +00:00)
      if (/Z|[+-]\d{2}:?\d{2}$/.test(dateString)) {
        try {
          // Parse the ISO date and then convert to the event's timezone
          const isoDate = parseISO(dateString);
          // Format with the explicit timezone
          const formattedDate = format(
            fromZonedTime(isoDate, timezone),
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
          );

          return formattedDate;
        } catch (error) {
          console.error("Error converting date with timezone:", error);
          return parsedDate.toISOString();
        }
      } else {
        // If no timezone in the date string, assume it's in the event's local timezone
        try {
          // Treat the parsed date as if it's in the event's timezone
          const formattedDate = format(
            fromZonedTime(parsedDate, timezone),
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
          );

          return formattedDate;
        } catch (error) {
          console.error("Error handling local event time:", error);
          return parsedDate.toISOString();
        }
      }
    } catch (error) {
      console.error("Error processing event date:", error);
      return new Date().toISOString();
    }
  }

  /**
   * Extract just the categories from text
   * @param text Text to extract categories from
   * @returns Array of category objects
   */
  public async extractCategories(text: string): Promise<Category[]> {
    return this.categoryProcessingService.extractAndProcessCategories(text);
  }

  /**
   * Generate an emoji and description for an event based on its title and description
   * @param title The event title
   * @param description The event description
   * @returns Object containing the emoji and its description
   */
  public async generateEventEmoji(
    title: string,
    description: string,
  ): Promise<{ emoji: string; emojiDescription: string }> {
    try {
      const response = await this.openAIService.executeChatCompletion({
        model: this.extractionModel as OpenAIModel,
        messages: [
          {
            role: "system",
            content: `You are an emoji generator for events. Your task is to generate a single, relevant emoji and a brief description of what it represents.
            The emoji should be a single, well-known emoji that clearly represents the event's theme or mood.
            The description should be a brief, clear explanation of what the emoji represents.
            
            Respond with a JSON object in this exact format:
            {
              "emoji": "A single, relevant emoji",
              "emojiDescription": "A brief description of what the emoji represents (e.g. 'party popper' for 🎉)"
            }`,
          },
          {
            role: "user",
            content: `Generate an emoji and description for this event:
            Title: ${title}
            Description: ${description}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(
        response.choices[0]?.message.content?.trim() ?? "{}",
      );

      console.log("[EventExtractionService] Generated emoji result:", result);
      console.log("[EventExtractionService] Generated emoji:", result.emoji);
      console.log("[EventExtractionService] Default emoji:", this.defaultEmoji);

      return {
        emoji:
          result.emoji && result.emoji.trim() !== ""
            ? result.emoji
            : this.defaultEmoji,
        emojiDescription: result.emojiDescription || "",
      };
    } catch (error) {
      console.error("Error generating event emoji:", error);
      return {
        emoji: this.defaultEmoji,
        emojiDescription: "",
      };
    }
  }
}

/**
 * Factory function to create an EventExtractionService instance
 */
export function createEventExtractionService({
  categoryProcessingService,
  locationResolutionService,
  openAIService,
  configService,
}: {
  categoryProcessingService: CategoryProcessingService;
  locationResolutionService: ILocationResolutionService;
  openAIService: OpenAIService;
  configService?: ConfigService;
}): IEventExtractionService {
  return new EventExtractionService(
    categoryProcessingService,
    locationResolutionService,
    openAIService,
    configService,
  );
}
