import "reflect-metadata";
import { DataSource } from "typeorm";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { ThirdSpace } from "./entities/ThirdSpace";
import { SeedStatus } from "./entities/SeedStatus";

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Event, Category, ThirdSpace, SeedStatus],
  migrations: [`${__dirname}/migrations/*.ts`],
  synchronize: false,
  logging: true,
  ssl: false,
});

export default AppDataSource;
