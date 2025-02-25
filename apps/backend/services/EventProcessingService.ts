// services/EventProcessingService.ts
import pgvector from "pgvector";

import { OpenAI } from "openai";
import { Repository } from "typeorm";
import { Event } from "../entities/Event";
import type { Point } from "geojson";
import type { CategoryProcessingService } from "./CategoryProcessingService";
import type { Category } from "../entities/Category";

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
  async processFlyerFromImage(
    imageData: Buffer | string,
    progressCallback?: ProgressCallback
  ): Promise<ScanResult> {
    // Report progress: Starting image processing
    if (progressCallback) {
      await progressCallback("Starting image analysis...");
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
    }

    // Call Vision API
    const visionResult = await this.processComprehensiveVisionAPI(base64Image);
    const extractedText = visionResult.text || "";

    // Report progress after vision processing
    if (progressCallback) {
      await progressCallback("Image analyzed successfully", {
        confidence: visionResult.confidence,
      });
    }

    // Report progress: Generating embeddings
    if (progressCallback) {
      await progressCallback("Generating text embeddings...");
    }

    // Generate embeddings for event similarity matching
    const embeddingPromise = this.generateEmbedding(extractedText);

    // Report progress: Extracting event details
    if (progressCallback) {
      await progressCallback("Extracting event details and categories...");
    }

    // Process event details in parallel with embedding generation
    const [eventDetailsWithCategories, embedding] = await Promise.all([
      this.extractEventDetailsWithCategories(extractedText),
      embeddingPromise,
    ]);

    // Report progress after extraction
    if (progressCallback) {
      await progressCallback("Event details extracted successfully", {
        title: eventDetailsWithCategories.title,
        categories: eventDetailsWithCategories.categories?.map((c) => c.name),
      });
    }

    // Report progress: Finding similar events
    if (progressCallback) {
      await progressCallback("Finding similar events...");
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

                   Also provide a confidence score between 0 and 1 indicating how confident you are in the extraction.
                   Include as much text from the image as possible in your analysis.`,
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

  private async extractEventDetailsWithCategories(text: string): Promise<EventDetails> {
    // Existing implementation...
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a precise event information extractor. Extract event details and format them consistently. 
                  For dates, always return them in ISO-8601 format (YYYY-MM-DDTHH:mm:ss.sssZ). 
                  For past events, return the original date even if it's in the past.
                  Also identify 2-5 relevant categories for the event.`,
        },
        {
          role: "user",
          content: `Extract the following details from this text in a JSON format:
                 - emoji: The most relevant emoji
                 - title: The event title
                 - date: The event date and time in ISO-8601 format
                 - address: The complete address including street, city, state, and zip if available
                 - description: Full description of the event
                 - categoryNames: Array of 2-5 category names that best describe this event
                 
                 Text to extract from:
                 ${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsedDetails = JSON.parse(response.choices[0]?.message.content?.trim() ?? "{}");
    const address = parsedDetails.address || "";

    // Get coordinates from address using Mapbox
    const location = await this.geocodeAddress(address);

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
