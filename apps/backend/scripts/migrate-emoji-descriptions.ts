import "reflect-metadata";
import { DataSource } from "typeorm";
import { AddEmojiDescription1710000000000 } from "../migrations/AddEmojiDescription1710000000000";

// Log environment variables (without the actual values)
console.log("Environment variables present:", {
  DATABASE_URL: !!process.env.DATABASE_URL,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
});

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  migrations: [AddEmojiDescription1710000000000],
  migrationsTableName: "migrations",
  logging: true, // Enable query logging
});

dataSource
  .initialize()
  .then(async () => {
    console.log("Database connection initialized");
    console.log("Running migration...");
    try {
      const migrations = await dataSource.runMigrations();
      console.log(
        "Migrations executed:",
        migrations.map((m) => m.name),
      );
      console.log("Migration completed successfully");
    } catch (error) {
      console.error("Error during migration execution:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
      }
    }
    await dataSource.destroy();
  })
  .catch((error) => {
    console.error("Error during database initialization:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  });
