import type { Context, Next } from "hono";
import { RateLimitService } from "../services/shared/RateLimitService";

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (c: Context) => string;
}

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

// Keep the original function for backward compatibility
export const rateLimit = () => {
  throw new Error(
    "rateLimit middleware must be created with createRateLimitMiddleware. Please update your route files to use the factory function.",
  );
};
