import { DataSource } from "typeorm";
import { Redis } from "ioredis";
import { createConfigService } from "./shared/ConfigService";
import { createRedisService } from "./shared/RedisService";
import { createOpenAIService } from "./shared/OpenAIService";
import { createOpenAICacheService } from "./shared/OpenAICacheService";
import { createEventCacheService } from "./shared/EventCacheService";
import { createImageProcessingCacheService } from "./shared/ImageProcessingCacheService";
import { createCategoryCacheService } from "./shared/CategoryCacheService";
import { createEmbeddingCacheService } from "./shared/EmbeddingCacheService";
import { createCategoryProcessingService } from "./CategoryProcessingService";
import { createEmbeddingService } from "./shared/EmbeddingService";
import { createEventService } from "./EventServiceRefactored";
import { EventSimilarityService } from "./event-processing/EventSimilarityService";
import { createImageProcessingService } from "./event-processing/ImageProcessingService";
import { createStorageService } from "./shared/StorageService";
import { createEventExtractionService } from "./event-processing/EventExtractionService";
import { createEventProcessingService } from "./EventProcessingService";
import { createUserPreferencesService } from "./UserPreferences";
import { createAuthService } from "./AuthService";
import { createEmailService, MockEmailService } from "./shared/EmailService";
import { createGoogleGeocodingService } from "./shared/GoogleGeocodingService";
import { createJobQueue } from "./JobQueue";
import { RepositoryInitializer } from "./RepositoryInitializer";
import { CivicEngagementService } from "./CivicEngagementService";
import type { EventService } from "./EventServiceRefactored";
import type { EventProcessingService } from "./EventProcessingService";
import type { CategoryProcessingService } from "./CategoryProcessingService";
import type { UserPreferencesServiceImpl } from "./UserPreferences";
import type { StorageService } from "./shared/StorageService";
import type { AuthService } from "./AuthService";
import type { OpenAIService } from "./shared/OpenAIService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { EmailService } from "./shared/EmailService";
import type { JobQueue } from "./JobQueue";
import type { RedisService } from "./shared/RedisService";
import type { GoogleGeocodingService } from "./shared/GoogleGeocodingService";

export interface ServiceContainer {
  eventService: EventService;
  eventProcessingService: EventProcessingService;
  categoryProcessingService: CategoryProcessingService;
  userPreferencesService: UserPreferencesServiceImpl;
  storageService: StorageService;
  authService: AuthService;
  openAIService: OpenAIService;
  embeddingService: IEmbeddingService;
  emailService: EmailService;
  jobQueue: JobQueue;
  redisService: RedisService;
  geocodingService: GoogleGeocodingService;
  civicEngagementService: CivicEngagementService;
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
    const eventCacheService = createEventCacheService(this.redisClient);
    const imageProcessingCacheService = createImageProcessingCacheService();
    const categoryCacheService = createCategoryCacheService(this.redisClient);
    const embeddingCacheService = createEmbeddingCacheService({
      configService,
    });

    // Initialize AI services
    const openAIService = createOpenAIService({
      redisService,
      openAICacheService,
    });

    const embeddingService = createEmbeddingService({
      openAIService,
      configService,
      embeddingCacheService,
    });

    // Initialize processing services
    const categoryProcessingService = createCategoryProcessingService({
      categoryRepository: repositories.categoryRepository,
      openAIService,
      categoryCacheService,
    });

    const eventSimilarityService = new EventSimilarityService(
      repositories.eventRepository,
      configService,
    );

    const imageProcessingService = createImageProcessingService(
      openAIService,
      imageProcessingCacheService,
    );

    const eventExtractionService = createEventExtractionService({
      categoryProcessingService,
      locationResolutionService: createGoogleGeocodingService(openAIService),
      openAIService,
      configService,
    });

    const eventProcessingService = createEventProcessingService({
      categoryProcessingService,
      eventSimilarityService,
      locationResolutionService: createGoogleGeocodingService(openAIService),
      imageProcessingService,
      embeddingService,
      configService,
      eventExtractionService,
    });

    // Initialize business services
    const eventService = createEventService({
      dataSource: this.dataSource,
      redisService,
      locationService: createGoogleGeocodingService(openAIService),
      eventCacheService,
      openaiService: openAIService,
      embeddingService,
    });

    const userPreferencesService = createUserPreferencesService({
      dataSource: this.dataSource,
      redisService,
      embeddingService,
      openAIService,
    });

    const storageService = createStorageService();

    const authService = createAuthService({
      userRepository: repositories.userRepository,
      dataSource: this.dataSource,
      userPreferencesService,
      openAIService,
    });

    const emailService = process.env.RESEND_API_KEY
      ? createEmailService({
          apiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.EMAIL_FROM || "noreply@yourdomain.com",
          adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
        })
      : new MockEmailService();

    const geocodingService = createGoogleGeocodingService(openAIService);

    // Initialize civic engagement service
    const civicEngagementService = new CivicEngagementService(
      repositories.civicEngagementRepository,
      redisService,
    );

    console.log("Services initialized successfully");

    return {
      eventService,
      eventProcessingService,
      categoryProcessingService,
      userPreferencesService,
      storageService,
      authService,
      openAIService,
      embeddingService,
      emailService,
      jobQueue,
      redisService,
      geocodingService,
      civicEngagementService,
    };
  }

  setupCleanupSchedule(jobQueue: JobQueue): void {
    const CLEANUP_HOUR = 3;
    const BATCH_SIZE = 100;
    let lastRunDate = "";

    setInterval(() => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (
        now.getHours() === CLEANUP_HOUR &&
        now.getMinutes() >= 0 &&
        now.getMinutes() <= 15 &&
        lastRunDate !== today
      ) {
        console.log("Scheduling daily event cleanup");
        jobQueue.enqueueCleanupJob(BATCH_SIZE);
        lastRunDate = today;
      }
    }, 60 * 1000);
  }
}
