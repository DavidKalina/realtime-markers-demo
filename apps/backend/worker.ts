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
import { JobHandlerRegistry } from "./handlers/job/JobHandlerRegistry";
import { Redis } from "ioredis";
import { createGoogleGeocodingService } from "./services/shared/GoogleGeocodingService";
import { createConfigService } from "./services/shared/ConfigService";
import { createEmbeddingService } from "./services/shared/EmbeddingService";
import { createOpenAIService } from "./services/shared/OpenAIService";
import { createOpenAICacheService } from "./services/shared/OpenAICacheService";


// Constants
const POLLING_INTERVAL = 1000; // 1 second
const MAX_CONCURRENT_JOBS = 5;
const JOB_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Global state
let activeJobs = 0;
let jobQueue: JobQueue;
let redisService: RedisService;
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

  // Initialize job queue
  jobQueue = createJobQueue({
    redisService,
  });

  // Initialize config service
  const configService = createConfigService();

  // Create OpenAIService
  const openAIService = createOpenAIService({
    redisService,
    openAICacheService: createOpenAICacheService(),
    dataSource: AppDataSource,
  });

  // Create embedding service
  const embeddingService = createEmbeddingService({
    openAIService,
    configService,
  });

  const geocodingService = createGoogleGeocodingService(
    openAIService,
    redisService,
  );

  // Initialize sidequest service
  const { createSidequestService } =
    await import("./services/SidequestService");
  const { createOverpassService } =
    await import("./services/shared/OverpassService");
  const { createComfortZoneService } =
    await import("./services/ComfortZoneService");
  const overpassService = createOverpassService({ redisService });
  const comfortZoneService = createComfortZoneService({
    dataSource: AppDataSource,
  });
  const sidequestService = createSidequestService({
    dataSource: AppDataSource,
    openAIService,
    geocodingService,
    overpassService,
    embeddingService,
    redisService,
    comfortZoneService,
  });

  jobHandlerRegistry = new JobHandlerRegistry(
    jobQueue,
    redisService,
    sidequestService,
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

    // Get handler for job type
    const handler = jobHandlerRegistry.getHandler(job.type);
    if (!handler) {
      throw new Error(`No handler found for job type: ${job.type}`);
    }

    // Process the job
    await handler.handle(jobId, job, jobHandlerRegistry.getContext());

    // Clear timeout
    clearTimeout(timeoutId);
    console.log(`[Worker] Job ${jobId} completed successfully`);
  } catch (error) {
    // Handle job error
    clearTimeout(timeoutId);
    console.error(`Error processing job ${jobId}:`, error);

    await jobQueue.failJob(
      jobId,
      error instanceof Error ? error.message : "Unknown error",
      "Something went wrong. Please try again.",
    );
  } finally {
    activeJobs--;
  }
}

// Start the worker
initializeWorker()
  .then(() => {
    console.log("Starting job polling...");
    setInterval(processJobs, POLLING_INTERVAL);
  })
  .catch((error) => {
    console.error("Failed to initialize worker:", error);
    process.exit(1);
  });
