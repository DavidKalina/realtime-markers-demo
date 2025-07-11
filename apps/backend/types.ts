// src/types.ts
import { Redis } from "ioredis";
import { type EventService } from "./services/EventServiceRefactored";
import { EventProcessingService } from "./services/EventProcessingService";
import { JobQueue } from "./services/JobQueue";

// This is the proper way to extend Hono types
declare module "hono" {
  interface ContextVariables {
    eventService: EventService;
    eventProcessingService: EventProcessingService;
    jobQueue: JobQueue;
    redisClient: Redis;
  }
}
