// src/seed/index.ts

import { DataSource } from "typeorm";
import { seedUsers } from "./seedUsers";
import { seedDefaultFilters } from "./seedFilters";
import { seedLevels } from "./seedLevels";

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  console.log("Starting database seeding...");

  // Check if we should run seeds based on environment
  const shouldSeed = process.env.SEED_DATABASE === "true" || process.env.NODE_ENV === "development";

  if (!shouldSeed) {
    console.log("Seeding skipped based on environment configuration");
    return;
  }

  try {
    // Seed users first
    await seedUsers(dataSource);

    // Add default filters for all users (including existing ones)
    await seedDefaultFilters(dataSource);

    // Seed levels
    await seedLevels(dataSource);

    // Add more seed functions as needed:
    // await seedCategories(dataSource);
    // await seedEvents(dataSource);

    console.log("✅ Database seeding completed successfully");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);

    // Decide if you want to throw the error or continue
    if (process.env.SEED_FAIL_HARD === "true") {
      throw error;
    }
  }
}
