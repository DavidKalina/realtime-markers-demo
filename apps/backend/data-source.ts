// data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { ThirdSpace } from "./entities/ThirdSpace";

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Event, Category, ThirdSpace],
  synchronize: true, // Set to true for now
  logging: true,
  ssl: false,
  poolSize: 20, // Increase from default 10
  maxQueryExecutionTime: 1000, // Log slow queries
  extra: {
    max: 25, // Maximum pool size
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Return error if can't connect in 2s
  },
});

export default AppDataSource;
