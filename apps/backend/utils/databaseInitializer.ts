import { DataSource } from "typeorm";
import { Redis } from "ioredis";
import { initializeDatabase } from "../data-source";
import { getAllRequiredTableNames } from "@realtime-markers/database";

export interface DatabaseStatus {
  isConnected: boolean;
  migrationsRun: boolean;
  tablesReady: boolean;
  lastMigration?: string;
  pendingMigrations: string[];
  missingTables: string[];
}

/**
 * Comprehensive database initialization with full validation
 */
export async function initializeDatabaseConnection(
  retries = 5,
  delay = 2000,
): Promise<DataSource> {
  return initializeDatabase(retries, delay);
}

/**
 * Check migration status and ensure all migrations have run
 */
export async function validateMigrations(dataSource: DataSource): Promise<{
  migrationsRun: boolean;
  lastMigration?: string;
  pendingMigrations: string[];
}> {
  if (!dataSource.isInitialized) {
    throw new Error("Database must be initialized before checking migrations");
  }

  try {
    // Check if migrations table exists
    const migrationsTableExists = await dataSource.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      )`,
    );

    if (!migrationsTableExists[0].exists) {
      console.log("Migrations table does not exist - no migrations have run");
      return {
        migrationsRun: false,
        pendingMigrations: [],
      };
    }

    // Get list of pending migrations
    const pendingMigrations = await dataSource.showMigrations();

    // Get the last executed migration
    const lastMigration = await dataSource.query(
      "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1",
    );

    const migrationsRun = !pendingMigrations;
    const lastMigrationName =
      lastMigration.length > 0 ? lastMigration[0].name : undefined;

    console.log(
      `Migration status: ${migrationsRun ? "All migrations run" : "Pending migrations exist"}`,
    );
    if (lastMigrationName) {
      console.log(`Last migration: ${lastMigrationName}`);
    }

    return {
      migrationsRun,
      lastMigration: lastMigrationName,
      pendingMigrations: pendingMigrations ? [] : [], // TypeORM returns boolean, not array
    };
  } catch (error) {
    console.error("Error validating migrations:", error);
    throw error;
  }
}

/**
 * Validate that all required tables exist and are accessible
 * Now dynamically determines required tables from entities instead of hardcoding
 */
export async function validateTables(dataSource: DataSource): Promise<{
  tablesReady: boolean;
  missingTables: string[];
}> {
  if (!dataSource.isInitialized) {
    throw new Error("Database must be initialized before checking tables");
  }

  // Dynamically get required tables from entities instead of hardcoding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requiredTables = getAllRequiredTableNames(dataSource as any);

  if (requiredTables.length === 0) {
    console.warn(
      "No required tables found from entities. This might indicate a configuration issue.",
    );
    return {
      tablesReady: false,
      missingTables: [],
    };
  }

  const missingTables: string[] = [];

  try {
    for (const tableName of requiredTables) {
      const tableExists = await dataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName],
      );

      if (!tableExists[0].exists) {
        missingTables.push(tableName);
      }
    }

    const tablesReady = missingTables.length === 0;

    if (tablesReady) {
      console.log("All required tables exist and are accessible");
    } else {
      console.error(`Missing tables: ${missingTables.join(", ")}`);
    }

    return {
      tablesReady,
      missingTables,
    };
  } catch (error) {
    console.error("Error validating tables:", error);
    throw error;
  }
}

/**
 * Get comprehensive database status
 */
export async function getDatabaseStatus(
  dataSource: DataSource,
): Promise<DatabaseStatus> {
  const isConnected = dataSource.isInitialized;

  if (!isConnected) {
    return {
      isConnected: false,
      migrationsRun: false,
      tablesReady: false,
      pendingMigrations: [],
      missingTables: [],
    };
  }

  const migrationStatus = await validateMigrations(dataSource);
  const tableStatus = await validateTables(dataSource);

  return {
    isConnected: true,
    migrationsRun: migrationStatus.migrationsRun,
    tablesReady: tableStatus.tablesReady,
    lastMigration: migrationStatus.lastMigration,
    pendingMigrations: migrationStatus.pendingMigrations,
    missingTables: tableStatus.missingTables,
  };
}

/**
 * Ensure database is fully ready before creating services
 * This performs comprehensive validation including migrations and tables
 */
export async function ensureDatabaseReadyForServices(
  dataSource: DataSource,
): Promise<void> {
  console.log("Performing comprehensive database readiness check...");

  if (!dataSource.isInitialized) {
    throw new Error("Database is not initialized");
  }

  // Check migration status
  const migrationStatus = await validateMigrations(dataSource);
  if (!migrationStatus.migrationsRun) {
    throw new Error(
      `Database migrations have not been run. Pending migrations: ${migrationStatus.pendingMigrations.join(", ")}`,
    );
  }

  // Check table status
  const tableStatus = await validateTables(dataSource);
  if (!tableStatus.tablesReady) {
    throw new Error(
      `Required tables are missing: ${tableStatus.missingTables.join(", ")}`,
    );
  }

  console.log("Database is fully ready for service initialization");
}

/**
 * Utility function for services to ensure database is ready before accessing repositories
 * This can be called at the beginning of any service method that uses repositories
 */
export function ensureDatabaseReadyForRepositoryAccess(
  dataSource: DataSource,
): void {
  if (!dataSource.isInitialized) {
    throw new Error("Database is not initialized. Cannot access repositories.");
  }
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(
  redisClient: Redis,
): Promise<boolean> {
  try {
    console.log("Testing Redis connection...");
    const result = await redisClient.ping();
    console.log("Redis connection test successful:", result);
    return true;
  } catch (error) {
    console.error("Redis connection test failed:", error);
    return false;
  }
}

/**
 * Wait for database to be ready with timeout
 */
export async function waitForDatabaseReady(
  dataSource: DataSource,
  timeoutMs: number = 30000,
  checkIntervalMs: number = 1000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      await ensureDatabaseReadyForServices(dataSource);
      return; // Success
    } catch (error) {
      console.log(`Database not ready yet: ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }
  }

  throw new Error(`Database did not become ready within ${timeoutMs}ms`);
}
