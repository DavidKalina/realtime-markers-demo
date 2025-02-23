import "reflect-metadata";
import { DataSource } from "typeorm";
import { Event } from "../entities/Event";
import { Category } from "../entities/Category";
import { ThirdSpace } from "../entities/ThirdSpace";
import { seedDatabase } from "./index";
import { SeedStatus } from "../entities/SeedStatus";

// Create a new DataSource instance for seeding
const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Event, Category, ThirdSpace, SeedStatus],
  synchronize: true,
  logging: true,
});

async function runSeeding() {
  try {
    await dataSource.initialize();
    console.log("Database connection established");
    await seedDatabase(dataSource);

    // Only exit if this script is run directly (not through docker-entrypoint.sh)
    if (import.meta.main) {
      process.exit(0);
    }
  } catch (error) {
    console.error("Error seeding database:", error);
    if (import.meta.main) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

// Export for use in docker-entrypoint.sh
export { runSeeding };

// Run if called directly
if (import.meta.main) {
  runSeeding();
}
