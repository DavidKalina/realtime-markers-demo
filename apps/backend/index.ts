import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "reflect-metadata";
import AppDataSource, { initializeDatabase } from "./data-source";
import type { AppContext } from "./types/context";
import { redisClient } from "./services/shared/redis";

import {
  testRedisConnection,
  ensureDatabaseReadyForServices,
  getDatabaseStatus,
} from "./utils/databaseInitializer";
import { seedUsers } from "./utils/userSeeder";
import { performanceMonitor } from "./middleware/performanceMonitor";
import { requestLimiter } from "./middleware/requestLimiter";
import { securityHeaders } from "./middleware/securityHeaders";
import { createServices } from "./services/ServiceInitializer";
import { NotificationSchedulerService } from "./services/NotificationSchedulerService";

// Route imports
import { adminRouter } from "./routes/admin";
import { devTracerRouter } from "./routes/devTracer";
import { authRouter } from "./routes/auth";
import { jobsRouter } from "./routes/jobs";
import { jobStreamingRouter } from "./routes/jobStreaming";
import { pushNotificationRouter } from "./routes/pushNotifications";
import { usersRouter } from "./routes/users";
import { sidequestRouter, publicSidequestRouter } from "./routes/sidequests";

// ── Global error handlers ────────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// ── App setup ────────────────────────────────────────────────────────
const app = new Hono<AppContext>();

// Test Redis connection after a short delay
setTimeout(() => {
  testRedisConnection(redisClient);
}, 5000);

// ── Middlewares ──────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
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
app.use("*", performanceMonitor());
app.use("*", async (c, next) => {
  const url = c.req.url;
  if (url !== "/" && url.endsWith("/")) {
    return c.redirect(url.slice(0, -1));
  }
  return next();
});

// ── Health check ─────────────────────────────────────────────────────
app.get("/api/health", async (c) => {
  const isDbConnected = AppDataSource.isInitialized;

  if (!isDbConnected) {
    return c.json(
      {
        status: "initializing",
        message: "Database connection in progress",
        timestamp: new Date().toISOString(),
        db_connection: "connecting",
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

// ── Initialize services ──────────────────────────────────────────────
console.log("Initializing database connection...");
const dataSource = await initializeDatabase();
console.log("Database connection established");

console.log("Validating database readiness...");
await ensureDatabaseReadyForServices(dataSource);
console.log("Database validation passed — creating services");

const services = await createServices(dataSource, redisClient);

// Setup push notification schedules (streak-at-risk, weekly nudge)
const notificationScheduler = new NotificationSchedulerService({
  dataSource,
  pushNotificationService: services.pushNotificationService,
});
notificationScheduler.start();

// Seed dev users on startup (idempotent — skips if they already exist)
await seedUsers(dataSource).catch((err) =>
  console.warn("User seeding skipped:", err.message),
);

console.log("All services initialized successfully");

// ── Context injection ────────────────────────────────────────────────
// Spread all services onto the Hono context once; adding a new service
// to ServiceContainer automatically makes it available via c.get().
const contextValues = {
  ...services,
  redisClient: services.redisService.getClient(),
} as Record<string, unknown>;

app.use("*", async (c, next) => {
  for (const [key, value] of Object.entries(contextValues)) {
    c.set(key as never, value as never);
  }
  await next();
});

// ── Routes ───────────────────────────────────────────────────────────
// Public routes (no auth required) — must come before authenticated routes
app.route("/api/public/sidequests", publicSidequestRouter);

app.route("/api/auth", authRouter);
app.route("/api/admin", adminRouter);
// Dev-only tracer (no auth) — local development only.
app.route("/dev", devTracerRouter);
app.route("/api/push-notifications", pushNotificationRouter);
app.route("/api/users", usersRouter);
app.route("/api/sidequests", sidequestRouter);

// Job streaming routes (must be before jobs router)
app.route("/api/jobs", jobStreamingRouter);
app.route("/api/jobs", jobsRouter);

// ── Error handling ───────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
