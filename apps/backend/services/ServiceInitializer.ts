import { DataSource } from "typeorm";
import { Redis } from "ioredis";
import { createConfigService } from "./shared/ConfigService";
import { createRedisService } from "./shared/RedisService";
import { createOpenAIService } from "./shared/OpenAIService";
import { createOpenAICacheService } from "./shared/OpenAICacheService";
import { createEmbeddingService } from "./shared/EmbeddingService";
import { createStorageService } from "./shared/StorageService";
import { createAuthService } from "./AuthService";
import { createEmailService, MockEmailService } from "./shared/EmailService";
import { createGoogleGeocodingService } from "./shared/GoogleGeocodingService";
import { createJobQueue } from "./JobQueue";

import { RepositoryInitializer } from "./RepositoryInitializer";
import type { StorageService } from "./shared/StorageService";
import type { AuthService } from "./AuthService";
import type { OpenAIService } from "./shared/OpenAIService";
import type { EmbeddingServiceImpl } from "./shared/EmbeddingService";
import type { EmailService } from "./shared/EmailService";
import type { JobQueue } from "./JobQueue";
import type { RedisService } from "./shared/RedisService";
import type { GoogleGeocodingService } from "./shared/GoogleGeocodingService";

import { createPushNotificationService } from "./PushNotificationService";
import type { PushNotificationService } from "./PushNotificationService";
import { createJobNotificationService } from "./JobNotificationService";
import type { JobNotificationService } from "./JobNotificationService";
import { createSidequestService } from "./SidequestService";
import type { SidequestService } from "./SidequestService";
import { createSidequestPrescriptionService } from "./SidequestPrescriptionService";
import type { SidequestPrescriptionService } from "./SidequestPrescriptionService";
import { createOverpassService } from "./shared/OverpassService";
import type { OverpassService } from "./shared/OverpassService";
import { createSidequestCheckinService } from "./SidequestCheckinService";
import type { SidequestCheckinService } from "./SidequestCheckinService";
import { createComfortZoneService } from "./ComfortZoneService";
import type { ComfortZoneService } from "./ComfortZoneService";
import { createCoverageService } from "./CoverageService";
import type { CoverageService } from "./CoverageService";
import { createResonanceService } from "./ResonanceService";
import type { ResonanceService } from "./ResonanceService";
import { createPathwayService } from "./PathwayService";
import type { PathwayService } from "./PathwayService";

export interface ServiceContainer {
  dataSource: DataSource;
  storageService: StorageService;
  authService: AuthService;
  openAIService: OpenAIService;
  embeddingService: EmbeddingServiceImpl;
  emailService: EmailService;
  jobQueue: JobQueue;
  redisService: RedisService;
  geocodingService: GoogleGeocodingService;
  sidequestService: SidequestService;
  sidequestPrescriptionService: SidequestPrescriptionService;
  sidequestCheckinService: SidequestCheckinService;
  overpassService: OverpassService;
  comfortZoneService: ComfortZoneService;
  coverageService: CoverageService;
  resonanceService: ResonanceService;
  pathwayService: PathwayService;
  pushNotificationService: PushNotificationService;
  jobNotificationService: JobNotificationService;
}

export class ServiceInitializer {
  private dataSource: DataSource;
  private redisClient: Redis;

  constructor(dataSource: DataSource, redisClient: Redis) {
    this.dataSource = dataSource;
    this.redisClient = redisClient;
  }

  async initialize(): Promise<ServiceContainer> {
    console.log("Initializing services...");

    // Initialize repositories with database readiness check
    const repositoryInitializer = new RepositoryInitializer(this.dataSource);
    const repositories = await repositoryInitializer.initialize();

    // Initialize core services
    const configService = createConfigService();
    const redisService = createRedisService(this.redisClient);
    const jobQueue = createJobQueue({ redisService });

    // Initialize cache services
    const openAICacheService = createOpenAICacheService();

    // Initialize AI services
    const openAIService = createOpenAIService({
      redisService,
      openAICacheService,
      dataSource: this.dataSource,
    });

    const embeddingService = createEmbeddingService({
      openAIService,
      configService,
    });

    // Initialize business services
    const storageService = createStorageService();

    const emailService = process.env.RESEND_API_KEY
      ? createEmailService({
          apiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.EMAIL_FROM || "noreply@mail.davidkalina.com",
          adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
        })
      : new MockEmailService();

    const authService = createAuthService({
      userRepository: repositories.userRepository,
      dataSource: this.dataSource,
      openAIService,
      emailService,
    });

    const geocodingService = createGoogleGeocodingService(
      openAIService,
      redisService,
    );

    const overpassService = createOverpassService({ redisService });

    const comfortZoneService = createComfortZoneService({
      dataSource: this.dataSource,
      openAIService,
    });

    const coverageService = createCoverageService({
      dataSource: this.dataSource,
    });

    const resonanceService = createResonanceService({
      dataSource: this.dataSource,
    });

    const pathwayService = createPathwayService({
      dataSource: this.dataSource,
    });

    const sidequestService = createSidequestService({
      dataSource: this.dataSource,
      openAIService,
      embeddingService,
      redisService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
    });

    const sidequestPrescriptionService = createSidequestPrescriptionService({
      dataSource: this.dataSource,
      openAIService,
      geocodingService,
      overpassService,
      embeddingService,
      redisService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
    });

    const pushNotificationService = createPushNotificationService({
      dataSource: this.dataSource,
    });

    const jobNotificationService = createJobNotificationService({
      dataSource: this.dataSource,
      pushNotificationService,
    });

    const sidequestCheckinService = createSidequestCheckinService({
      dataSource: this.dataSource,
      pushService: pushNotificationService,
      redisService,
      openAIService,
      coverageService,
    });

    console.log("Services initialized successfully");

    return {
      dataSource: this.dataSource,
      storageService,
      authService,
      openAIService,
      embeddingService,
      emailService,
      jobQueue,
      redisService,
      geocodingService,
      sidequestService,
      sidequestPrescriptionService,
      sidequestCheckinService,
      overpassService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
      pushNotificationService,
      jobNotificationService,
    };
  }
}
