import { DataSource } from "typeorm";
import { Redis } from "ioredis";
import AppDataSource from "../data-source";

/**
 * Initialize database connection with retry logic
 */
export async function initializeDatabase(
  retries = 5,
  delay = 2000,
): Promise<DataSource> {
  for (let i = 0; i < retries; i++) {
    try {
      await AppDataSource.initialize();
      console.log("Database connection established");
      return AppDataSource;
    } catch (error) {
      console.error(`Database initialization attempt ${i + 1} failed:`, error);

      if (i === retries - 1) {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Failed to initialize database after all retries");
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(
  redisClient: Redis,
): Promise<boolean> {
  try {
    console.log("Testing Redis connection...");
    const result = await redisClient.ping();
    console.log("Redis connection test successful:", result);
    return true;
  } catch (error) {
    console.error("Redis connection test failed:", error);
    return false;
  }
}
