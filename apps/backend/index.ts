// src/index.ts
import { Hono } from "hono";
import "reflect-metadata";
import AppDataSource, { initializeDatabase } from "./data-source";
import type { AppContext } from "./types/context";
import { redisClient } from "./services/shared/redis";

// Import utilities
import {
  testRedisConnection,
  ensureDatabaseReadyForServices,
  getDatabaseStatus,
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

// Enhanced health check endpoint with detailed database status
app.get("/api/health", async (c) => {
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

  try {
    // Get detailed database status
    const dbStatus = await getDatabaseStatus(AppDataSource);

    return c.json({
      status:
        dbStatus.migrationsRun && dbStatus.tablesReady ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      db_connection: "connected",
      database: {
        migrations_run: dbStatus.migrationsRun,
        tables_ready: dbStatus.tablesReady,
        last_migration: dbStatus.lastMigration,
        pending_migrations: dbStatus.pendingMigrations,
        missing_tables: dbStatus.missingTables,
      },
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        db_connection: "connected",
        error: (error as Error).message,
      },
      500,
    );
  }
});

// Initialize services using ServiceInitializer with comprehensive database validation
async function initializeServices() {
  console.log("Initializing database connection...");
  const dataSource = await initializeDatabase();
  console.log("Database connection established");

  // Ensure database is fully ready before creating services
  console.log("Validating database readiness...");
  await ensureDatabaseReadyForServices(dataSource);
  console.log("Database validation passed - creating services");

  // Create ServiceInitializer and initialize all services
  const serviceInitializer = new ServiceInitializer(dataSource, redisClient);
  const services = await serviceInitializer.initialize();

  // Setup cleanup schedule
  serviceInitializer.setupCleanupSchedule(services.jobQueue);

  console.log("All services initialized successfully");
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
