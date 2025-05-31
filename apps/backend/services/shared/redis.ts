import Redis from "ioredis";
import { RedisService } from "./RedisService";

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
};

// Initialize Redis client
const redis = new Redis(redisConfig);

// Add comprehensive error handling for Redis
redis.on("error", (error: Error & { code?: string }) => {
  console.error("Redis connection error:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    hasPassword: !!process.env.REDIS_PASSWORD,
    env: {
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ? "***" : "not set",
    },
  });
});

redis.on("authError", (error: Error) => {
  console.error("Redis authentication error:", {
    message: error.message,
    stack: error.stack,
    hasPassword: !!process.env.REDIS_PASSWORD,
  });
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
  // Test the connection with a PING
  redis
    .ping()
    .then(() => {
      console.log("Redis PING successful");
    })
    .catch((err) => {
      console.error("Redis PING failed:", err);
    });
});

redis.on("ready", () => {
  console.log("Redis is ready to accept commands");
});

redis.on("close", () => {
  console.log("Redis connection closed");
});

redis.on("reconnecting", (times: number) => {
  console.log(`Redis reconnecting... Attempt ${times}`);
});

redis.on("end", () => {
  console.log("Redis connection ended");
});

// Create and export Redis service instance
export const redisService = RedisService.getInstance(redis);

// Export the Redis client for direct access if needed
export const redisClient = redis;
