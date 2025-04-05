import { initializeDatabase } from "../data-source";
import { AddEmojiDescription1710000000000 } from "../migrations/AddEmojiDescription1710000000000";

async function runMigration() {
    try {
        const dataSource = await initializeDatabase();
        console.log("Database connection established");

        const migration = new AddEmojiDescription1710000000000();
        await migration.up(dataSource.createQueryRunner());
        console.log("Migration completed successfully");

        await dataSource.destroy();
        console.log("Database connection closed");
    } catch (error) {
        console.error("Error running migration:", error);
        process.exit(1);
    }
}

runMigration(); 