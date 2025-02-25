// worker.ts
import Redis from "ioredis";
import { EventProcessingService } from "./services/EventProcessingService";
import { EventService } from "./services/EventService";
import AppDataSource from "./data-source";
import { OpenAIService } from "./services/OpenAIService";
import { CategoryProcessingService } from "./services/CategoryProcessingService";
import { Event } from "./entities/Event";
import { Category } from "./entities/Category";

// Configuration
const POLLING_INTERVAL = 1000; // 1 second
const MAX_CONCURRENT_JOBS = 3;
const JOB_TIMEOUT = 3 * 60 * 1000; // 3 minutes

async function initializeWorker() {
  // Initialize data sources
  await AppDataSource.initialize();

  // Initialize Redis clients
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  });

  // Initialize services
  const openai = OpenAIService.getInstance();
  const eventRepository = AppDataSource.getRepository(Event);
  const categoryRepository = AppDataSource.getRepository(Category);
  const categoryProcessingService = new CategoryProcessingService(openai, categoryRepository);
  const eventProcessingService = new EventProcessingService(
    openai,
    eventRepository,
    categoryProcessingService
  );
  const eventService = new EventService(AppDataSource);

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

    const job = JSON.parse(jobData);
    activeJobs++;

    // Update job status
    job.status = "processing";
    job.started = new Date().toISOString();
    await redisClient.set(`job:${jobId}`, JSON.stringify(job));

    // Publish initial processing update
    await redisClient.publish(
      `job:${jobId}:updates`,
      JSON.stringify({
        id: jobId,
        status: "processing",
        progress: "Initializing job...",
        updated: new Date().toISOString(),
      })
    );

    // Set up timeout handler
    const timeoutId = setTimeout(async () => {
      console.error(`Job ${jobId} timed out after ${JOB_TIMEOUT}ms`);
      job.status = "failed";
      job.error = "Job timed out";
      job.completed = new Date().toISOString();

      await redisClient.set(`job:${jobId}`, JSON.stringify(job));
      await redisClient.publish(
        `job:${jobId}:updates`,
        JSON.stringify({
          id: jobId,
          status: "failed",
          error: "Job timed out",
          updated: new Date().toISOString(),
        })
      );

      activeJobs--;
    }, JOB_TIMEOUT);

    try {
      // Process based on job type
      if (job.type === "process_flyer") {
        // Get the image buffer from Redis
        const bufferData = await redisClient.getBuffer(`job:${jobId}:buffer`);
        if (!bufferData) {
          throw new Error("Image data not found");
        }

        // Publish progress update for image analysis start
        await redisClient.publish(
          `job:${jobId}:updates`,
          JSON.stringify({
            id: jobId,
            status: "processing",
            progress: "Analyzing image...",
            updated: new Date().toISOString(),
          })
        );

        // Process the image
        const scanResult = await eventProcessingService.processFlyerFromImage(bufferData);

        // Update job with intermediate results
        job.scanResult = {
          confidence: scanResult.confidence,
          similarity: scanResult.similarity,
        };
        job.updated = new Date().toISOString();
        await redisClient.set(`job:${jobId}`, JSON.stringify(job));

        // Publish detailed progress update with confidence score
        await redisClient.publish(
          `job:${jobId}:updates`,
          JSON.stringify({
            id: jobId,
            status: "processing",
            progress: "Image analyzed, processing results...",
            confidence: scanResult.confidence,
            updated: new Date().toISOString(),
          })
        );

        // Create the event if confidence is high enough
        if (scanResult.confidence >= 0.75) {
          // Publish progress update for event creation
          await redisClient.publish(
            `job:${jobId}:updates`,
            JSON.stringify({
              id: jobId,
              status: "processing",
              progress: "Creating event...",
              confidence: scanResult.confidence,
              updated: new Date().toISOString(),
            })
          );

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
          });

          // Publish event creation notification
          await redisClient.publish(
            "event_changes",
            JSON.stringify({
              operation: "INSERT",
              record: newEvent,
            })
          );

          // Update job with result
          job.eventId = newEvent.id;
          job.result = { eventId: newEvent.id, title: eventDetails.title };
          job.status = "completed";
        } else {
          job.status = "completed";
          job.result = {
            message: "Confidence too low to create event",
            confidence: scanResult.confidence,
            threshold: 0.75,
          };
        }
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      // Clear timeout and update job status
      clearTimeout(timeoutId);
      job.completed = new Date().toISOString();
      await redisClient.set(`job:${jobId}`, JSON.stringify(job));

      // Publish final update
      await redisClient.publish(
        `job:${jobId}:updates`,
        JSON.stringify({
          id: jobId,
          status: job.status,
          result: job.result,
          completed: job.completed,
          updated: new Date().toISOString(),
        })
      );

      // Clean up the buffer data
      await redisClient.del(`job:${jobId}:buffer`);
    } catch (error: any) {
      // Handle job error
      clearTimeout(timeoutId);
      console.error(`Error processing job ${jobId}:`, error);

      job.status = "failed";
      job.error = error.message;
      job.completed = new Date().toISOString();

      await redisClient.set(`job:${jobId}`, JSON.stringify(job));

      // Publish error update
      await redisClient.publish(
        `job:${jobId}:updates`,
        JSON.stringify({
          id: jobId,
          status: "failed",
          error: error.message,
          completed: job.completed,
          updated: new Date().toISOString(),
        })
      );
    } finally {
      activeJobs--;
    }
  }

  // Start polling for jobs
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
