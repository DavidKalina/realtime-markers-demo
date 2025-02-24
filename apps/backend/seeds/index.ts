// seeds/index.ts
import { DataSource } from "typeorm";
import { Category } from "../entities/Category";
import { categories } from "./categories";
import { seedEvents } from "./events";

export async function seedDatabase(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();

  try {
    // Start transaction
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Check if already seeded

    console.log("Starting database seeding...");

    // Seed categories
    console.log("Seeding categories...");
    for (const categoryData of categories) {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(Category)
        .values(categoryData)
        .execute();
    }

    // Verify categories
    const categoriesCount = await queryRunner.manager.count(Category);
    console.log(`Categories created: ${categoriesCount}`);

    // Seed events
    console.log("Seeding events...");
    await seedEvents(queryRunner.manager);

    // Commit transaction
    await queryRunner.commitTransaction();
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
