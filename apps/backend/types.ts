// src/types.ts
import { Redis } from "ioredis";
import { JobQueue } from "./services/JobQueue";

// This is the proper way to extend Hono types
declare module "hono" {
  interface ContextVariables {
    jobQueue: JobQueue;
    redisClient: Redis;
  }
}
