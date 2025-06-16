import type { Context, Next } from "hono";
import {
  RateLimitService,
  createRateLimitService,
} from "../services/shared/RateLimitService";

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (c: Context) => string;
}

// Create a singleton rate limit service instance
let rateLimitServiceInstance: RateLimitService | null = null;

export const getRateLimitService = (): RateLimitService => {
  if (!rateLimitServiceInstance) {
    rateLimitServiceInstance = createRateLimitService();
    rateLimitServiceInstance.initRedis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }
  return rateLimitServiceInstance;
};

export const createRateLimitMiddleware = (
  rateLimitService: RateLimitService,
) => {
  return (options: RateLimitOptions) => {
    const defaultKeyGenerator = (c: Context) => {
      // Use IP address as default key, or user ID if authenticated
      return (
        c.get("user")?.userId ||
        c.req.header("x-forwarded-for") ||
        c.req.header("x-real-ip") ||
        "unknown"
      );
    };

    return async (c: Context, next: Next) => {
      const key = (options.keyGenerator || defaultKeyGenerator)(c);

      try {
        const { limited, remaining, resetTime } =
          await rateLimitService.isRateLimited(key, {
            maxRequests: options.maxRequests,
            windowMs: options.windowMs,
          });

        // Set rate limit headers
        c.header("X-RateLimit-Limit", options.maxRequests.toString());
        c.header("X-RateLimit-Remaining", remaining.toString());
        c.header("X-RateLimit-Reset", resetTime.toString());

        if (limited) {
          return c.json(
            {
              error: "Too many requests",
              message: "Please try again later",
              retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
            },
            429,
          );
        }

        await next();
      } catch (error) {
        console.error("Rate limit error:", error);
        // On Redis errors, we'll allow the request to proceed
        await next();
      }
    };
  };
};

// Export the rate limit middleware that uses the singleton service
export const rateLimit = (options: RateLimitOptions) => {
  const rateLimitService = getRateLimitService();
  return createRateLimitMiddleware(rateLimitService)(options);
};
