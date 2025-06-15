// src/types/context.ts
import type { EventService } from "../services/EventService";
import type { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { UserPreferencesServiceImpl } from "../services/UserPreferences";
import type { StorageService } from "../services/shared/StorageService";
import { PlanService } from "../services/PlanService";
import { LevelingService } from "../services/LevelingService";
import type { FriendshipServiceImpl } from "../services/FriendshipService";
import type { NotificationService } from "../services/NotificationService";
import type { RedisService } from "../services/shared/RedisService";
import { AuthService } from "../services/AuthService";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  redisService: RedisService;
  userPreferencesService: UserPreferencesServiceImpl;
  planService: PlanService;
  levelingService: LevelingService;
  friendshipService: FriendshipServiceImpl;
  notificationService: NotificationService;
  authService: AuthService;
  user?: { id: string; email: string; role: string; userId?: string };
  userId?: string;
}

export type AppContext = {
  Variables: AppVariables;
  Bindings: {
    // ... existing bindings ...
  };
};
