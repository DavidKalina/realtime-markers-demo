// src/types/context.ts
import { JobQueue } from "../services/JobQueue";
import Redis from "ioredis";
import type { StorageService } from "../services/shared/StorageService";
import type { RedisService } from "../services/shared/RedisService";
import { AuthService } from "../services/AuthService";
import type { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
import type { EmailService } from "../services/shared/EmailService";
import type { SidequestService } from "../services/SidequestService";
import type { SidequestCheckinService } from "../services/SidequestCheckinService";
import type { OverpassService } from "../services/shared/OverpassService";
import type { EmbeddingServiceImpl } from "../services/shared/EmbeddingService";
import type { DistrictService } from "../services/DistrictService";

export interface AppVariables {
  storageService: StorageService;
  jobQueue: JobQueue;
  redisClient: Redis;
  redisService: RedisService;
  authService: AuthService;
  geocodingService: GoogleGeocodingService;
  emailService: EmailService;
  sidequestService: SidequestService;
  sidequestCheckinService: SidequestCheckinService;
  overpassService: OverpassService;

  embeddingService: EmbeddingServiceImpl;
  districtService: DistrictService;
  user?: { id: string; email: string; role: string; userId?: string };
  userId?: string;
}

export type AppContext = {
  Variables: AppVariables;
  Bindings: {
    // ... existing bindings ...
  };
};
