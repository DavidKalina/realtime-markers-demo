// services/EventProcessingService.ts
import { parseISO } from "date-fns";
import { format, fromZonedTime } from "date-fns-tz";
import type { Point } from "geojson";
import type { Category } from "../entities/Category";
import type { CategoryProcessingService } from "./CategoryProcessingService";
import type { SimilarityResult } from "./event-processing/dto/SimilarityResult";
import { ImageProcessingService } from "./event-processing/ImageProcessingService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { IEventSimilarityService } from "./event-processing/interfaces/IEventSimilarityService";
import type { ILocationResolutionService } from "./event-processing/interfaces/ILocationResolutionService";
import { LocationResolutionService } from "./event-processing/LocationResolutionService";
import { ConfigService } from "./shared/ConfigService";
import { EmbeddingService, type EmbeddingInput } from "./shared/EmbeddingService";
import { OpenAIService } from "./shared/OpenAIService";

interface LocationContext {
  userCoordinates?: { lat: number; lng: number };
  organizationHints?: string[];
}

interface EventDetails {
  emoji: string;
  title: string;
  date: string;
  address: string;
  location: Point;
  description: string;
  categories?: Category[];
  timezone?: string; // IANA timezone identifier (e.g., "America/New_York")
}

interface ScanResult {
  confidence: number;
  eventDetails: EventDetails;
  similarity: SimilarityResult;
  isDuplicate?: boolean;
}

interface ProgressCallback {
  (message: string, metadata?: Record<string, any>): Promise<void>;
}

export class EventProcessingService {
  private imageProcessingService: ImageProcessingService;
  private locationResolutionService: ILocationResolutionService;
  private embeddingService: IEmbeddingService;

  constructor(
    private categoryProcessingService: CategoryProcessingService,
    private eventSimilarityService: IEventSimilarityService,
    locationResolutionService?: ILocationResolutionService,
    configService?: ConfigService
  ) {
    // Initialize the image processing service
    this.imageProcessingService = new ImageProcessingService();

    // Use provided location service or create a new one
    this.locationResolutionService =
      locationResolutionService || new LocationResolutionService(configService);

    this.embeddingService = EmbeddingService.getInstance(configService);
  }

  async processFlyerFromImage(
    imageData: Buffer | string,
    progressCallback?: ProgressCallback,
    locationContext?: LocationContext
  ): Promise<ScanResult> {
    // Report progress: Starting image processing
    if (progressCallback) {
      await progressCallback("Analyzing image...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Report progress: Vision API processing
    if (progressCallback) {
      await progressCallback("Analyzing image with Vision API...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Use the new ImageProcessingService to process the image
    const visionResult = await this.imageProcessingService.processImage(imageData);

    console.log("VISION_RESULT", visionResult.rawText);

    const extractedText = visionResult.rawText || "";

    // Report progress after vision processing
    if (progressCallback) {
      await progressCallback("Image analyzed successfully", {
        confidence: visionResult.confidence,
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Report progress: Generating embeddings
    if (progressCallback) {
      await progressCallback("Generating text embeddings...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Report progress: Extracting event details
    if (progressCallback) {
      await progressCallback("Extracting event details and categories...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Extract detailed event information
    const eventDetailsWithCategories = await this.extractEventDetailsWithCategories(
      extractedText,
      locationContext
    );

    if (progressCallback) {
      await progressCallback("Extracting event details and categories...", {
        title: eventDetailsWithCategories.title,
        categories: eventDetailsWithCategories.categories?.map((c) => c.name),
        timezone: eventDetailsWithCategories.timezone, // Include timezone in progress updates
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Generate better embeddings with the structured event details
    // This will properly weight location, title, date, etc.
    const finalEmbedding = await this.generateEmbedding(eventDetailsWithCategories);

    // Report progress: Finding similar events
    if (progressCallback) {
      await progressCallback("Finding similar events...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Check for similar events using the event similarity service
    const similarity = await this.eventSimilarityService.findSimilarEvents(finalEmbedding, {
      title: eventDetailsWithCategories.title,
      date: eventDetailsWithCategories.date,
      coordinates: eventDetailsWithCategories.location.coordinates as [number, number],
      address: eventDetailsWithCategories.address,
      description: eventDetailsWithCategories.description,
      timezone: eventDetailsWithCategories.timezone,
    });

    const isDuplicate = similarity.isDuplicate;

    console.log("DUPLICATE CHECK:", {
      score: similarity.score,
      matchingEventId: similarity.matchingEventId,
      matchReason: similarity.matchReason,
      isDuplicate,
    });

    if (isDuplicate && similarity.matchingEventId) {
      await this.eventSimilarityService.handleDuplicateScan(similarity.matchingEventId);

      if (progressCallback) {
        await progressCallback("Duplicate event detected!", {
          isDuplicate: true,
          matchingEventId: similarity.matchingEventId,
          similarityScore: similarity.score.toFixed(2),
          matchReason: similarity.matchReason || "High similarity score",
          // Include any additional metadata about the match
          matchDetails: similarity.matchDetails || {},
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Report progress: Processing complete
    if (progressCallback) {
      await progressCallback("Processing complete!", {
        confidence: visionResult.confidence,
        similarityScore: similarity.score,
        isDuplicate: isDuplicate || false,
        reasonForMatch: isDuplicate ? similarity.matchReason || "High similarity" : undefined,
        timezone: eventDetailsWithCategories.timezone, // Include timezone in final progress update
      });
    }

    return {
      confidence: visionResult.confidence || 0,
      eventDetails: eventDetailsWithCategories,
      similarity,
      isDuplicate: isDuplicate || false,
    };
  }

  private async extractEventDetailsWithCategories(
    text: string,
    locationContext?: LocationContext
  ): Promise<EventDetails> {
    // Get current date to provide as context
    const currentDate = new Date().toISOString();

    // First, try to get user's city and state if coordinates are provided
    let userCityState = "";
    if (locationContext?.userCoordinates) {
      try {
        // Use the LocationResolutionService for reverse geocoding
        userCityState = await this.locationResolutionService.reverseGeocodeCityState(
          locationContext.userCoordinates.lat,
          locationContext.userCoordinates.lng
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
      : locationContext?.userCoordinates
      ? `The user is currently located near latitude ${locationContext.userCoordinates.lat}, longitude ${locationContext.userCoordinates.lng}.`
      : "";

    // Extract event details with enhanced location awareness
    const response = await OpenAIService.executeChatCompletion({
      model: "gpt-4o",
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
            - For university events (with codes like "LC 301"), connect them to the appropriate campus`,
        },
        {
          role: "user",
          content: `Extract the following details from this text in a JSON format:
           - emoji: The most relevant emoji
           - title: The event title
           - date: The event date and time in ISO-8601 format
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
    ].filter(Boolean);

    console.log("Location clues found:", locationClues);

    // Use the location resolution service to resolve the address and coordinates
    const resolvedLocation = await this.locationResolutionService.resolveLocation(locationClues, {
      cityState: userCityState,
      coordinates: locationContext?.userCoordinates,
    });

    // Create Point from resolved coordinates
    const location = resolvedLocation.coordinates;

    // Get timezone from the location service
    const timezone = resolvedLocation.timezone;

    // Log resolved information
    console.log(`Address resolved with confidence: ${resolvedLocation.confidence.toFixed(2)}`);
    console.log(`Resolved timezone: ${timezone} for coordinates [${location.coordinates}]`);

    // Process date with timezone awareness
    let eventDate;
    try {
      // Check if we have a valid date string
      if (parsedDetails.date) {
        // First try to parse the date directly
        let parsedDate = new Date(parsedDetails.date);

        // If we can't parse it or it's invalid, handle that case
        if (isNaN(parsedDate.getTime())) {
          console.log("Could not parse date directly:", parsedDetails.date);
          eventDate = new Date().toISOString();
        } else {
          // Check for specific timezone info in the API response or use our resolved timezone
          const explicitTimezone = parsedDetails.timezone || timezone;

          // If the date string already contains timezone info (like Z or +00:00)
          if (/Z|[+-]\d{2}:?\d{2}$/.test(parsedDetails.date)) {
            try {
              // Parse the ISO date and then convert to the event's timezone
              const isoDate = parseISO(parsedDetails.date);
              // Format with the explicit timezone
              eventDate = format(
                fromZonedTime(isoDate, explicitTimezone),
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
              );

              console.log({ isoDate, eventDate });
            } catch (e) {
              console.error("Error converting date with timezone:", e);
              eventDate = parsedDate.toISOString();
            }
          } else {
            // If no timezone in the date string, assume it's in the event's local timezone
            try {
              // Treat the parsed date as if it's in the event's timezone
              eventDate = format(
                fromZonedTime(parsedDate, explicitTimezone),
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
              );
            } catch (e) {
              console.error("Error handling local event time:", e);
              eventDate = parsedDate.toISOString();
            }
          }
        }
      } else {
        eventDate = new Date().toISOString();
      }
    } catch (error) {
      console.error("Error processing event date:", error);
      eventDate = new Date().toISOString();
    }

    // Log the date processing information
    console.log("Date processing:", {
      original: parsedDetails.date,
      resolved: eventDate,
      timezone: timezone,
      explicitTimezone: parsedDetails.timezone,
    });

    // Process categories
    let categories: Category[] = [];
    if (parsedDetails.categoryNames && Array.isArray(parsedDetails.categoryNames)) {
      // Get existing categories or create new ones
      categories = await this.categoryProcessingService.getOrCreateCategories(
        parsedDetails.categoryNames
      );
    }

    return {
      emoji: parsedDetails.emoji || "📍",
      title: parsedDetails.title || "",
      date: eventDate,
      address: resolvedLocation.address,
      location: location,
      description: parsedDetails.description || "",
      categories: categories,
      timezone: timezone, // Include timezone in the return object
    };
  }

  private async generateEmbedding(eventDetails: EventDetails | string): Promise<number[]> {
    if (typeof eventDetails === "string") {
      // For raw text, use the embedding service directly
      return await this.embeddingService.getEmbedding(eventDetails);
    } else {
      // For structured event details, create an appropriate embedding input
      const input: EmbeddingInput = {
        text: eventDetails.description || "",
        title: eventDetails.title,
        date: eventDetails.date,
        coordinates: eventDetails.location.coordinates as [number, number],
        address: eventDetails.address,
        timezone: eventDetails.timezone,
        // Use default weights from EmbeddingService
      };

      // Generate a structured embedding
      return await this.embeddingService.getStructuredEmbedding(input);
    }
  }
}
