// worker.ts
import Redis from "ioredis";
import AppDataSource from "./data-source";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { EventExtractionService } from "./services/event-processing/EventExtractionService";
import { EventSimilarityService } from "./services/event-processing/EventSimilarityService";
import { ImageProcessingService } from "./services/event-processing/ImageProcessingService";
import type { IEventProcessingServiceDependencies } from "./services/event-processing/interfaces/IEventProcessingServiceDependencies";
import { LocationResolutionService } from "./services/event-processing/LocationResolutionService";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import { JobQueue } from "./services/JobQueue";
import { ConfigService } from "./services/shared/ConfigService";
import { EnhancedLocationService } from "./services/shared/LocationService";
import { OpenAIService } from "./services/shared/OpenAIService";
import { isEventTemporalyRelevant } from "./utils/isEventTemporalyRelevant";
import { StorageService } from "./services/shared/StorageService";

// Configuration
const POLLING_INTERVAL = 1000; // 1 second
const MAX_CONCURRENT_JOBS = 3;
const JOB_TIMEOUT = 3 * 60 * 1000; // 3 minutes

async function initializeWorker() {
  console.log("Initializing worker...");

  // Initialize data sources
  await AppDataSource.initialize();

  const redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  // Initialize OpenAI service
  OpenAIService.initRedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  // Get OpenAI instance - this initializes the singleton
  OpenAIService.getInstance();

  StorageService.getInstance();

  // Initialize LocationService singleton (this is just to warm up the cache)
  EnhancedLocationService.getInstance();

  const configService = ConfigService.getInstance();

  // Initialize repositories and services
  const eventRepository = AppDataSource.getRepository(Event);
  const categoryRepository = AppDataSource.getRepository(Category);
  const categoryProcessingService = new CategoryProcessingService(
    OpenAIService.getInstance(),
    categoryRepository
  );

  // Create the event similarity service
  const eventSimilarityService = new EventSimilarityService(eventRepository, configService);

  // Create the location resolution service
  const locationResolutionService = new LocationResolutionService(configService);

  // Create the image processing service
  const imageProcessingService = new ImageProcessingService();

  const eventExtractionService = new EventExtractionService(
    categoryProcessingService,
    locationResolutionService
  );

  const jobQueue = new JobQueue(redisClient);

  // Create event processing service using the dependencies interface
  const eventProcessingDependencies: IEventProcessingServiceDependencies = {
    categoryProcessingService,
    eventSimilarityService,
    locationResolutionService,
    imageProcessingService,
    configService,
    eventExtractionService,
    jobQueue,
  };

  const eventProcessingService = new EventProcessingService(eventProcessingDependencies);

  const eventService = new EventService(AppDataSource);

  // Initialize JobQueue

  // Active jobs counter
  let activeJobs = 0;

  // Process jobs function
  async function processJobs() {
    // Don't take new jobs if we're at capacity
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
      return;
    }

    // Get a job from the queue
    const jobId = await redisClient.lpop("jobs:pending");
    if (!jobId) {
      return;
    }

    // Get job data
    const jobData = await redisClient.get(`job:${jobId}`);
    if (!jobData) {
      return;
    }

    console.log(`[Worker] Starting job ${jobId}`);
    activeJobs++;

    // Set up timeout handler
    const timeoutId = setTimeout(async () => {
      console.error(`Job ${jobId} timed out after ${JOB_TIMEOUT}ms`);

      try {
        await jobQueue.updateJobStatus(jobId, {
          status: "failed",
          error: "Job timed out",
          completed: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error updating timed out job:", error);
      }

      activeJobs--;
    }, JOB_TIMEOUT);

    try {
      // Update job status to processing
      await jobQueue.updateJobStatus(jobId, {
        status: "processing",
        started: new Date().toISOString(),
        progress: "Initializing job...",
      });

      // Add a small delay to ensure UI can process the updates
      await new Promise((resolve) => setTimeout(resolve, 500));

      const job = JSON.parse(jobData);

      // Process based on job type
      if (job.type === "process_flyer") {
        // Get the image buffer from Redis
        const bufferData = await redisClient.getBuffer(`job:${jobId}:buffer`);
        if (!bufferData) {
          throw new Error("Image data not found");
        }

        // Update status to analyzing (this initial update remains)
        console.log(`[Worker] Analyzing image for job ${jobId}`);
        await jobQueue.updateJobStatus(jobId, {
          progress: "Analyzing image...",
        });

        // Create progress callback function
        const progressCallback = async (message: string, metadata?: Record<string, any>) => {
          console.log(`[Worker] Progress update for job ${jobId}: ${message}`);
          await jobQueue.updateJobStatus(jobId, {
            progress: message,
            ...metadata,
          });

          // Add a small delay to ensure UI can process the updates
          await new Promise((resolve) => setTimeout(resolve, 300));
        };

        const scanResult = await eventProcessingService.processFlyerFromImage(
          bufferData,
          progressCallback,
          {
            userCoordinates: job.data.userCoordinates,
          },
          jobId
        );

        // Add detailed debugging to see what's happening
        console.log("DETAILED SCAN RESULT:", {
          confidence: scanResult.confidence,
          title: scanResult.eventDetails.title,
          isDuplicate: scanResult.isDuplicate, // Check if this is properly set
          similarityScore: scanResult.similarity.score,
          threshold: 0.72,
          date: scanResult.eventDetails.date,
          timezone: scanResult.eventDetails.timezone,
          matchingEventId: scanResult.similarity.matchingEventId,
        });

        console.log(`[Worker] Image analyzed with confidence: ${scanResult.confidence}`);

        // Now check if this is a duplicate event
        if (scanResult.isDuplicate && scanResult.similarity.matchingEventId) {
          console.log(
            `[Worker] Duplicate event detected with ID: ${scanResult.similarity.matchingEventId}`
          );

          // Get the existing event to return its details
          const existingEvent = await eventRepository.findOne({
            where: { id: scanResult.similarity.matchingEventId },
          });

          if (existingEvent) {
            // Mark as completed with duplicate information
            await jobQueue.updateJobStatus(jobId, {
              status: "completed",
              eventId: existingEvent.id,
              result: {
                eventId: existingEvent.id,
                title: existingEvent.title,
                coordinates: existingEvent.location.coordinates,
                isDuplicate: true,
                similarityScore: scanResult.similarity.score,
              },
              completed: new Date().toISOString(),
            });
          } else {
            // This shouldn't happen, but handle the case anyway
            console.error(
              `[Worker] Matching event ${scanResult.similarity.matchingEventId} not found`
            );
            await jobQueue.updateJobStatus(jobId, {
              status: "failed",
              error: "Duplicate event reference not found",
              completed: new Date().toISOString(),
            });
          }
        }

        // Create the event if confidence is high enough
        else if (scanResult.confidence >= 0.75) {
          // Update for event creation
          await jobQueue.updateJobStatus(jobId, {
            progress: "Creating event...",
          });

          const eventDetails = scanResult.eventDetails;

          const eventDate = new Date(eventDetails.date);

          // Validate the event date
          const dateValidation = isEventTemporalyRelevant(eventDate);

          if (!dateValidation.valid) {
            console.log(
              `[Worker] Event date validation failed: ${dateValidation.reason} (${dateValidation.daysFromNow} days from now)`
            );

            // Mark as completed with info about invalid date
            await jobQueue.updateJobStatus(jobId, {
              status: "completed",
              result: {
                message: dateValidation.reason,
                daysFromNow: dateValidation.daysFromNow,
                date: eventDate.toISOString(),
                confidence: scanResult.confidence,
              },
              completed: new Date().toISOString(),
            });
            return;
          }

          const newEvent = await eventService.createEvent({
            emoji: eventDetails.emoji,
            title: eventDetails.title,
            eventDate: new Date(eventDetails.date),
            endDate: eventDetails.endDate ? new Date(eventDetails.endDate) : undefined,
            location: eventDetails.location,
            description: eventDetails.description,
            confidenceScore: scanResult.confidence,
            address: eventDetails.address,
            categoryIds: eventDetails.categories?.map((cat) => cat.id),
            creatorId: job.data.creatorId,
            qrDetectedInImage: scanResult.qrCodeDetected || false,
            detectedQrData: scanResult.qrCodeData,
          });

          // Check if QR code was detected in the image
          if (scanResult.qrCodeDetected && scanResult.qrCodeData) {
            await jobQueue.updateJobStatus(jobId, {
              progress: "Storing detected QR code...",
            });

            try {
              // Use the detected QR code instead of generating a new one
              await eventService.storeDetectedQRCode(newEvent.id, scanResult.qrCodeData);
              console.log(`[Worker] Stored detected QR code for event ${newEvent.id}`);
            } catch (error) {
              console.error(
                `[Worker] Error storing detected QR code for event ${newEvent.id}:`,
                error
              );
              // Fall back to generating a QR code if storing fails
            }
          } else {
            // No QR code detected, generate one as usual
            await jobQueue.updateJobStatus(jobId, {
              progress: "Generating QR code...",
            });
          }

          // Publish event creation notification
          await redisClient.publish(
            "event_changes",
            JSON.stringify({
              operation: "INSERT",
              record: newEvent,
            })
          );

          // Mark as completed with success
          // In worker.ts, when marking the job as completed
          await jobQueue.updateJobStatus(jobId, {
            status: "completed",
            eventId: newEvent.id,
            result: {
              eventId: newEvent.id,
              title: eventDetails.title,
              coordinates: newEvent.location.coordinates, // Add coordinates here
            },
            completed: new Date().toISOString(),
          });
        } else {
          console.log(`[Worker] Confidence too low (${scanResult.confidence}) to create event`);
          // Mark as completed with info about low confidence
          await jobQueue.updateJobStatus(jobId, {
            status: "completed",
            result: {
              message: "Confidence too low to create event",
              confidence: scanResult.confidence,
              threshold: 0.75,
            },
            completed: new Date().toISOString(),
          });
        }
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      // Clear timeout
      clearTimeout(timeoutId);

      // Clean up the buffer data
      await redisClient.del(`job:${jobId}:buffer`);
      console.log(`[Worker] Job ${jobId} completed successfully`);
    } catch (error: any) {
      // Handle job error
      clearTimeout(timeoutId);
      console.error(`Error processing job ${jobId}:`, error);

      // Update job with error
      await jobQueue.updateJobStatus(jobId, {
        status: "failed",
        error: error.message,
        completed: new Date().toISOString(),
      });
    } finally {
      activeJobs--;
    }
  }

  // Start polling for jobs
  console.log("Starting job polling...");
  setInterval(processJobs, POLLING_INTERVAL);
  console.log("Worker started successfully");

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Worker shutting down...");
    await redisClient.quit();
    process.exit(0);
  });
}

// Start the worker
initializeWorker().catch((error) => {
  console.error("Failed to initialize worker:", error);
  process.exit(1);
});
