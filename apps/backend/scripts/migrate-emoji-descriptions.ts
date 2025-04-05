import "reflect-metadata";
import { DataSource } from "typeorm";
import { AddEmojiDescription1710000000000 } from "../migrations/AddEmojiDescription1710000000000";

const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    migrations: [AddEmojiDescription1710000000000],
    migrationsTableName: "migrations"
});

dataSource.initialize()
    .then(async () => {
        console.log("Running migration...");
        await dataSource.runMigrations();
        console.log("Migration completed");
        await dataSource.destroy();
    })
    .catch(error => {
        console.error("Error during migration:", error);
        process.exit(1);
    }); 