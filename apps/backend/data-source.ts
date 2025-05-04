// data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { User } from "./entities/User";
import { UserEventDiscovery } from "./entities/UserEventDiscovery";
import { UserEventSave } from "./entities/UserEventSave";
import { Filter } from "./entities/Filter";
import { Level } from "./entities/Level";
import { UserLevel } from "./entities/UserLevel";
import { Friendship } from "./entities/Friendship";
import { EventShare } from "./entities/EventShare";
import { InitialSchemaAndSeed1710000000000 } from "./migrations/1710000000000-InitialSchemaAndSeed";
import { AddLevelingSystem1710000000003 } from "./migrations/AddLevelingSystem1710000000003";

// Create the DataSource instance
const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [
    Event,
    Category,
    User,
    UserEventDiscovery,
    UserEventSave,
    Filter,
    Level,
    UserLevel,
    EventShare,
    Friendship,
  ],
  migrations: [InitialSchemaAndSeed1710000000000, AddLevelingSystem1710000000003],
  migrationsTableName: "migrations",
  migrationsRun: true, // Automatically run migrations on startup
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

// Wrapped DataSource with retry logic
const initializeDatabase = async (retries = 5, delay = 2000): Promise<DataSource> => {
  // If the dataSource is already initialized, return it
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database initialization attempt ${attempt}/${retries}`);
      await AppDataSource.initialize();
      console.log("Database connection established successfully");
      return AppDataSource;
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`);
      console.error(error);

      if (attempt === retries) {
        console.error("Max retries reached. Exiting.");
        throw error;
      }

      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * 1.5, 10000);
    }
  }

  throw new Error("Failed to initialize database after all retries");
};

export { initializeDatabase };
export default AppDataSource;
