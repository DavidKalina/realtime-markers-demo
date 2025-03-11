// services/EventProcessingService.ts
import type { Point } from "geojson";
import type { Category } from "../entities/Category";
import type { SimilarityResult } from "./event-processing/dto/SimilarityResult";
import { EventExtractionService } from "./event-processing/EventExtractionService";
import { ImageProcessingService } from "./event-processing/ImageProcessingService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { IEventExtractionService } from "./event-processing/interfaces/IEventExtractionService";
import type { IEventProcessingServiceDependencies } from "./event-processing/interfaces/IEventProcessingServiceDependencies";
import type { IImageProcessingService } from "./event-processing/interfaces/IImageProcesssingService";
import type { ILocationResolutionService } from "./event-processing/interfaces/ILocationResolutionService";
import { EmbeddingService, type EmbeddingInput } from "./shared/EmbeddingService";

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
  private imageProcessingService: IImageProcessingService;
  private locationResolutionService: ILocationResolutionService;
  private eventExtractionService: IEventExtractionService;
  private embeddingService: IEmbeddingService;

  constructor(private dependencies: IEventProcessingServiceDependencies) {
    // Initialize the image processing service (use provided or create new one)
    this.imageProcessingService =
      dependencies.imageProcessingService || new ImageProcessingService();

    // Use provided location service
    this.locationResolutionService = dependencies.locationResolutionService;

    // Initialize or use the provided event extraction service
    if (dependencies.eventExtractionService) {
      this.eventExtractionService = dependencies.eventExtractionService;
    } else {
      // If not provided, create a new instance using OpenAIService singleton
      this.eventExtractionService = new EventExtractionService(
        dependencies.categoryProcessingService,
        dependencies.locationResolutionService
      );
    }

    // Use provided embedding service or get singleton instance
    this.embeddingService =
      dependencies.embeddingService || EmbeddingService.getInstance(dependencies.configService);
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

    // Use the ImageProcessingService to process the image
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

    // Report progress: Extracting event details
    if (progressCallback) {
      await progressCallback("Extracting event details and categories...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Use the EventExtractionService to extract details from the text
    const extractionResult = await this.eventExtractionService.extractEventDetails(extractedText, {
      userCoordinates: locationContext?.userCoordinates,
      organizationHints: locationContext?.organizationHints,
    });

    const eventDetailsWithCategories = extractionResult.event;

    if (progressCallback) {
      await progressCallback("Extracting event details and categories...", {
        title: eventDetailsWithCategories.title,
        categories: eventDetailsWithCategories.categories?.map((c) => c.name),
        timezone: eventDetailsWithCategories.timezone,
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Report progress: Generating embeddings
    if (progressCallback) {
      await progressCallback("Generating text embeddings...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Generate embeddings with the structured event details
    // This will properly weight location, title, date, etc.
    const finalEmbedding = await this.generateEmbedding(eventDetailsWithCategories);

    // Report progress: Finding similar events
    if (progressCallback) {
      await progressCallback("Finding similar events...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Check for similar events using the event similarity service
    const similarity = await this.dependencies.eventSimilarityService.findSimilarEvents(
      finalEmbedding,
      {
        title: eventDetailsWithCategories.title,
        date: eventDetailsWithCategories.date,
        coordinates: eventDetailsWithCategories.location.coordinates as [number, number],
        address: eventDetailsWithCategories.address,
        description: eventDetailsWithCategories.description,
        timezone: eventDetailsWithCategories.timezone,
      }
    );

    const isDuplicate = similarity.isDuplicate;

    console.log("DUPLICATE CHECK:", {
      score: similarity.score,
      matchingEventId: similarity.matchingEventId,
      matchReason: similarity.matchReason,
      isDuplicate,
    });

    if (isDuplicate && similarity.matchingEventId) {
      await this.dependencies.eventSimilarityService.handleDuplicateScan(
        similarity.matchingEventId
      );

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
        timezone: eventDetailsWithCategories.timezone,
      });
    }

    return {
      confidence: visionResult.confidence || 0,
      eventDetails: eventDetailsWithCategories,
      similarity,
      isDuplicate: isDuplicate || false,
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
