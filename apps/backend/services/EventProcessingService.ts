// services/EventProcessingService.ts
import pgvector from "pgvector";

import { OpenAI } from "openai";
import { Repository } from "typeorm";
import { Event } from "../entities/Event";
import type { Point } from "geojson";
import type { CategoryProcessingService } from "./CategoryProcessingService";
import type { Category } from "../entities/Category";

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
}

interface ScanResult {
  confidence: number;
  eventDetails: EventDetails;
  similarity: {
    score: number;
    matchingEventId?: string;
  };
}

// Add this interface for progress reporting
interface ProgressCallback {
  (message: string, metadata?: Record<string, any>): Promise<void>;
}

export class EventProcessingService {
  constructor(
    private openai: OpenAI,
    private eventRepository: Repository<Event>,
    private categoryProcessingService: CategoryProcessingService
  ) {}

  private async geocodeAddress(address: string): Promise<Point> {
    // Existing geocode implementation...
    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${process.env.MAPBOX_GEOCODING_TOKEN}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        throw new Error("No coordinates found for address");
      }

      const [longitude, latitude] = data.features[0].center;

      return {
        type: "Point",
        coordinates: [longitude, latitude],
      };
    } catch (error) {
      console.error("Geocoding error:", error);
      // Fallback to a default location in Provo if geocoding fails
      return {
        type: "Point",
        coordinates: [-111.6585, 40.2338],
      };
    }
  }

  // Add optional progress callback parameter
  // Modified processFlyerFromImage method in EventProcessingService.ts
  async processFlyerFromImage(
    imageData: Buffer | string,
    progressCallback?: ProgressCallback,
    locationContext?: LocationContext
  ): Promise<ScanResult> {
    // Report progress: Starting image processing
    if (progressCallback) {
      await progressCallback("Analyzing image..."); // CHANGED from "Starting image analysis..."
      await new Promise((resolve) => setTimeout(resolve, 300)); // Add small delay between steps
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

    // Generate embeddings for event similarity matching
    const embeddingPromise = this.generateEmbedding(extractedText);

    // Report progress: Extracting event details
    if (progressCallback) {
      await progressCallback("Extracting event details and categories...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const [eventDetailsWithCategories, embedding] = await Promise.all([
      this.extractEventDetailsWithCategories(extractedText, locationContext),
      embeddingPromise,
    ]);

    // CHANGE THIS to match hook's expected format:
    if (progressCallback) {
      // NO LONGER SEND "Event details extracted successfully" - it's not in the hook's steps
      await progressCallback("Extracting event details and categories...", {
        title: eventDetailsWithCategories.title,
        categories: eventDetailsWithCategories.categories?.map((c) => c.name),
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Report progress: Finding similar events
    if (progressCallback) {
      await progressCallback("Finding similar events...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Check for similar events
    const similarity = await this.findSimilarEvents(embedding);

    // Report progress: Processing complete
    if (progressCallback) {
      await progressCallback("Processing complete!", {
        confidence: visionResult.confidence,
        similarityScore: similarity.score,
      });
    }

    return {
      confidence: visionResult.confidence || 0,
      eventDetails: eventDetailsWithCategories,
      similarity,
    };
  }

  // Existing methods below...
  private async processComprehensiveVisionAPI(base64Image: string) {
    const response = await this.openai.chat.completions.create({
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
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a precise event information extractor with location awareness.
            Extract event details from flyers and promotional materials.
            For dates, always return them in ISO-8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
            
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

    // Now infer address using all collected information
    let address = "";
    const locationClues = [
      parsedDetails.organization || "",
      parsedDetails.venue || "",
      ...(Array.isArray(parsedDetails.locationClues) ? parsedDetails.locationClues : []),
    ].filter(Boolean);

    console.log("Location clues found:", locationClues);

    if (locationClues.length > 0) {
      // We have some location clues, let's infer the address
      address = await this.inferAddressFromLocationClues(
        locationClues,
        userCityState,
        locationContext?.userCoordinates
      );
    }

    let location: Point;
    if (address) {
      location = await this.geocodeAddress(address);
    } else if (locationContext?.userCoordinates) {
      // If we still don't have an address but have user coordinates, use them as fallback
      console.log("Using user coordinates as fallback location");
      location = {
        type: "Point",
        coordinates: [locationContext.userCoordinates.lng, locationContext.userCoordinates.lat],
      };
    } else {
      // Ultimate fallback to a default location
      location = {
        type: "Point",
        coordinates: [-111.6585, 40.2338], // Default location in Provo
      };
    }

    // Process date with fallback
    let eventDate;
    try {
      eventDate = parsedDetails.date
        ? new Date(parsedDetails.date).toISOString()
        : new Date().toISOString();

      if (isNaN(new Date(eventDate).getTime())) {
        eventDate = new Date().toISOString();
      }
    } catch (error) {
      eventDate = new Date().toISOString();
    }

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
      address: address,
      location: location,
      description: parsedDetails.description || "",
      categories: categories,
    };
  }

  // New method to infer address from all location clues
  private async inferAddressFromLocationClues(
    clues: string[],
    userCityState: string,
    userCoordinates?: { lat: number; lng: number }
  ): Promise<string> {
    const cluesText = clues.join(", ");
    const userLocationContext = userCityState
      ? `The user is currently in ${userCityState}.`
      : userCoordinates
      ? `The user is currently at latitude ${userCoordinates.lat}, longitude ${userCoordinates.lng}.`
      : "";

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an address resolution expert. ${userLocationContext}
          
          Based on the location clues and the user's current location:
          1. Determine the most likely full address for the event
          2. If clues mention a university, campus building, or room code, infer the complete address
          3. Consider the user's current city and state in resolving ambiguous locations
          
          Return a complete, geocodable address with street, city, state, and ZIP.`,
          },
          {
            role: "user",
            content: `Location clues: ${cluesText}
          
          Return ONLY the complete address without explanation.
          If you cannot determine a specific address with reasonable confidence, return "UNKNOWN".`,
          },
        ],
      });

      const inferredAddress = response.choices[0].message.content?.trim();
      console.log("Inferred address:", inferredAddress);

      return inferredAddress === "UNKNOWN" ? "" : inferredAddress || "";
    } catch (error) {
      console.error("Error inferring address from clues:", error);
      return "";
    }
  }

  private async generateEmbedding(text: string) {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  }

  private async findSimilarEvents(embedding: number[]) {
    try {
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

      const bestMatch = similarEvents[0];
      // Calculate similarity score
      const similarityScore = this.calculateCosineSimilarity(
        embedding,
        pgvector.fromSql(bestMatch.embedding) // Convert back to number[]
      );

      return {
        score: similarityScore,
        matchingEventId: bestMatch.id,
      };
    } catch (error) {
      console.error("Error in findSimilarEvents:", error);
      return { score: 0 };
    }
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
