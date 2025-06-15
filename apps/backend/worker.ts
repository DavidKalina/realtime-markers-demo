// worker.ts
import AppDataSource from "./data-source";
import {
  createJobQueue,
  type JobQueue,
  type JobData,
} from "./services/JobQueue";
import {
  createRedisService,
  type RedisService,
} from "./services/shared/RedisService";
import { createEventService, type EventService } from "./services/EventService";
import {
  createEventProcessingService,
  type EventProcessingService,
} from "./services/EventProcessingService";
import { PlanService } from "./services/PlanService";
import {
  createStorageService,
  type StorageService,
} from "./services/shared/StorageService";
import { JobHandlerRegistry } from "./handlers/job/JobHandlerRegistry";
import { Redis } from "ioredis";
import { createCategoryProcessingService } from "./services/CategoryProcessingService";
import { EventSimilarityService } from "./services/event-processing/EventSimilarityService";
import { createImageProcessingService } from "./services/event-processing/ImageProcessingService";
import { EventExtractionService } from "./services/event-processing/EventExtractionService";
import { createGoogleGeocodingService } from "./services/shared/GoogleGeocodingService";
import { createConfigService } from "./services/shared/ConfigService";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { createEmbeddingService } from "./services/shared/EmbeddingService";
import { createEmbeddingCacheService } from "./services/shared/EmbeddingCacheService";
import { createOpenAIService } from "./services/shared/OpenAIService";
import { createOpenAICacheService } from "./services/shared/OpenAICacheService";
import { createEventCacheService } from "./services/shared/EventCacheService";
import { createImageProcessingCacheService } from "./services/shared/ImageProcessingCacheService";
import { LevelingService } from "./services/LevelingService";
import { createCategoryCacheService } from "./services/shared/CategoryCacheService";
import { createLevelingCacheService } from "./services/shared/LevelingCacheService";

// Constants
const POLLING_INTERVAL = 1000; // 1 second
const MAX_CONCURRENT_JOBS = 5;
const JOB_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Global state
let activeJobs = 0;
let jobQueue: JobQueue;
let redisService: RedisService;
let eventService: EventService;
let eventProcessingService: EventProcessingService;
let planService: PlanService;
let storageService: StorageService;
let jobHandlerRegistry: JobHandlerRegistry;

async function initializeWorker() {
  console.log("Initializing worker...");

  // Initialize database connection
  await AppDataSource.initialize();
  console.log("Database connection initialized");

  // Initialize Redis client
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  });

  // Create RedisService instance
  redisService = createRedisService(redisClient);

  // Initialize job queue first
  jobQueue = createJobQueue({
    redisService,
  });

  // Initialize config service
  const configService = createConfigService();

  // Initialize repositories
  const categoryRepository = AppDataSource.getRepository(Category);
  const eventRepository = AppDataSource.getRepository(Event);

  // Initialize category processing service
  const categoryProcessingService = createCategoryProcessingService({
    categoryRepository,
    openAIService: createOpenAIService({
      redisService,
      openAICacheService: createOpenAICacheService(),
    }),
    categoryCacheService: createCategoryCacheService(redisClient),
  });

  // Create OpenAIService instance with dependencies
  const openAIService = createOpenAIService({
    redisService,
    openAICacheService: createOpenAICacheService(),
  });

  // Create EventCacheService instance
  const eventCacheService = createEventCacheService(redisClient);

  // Create ImageProcessingCacheService instance
  const imageProcessingCacheService = createImageProcessingCacheService();

  // Create LevelingService instance
  const levelingService = new LevelingService({
    dataSource: AppDataSource,
    redisService,
    levelingCacheService: createLevelingCacheService(redisClient),
  });

  // Initialize event similarity service
  const eventSimilarityService = new EventSimilarityService(
    eventRepository,
    configService,
  );

  // Create the image processing service
  const imageProcessingService = createImageProcessingService(
    openAIService,
    imageProcessingCacheService,
  );

  // Create the event extraction service
  const eventExtractionService = new EventExtractionService(
    categoryProcessingService,
    createGoogleGeocodingService(openAIService),
  );

  // Create embedding service with dependencies
  const embeddingService = createEmbeddingService({
    openAIService,
    configService,
    embeddingCacheService: createEmbeddingCacheService({ configService }),
  });

  // Create event processing service with all dependencies
  eventProcessingService = createEventProcessingService({
    categoryProcessingService,
    eventSimilarityService,
    locationResolutionService: createGoogleGeocodingService(openAIService),
    imageProcessingService,
    embeddingService,
    configService,
    eventExtractionService,
    jobQueue,
  });

  // Initialize event service
  eventService = createEventService({
    dataSource: AppDataSource,
    redisService,
    locationService: createGoogleGeocodingService(openAIService),
    eventCacheService,
    openaiService: openAIService,
    levelingService,
  });

  // Initialize plan service
  planService = new PlanService({ dataSource: AppDataSource });

  // Initialize storage service
  storageService = createStorageService();

  // Initialize job handler registry
  jobHandlerRegistry = new JobHandlerRegistry(
    eventProcessingService,
    eventService,
    jobQueue,
    redisService,
    planService,
    storageService,
  );

  console.log("Worker initialized successfully");
}

async function processJobs() {
  // Don't take new jobs if we're at capacity
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return;
  }

  // Get next job from queue
  const jobId = await redisService.getClient().lpop("jobs:pending");
  if (!jobId) {
    return;
  }

  // Increment active jobs counter
  activeJobs++;

  // Set up timeout
  const timeoutId = setTimeout(async () => {
    console.error(`Job ${jobId} timed out after ${JOB_TIMEOUT}ms`);
    await jobQueue.failJob(
      jobId,
      "Job timed out",
      "The job took too long to process and was terminated.",
    );
    activeJobs--;
  }, JOB_TIMEOUT);

  try {
    // Get job data
    const jobData = await redisService.get(`job:${jobId}`);
    if (!jobData) {
      throw new Error(`Job data not found for job ${jobId}`);
    }

    const job = typeof jobData === "string" ? JSON.parse(jobData) : jobData;
    console.log(`[Worker] Processing job ${jobId} of type ${job.type}`);

    // Note: We don't update job progress here because:
    // 1. Jobs start with "pending" status when created
    // 2. Job handlers will update status and progress when they start
    // 3. This avoids duplicate SSE messages

    // Get handler for job type
    const handler = jobHandlerRegistry.getHandler(job.type);
    if (!handler) {
      throw new Error(`No handler found for job type: ${job.type}`);
    }

    // Process the job with progress updates
    await processJobWithProgress(jobId, job, handler);

    // Clear timeout
    clearTimeout(timeoutId);
    console.log(`[Worker] Job ${jobId} completed successfully`);
  } catch (error) {
    // Handle job error
    clearTimeout(timeoutId);
    console.error(`Error processing job ${jobId}:`, error);

    // Update job with error
    await jobQueue.failJob(
      jobId,
      error instanceof Error ? error.message : "Unknown error",
      "We encountered an error while processing your event. Please try again with a different image or contact support if the issue persists.",
    );
  } finally {
    activeJobs--;
  }
}

async function processJobWithProgress(
  jobId: string,
  job: JobData,
  handler: {
    handle: (
      jobId: string,
      job: JobData,
      context: { jobQueue: JobQueue; redisService: RedisService },
    ) => Promise<void>;
  },
): Promise<void> {
  // Note: We don't need to update status to "processing" here because:
  // 1. Jobs start with "pending" status when created
  // 2. Job handlers will update status to "processing" when they start
  // 3. This avoids duplicate SSE messages

  // Process the job
  await handler.handle(jobId, job, jobHandlerRegistry.getContext());

  // Note: Job handlers are responsible for calling completeJob or failJob
  // No need to call completeJob here as it would override the handler's result
}

// Start the worker
initializeWorker()
  .then(() => {
    // Start polling for jobs
    console.log("Starting job polling...");
    setInterval(processJobs, POLLING_INTERVAL);
  })
  .catch((error) => {
    console.error("Failed to initialize worker:", error);
    process.exit(1);
  });
