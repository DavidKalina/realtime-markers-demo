// src/types/context.ts
import { EventService } from "../services/EventService";
import { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { UserPreferencesService } from "../services/UserPreferences";
import type { StorageService } from "../services/shared/StorageService";
import { PlanService } from "../services/PlanService";
import { LevelingService } from "../services/LevelingService";
import type { OrganizationService } from "../services/OrganizationService";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  storageService: StorageService;
  organizationService: OrganizationService;
  jobQueue: JobQueue;
  redisClient: Redis;
  userPreferencesService: UserPreferencesService;
  planService: PlanService;
  levelingService: LevelingService;
  user?: { userId: string; email: string; role: string };
}

export interface AppContext {
  Variables: AppVariables;
}
