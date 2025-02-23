import { DataSource } from "typeorm";
import { seedCategories } from "./categories";
import { seedEvents } from "./events";
import { SeedStatus } from "../entities/SeedStatus";
import { Event } from "../entities/Event";
import { Category } from "../entities/Category";

export async function seedDatabase(dataSource: DataSource) {
  try {
    // Check if already seeded
    const seedStatusRepo = dataSource.getRepository(SeedStatus);
    const existingSeed = await seedStatusRepo.findOne({
      where: { seedName: "initial" },
    });

    // For development, always reseed
    if (existingSeed) {
      console.log("Clearing existing seed data...");
      await dataSource.getRepository(Event).clear();
      await dataSource.getRepository(Category).clear();
      await seedStatusRepo.clear();
    }

    console.log("Starting database seeding...");

    // Seed categories first
    console.log("Seeding categories...");
    await seedCategories(dataSource);

    // Verify categories were created
    const categoriesCount = await dataSource.getRepository(Category).count();
    console.log(`Verified categories count: ${categoriesCount}`);

    // Seed events
    console.log("Seeding events...");
    await seedEvents(dataSource, 20); // Start with fewer events for testing

    // Verify events were created
    const eventsCount = await dataSource.getRepository(Event).count();
    console.log(`Verified events count: ${eventsCount}`);

    // Verify events have categories
    const eventsWithCategories = await dataSource.getRepository(Event).find({
      relations: ["categories"],
    });
    console.log(`Events with categories: ${eventsWithCategories.length}`);
    console.log(
      `First event categories: `,
      eventsWithCategories[0]?.categories?.map((c) => c.name) || "No events found"
    );

    // Mark as seeded
    await seedStatusRepo.save({
      seedName: "initial",
      completed: true,
    });

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    // Log detailed error
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
    }
    throw error;
  }
}
