// runSeeder.ts
import "reflect-metadata";
import AppDataSource from "../data-source";
import { seedDatabase } from "./index";

const initialize = async () => {
  try {
    // Make sure the connection isn't already established
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("Database connection established");
    }

    await seedDatabase(AppDataSource);

    if (import.meta.main) {
      process.exit(0);
    }
  } catch (error) {
    console.error("Error during initialization:", error);
    if (import.meta.main) {
      process.exit(1);
    } else {
      throw error;
    }
  }
};

if (import.meta.main) {
  initialize();
}

export { initialize as runSeeding };
