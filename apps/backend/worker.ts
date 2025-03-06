// worker.ts
import Redis from "ioredis";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import AppDataSource from "./data-source";
import { OpenAIService } from "./services/OpenAIService";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { EnhancedLocationService } from "./services/LocationService";
import { Event } from "./entities/Event";
import { Category } from "./entities/Category";
import { JobQueue } from "./services/JobQueue";

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

  // Initialize LocationService singleton (this is just to warm up the cache)
  EnhancedLocationService.getInstance();

  // Initialize repositories and services
  const eventRepository = AppDataSource.getRepository(Event);
  const categoryRepository = AppDataSource.getRepository(Category);
  const categoryProcessingService = new CategoryProcessingService(
    OpenAIService.getInstance(),
    categoryRepository
  );

  // Create event processing service with the updated constructor signature
  const eventProcessingService = new EventProcessingService(
    eventRepository,
    categoryProcessingService
  );

  const eventService = new EventService(AppDataSource);

  // Initialize JobQueue
  const jobQueue = new JobQueue(redisClient);

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
          }
        );

        console.log("SIMILARITY", scanResult.similarity);

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

          // Continue with event creation as before...
          const eventDetails = scanResult.eventDetails;
          const newEvent = await eventService.createEvent({
            emoji: eventDetails.emoji,
            title: eventDetails.title,
            eventDate: new Date(eventDetails.date),
            location: eventDetails.location,
            description: eventDetails.description,
            confidenceScore: scanResult.confidence,
            address: eventDetails.address,
            categoryIds: eventDetails.categories?.map((cat) => cat.id),
            creatorId: job.data.creatorId,
          });

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
