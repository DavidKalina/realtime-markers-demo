// src/types/context.ts
import type { EventService } from "../services/EventServiceRefactored";
import type { EventProcessingService } from "../services/EventProcessingService";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { UserPreferencesServiceImpl } from "../services/UserPreferences";
import type { StorageService } from "../services/shared/StorageService";
import type { RedisService } from "../services/shared/RedisService";
import { AuthService } from "../services/AuthService";
import type { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
import type { IEmbeddingService } from "../services/event-processing/interfaces/IEmbeddingService";
import type { CategoryProcessingService } from "../services/CategoryProcessingService";
import type { EmailService } from "../services/shared/EmailService";
import type { CivicEngagementService } from "../services/CivicEngagementService";

export interface AppVariables {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  redisService: RedisService;
  userPreferencesService: UserPreferencesServiceImpl;
  authService: AuthService;
  geocodingService: GoogleGeocodingService;
  embeddingService: IEmbeddingService;
  categoryProcessingService: CategoryProcessingService;
  emailService: EmailService;
  civicEngagementService: CivicEngagementService;
  user?: { id: string; email: string; role: string; userId?: string };
  userId?: string;
}

export type AppContext = {
  Variables: AppVariables;
  Bindings: {
    // ... existing bindings ...
  };
};
