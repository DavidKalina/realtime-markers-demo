// worker.ts
import Redis from "ioredis";
import AppDataSource from "./data-source";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { User } from "./entities/User";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { EventExtractionService } from "./services/event-processing/EventExtractionService";
import { EventSimilarityService } from "./services/event-processing/EventSimilarityService";
import { ImageProcessingService } from "./services/event-processing/ImageProcessingService";
import type { IEventProcessingServiceDependencies } from "./services/event-processing/interfaces/IEventProcessingServiceDependencies";
import { LocationResolutionService } from "./services/event-processing/LocationResolutionService";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import { JobQueue } from "./services/JobQueue";
import { PlanService } from "./services/PlanService";
import { ConfigService } from "./services/shared/ConfigService";
import { GoogleGeocodingService } from "./services/shared/GoogleGeocodingService";
import { OpenAIService } from "./services/shared/OpenAIService";
import { StorageService } from "./services/shared/StorageService";
import { isEventTemporalyRelevant } from "./utils/isEventTemporalyRelevant";

// Configuration
const POLLING_INTERVAL = 1000; // 1 second
const MAX_CONCURRENT_JOBS = 3;
const JOB_TIMEOUT = 3 * 60 * 1000; // 3 minutes

async function initializeWorker() {
  console.log("Initializing worker...");

  // Initialize data sources
  await AppDataSource.initialize();

  // Initialize Redis client with proper configuration
  const redisConfig = {
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis retry attempt ${times} with delay ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      console.log("Redis reconnectOnError triggered:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      return true;
    },
    enableOfflineQueue: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    lazyConnect: true,
    authRetry: true,
    enableReadyCheck: true,
  };

  const redisClient = new Redis(redisConfig);

  // Add error handling for Redis
  redisClient.on("error", (error: Error & { code?: string }) => {
    console.error("Redis connection error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
  });

  redisClient.on("connect", () => {
    console.log("Redis connected successfully");
  });

  redisClient.on("ready", () => {
    console.log("Redis is ready to accept commands");
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
  GoogleGeocodingService.getInstance();

  const configService = ConfigService.getInstance();

  // Initialize repositories and services
  const eventRepository = AppDataSource.getRepository(Event);
  const categoryRepository = AppDataSource.getRepository(Category);
  const categoryProcessingService = new CategoryProcessingService(categoryRepository);

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

  const planService = new PlanService(AppDataSource);

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
      // Get job data
      const job = JSON.parse(jobData);
      console.log(`[Worker] Processing job ${jobId} of type ${job.type}`);

      // In worker.ts processJobs function, add a new job type handler
      if (job.type === "cleanup_outdated_events") {
        const batchSize = job.data.batchSize || 100;
        console.log(`[Worker] Updating job ${jobId} progress: Cleaning up outdated events`);
        await jobQueue.updateJobStatus(jobId, {
          progress: `Cleaning up outdated events (batch size: ${batchSize})`,
        });

        const result = await eventService.cleanupOutdatedEvents(batchSize);

        // Publish deletion notifications for each deleted event
        for (const deletedEvent of result.deletedEvents) {
          await redisClient.publish(
            "event_changes",
            JSON.stringify({
              operation: "DELETE",
              record: {
                id: deletedEvent.id,
                location: deletedEvent.location,
              },
            })
          );
        }

        await jobQueue.updateJobStatus(jobId, {
          status: "completed",
          result: {
            deletedCount: result.deletedCount,
            hasMore: result.hasMore,
          },
          completed: new Date().toISOString(),
        });

        // If there are more events to clean up, queue another job
        if (result.hasMore) {
          await jobQueue.enqueueCleanupJob(batchSize);
        }
      } else if (job.type === "process_flyer") {
        // Check if user has reached their scan limit
        if (job.data.creatorId) {
          const hasReachedLimit = await planService.hasReachedScanLimit(job.data.creatorId);
          if (hasReachedLimit) {
            await jobQueue.updateJobStatus(jobId, {
              status: "failed",
              progress: 1,
              error: "Scan limit reached",
              message:
                "You have reached your weekly scan limit. Please upgrade to Pro for more scans.",
              completed: new Date().toISOString(),
            });
            return;
          }
        }

        // Get the image buffer from Redis
        const bufferData = await redisClient.getBuffer(`job:${jobId}:buffer`);
        if (!bufferData) {
          throw new Error("Image data not found");
        }

        // Upload image
        const storageService = StorageService.getInstance();
        const originalImageUrl = await storageService.uploadImage(bufferData, "original-flyers", {
          jobId: jobId,
          contentType: job.data.contentType || "image/jpeg",
          filename: job.data.filename || "event-flyer.jpg",
        });

        // Process the image - ProgressReportingService will handle all progress updates
        const scanResult = await eventProcessingService.processFlyerFromImage(
          bufferData,
          undefined, // No need for progress callback
          {
            userCoordinates: job.data.userCoordinates,
          },
          jobId
        );

        // Check confidence score first
        if (scanResult.confidence < 0.75) {
          console.log(
            `[Worker] Confidence too low (${scanResult.confidence}) to proceed with event processing`
          );
          await jobQueue.updateJobStatus(jobId, {
            status: "completed",
            progress: 1, // Set to 100% when completed
            result: {
              message:
                "The image quality or content was not clear enough to reliably extract event information. Please try again with a clearer image.",
              confidence: scanResult.confidence,
              threshold: 0.75,
            },
            completed: new Date().toISOString(),
          });
          return;
        }

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
              progress: 1, // Set to 100% when completed
              eventId: existingEvent.id,
              result: {
                eventId: existingEvent.id,
                title: existingEvent.title,
                coordinates: existingEvent.location.coordinates,
                isDuplicate: true,
                similarityScore: scanResult.similarity.score,
                message:
                  "This event appears to be very similar to an existing event in our database. We've linked you to the existing event instead.",
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
              progress: 1, // Set to 100% when completed
              error: "Duplicate event reference not found",
              message: "We encountered an error while processing this event. Please try again.",
              completed: new Date().toISOString(),
            });
          }
        }

        // Create the event if confidence is high enough
        else if (scanResult.confidence >= 0.75) {
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
              progress: 1,
              result: {
                message:
                  dateValidation.daysFromNow !== undefined && dateValidation.daysFromNow < 0
                    ? "This event appears to be in the past. We only process upcoming events."
                    : dateValidation.reason,
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
            emojiDescription: eventDetails.emojiDescription,
            title: eventDetails.title,
            eventDate: new Date(eventDetails.date),
            endDate: eventDetails.endDate ? new Date(eventDetails.endDate) : undefined,
            location: eventDetails.location,
            description: eventDetails.description,
            confidenceScore: scanResult.confidence,
            address: eventDetails.address,
            locationNotes: eventDetails.locationNotes || "",
            categoryIds: eventDetails.categories?.map((cat) => cat.id),
            creatorId: job.data.creatorId,
            qrDetectedInImage: scanResult.qrCodeDetected || false,
            detectedQrData: scanResult.qrCodeData,
            originalImageUrl: originalImageUrl,
            embedding: scanResult.embedding,
          });

          // Create discovery record and increment user stats if they are the creator
          if (job.data.creatorId) {
            await eventService.createDiscoveryRecord(job.data.creatorId, newEvent.id);
          }

          // Publish notifications
          await redisClient.publish(
            "event_changes",
            JSON.stringify({
              operation: "INSERT",
              record: newEvent,
            })
          );

          await redisClient.publish(
            "discovered_events",
            JSON.stringify({
              type: "EVENT_DISCOVERED",
              event: {
                id: newEvent.id,
                title: newEvent.title,
                emoji: newEvent.emoji,
                location: newEvent.location,
                description: newEvent.description,
                eventDate: newEvent.eventDate,
                endDate: newEvent.endDate,
                address: newEvent.address,
                locationNotes: newEvent.locationNotes,
                categories: newEvent.categories,
                confidenceScore: newEvent.confidenceScore,
                originalImageUrl: newEvent.originalImageUrl,
                creatorId: newEvent.creatorId,
                createdAt: newEvent.createdAt,
                updatedAt: newEvent.updatedAt,
              },
              timestamp: new Date().toISOString(),
            })
          );

          // Mark as completed with success
          await jobQueue.updateJobStatus(jobId, {
            status: "completed",
            progress: 1, // Set to 100% when completed
            eventId: newEvent.id,
            result: {
              eventId: newEvent.id,
              title: eventDetails.title,
              coordinates: newEvent.location.coordinates,
              message: "Event successfully processed and added to the database!",
            },
            completed: new Date().toISOString(),
          });
        } else {
          console.log(`[Worker] Confidence too low (${scanResult.confidence}) to create event`);
          // Mark as completed with info about low confidence
          await jobQueue.updateJobStatus(jobId, {
            status: "completed",
            progress: 1, // Set to 100% when completed
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
        progress: 1, // Set to 100% when completed
        error: error.message,
        message:
          "We encountered an error while processing your event. Please try again with a different image or contact support if the issue persists.",
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
