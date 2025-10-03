import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { performanceMonitor } from "../middleware/performanceMonitor";
import { requestLimiter } from "../middleware/requestLimiter";
import { securityHeaders } from "../middleware/securityHeaders";
import type { AppContext } from "../types/context";
import { Redis } from "ioredis";

/**
 * Setup global middlewares for the application
 */
export function setupMiddlewares(
  app: Hono<AppContext>,
  redisClient: Redis,
): void {
  // Apply global middlewares
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin:
        process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : "*",
      allowMethods: [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "OPTIONS",
      ],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );
  app.use("*", securityHeaders());
  app.use(
    "*",
    requestLimiter({
      maxBodySize: 5 * 1024 * 1024, // 5MB for file uploads
      maxUrlLength: 2048,
      maxHeadersSize: 8192,
    }),
  );

  // Add performance monitoring after Redis initialization
  app.use("*", performanceMonitor(redisClient));

  // Redirect trailing slashes
  app.use("*", async (c, next) => {
    const url = c.req.url;
    if (url !== "/" && url.endsWith("/")) {
      return c.redirect(url.slice(0, -1));
    }
    return next();
  });
}

/**
 * Setup global error handlers
 */
export function setupErrorHandlers(): void {
  // Add a global error handler for unhandled Redis errors
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
  });
}
