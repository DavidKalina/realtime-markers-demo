import "reflect-metadata";
import { DataSource } from "typeorm";

// Import all entities from the shared package
import {
  User,
  Event,
  Category,
  EventShare,
  Filter,
  QueryAnalytics,
  UserEventView,
  UserEventDiscovery,
  UserEventRsvp,
  UserEventSave,
  CivicEngagement,
  UserPushToken,
} from "../entities";

// Create the DataSource instance
export const createDataSource = (databaseUrl: string): DataSource => {
  return new DataSource({
    type: "postgres",
    url: databaseUrl,
    entities: [
      User,
      Event,
      Category,
      EventShare,
      Filter,
      QueryAnalytics,
      UserEventView,
      UserEventDiscovery,
      UserEventRsvp,
      UserEventSave,
      CivicEngagement,
      UserPushToken,
    ],
    migrationsTableName: "migrations",
    migrationsRun: false, // Disable automatic migration running
    logging: ["query", "error", "schema"], // More detailed logging
    ssl: false,
    poolSize: 20,
    connectTimeoutMS: 10000, // Increase timeout for initial connection
    maxQueryExecutionTime: 1000, // Log slow queries
    extra: {
      max: 25, // Maximum pool size
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Longer timeout for connection
    },
  });
};

// Function to run migrations manually
export const runMigrations = async (dataSource: DataSource): Promise<void> => {
  if (!dataSource.isInitialized) {
    throw new Error("Database must be initialized before running migrations");
  }

  try {
    console.log("Running database migrations...");

    // Check if there are pending migrations
    const hasPendingMigrations = await dataSource.showMigrations();
    console.log(`Has pending migrations: ${hasPendingMigrations}`);

    await dataSource.runMigrations();
    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  }
};

// Function to ensure database is fully ready
export const ensureDatabaseReady = async (
  dataSource: DataSource,
): Promise<void> => {
  if (!dataSource.isInitialized) {
    throw new Error("Database must be initialized before checking readiness");
  }

  try {
    console.log("Ensuring database is fully ready...");

    // Check that essential tables exist (only the most critical ones)
    const essentialTables = ["users", "events", "categories"];

    for (const tableName of essentialTables) {
      const tableExists = await dataSource.query(
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
export const initializeDatabase = async (
  databaseUrl: string,
  retries = 5,
  delay = 2000,
): Promise<DataSource> => {
  const dataSource = createDataSource(databaseUrl);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database initialization attempt ${attempt}/${retries}`);
      await dataSource.initialize();
      console.log("Database connection established successfully");

      // Run migrations after successful connection
      await runMigrations(dataSource);

      // Ensure database is fully ready
      await ensureDatabaseReady(dataSource);

      return dataSource;
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`);
      console.error(error);

      if (attempt === retries) {
        console.error("Max retries reached. Exiting.");
        throw error;
      }

      // If DataSource is initialized but failed, destroy it before retrying
      if (dataSource.isInitialized) {
        try {
          await dataSource.destroy();
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
