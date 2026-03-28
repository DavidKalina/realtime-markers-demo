import "reflect-metadata";
import AppDataSource from "../data-source";
import { seedUsers } from "../utils/userSeeder";

async function main() {
  try {
    console.log("Connecting to database...");
    await AppDataSource.initialize();
    console.log("Connected.\n");

    await seedUsers(AppDataSource);

    await AppDataSource.destroy();
    console.log("\nDone.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
