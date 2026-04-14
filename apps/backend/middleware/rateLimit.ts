import type { Context, Next } from "hono";
import type { Redis } from "ioredis";

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (c: Context) => string;
}

async function checkRateLimit(
  redis: Redis,
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ limited: boolean; remaining: number; resetTime: number }> {
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
    const redis = c.get("redisClient") as Redis;

    try {
      const { limited, remaining, resetTime } = await checkRateLimit(
        redis,
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
