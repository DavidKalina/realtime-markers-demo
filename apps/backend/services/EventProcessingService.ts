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
import type {
  IProgressReportingService,
  ProgressCallback,
} from "./event-processing/interfaces/IProgressReportingService";
import { ProgressReportingService } from "./event-processing/ProgressReportingService";
import { EmbeddingService, type EmbeddingInput } from "./shared/EmbeddingService";
import type { JobQueue } from "./JobQueue";

interface LocationContext {
  userCoordinates?: { lat: number; lng: number };
  organizationHints?: string[];
}

interface EventDetails {
  emoji: string;
  title: string;
  date: string;
  endDate?: string;
  address: string;
  location: Point;
  description: string;
  categories?: Category[];
  timezone?: string; // IANA timezone identifier (e.g., "America/New_York")
  locationNotes?: string; // Additional location context like building, room, etc.
  userCityState?: string; // User's city and state for location context
}

interface ScanResult {
  confidence: number;
  eventDetails: EventDetails;
  similarity: SimilarityResult;
  isDuplicate?: boolean;
  qrCodeDetected?: boolean;
  qrCodeData?: string;
  embedding: number[];
}

export class EventProcessingService {
  private imageProcessingService: IImageProcessingService;
  private locationResolutionService: ILocationResolutionService;
  private eventExtractionService: IEventExtractionService;
  private embeddingService: IEmbeddingService;
  private progressReportingService: IProgressReportingService;
  private jobQueue?: JobQueue; // Store JobQueue instance

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

    // Use provided progress reporting service or create a basic one
    this.progressReportingService =
      dependencies.progressReportingService || new ProgressReportingService();

    this.jobQueue = dependencies.jobQueue;
  }

  public createWorkflow(
    jobId?: string,
    externalCallback?: ProgressCallback
  ): IProgressReportingService {
    // Create a NEW progress reporting service to avoid cross-workflow interference
    const progressService = new ProgressReportingService(
      externalCallback,
      this.jobQueue, // Pass JobQueue to the new instance
      this.dependencies.configService
    );

    // Connect to job queue if a job ID is provided
    if (jobId) {
      progressService.connectToJobQueue(jobId);
    }

    return progressService;
  }

  async processFlyerFromImage(
    imageData: Buffer | string,
    progressCallback?: ProgressCallback,
    locationContext?: LocationContext,
    jobId?: string // Add jobId parameter
  ): Promise<ScanResult> {
    // Create a workflow with the standard processing steps
    const workflow = this.createWorkflow(jobId, progressCallback);

    // Start a session with 6 steps (image processing, vision API, extraction, embedding, similarity, completion)
    workflow.startSession(6, "Flyer Processing");

    // Step 1: Analyze image
    await workflow.updateProgress(1, "Analyzing image...");

    // Step 2: Process with Vision API
    await workflow.updateProgress(2, "Analyzing image with Vision API...");

    // Use the ImageProcessingService to process the image
    const visionResult = await this.imageProcessingService.processImage(imageData);
    const extractedText = visionResult.rawText || "";

    if (visionResult.qrCodeDetected) {
      await workflow.updateProgress(3, "QR code detected in image", {
        qrCodeDetected: true,
        qrCodeData: visionResult.qrCodeData || "[Content not readable]",
      });
    } else {
      // Regular progress update if no QR detected
      await workflow.updateProgress(3, "Image analyzed successfully", {
        confidence: visionResult.confidence,
      });
    }

    // Report progress after vision processing
    await workflow.updateProgress(3, "Image analyzed successfully", {
      confidence: visionResult.confidence,
    });

    // Step 3: Extract event details
    // Use the EventExtractionService to extract details from the text
    const extractionResult = await this.eventExtractionService.extractEventDetails(extractedText, {
      userCoordinates: locationContext?.userCoordinates,
      organizationHints: locationContext?.organizationHints,
    });

    const eventDetailsWithCategories = {
      ...extractionResult.event,
      locationNotes: extractionResult.event.locationNotes || "", // Ensure locationNotes is always set
    };

    await workflow.updateProgress(4, "Event details extracted", {
      title: eventDetailsWithCategories.title,
      categories: eventDetailsWithCategories.categories?.map((c) => c.name),
      timezone: eventDetailsWithCategories.timezone,
      locationNotes: eventDetailsWithCategories.locationNotes, // Add to progress update
    });

    // Step 4: Generate embeddings
    await workflow.updateProgress(5, "Generating text embeddings...");

    // Generate embeddings with the structured event details
    // This will properly weight location, title, date, etc.
    const finalEmbedding = await this.generateEmbedding(eventDetailsWithCategories);

    // Step 5: Find similar events
    // Check for similar events using the event similarity service
    const similarity = await this.dependencies.eventSimilarityService.findSimilarEvents(
      finalEmbedding,
      {
        title: eventDetailsWithCategories.title,
        date: eventDetailsWithCategories.date,
        endDate: eventDetailsWithCategories.endDate,
        coordinates: eventDetailsWithCategories.location.coordinates as [number, number],
        address: eventDetailsWithCategories.address,
        description: eventDetailsWithCategories.description,
        timezone: eventDetailsWithCategories.timezone,
      }
    );

    const isDuplicate = similarity.isDuplicate;

    // Handle duplicate if found
    if (isDuplicate && similarity.matchingEventId) {
      await this.dependencies.eventSimilarityService.handleDuplicateScan(
        similarity.matchingEventId
      );

      await workflow.updateProgress(5, "Duplicate event detected!", {
        isDuplicate: true,
        matchingEventId: similarity.matchingEventId,
        similarityScore: similarity.score.toFixed(2),
        matchReason: similarity.matchReason || "High similarity score",
        matchDetails: similarity.matchDetails || {},
      });
    }

    // Step 6: Complete processing
    await workflow.completeSession("Processing complete!", {
      confidence: visionResult.confidence,
      similarityScore: similarity.score,
      isDuplicate: isDuplicate || false,
      reasonForMatch: isDuplicate ? similarity.matchReason || "High similarity" : undefined,
      timezone: eventDetailsWithCategories.timezone,
    });

    return {
      confidence: visionResult.confidence || 0,
      eventDetails: eventDetailsWithCategories,
      similarity,
      isDuplicate: isDuplicate || false,
      qrCodeDetected: visionResult.qrCodeDetected,
      qrCodeData: visionResult.qrCodeData,
      embedding: finalEmbedding,
    };
  }

  private async generateEmbedding(eventDetails: EventDetails): Promise<number[]> {
    // Use the same format as EventService
    const textForEmbedding = `
      TITLE: ${eventDetails.title} ${eventDetails.title} ${eventDetails.title}
      CATEGORIES: ${eventDetails.categories?.map(c => c.name).join(", ") || ""}
      DESCRIPTION: ${eventDetails.description || ""}
      LOCATION: ${eventDetails.address || ""}
      LOCATION_NOTES: ${eventDetails.locationNotes || ""}
      `.trim();

    // Get embedding using the embedding service
    return await this.embeddingService.getEmbedding(textForEmbedding);
  }
}
