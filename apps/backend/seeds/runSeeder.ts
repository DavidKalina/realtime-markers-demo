import "reflect-metadata";
import { DataSource } from "typeorm";
import { Event } from "../entities/Event";
import { Category } from "../entities/Category";
import { FlyerImage } from "../entities/FlyerImage";
import { ThirdSpace } from "../entities/ThirdSpace";
import { seedDatabase } from "./index"; // your exported function

// Create a new DataSource instance for seeding
const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Event, Category, FlyerImage, ThirdSpace],
  synchronize: true,
  logging: true,
});

async function runSeeding() {
  try {
    await dataSource.initialize();
    console.log("Database connection established");
    await seedDatabase(dataSource);
    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

runSeeding();
