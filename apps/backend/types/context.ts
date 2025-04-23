// src/types/context.ts
import { EventService } from "../services/EventService";
import { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { UserPreferencesService } from "../services/UserPreferences";
import type { StorageService } from "../services/shared/StorageService";
import { PlanService } from "../services/PlanService";
import { LevelingService } from "../services/LevelingService";
import { FriendshipService } from "../services/FriendshipService";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  userPreferencesService: UserPreferencesService;
  planService: PlanService;
  levelingService: LevelingService;
  friendshipService: FriendshipService;
  user?: { userId: string; email: string; role: string };
}

export interface AppContext {
  Variables: AppVariables;
}
