// services/event-processing/interfaces/IEventProcessingServiceDependencies.ts

import type { IEmbeddingService } from "./IEmbeddingService";
import type { IEventSimilarityService } from "./IEventSimilarityService";
import type { ILocationResolutionService } from "./ILocationResolutionService";
import type { CategoryProcessingService } from "../../CategoryProcessingService";
import type { ConfigService } from "../../shared/ConfigService";
import type { IEventExtractionService } from "./IEventExtractionService";
import type { IImageProcessingService } from "./IImageProcesssingService";
import type { JobQueue } from "../../JobQueue";
import type { OpenAIService } from "../../shared/OpenAIService";

/**
 * Interface for EventProcessingService dependencies
 * Provides a named parameter approach instead of positional parameters
 */
export interface IEventProcessingServiceDependencies {
  /**
   * Service for category processing and extraction
   */
  categoryProcessingService: CategoryProcessingService;

  /**
   * Service for event similarity detection
   */
  eventSimilarityService: IEventSimilarityService;

  /**
   * Service for location resolution
   */
  locationResolutionService: ILocationResolutionService;

  /**
   * Service for image processing
   */
  imageProcessingService: IImageProcessingService;

  /**
   * Service for event extraction
   */
  eventExtractionService?: IEventExtractionService;

  /**
   * Service for embedding generation
   */
  embeddingService: IEmbeddingService;

  /**
   * Configuration service
   */
  configService?: ConfigService;

  /**
   * OpenAI service for AI operations
   */
  openAIService?: OpenAIService;

  jobQueue?: JobQueue;
}
