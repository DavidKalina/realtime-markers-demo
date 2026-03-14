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
  UserFollow,
  LlmUsageLog,
  Itinerary,
  ItineraryItem,
  ItineraryCheckin,
  ItineraryRitual,
  UserBadge,
} from "@realtime-markers/database";

// Import all migrations explicitly
import { CategoryTable1710000000000 } from "./migrations/CategoryTable1710000000000";
import { EventTable1710000000001 } from "./migrations/EventTable1710000000001";
import { FilterTable1710000000003 } from "./migrations/FilterTable1710000000003";
import { QueryAnalyticsTable1710000000005 } from "./migrations/QueryAnalyticsTable1710000000005";
import { UserTable1710000000006 } from "./migrations/UserTable1710000000006";
import { UserEventDiscoveryTable1710000000007 } from "./migrations/UserEventDiscoveryTable1710000000007";
import { UserEventRsvpTable1710000000008 } from "./migrations/UserEventRsvpTable1710000000008";
import { UserEventSaveTable1710000000009 } from "./migrations/UserEventSaveTable1710000000009";
import { UserEventViewTable1710000000010 } from "./migrations/UserEventViewTable1710000000010";
import { SeedUsers1710000000012 } from "./migrations/SeedUsers1710000000012";
import { AddAllUserForeignKeys1710000000014 } from "./migrations/AddAllUserForeignKeys1710000000014";
import { AddIsOfficialToEvents1710000000015 } from "./migrations/AddIsOfficialToEvents1710000000015";
import { SeedOfficialEvents1710000000016 } from "./migrations/SeedOfficialEvents1710000000016";
import { RegenerateEmbeddings1710000000017 } from "./migrations/RegenerateEmbeddings1710000000017";
import { UserPushTokenTable1710000000022 } from "./migrations/UserPushTokenTable1710000000022";
import { DropCivicEngagementTables1710000000023 } from "./migrations/DropCivicEngagementTables1710000000023";
import { AddSpatialAndCompoundIndexes1710000000024 } from "./migrations/AddSpatialAndCompoundIndexes1710000000024";
import { AddGamificationFields1710000000025 } from "./migrations/AddGamificationFields1710000000025";
import { AddExternalEventFields1710000000026 } from "./migrations/AddExternalEventFields1710000000026";
import { AddEventDigest1710000000027 } from "./migrations/AddEventDigest1710000000027";
import { AddExternalUrl1710000000028 } from "./migrations/AddExternalUrl1710000000028";
import { AddCityToEvents1710000000029 } from "./migrations/AddCityToEvents1710000000029";
import { UserFollowTable1710000000030 } from "./migrations/UserFollowTable1710000000030";
import { LlmUsageLogTable1710000000031 } from "./migrations/LlmUsageLogTable1710000000031";
import { AddPasswordResetFields1710000000032 } from "./migrations/AddPasswordResetFields1710000000032";
import { ThirdSpaceScoreSnapshot1710000000033 } from "./migrations/ThirdSpaceScoreSnapshot1710000000033";
import { NormalizeTSSCityNames1710000000034 } from "./migrations/NormalizeTSSCityNames1710000000034";
import { ItineraryTables1710000000035 } from "./migrations/ItineraryTables1710000000035";
import { AddItineraryItemGeoData1710000000036 } from "./migrations/AddItineraryItemGeoData1710000000036";
import { AddItineraryShareToken1710000000037 } from "./migrations/AddItineraryShareToken1710000000037";
import { AddItineraryCheckins1710000000038 } from "./migrations/AddItineraryCheckins1710000000038";
import { ItineraryCheckinsTable1710000000039 } from "./migrations/ItineraryCheckinsTable1710000000039";
import { AddItineraryForecast1710000000040 } from "./migrations/AddItineraryForecast1710000000040";
import { ItineraryRitualsTable1710000000041 } from "./migrations/ItineraryRitualsTable1710000000041";
import { AddItineraryRatingAndCompletion1710000000050 } from "./migrations/AddItineraryRatingAndCompletion1710000000050";
import { AddAdventureStreaks1710000000051 } from "./migrations/AddAdventureStreaks1710000000051";
import { AddUserBadges1710000000052 } from "./migrations/AddUserBadges1710000000052";
import { AddItineraryIntention1710000000053 } from "./migrations/AddItineraryIntention1710000000053";
import { RenameThirdSpaceScoreColumns1710000000054 } from "./migrations/RenameThirdSpaceScoreColumns1710000000054";

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
    UserFollow,
    LlmUsageLog,
    Itinerary,
    ItineraryItem,
    ItineraryCheckin,
    ItineraryRitual,
    UserBadge,
  ],
  migrations: [
    CategoryTable1710000000000,
    EventTable1710000000001,
    FilterTable1710000000003,
    QueryAnalyticsTable1710000000005,
    UserTable1710000000006,
    UserEventDiscoveryTable1710000000007,
    UserEventRsvpTable1710000000008,
    UserEventSaveTable1710000000009,
    UserEventViewTable1710000000010,
    SeedUsers1710000000012,
    AddAllUserForeignKeys1710000000014,
    AddIsOfficialToEvents1710000000015,
    SeedOfficialEvents1710000000016,
    RegenerateEmbeddings1710000000017,
    UserPushTokenTable1710000000022,
    DropCivicEngagementTables1710000000023,
    AddSpatialAndCompoundIndexes1710000000024,
    AddGamificationFields1710000000025,
    AddExternalEventFields1710000000026,
    AddEventDigest1710000000027,
    AddExternalUrl1710000000028,
    AddCityToEvents1710000000029,
    UserFollowTable1710000000030,
    LlmUsageLogTable1710000000031,
    AddPasswordResetFields1710000000032,
    ThirdSpaceScoreSnapshot1710000000033,
    NormalizeTSSCityNames1710000000034,
    ItineraryTables1710000000035,
    AddItineraryItemGeoData1710000000036,
    AddItineraryShareToken1710000000037,
    AddItineraryCheckins1710000000038,
    ItineraryCheckinsTable1710000000039,
    AddItineraryForecast1710000000040,
    ItineraryRitualsTable1710000000041,
    AddItineraryRatingAndCompletion1710000000050,
    AddAdventureStreaks1710000000051,
    AddUserBadges1710000000052,
    AddItineraryIntention1710000000053,
    RenameThirdSpaceScoreColumns1710000000054,
  ],
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
