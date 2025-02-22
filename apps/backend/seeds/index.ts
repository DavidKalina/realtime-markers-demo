import { DataSource } from "typeorm";
import { seedCategories } from "./categories";
import { seedMarkers } from "./markers";

export async function seedDatabase(dataSource: DataSource) {
  try {
    await seedCategories(dataSource);
    await seedMarkers(dataSource);
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
