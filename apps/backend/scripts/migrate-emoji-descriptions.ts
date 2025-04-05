import "reflect-metadata";
import { DataSource } from "typeorm";
import { Event } from "../entities/Event";
import { Category } from "../entities/Category";
import { User } from "../entities/User";
import { UserEventDiscovery } from "../entities/UserEventDiscovery";
import { UserEventSave } from "../entities/UserEventSave";
import { Filter } from "../entities/Filter";
import { AddEmojiDescription1710000000000 } from "../migrations/AddEmojiDescription1710000000000";

async function runMigration() {
    const dataSource = new DataSource({
        type: "postgres",
        url: process.env.DATABASE_URL,
        entities: [Event, Category, User, UserEventDiscovery, UserEventSave, Filter],
        synchronize: false, // Disable auto-sync for safety
        logging: ["error"],
    });

    try {
        await dataSource.initialize();
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