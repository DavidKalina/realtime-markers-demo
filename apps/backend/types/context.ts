// src/types/context.ts
import { EventService } from "../services/EventService";
import { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { UserPreferencesService } from "../services/UserPreferences";
import type { StorageService } from "../services/shared/StorageService";
import { PlanService } from "../services/PlanService";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  userPreferencesService: UserPreferencesService;
  planService: PlanService;
  user?: { userId: string; email: string; role: string };
}

export interface AppContext {
  Variables: AppVariables;
}
