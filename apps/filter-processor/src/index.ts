// apps/filter-processor/src/index.ts
import Redis from "ioredis";
import { FilterProcessor } from "./services/FilterProcessor";
import { initializeHealthCheck } from "./utils/healthCheck";

// Load environment variables
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
const POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_DB = process.env.POSTGRES_DB || "markersdb";
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "8082");

// console.log(`🚀 Starting Filter Processor Service`);
// console.log(`📌 Redis: ${REDIS_HOST}:${REDIS_PORT}`);
// console.log(`📌 PostgreSQL: ${POSTGRES_HOST}`);
// console.log(`📌 Health check port: ${HEALTH_PORT}`);

// Configure Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
};

// Initialize Redis clients for publishing and subscribing
// console.log("Initializing Redis clients...");
const redisPub = new Redis(redisConfig);
const redisSub = new Redis(redisConfig);

// Database connection string for future use
const DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}`;

// Initialize health check endpoint FIRST - this is important for Docker health checks
// console.log("Starting health check server...");
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

    // Create the FilterProcessor instance with Redis clients
    const filterProcessor = new FilterProcessor(redisPub, redisSub);

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
