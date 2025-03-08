// services/EventProcessingService.ts
import pgvector from "pgvector";
import { Repository } from "typeorm";
import { Event } from "../entities/Event";
import type { Point } from "geojson";
import type { CategoryProcessingService } from "./CategoryProcessingService";
import type { Category } from "../entities/Category";
import { OpenAIService } from "./OpenAIService";
import { EnhancedLocationService } from "./LocationService";
import { fromZonedTime, format } from "date-fns-tz";
import { parseISO } from "date-fns";

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
  similarity: {
    score: number;
    matchingEventId?: string;
  };
  isDuplicate?: boolean;
}

// Add this interface for progress reporting
interface ProgressCallback {
  (message: string, metadata?: Record<string, any>): Promise<void>;
}

export class EventProcessingService {
  // Private reference to the location service
  private locationService: EnhancedLocationService;
  private readonly DUPLICATE_SIMILARITY_THRESHOLD = 0.72;
  private readonly SAME_LOCATION_THRESHOLD = 0.65;

  constructor(
    private eventRepository: Repository<Event>,
    private categoryProcessingService: CategoryProcessingService
  ) {
    // Get the location service instance
    this.locationService = EnhancedLocationService.getInstance();
  }

  private async handleDuplicateScan(eventId: string): Promise<void> {
    await this.eventRepository.increment({ id: eventId }, "scanCount", 1);
    console.log(`Incremented scan count for duplicate event: ${eventId}`);
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

    // Convert the image data to a base64 string if necessary
    let base64Image: string;
    if (typeof imageData === "string" && imageData.startsWith("data:image")) {
      base64Image = imageData;
    } else if (typeof imageData === "string") {
      const buffer = await import("fs/promises").then((fs) => fs.readFile(imageData));
      base64Image = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } else {
      base64Image = `data:image/jpeg;base64,${imageData.toString("base64")}`;
    }

    // Report progress: Vision API processing
    if (progressCallback) {
      await progressCallback("Analyzing image with Vision API...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Call Vision API
    const visionResult = await this.processComprehensiveVisionAPI(base64Image);

    console.log("VISION_RESULT", visionResult.text);

    const extractedText = visionResult.text || "";

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

    // Check for similar events using the multi-factor approach
    const similarity = await this.findSimilarEvents(finalEmbedding, eventDetailsWithCategories);

    const isDuplicate =
      (similarity.score > this.DUPLICATE_SIMILARITY_THRESHOLD && !!similarity.matchingEventId) ||
      (similarity.matchReason?.includes("Same location") &&
        similarity.score > this.SAME_LOCATION_THRESHOLD);

    console.log("DUPLICATE CHECK:", {
      score: similarity.score,
      threshold: this.DUPLICATE_SIMILARITY_THRESHOLD,
      matchingEventId: similarity.matchingEventId,
      matchReason: similarity.matchReason,
      locationThreshold: this.SAME_LOCATION_THRESHOLD,
      isDuplicate,
    });

    if (isDuplicate && similarity.matchingEventId) {
      await this.handleDuplicateScan(similarity.matchingEventId);

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

  private async processComprehensiveVisionAPI(base64Image: string) {
    const response = await OpenAIService.executeChatCompletion({
      model: "gpt-4o",
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

    const content = response.choices[0].message.content;

    // Extract confidence score from the response
    const extractConfidenceScore = (text: string): number => {
      const match = text.match(/Confidence Score[^\d]*(\d*\.?\d+)/i);
      return match ? parseFloat(match[1]) : 0.5; // Default to 0.5 if not found
    };

    const confidence = extractConfidenceScore(content || "");

    return {
      success: true,
      text: content,
      confidence: confidence,
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
        // Reverse geocode the user's coordinates to get city/state
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${locationContext.userCoordinates.lng},${locationContext.userCoordinates.lat}.json?access_token=${process.env.MAPBOX_GEOCODING_TOKEN}&types=place,region`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            // Extract city and state when available
            const place = data.features.find((f: any) => f.place_type.includes("place"));
            const region = data.features.find((f: any) => f.place_type.includes("region"));

            if (place && region) {
              userCityState = `${place.text}, ${region.text}`;
              console.log("User location context:", userCityState);
            }
          }
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

    // Use the enhanced location service to resolve the address and coordinates
    const resolvedLocation = await this.locationService.resolveLocation(
      locationClues,
      userCityState,
      locationContext?.userCoordinates
    );

    // Create Point from resolved coordinates
    const location: Point = {
      type: "Point",
      coordinates: resolvedLocation.coordinates,
    };

    // Get timezone from the location service (already included in resolvedLocation)
    const timezone = resolvedLocation.timezone || "UTC";

    // Log resolved information
    console.log(`Address resolved with confidence: ${resolvedLocation.confidence.toFixed(2)}`);
    console.log(`Resolved timezone: ${timezone} for coordinates [${resolvedLocation.coordinates}]`);

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
    let inputText: string;

    if (typeof eventDetails === "string") {
      // Handle the case where raw text is passed - just use it directly
      inputText = eventDetails;
    } else {
      // Extract location data for special weighting
      const coordinates = eventDetails.location.coordinates;
      const roundedCoords = [
        Math.round(coordinates[0] * 1000) / 1000, // Round to 3 decimal places (~110m precision)
        Math.round(coordinates[1] * 1000) / 1000,
      ];

      // Format the date in a standardized way
      let dateStr = "";
      try {
        const date = new Date(eventDetails.date);
        if (!isNaN(date.getTime())) {
          // Format as YYYY-MM-DD
          dateStr = date.toISOString().split("T")[0];
        }
      } catch (e) {
        // If date parsing fails, use the original string
        dateStr = eventDetails.date;
      }

      // Create a weighted text representation with stronger location emphasis
      const weightedItems = [
        // Title gets strong weight (4x)
        `TITLE: ${eventDetails.title.repeat(4)}`,

        // Date with standardized format for better matching (2x)
        `DATE: ${dateStr.repeat(2)}`,

        // Include timezone if available
        eventDetails.timezone ? `TIMEZONE: ${eventDetails.timezone}` : "",

        // Location and address get the most weight (5-6x)
        `COORDS: ${roundedCoords.join(",")}`.repeat(2),
        `ADDRESS: ${eventDetails.address.repeat(5)}`,

        // Description gets normal weight
        `DESCRIPTION: ${eventDetails.description}`,
      ];

      // Join with double newlines for clear section separation
      inputText = weightedItems.filter(Boolean).join("\n\n");

      console.log("Generating embedding with weighted format:", {
        title: eventDetails.title,
        address: eventDetails.address,
        coordinates: roundedCoords.join(","),
        timezone: eventDetails.timezone,
        textLength: inputText.length,
      });
    }

    // Use the OpenAIService helper method for embeddings
    return await OpenAIService.generateEmbedding(inputText);
  }

  private async findSimilarEvents(
    embedding: number[],
    eventDetails: EventDetails
  ): Promise<{
    score: number;
    matchingEventId?: string;
    matchReason?: string;
    matchDetails?: Record<string, any>;
  }> {
    try {
      // First, use vector search to find potential matches
      const similarEvents = await this.eventRepository
        .createQueryBuilder("event")
        .where("event.embedding IS NOT NULL")
        .orderBy("embedding <-> :embedding")
        .setParameters({ embedding: pgvector.toSql(embedding) })
        .limit(5)
        .getMany();

      if (similarEvents.length === 0) {
        return { score: 0 };
      }

      // Get best match from vector similarity
      const bestMatch = similarEvents[0];

      // Calculate embedding similarity score
      const embeddingScore = this.calculateCosineSimilarity(
        embedding,
        pgvector.fromSql(bestMatch.embedding)
      );

      // ---------- TITLE SIMILARITY ----------
      // Calculate title similarity using Jaccard index for word overlap
      const titleSimilarity = this.getJaccardSimilarity(
        eventDetails.title.toLowerCase(),
        (bestMatch.title || "").toLowerCase()
      );

      // ---------- LOCATION SIMILARITY ----------
      // Generate coordinate points for distance calculation
      const eventCoords = {
        lat: eventDetails.location.coordinates[1],
        lng: eventDetails.location.coordinates[0],
      };

      const matchCoords = {
        lat: bestMatch.location?.coordinates?.[1] ?? 0,
        lng: bestMatch.location?.coordinates?.[0] ?? 0,
      };

      // Calculate distance between coordinates in meters
      const distanceInMeters = this.calculateDistance(eventCoords, matchCoords);

      // Convert distance to a similarity score (closer = higher score)
      // Events within 100m get a score of 1.0, decreasing as distance increases
      const locationSimilarity = Math.max(0, Math.min(1, 1 - distanceInMeters / 1000));

      // ---------- DATE SIMILARITY ----------
      // Check for date similarity if dates are within 1 day
      const eventDate = new Date(eventDetails.date);
      const matchDate = new Date(bestMatch.eventDate || Date.now()); // Fallback to now
      const dateDiffMs = Math.abs(eventDate.getTime() - matchDate.getTime());
      const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);
      const dateSimilarity = dateDiffDays <= 1 ? 1 : Math.max(0, 1 - dateDiffDays / 7);

      // ---------- ADDRESS SIMILARITY ----------
      // Check if addresses match closely, handling undefined addresses
      const eventAddress = eventDetails.address || "";
      const matchAddress = bestMatch.address || "";

      const addressSimilarity = this.getSimilarityScore(
        eventAddress.toLowerCase(),
        matchAddress.toLowerCase()
      );

      // ---------- TIMEZONE SIMILARITY ----------
      // Add timezone matching to improve event comparison
      const eventTimezone = eventDetails.timezone || "UTC";
      const matchTimezone = bestMatch.timezone || "UTC";
      const timezoneSimilarity = eventTimezone === matchTimezone ? 1.0 : 0.5;

      // ---------- COMPOSITE SCORE ----------
      // Calculate weighted composite score
      // Prioritize location (35%), then title (25%), then date (20%), then address (10%), timezone (5%), then embedding (5%)
      const compositeScore =
        locationSimilarity * 0.35 +
        titleSimilarity * 0.25 +
        dateSimilarity * 0.2 +
        addressSimilarity * 0.1 +
        timezoneSimilarity * 0.05 +
        embeddingScore * 0.05;

      // ---------- MATCH REASON ----------
      // Determine match reason for transparency
      let matchReason = "";

      if (locationSimilarity > 0.95) {
        // Essentially same location (within ~50 meters)
        if (dateSimilarity > 0.9) {
          matchReason = "Same location and same date";
          if (titleSimilarity > 0.6) matchReason += " with similar title";
        } else {
          matchReason = "Same location, different date";
        }
      } else if (locationSimilarity > 0.8 && dateSimilarity > 0.9) {
        matchReason = "Same date at nearby location";
      } else if (titleSimilarity > 0.8 && dateSimilarity > 0.8) {
        matchReason = "Similar title on same date";
      } else if (embeddingScore > 0.85) {
        matchReason = "Very similar overall content";
      } else if (compositeScore > 0.78) {
        matchReason = "Multiple similarity factors";
      }

      // Store detailed match data for logging
      const matchDetails = {
        distance: `${distanceInMeters.toFixed(0)} meters`,
        locationSimilarity: locationSimilarity.toFixed(2),
        titleSimilarity: titleSimilarity.toFixed(2),
        dateSimilarity: dateSimilarity.toFixed(2),
        dateDiffDays: dateDiffDays.toFixed(1),
        addressSimilarity: addressSimilarity.toFixed(2),
        timezoneSimilarity: timezoneSimilarity.toFixed(2),
        embeddingScore: embeddingScore.toFixed(2),
        compositeScore: compositeScore.toFixed(2),
        timezone: eventDetails.timezone,
        matchTimezone: bestMatch.timezone,
      };

      console.log("Duplicate detection metrics:", {
        eventId: bestMatch.id,
        title: bestMatch.title || "[No title]",
        eventTitle: eventDetails.title,
        ...matchDetails,
        matchReason,
      });

      return {
        score: compositeScore,
        matchingEventId: bestMatch.id,
        matchReason,
        matchDetails,
      };
    } catch (error) {
      console.error("Error in findSimilarEvents:", error);
      return { score: 0 };
    }
  }

  // Helper method to calculate Jaccard similarity for text
  private getJaccardSimilarity(text1: string, text2: string): number {
    // Handle undefined or empty inputs
    if (!text1 || !text2) return 0;

    // Convert texts to word sets
    const words1 = new Set(text1.split(/\s+/).filter(Boolean));
    const words2 = new Set(text2.split(/\s+/).filter(Boolean));

    // Handle empty sets
    if (words1.size === 0 || words2.size === 0) return 0;

    // Count intersection and union
    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    // Return Jaccard index
    return intersection.size / union.size;
  }

  // Helper method to calculate string similarity
  private getSimilarityScore(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    // Simple implementation - calculate percentage of matching words
    const words1 = str1.split(/\s+/).filter(Boolean);
    const words2 = str2.split(/\s+/).filter(Boolean);

    // Handle empty strings
    if (words1.length === 0 || words2.length === 0) return 0;

    // Count matching words
    let matches = 0;
    for (const word of words1) {
      if (words2.includes(word)) matches++;
    }

    // Return percentage of matches
    return matches / Math.max(words1.length, words2.length);
  }

  // Helper method to calculate distance between coordinates in meters
  private calculateDistance(
    coords1: { lat: number; lng: number },
    coords2: { lat: number; lng: number }
  ): number {
    // Check for invalid coordinates
    if (isNaN(coords1.lat) || isNaN(coords1.lng) || isNaN(coords2.lat) || isNaN(coords2.lng)) {
      return 10000; // Return large distance if coordinates are invalid
    }

    // Haversine formula for accurate earth distance
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters

    const dLat = toRad(coords2.lat - coords1.lat);
    const dLng = toRad(coords2.lng - coords1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coords1.lat)) *
        Math.cos(toRad(coords2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // Distance in meters
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
