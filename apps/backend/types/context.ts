// src/types/context.ts
import type { DataSource } from "typeorm";
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { StorageService } from "../services/shared/StorageService";
import type { RedisService } from "../services/shared/RedisService";
import { AuthService } from "../services/AuthService";
import type { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
import type { EmailService } from "../services/shared/EmailService";
import type { SidequestService } from "../services/SidequestService";
import type { SidequestPrescriptionService } from "../services/SidequestPrescriptionService";
import type { SidequestCheckinService } from "../services/SidequestCheckinService";
import type { OverpassService } from "../services/shared/OverpassService";
import type { EmbeddingServiceImpl } from "../services/shared/EmbeddingService";
import type { ComfortZoneService } from "../services/ComfortZoneService";
import type { CoverageService } from "../services/CoverageService";
import type { PathwayService } from "../services/PathwayService";
import type { PushNotificationService } from "../services/PushNotificationService";
import type { JobNotificationService } from "../services/JobNotificationService";
import type { FearLadderGenerationService } from "../services/FearLadderGenerationService";
import type { BarrierGenerationService } from "../services/BarrierGenerationService";
import type { GoalRefinementService } from "../services/GoalRefinementService";
import type { PacingService } from "../services/PacingService";

export interface AppVariables {
  dataSource: DataSource;
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  redisService: RedisService;
  authService: AuthService;
  geocodingService: GoogleGeocodingService;
  emailService: EmailService;
  sidequestService: SidequestService;
  sidequestPrescriptionService: SidequestPrescriptionService;
  sidequestCheckinService: SidequestCheckinService;
  overpassService: OverpassService;

  embeddingService: EmbeddingServiceImpl;
  comfortZoneService: ComfortZoneService;
  coverageService: CoverageService;
  pathwayService: PathwayService;
  pushNotificationService: PushNotificationService;
  jobNotificationService: JobNotificationService;
  fearLadderGenerationService: FearLadderGenerationService;
  barrierGenerationService: BarrierGenerationService;
  goalRefinementService: GoalRefinementService;
  pacingService: PacingService;
  user?: { id: string; email: string; role: string; userId?: string };
  userId?: string;
}

export type AppContext = {
  Variables: AppVariables;
  Bindings: {
    // ... existing bindings ...
  };
};
