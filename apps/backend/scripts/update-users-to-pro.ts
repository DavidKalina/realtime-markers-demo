import dataSource from "../data-source";

async function main() {
  try {
    console.log("Initializing database connection...");
    await dataSource.initialize();
    console.log("Database connection established");

    console.log("Running migration to update users to PRO tier...");
    await dataSource.runMigrations();
    console.log("Migration completed successfully");

    await dataSource.destroy();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error running migration:", error);
    process.exit(1);
  }
}

main();
