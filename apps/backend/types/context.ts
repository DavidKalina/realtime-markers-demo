// src/types/context.ts
import { EventService } from "../services/EventService";
import { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { UserPreferencesService } from "../services/UserPreferences";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  jobQueue: JobQueue;
  redisClient: Redis;
  userPreferencesService: UserPreferencesService;
  user?: { userId: string; email: string; role: string };
}

export interface AppContext {
  Variables: AppVariables;
}
