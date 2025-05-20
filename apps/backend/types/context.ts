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
import { NotificationService } from "../services/NotificationService";
import { RedisService } from "../services/shared/RedisService";
import { GroupService } from "../services/GroupService";
import { AuthService } from "../services/AuthService";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  redisService: RedisService;
  userPreferencesService: UserPreferencesService;
  planService: PlanService;
  levelingService: LevelingService;
  friendshipService: FriendshipService;
  notificationService: NotificationService;
  groupService: GroupService;
  authService: AuthService;
  user?: { userId: string; email: string; role: string };
  userId?: string;
}

export type AppContext = {
  Variables: AppVariables;
  Bindings: {
    // ... existing bindings ...
  };
};
