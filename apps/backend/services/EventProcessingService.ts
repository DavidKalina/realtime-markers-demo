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
import type { Event } from "../entities/Event";
import { Repository } from "typeorm";

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
}

interface ScanResult {
  confidence: number;
  eventDetails: EventDetails;
  similarity: SimilarityResult;
  isDuplicate?: boolean;
  qrCodeDetected?: boolean; // New field
  qrCodeData?: string; // New field
}

export class EventProcessingService {
  private imageProcessingService: IImageProcessingService;
  private locationResolutionService: ILocationResolutionService;
  private eventExtractionService: IEventExtractionService;
  private embeddingService: IEmbeddingService;
  private progressReportingService: IProgressReportingService;
  private jobQueue?: JobQueue; // Store JobQueue instance
  private eventRepository: Repository<Event>;

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
    this.eventRepository = dependencies.eventRepository;
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
    jobId?: string
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
      await workflow.updateProgress(3, "Image analyzed successfully", {
        confidence: visionResult.confidence,
      });
    }

    // Step 3: Extract event details
    const extractionResult = await this.eventExtractionService.extractEventDetails(extractedText, {
      userCoordinates: locationContext?.userCoordinates,
      organizationHints: locationContext?.organizationHints,
    });

    const eventDetailsWithCategories = extractionResult.event;

    await workflow.updateProgress(4, "Event details extracted", {
      title: eventDetailsWithCategories.title,
      categories: eventDetailsWithCategories.categories?.map((c) => c.name),
      timezone: eventDetailsWithCategories.timezone,
    });

    // Step 4: Generate embeddings
    await workflow.updateProgress(5, "Generating text embeddings...");
    const finalEmbedding = await this.generateEmbedding(eventDetailsWithCategories);

    // Step 5: Find similar events
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
      // Get the existing event
      const existingEvent = await this.dependencies.eventRepository.findOne({
        where: { id: similarity.matchingEventId },
      });

      if (existingEvent) {
        // Calculate confidence for this scan
        const scanConfidence = this.calculateScanConfidence(
          visionResult.confidence,
          similarity.score,
          eventDetailsWithCategories
        );

        // If this scan has higher confidence, merge the data
        if (scanConfidence > (existingEvent.confidenceScore || 0)) {
          await this.mergeHigherConfidenceData(existingEvent, {
            ...eventDetailsWithCategories,
            confidenceScore: scanConfidence,
            qrDetectedInImage: visionResult.qrCodeDetected || false,
            detectedQrData: visionResult.qrCodeData,
            originalImageUrl: jobId ? `original-flyers/${jobId}` : undefined,
            eventDate: new Date(eventDetailsWithCategories.date),
            endDate: eventDetailsWithCategories.endDate
              ? new Date(eventDetailsWithCategories.endDate)
              : undefined,
          });
        }

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
        endDate: eventDetails.endDate,
        coordinates: eventDetails.location.coordinates as [number, number],
        address: eventDetails.address,
        timezone: eventDetails.timezone,
        // Use default weights from EmbeddingService
      };

      // Generate a structured embedding
      return await this.embeddingService.getStructuredEmbedding(input);
    }
  }

  // Helper method to calculate overall scan confidence
  private calculateScanConfidence(
    visionConfidence: number,
    similarityScore: number,
    eventDetails: any
  ): number {
    // Base confidence from vision analysis
    let confidence = visionConfidence * 0.4;

    // Add confidence from similarity score
    confidence += similarityScore * 0.3;

    // Add confidence from completeness of event details
    const completenessScore = this.calculateEventCompleteness(eventDetails);
    confidence += completenessScore * 0.3;

    return Math.min(1.0, confidence);
  }

  // Helper method to calculate how complete the event details are
  private calculateEventCompleteness(eventDetails: any): number {
    let score = 0;
    const weights = {
      title: 0.2,
      description: 0.2,
      date: 0.2,
      location: 0.2,
      categories: 0.1,
      address: 0.1,
    };

    if (eventDetails.title) score += weights.title;
    if (eventDetails.description) score += weights.description;
    if (eventDetails.date) score += weights.date;
    if (eventDetails.location) score += weights.location;
    if (eventDetails.categories?.length) score += weights.categories;
    if (eventDetails.address) score += weights.address;

    return score;
  }

  // Helper method to merge higher confidence data
  private async mergeHigherConfidenceData(
    existingEvent: Event,
    newData: {
      title: string;
      description?: string;
      eventDate: Date;
      endDate?: Date;
      location: Point;
      address?: string;
      timezone?: string;
      categories?: Category[];
      confidenceScore: number;
      qrDetectedInImage: boolean;
      detectedQrData?: string;
      originalImageUrl?: string;
    }
  ): Promise<void> {
    // Check if we can update this event
    const now = new Date();
    const lastUpdate = existingEvent.lastUpdateTimestamp || existingEvent.createdAt;
    const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    // Rate limiting rules:
    // 1. Minimum 24 hours between updates
    // 2. Maximum 5 updates per event
    const MIN_HOURS_BETWEEN_UPDATES = 24;
    const MAX_UPDATES = 5;

    if (hoursSinceLastUpdate < MIN_HOURS_BETWEEN_UPDATES) {
      console.log(
        `Skipping update - too soon since last update (${hoursSinceLastUpdate.toFixed(1)} hours)`
      );
      return;
    }

    if (existingEvent.updateCount >= MAX_UPDATES) {
      console.log(`Skipping update - max updates (${MAX_UPDATES}) reached`);
      return;
    }

    // Only update fields if new data has higher confidence
    if (newData.confidenceScore > (existingEvent.confidenceScore || 0)) {
      // Update basic fields
      existingEvent.title = newData.title;
      existingEvent.description = newData.description || existingEvent.description;
      existingEvent.eventDate = newData.eventDate;
      existingEvent.endDate = newData.endDate || existingEvent.endDate;
      existingEvent.location = newData.location;
      existingEvent.address = newData.address || existingEvent.address;
      existingEvent.timezone = newData.timezone || existingEvent.timezone;
      existingEvent.confidenceScore = newData.confidenceScore;

      // Update QR code related fields if new scan has QR code
      if (newData.qrDetectedInImage) {
        existingEvent.qrDetectedInImage = true;
        existingEvent.detectedQrData = newData.detectedQrData;
        existingEvent.hasQrCode = true;
      }

      // Update original image if new one is available
      if (newData.originalImageUrl) {
        existingEvent.originalImageUrl = newData.originalImageUrl;
      }

      // Update categories if new ones are available
      if (newData.categories?.length) {
        existingEvent.categories = newData.categories;
      }

      // Update tracking fields
      existingEvent.lastUpdateTimestamp = now;
      existingEvent.updateCount += 1;

      // Save the updated event
      await this.dependencies.eventRepository.save(existingEvent);
    }
  }
}
