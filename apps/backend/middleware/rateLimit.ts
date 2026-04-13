import type { Context, Next } from "hono";
import { Redis } from "ioredis";

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (c: Context) => string;
}

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }
  return redisClient;
}

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ limited: boolean; remaining: number; resetTime: number }> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;

  const currentCount = await redis.get(windowKey);
  const count = currentCount ? parseInt(currentCount, 10) : 0;

  if (count >= maxRequests) {
    const resetTime = (Math.floor(now / windowMs) + 1) * windowMs;
    return { limited: true, remaining: 0, resetTime };
  }

  await redis.incr(windowKey);
  await redis.expire(windowKey, Math.ceil(windowMs / 1000));

  return {
    limited: false,
    remaining: maxRequests - (count + 1),
    resetTime: (Math.floor(now / windowMs) + 1) * windowMs,
  };
}

export const rateLimit = (options: RateLimitOptions) => {
  const defaultKeyGenerator = (c: Context) => {
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
      const { limited, remaining, resetTime } = await checkRateLimit(
        key,
        options.maxRequests,
        options.windowMs,
      );

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
      await next();
    }
  };
};
