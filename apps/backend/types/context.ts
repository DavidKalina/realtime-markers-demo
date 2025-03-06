// First, let's define the app context types
// src/types/context.ts
import { EventService } from "../services/EventService";
import { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  jobQueue: JobQueue;
  redisClient: Redis;
  user?: { userId: string; email: string; role: string };
}

export interface AppContext {
  Variables: AppVariables;
}
