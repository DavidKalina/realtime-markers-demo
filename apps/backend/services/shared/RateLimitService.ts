import { Redis } from "ioredis";

interface RateLimitConfig {
    maxRequests: number;  // Maximum number of requests allowed
    windowMs: number;     // Time window in milliseconds
}

export class RateLimitService {
    private static instance: RateLimitService;
    private redisClient: Redis | null = null;

    private constructor() { }

    public static getInstance(): RateLimitService {
        if (!RateLimitService.instance) {
            RateLimitService.instance = new RateLimitService();
        }
        return RateLimitService.instance;
    }

    public initRedis(options: { host: string; port: number; password?: string }) {
        this.redisClient = new Redis({
            host: options.host,
            port: options.port,
            password: options.password || undefined,
        });
    }

    public async isRateLimited(
        key: string,
        config: RateLimitConfig
    ): Promise<{ limited: boolean; remaining: number; resetTime: number }> {
        if (!this.redisClient) {
            throw new Error("Redis client not initialized");
        }

        const now = Date.now();
        const windowKey = `ratelimit:${key}:${Math.floor(now / config.windowMs)}`;

        // Get current count
        const currentCount = await this.redisClient.get(windowKey);
        const count = currentCount ? parseInt(currentCount, 10) : 0;

        // If we've hit the limit, return true
        if (count >= config.maxRequests) {
            const resetTime = (Math.floor(now / config.windowMs) + 1) * config.windowMs;
            return {
                limited: true,
                remaining: 0,
                resetTime,
            };
        }

        // Increment the counter
        await this.redisClient.incr(windowKey);
        // Set expiry for the window
        await this.redisClient.expire(windowKey, Math.ceil(config.windowMs / 1000));

        return {
            limited: false,
            remaining: config.maxRequests - (count + 1),
            resetTime: (Math.floor(now / config.windowMs) + 1) * config.windowMs,
        };
    }
} 