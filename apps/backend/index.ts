// src/index.ts
import { Hono } from "hono";
import "reflect-metadata";
import AppDataSource from "./data-source";
import type { AppContext } from "./types/context";
import { redisClient } from "./services/shared/redis";

// Import utilities
import {
  initializeDatabase,
  testRedisConnection,
} from "./utils/databaseInitializer";
import { setupMiddlewares, setupErrorHandlers } from "./utils/middlewareSetup";
import { setupRoutes } from "./utils/routeSetup";
import { setupContext } from "./utils/contextSetup";
import { ServiceInitializer } from "./services/ServiceInitializer";

// Create the app with proper typing
const app = new Hono<AppContext>();

// Setup global error handlers
setupErrorHandlers();

// Test Redis connection after a short delay
setTimeout(() => {
  testRedisConnection(redisClient);
}, 5000);

// Setup middlewares
setupMiddlewares(app, redisClient);

// Health check endpoint
app.get("/api/health", (c) => {
  const isDbConnected = AppDataSource.isInitialized;

  if (!isDbConnected) {
    return c.json(
      {
        status: "initializing",
        message: "Database connection in progress",
        timestamp: new Date().toISOString(),
        db_connection: isDbConnected ? "connected" : "connecting",
        storage: {
          configured:
            !!process.env.DO_SPACE_ACCESS_KEY &&
            !!process.env.DO_SPACE_SECRET_KEY,
        },
      },
      200,
    );
  }

  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    db_connection: "connected",
  });
});

// Initialize services using ServiceInitializer
async function initializeServices() {
  console.log("Initializing database connection...");
  const dataSource = await initializeDatabase();
  console.log("Database connection established, now initializing services");

  // Create ServiceInitializer and initialize all services
  const serviceInitializer = new ServiceInitializer(dataSource, redisClient);
  const services = await serviceInitializer.initialize();

  // Setup cleanup schedule
  serviceInitializer.setupCleanupSchedule(services.jobQueue);

  return services;
}

// Initialize all services async
const services = await initializeServices();

// Setup context injection
setupContext(app, services);

// Setup routes
setupRoutes(app);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
