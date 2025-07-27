import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { CivicEngagementService } from "../../services/CivicEngagementService";
import type { StorageService } from "../../services/shared/StorageService";
import type { CreateCivicEngagementInput } from "../../types/civicEngagement";
import { CivicEngagementType } from "@realtime-markers/database";
import type { Point } from "geojson";
import type { IEmbeddingService } from "../../services/event-processing/interfaces/IEmbeddingService";

export class ProcessCivicEngagementHandler extends BaseJobHandler {
  readonly jobType = "process_civic_engagement";

  constructor(
    private readonly civicEngagementService: CivicEngagementService,
    private readonly storageService: StorageService,
    private readonly embeddingService: IEmbeddingService,
  ) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    try {
      // Start the job and update status to processing
      await this.startJob(
        jobId,
        context,
        "Starting civic engagement processing",
      );

      // Step 1: Validation and Setup (15% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 15,
        progressStep: "Validating civic engagement request",
        progressDetails: {
          currentStep: "1",
          totalSteps: 5,
          stepProgress: 100,
          stepDescription: "Validating civic engagement request",
        },
      });

      // Validate required fields
      const {
        title,
        type,
        description,
        location,
        address,
        locationNotes,
        creatorId,
      } = job.data;

      if (!title || !type || !creatorId) {
        throw new Error(
          "Missing required fields: title, type, and creatorId are required",
        );
      }

      if (
        !Object.values(CivicEngagementType).includes(
          type as CivicEngagementType,
        )
      ) {
        throw new Error(`Invalid civic engagement type: ${type}`);
      }

      // Step 2: Image Processing (if provided) (35% progress)
      let imageUrls: string[] = [];

      if (job.data.hasBuffer) {
        await this.updateJobProgress(jobId, context, {
          progress: 25,
          progressStep: "Processing attached images",
          progressDetails: {
            currentStep: "2",
            totalSteps: 5,
            stepProgress: 0,
            stepDescription: "Processing attached images",
          },
        });

        // Get the image buffer from Redis
        const bufferData = await context.redisService.get<{ data: number[] }>(
          `job:${jobId}:buffer`,
        );

        if (bufferData) {
          // Convert the array back to a Buffer
          const imageBuffer = Buffer.from(bufferData.data);

          // Upload image
          const imageUrl = await this.storageService.uploadImage(
            imageBuffer,
            "civic-engagement",
            {
              jobId: jobId,
              contentType: (job.data.contentType as string) || "image/jpeg",
              filename: (job.data.filename as string) || "civic-engagement.jpg",
            },
          );

          if (imageUrl) {
            imageUrls = [imageUrl];
          }
        }

        await this.updateJobProgress(jobId, context, {
          progress: 35,
          progressStep: "Images processed successfully",
          progressDetails: {
            currentStep: "2",
            totalSteps: 5,
            stepProgress: 100,
            stepDescription: "Images processed successfully",
          },
        });
      } else {
        // Skip image processing if no buffer
        await this.updateJobProgress(jobId, context, {
          progress: 35,
          progressStep: "No images to process",
          progressDetails: {
            currentStep: "2",
            totalSteps: 5,
            stepProgress: 100,
            stepDescription: "No images to process",
          },
        });
      }

      // Step 3: Creating Civic Engagement (75% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 55,
        progressStep: "Creating civic engagement record",
        progressDetails: {
          currentStep: "3",
          totalSteps: 4,
          stepProgress: 100,
          stepDescription: "Creating civic engagement record",
        },
      });

      // Prepare the input data
      const civicEngagementInput: CreateCivicEngagementInput = {
        title: title as string,
        type: type as CivicEngagementType,
        description: description as string,
        location: location as Point | undefined,
        address: address as string,
        locationNotes: locationNotes as string,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        creatorId: creatorId as string,
      };

      // Create the civic engagement record (embedding will be handled by the service)
      const civicEngagement =
        await this.civicEngagementService.createCivicEngagement(
          civicEngagementInput,
        );

      // Step 4: Completion (100% progress)
      await this.updateJobProgress(jobId, context, {
        progress: 100,
        progressStep: "Civic engagement created successfully",
        progressDetails: {
          currentStep: "4",
          totalSteps: 4,
          stepProgress: 100,
          stepDescription: "Civic engagement created successfully",
        },
      });

      // Complete the job with result
      await this.completeJob(jobId, context, {
        message: `Civic engagement "${civicEngagement.title}" created successfully`,
        civicEngagementId: civicEngagement.id,
        type: civicEngagement.type,
        status: civicEngagement.status,
        hasImages: imageUrls.length > 0,
      });

      console.log(
        `[ProcessCivicEngagementHandler] Civic engagement ${civicEngagement.id} created successfully`,
      );
    } catch (error) {
      console.error(
        `[ProcessCivicEngagementHandler] Error processing job ${jobId}:`,
        error,
      );
      await this.failJob(
        jobId,
        context,
        error instanceof Error ? error : new Error(String(error)),
        "Failed to process civic engagement request. Please try again.",
      );
    }
  }
}
