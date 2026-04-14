import type { Context, Next } from "hono";

export const performanceMonitor = () => {
  return async (c: Context, next: Next) => {
    const start = process.hrtime();

    await next();

    const [seconds, nanoseconds] = process.hrtime(start);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;

    // Log slow requests
    if (responseTime > 1000) {
      console.warn(
        `Slow request detected: ${c.req.method} ${c.req.path} took ${responseTime.toFixed(0)}ms`,
      );
    }

    c.header("X-Response-Time", `${responseTime.toFixed(2)}ms`);
  };
};
