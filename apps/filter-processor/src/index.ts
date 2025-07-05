// apps/filter-processor/src/index.ts
import Redis from "ioredis";
import { createFilterProcessor } from "./services/FilterProcessor";
import { initializeHealthCheck } from "./utils/healthCheck";

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "8082");

// Configure Redis connection
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

// Initialize Redis clients for publishing and subscribing
// console.log("Initializing Redis clients...");
const redisPub = new Redis(redisConfig);
const redisSub = new Redis(redisConfig);

// Add error handling for Redis publisher
redisPub.on("error", (error: Error & { code?: string }) => {
  console.error("Redis publisher error:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
});

redisPub.on("connect", () => {
  console.log("Redis publisher connected successfully");
});

redisPub.on("ready", () => {
  console.log("Redis publisher is ready to accept commands");
});

// Add error handling for Redis subscriber
redisSub.on("error", (error: Error & { code?: string }) => {
  console.error("Redis subscriber error:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
});

redisSub.on("connect", () => {
  console.log("Redis subscriber connected successfully");
});

redisSub.on("ready", () => {
  console.log("Redis subscriber is ready to accept commands");
});

const { startHealthServer } = initializeHealthCheck({
  redisPub,
  port: HEALTH_PORT,
});

// Start health check server immediately
startHealthServer();

// Create and start the Filter Processor service
async function startFilterProcessor() {
  try {
    // console.log("👾 Initializing Filter Processor...");

    // Wait for backend to be ready before initializing
    const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
    console.log(
      `⏳ [FilterProcessor] Waiting for backend to be ready at ${backendUrl}...`,
    );

    let backendReady = false;
    const maxBackendRetries = 10;
    const backendRetryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxBackendRetries; attempt++) {
      try {
        const response = await fetch(`${backendUrl}/api/health`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          backendReady = true;
          console.log(
            `✅ [FilterProcessor] Backend is ready (attempt ${attempt}/${maxBackendRetries})`,
          );
          break;
        } else {
          console.log(
            `⚠️ [FilterProcessor] Backend health check failed with status ${response.status} (attempt ${attempt}/${maxBackendRetries})`,
          );
        }
      } catch (error) {
        console.log(
          `⏳ [FilterProcessor] Backend not ready yet (attempt ${attempt}/${maxBackendRetries}): ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      if (attempt < maxBackendRetries) {
        console.log(
          `⏳ [FilterProcessor] Retrying in ${backendRetryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, backendRetryDelay));
      }
    }

    if (!backendReady) {
      throw new Error(
        `Backend failed to become ready after ${maxBackendRetries} attempts`,
      );
    }

    // Create the FilterProcessor instance with Redis clients using the factory function
    const filterProcessor = createFilterProcessor(redisPub, redisSub, {
      // Optional configuration
      eventCacheConfig: {
        maxCacheSize: 10000,
        enableSpatialIndex: true,
      },
      userStateConfig: {
        maxUsers: 10000,
        enableViewportTracking: true,
        enableFilterTracking: true,
      },
      relevanceScoringConfig: {
        popularityWeight: 0.4,
        timeWeight: 0.4,
        distanceWeight: 0.2,
        maxPastHours: 24,
        maxFutureDays: 30,
      },
    });

    // Initialize the processor
    await filterProcessor.initialize();

    // console.log("✅ Filter Processor initialized successfully");

    // Handle termination signals
    const shutdown = async () => {
      // console.log("🛑 Shutting down Filter Processor...");
      await filterProcessor.shutdown();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    return filterProcessor;
  } catch (error) {
    console.error("❌ Failed to initialize Filter Processor:", error);
    // Don't exit - keep the health check server running so container doesn't restart
    // console.log("Keeping service running for health checks despite initialization failure");
    return null;
  }
}

// Start the service
startFilterProcessor()
  .then(() => {
    // console.log("Filter Processor service started successfully");
  })
  .catch((error) => {
    console.error("Error starting Filter Processor service:", error);
    // Don't exit - keep the health check server running so container doesn't restart
  });
