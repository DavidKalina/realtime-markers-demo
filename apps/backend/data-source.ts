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
});

export default AppDataSource;
