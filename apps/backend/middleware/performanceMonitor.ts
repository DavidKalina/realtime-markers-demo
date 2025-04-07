import type { Context, Next } from "hono";
import { Redis } from "ioredis";

interface PerformanceMetrics {
    responseTime: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
        arrayBuffers: number;
    };
    timestamp: number;
    path: string;
    method: string;
    statusCode: number;
}

export const performanceMonitor = (redisClient: Redis) => {
    return async (c: Context, next: Next) => {
        const start = process.hrtime();
        const startMemory = process.memoryUsage();

        await next();

        const [seconds, nanoseconds] = process.hrtime(start);
        const endMemory = process.memoryUsage();
        const responseTime = seconds * 1000 + nanoseconds / 1000000;

        // Calculate memory differences
        const memoryDiff = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external,
            rss: endMemory.rss - startMemory.rss,
            arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        };

        const metrics: PerformanceMetrics = {
            responseTime,
            memoryUsage: memoryDiff,
            timestamp: Date.now(),
            path: c.req.path,
            method: c.req.method,
            statusCode: c.res.status,
        };

        // Store metrics in Redis for analysis
        try {
            // Only try to store if Redis is ready
            if (redisClient.status === 'ready') {
                const key = `perf:${Date.now()}`;
                await redisClient.setex(key, 86400, JSON.stringify(metrics)); // Store for 24 hours
            } else {
                console.log('Redis not ready, skipping performance metrics storage');
            }
        } catch (error) {
            console.error("Error storing performance metrics:", error);
        }

        // Log slow requests
        if (responseTime > 1000) { // Log requests taking more than 1 second
            console.warn(`Slow request detected: ${c.req.method} ${c.req.path} took ${responseTime}ms`);
        }

        // Add performance headers
        c.header("X-Response-Time", `${responseTime.toFixed(2)}ms`);
    };
}; 