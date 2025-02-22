import { DataSource } from "typeorm";
import { seedCategories } from "./categories";
import { seedEvents } from "./events";

export async function seedDatabase(dataSource: DataSource) {
  try {
    // First seed categories as they are required for events
    await seedCategories(dataSource);

    // Then seed events
    await seedEvents(dataSource);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
