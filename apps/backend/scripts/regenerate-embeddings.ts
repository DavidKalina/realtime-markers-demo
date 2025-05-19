import "reflect-metadata";
import { DataSource } from "typeorm";
import { RegenerateEmbeddings1710000000001 } from "../migrations/RegenerateEmbeddings1710000000001";

// Log environment variables (without the actual values)
console.log("Environment variables present:", {
  DATABASE_URL: !!process.env.DATABASE_URL,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
});

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  migrations: [RegenerateEmbeddings1710000000001],
  migrationsTableName: "migrations",
  logging: true,
});

dataSource
  .initialize()
  .then(async () => {
    console.log("Database connection initialized");
    console.log("Running embedding regeneration...");
    try {
      const migrations = await dataSource.runMigrations();
      console.log(
        "Migrations executed:",
        migrations.map((m) => m.name),
      );
      console.log("Embedding regeneration completed successfully");
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
