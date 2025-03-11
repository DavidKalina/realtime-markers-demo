// services/event-processing/EventExtractionService.ts

import { parseISO } from "date-fns";
import { format, fromZonedTime } from "date-fns-tz";
import type { Category } from "../../entities/Category";
import type { CategoryProcessingService } from "../CategoryProcessingService";
import type { ConfigService } from "../shared/ConfigService";
import { OpenAIService } from "../shared/OpenAIService";
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
    private configService?: ConfigService
  ) {
    // Initialize with config or defaults
    this.defaultEmoji = configService?.get("eventProcessing.defaultEmoji") || "📍";
    this.extractionModel = configService?.get("openai.extractionModel") || "gpt-4o";
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
    }
  ): Promise<EventExtractionResult> {
    // Get current date to provide as context
    const currentDate = new Date().toISOString();

    // First, try to get user's city and state if coordinates are provided
    let userCityState = options?.userCityState || "";
    if (!userCityState && options?.userCoordinates) {
      try {
        // Use the LocationResolutionService for reverse geocoding
        userCityState = await this.locationResolutionService.reverseGeocodeCityState(
          options.userCoordinates.lat,
          options.userCoordinates.lng
        );

        if (userCityState) {
          console.log("User location context:", userCityState);
        }
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
    const response = await OpenAIService.executeChatCompletion({
      model: this.extractionModel,
      messages: [
        {
          role: "system",
          content: `You are a precise event information extractor with location and timezone awareness.
            Extract event details from flyers and promotional materials.
            For dates, always return them in ISO-8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
            If timezone information is available on the flyer, include it in the date format.
            
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
           - emoji: The most relevant emoji
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

    const parsedDetails = JSON.parse(response.choices[0]?.message.content?.trim() ?? "{}");

    // Collect all location clues
    const locationClues = [
      parsedDetails.organization || "",
      parsedDetails.venue || "",
      ...(Array.isArray(parsedDetails.locationClues) ? parsedDetails.locationClues : []),
      ...(options?.organizationHints || []),
    ].filter(Boolean);

    console.log("Location clues found:", locationClues);

    // Use the location resolution service to resolve the address and coordinates
    const resolvedLocation = await this.locationResolutionService.resolveLocation(locationClues, {
      cityState: userCityState,
      coordinates: options?.userCoordinates,
    });

    // Create Point from resolved coordinates
    const location = resolvedLocation.coordinates;

    // Get timezone from the location service
    const timezone = resolvedLocation.timezone;

    // Log resolved information
    console.log(`Address resolved with confidence: ${resolvedLocation.confidence.toFixed(2)}`);
    console.log(`Resolved timezone: ${timezone} for coordinates [${location.coordinates}]`);

    // Process dates with timezone awareness
    const eventDate = this.processEventDate(parsedDetails.date, parsedDetails.timezone, timezone);
    const eventEndDate = parsedDetails.endDate
      ? this.processEventDate(parsedDetails.endDate, parsedDetails.timezone, timezone)
      : undefined;

    // Process categories
    let categories: Category[] = [];
    if (parsedDetails.categoryNames && Array.isArray(parsedDetails.categoryNames)) {
      // Get existing categories or create new ones
      categories = await this.categoryProcessingService.getOrCreateCategories(
        parsedDetails.categoryNames
      );
    }

    return {
      rawExtractedData: parsedDetails,
      event: {
        emoji: parsedDetails.emoji || this.defaultEmoji,
        title: parsedDetails.title || "",
        date: eventDate,
        endDate: eventEndDate,
        address: resolvedLocation.address,
        location: location,
        description: parsedDetails.description || "",
        categories: categories,
        timezone: timezone,
      },
      locationDetails: {
        confidence: resolvedLocation.confidence,
        resolvedAt: resolvedLocation.resolvedAt,
        clues: locationClues,
      },
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
    resolvedTimezone: string = "UTC"
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
        console.log("Could not parse date directly:", dateString);
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
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
          );

          console.log("Date processing with explicit zone:", { isoDate, formattedDate });
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
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
          );

          console.log("Date processing with local zone:", { parsedDate, formattedDate });
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
}
