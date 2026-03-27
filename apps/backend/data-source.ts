// data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";

// Import all entities from the shared package
import {
  User,
  Event,
  Category,
  Filter,
  QueryAnalytics,
  UserEventView,
  UserEventDiscovery,
  UserEventRsvp,
  UserEventSave,
  UserPushToken,
  LlmUsageLog,
  Sidequest,
  Objective,
  ObjectiveCheckin,
  UserBadge,
  AdventureScoreSnapshot,
  District,
  DistrictSnapshot,
} from "@realtime-markers/database";

import { dirname, join } from "path";
import { fileURLToPath } from "url";

const currentDir = dirname(fileURLToPath(import.meta.url));

// Create the DataSource instance
const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Event,
    Category,
    Filter,
    QueryAnalytics,
    UserEventView,
    UserEventDiscovery,
    UserEventRsvp,
    UserEventSave,
    UserPushToken,
    LlmUsageLog,
    Sidequest,
    Objective,
    ObjectiveCheckin,
    UserBadge,
    AdventureScoreSnapshot,
    District,
    DistrictSnapshot,
  ],
  migrations: [join(currentDir, "migrations", "*.ts")],
  migrationsTableName: "migrations",
  migrationsRun: false, // Disable automatic migration running
  logging: ["error"],
  ssl: false,
  poolSize: 50,
  connectTimeoutMS: 10000, // Increase timeout for initial connection
  maxQueryExecutionTime: 1000, // Log slow queries
  extra: {
    max: 60, // Maximum pool size
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 5000, // Longer timeout for connection
  },
});

// Function to run migrations manually
const runMigrations = async (): Promise<void> => {
  if (!AppDataSource.isInitialized) {
    throw new Error("Database must be initialized before running migrations");
  }

  try {
    console.log("Running database migrations...");

    // Check if there are pending migrations
    const hasPendingMigrations = await AppDataSource.showMigrations();
    console.log(`Has pending migrations: ${hasPendingMigrations}`);

    await AppDataSource.runMigrations();
    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  }
};

// Function to ensure database is fully ready
const ensureDatabaseReady = async (): Promise<void> => {
  if (!AppDataSource.isInitialized) {
    throw new Error("Database must be initialized before checking readiness");
  }

  try {
    console.log("Ensuring database is fully ready...");

    // Check that essential tables exist (only the most critical ones)
    const essentialTables = ["users", "events", "categories"];

    for (const tableName of essentialTables) {
      const tableExists = await AppDataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName],
      );

      if (!tableExists[0].exists) {
        console.error(`Essential table '${tableName}' does not exist`);
        console.log(
          "This might indicate that migrations failed to run properly",
        );
        throw new Error(`Essential table '${tableName}' does not exist`);
      }
    }

    console.log("Essential tables exist - database is ready");
  } catch (error) {
    console.error("Database readiness check failed:", error);
    throw error;
  }
};

// Wrapped DataSource with retry logic and development seeding
const initializeDatabase = async (
  retries = 5,
  delay = 2000,
): Promise<DataSource> => {
  // If the dataSource is already initialized, check if it's ready
  if (AppDataSource.isInitialized) {
    try {
      await ensureDatabaseReady();
      return AppDataSource;
    } catch {
      console.log(
        "Database is initialized but not ready, will retry initialization",
      );
      // If database is initialized but not ready, we need to destroy and reinitialize
      await AppDataSource.destroy();
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database initialization attempt ${attempt}/${retries}`);
      await AppDataSource.initialize();
      console.log("Database connection established successfully");

      // Run migrations after successful connection
      await runMigrations();

      // Ensure database is fully ready
      await ensureDatabaseReady();

      return AppDataSource;
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`);
      console.error(error);

      if (attempt === retries) {
        console.error("Max retries reached. Exiting.");
        throw error;
      }

      // If DataSource is initialized but failed, destroy it before retrying
      if (AppDataSource.isInitialized) {
        try {
          await AppDataSource.destroy();
        } catch (destroyError) {
          console.error("Error destroying DataSource:", destroyError);
        }
      }

      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * 1.5, 10000);
    }
  }

  throw new Error("Failed to initialize database after all retries");
};

export { initializeDatabase, runMigrations, ensureDatabaseReady };
export default AppDataSource;
