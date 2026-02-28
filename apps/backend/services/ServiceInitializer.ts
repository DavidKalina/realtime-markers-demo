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
import { createGamificationService } from "./GamificationService";
import { RepositoryInitializer } from "./RepositoryInitializer";
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
import type { GamificationService } from "./GamificationService";
import { createAreaScanService } from "./AreaScanService";
import type { AreaScanService } from "./AreaScanService";
import { createEventHypeService } from "./EventHypeService";
import type { EventHypeService } from "./EventHypeService";
import {
  createTicketmasterService,
  type TicketmasterService,
} from "./TicketmasterService";

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
  gamificationService: GamificationService;
  areaScanService: AreaScanService;
  eventHypeService: EventHypeService;
  ticketmasterService: TicketmasterService | null;
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
      locationResolutionService: createGoogleGeocodingService(
        openAIService,
        redisService,
      ),
      openAIService,
      configService,
    });

    const eventProcessingService = createEventProcessingService({
      categoryProcessingService,
      eventSimilarityService,
      locationResolutionService: createGoogleGeocodingService(
        openAIService,
        redisService,
      ),
      imageProcessingService,
      embeddingService,
      configService,
      eventExtractionService,
    });

    // Initialize business services
    const gamificationService = createGamificationService({
      dataSource: this.dataSource,
      redisService,
    });

    const eventService = createEventService({
      dataSource: this.dataSource,
      redisService,
      locationService: createGoogleGeocodingService(
        openAIService,
        redisService,
      ),
      eventCacheService,
      openaiService: openAIService,
      embeddingService,
      gamificationService,
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
          fromEmail: process.env.EMAIL_FROM || "noreply@mapmoji.app",
          adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
        })
      : new MockEmailService();

    const geocodingService = createGoogleGeocodingService(
      openAIService,
      redisService,
    );

    const areaScanService = createAreaScanService({
      dataSource: this.dataSource,
      openAIService,
      redisService,
    });

    const eventHypeService = createEventHypeService({
      dataSource: this.dataSource,
      openAIService,
      redisService,
    });

    // Conditionally create TicketmasterService (opt-in via env var)
    const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
    const ticketmasterService = ticketmasterApiKey
      ? createTicketmasterService({ apiKey: ticketmasterApiKey })
      : null;

    if (ticketmasterService) {
      console.log("TicketmasterService enabled for event import");
    }

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
      gamificationService,
      areaScanService,
      eventHypeService,
      ticketmasterService,
    };
  }

  setupCleanupSchedule(jobQueue: JobQueue): void {
    // Allow disabling daily cleanup via environment variable
    if (process.env.DISABLE_DAILY_CLEANUP === "true") {
      console.log(
        "Daily event cleanup disabled via DISABLE_DAILY_CLEANUP environment variable",
      );
      return;
    }

    const CLEANUP_HOUR = parseInt(process.env.CLEANUP_HOUR || "3");
    const BATCH_SIZE = parseInt(process.env.CLEANUP_BATCH_SIZE || "100");
    let lastRunDate = "";

    console.log(
      `Setting up daily cleanup schedule: hour=${CLEANUP_HOUR}, batchSize=${BATCH_SIZE}`,
    );

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

  setupEventImportSchedule(jobQueue: JobQueue): void {
    // Entirely opt-in: skip if disabled or missing config
    if (process.env.DISABLE_EVENT_IMPORT === "true") {
      console.log(
        "Event import disabled via DISABLE_EVENT_IMPORT environment variable",
      );
      return;
    }

    const apiKey = process.env.TICKETMASTER_API_KEY;
    const latitude = process.env.IMPORT_LATITUDE;
    const longitude = process.env.IMPORT_LONGITUDE;

    if (!apiKey || !latitude || !longitude) {
      console.log(
        "Event import not configured (missing TICKETMASTER_API_KEY, IMPORT_LATITUDE, or IMPORT_LONGITUDE)",
      );
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.error(
        "Event import: invalid IMPORT_LATITUDE or IMPORT_LONGITUDE values",
      );
      return;
    }

    const radiusKm = parseInt(process.env.IMPORT_RADIUS_KM || "50");
    const intervalHours = parseFloat(process.env.IMPORT_INTERVAL_HOURS || "6");
    const intervalMs = intervalHours * 60 * 60 * 1000;
    let lastImportTime = 0;

    console.log(
      `Setting up event import schedule: lat=${lat}, lng=${lng}, radius=${radiusKm}km, interval=${intervalHours}h`,
    );

    const enqueueImport = () => {
      const now = Date.now();
      if (now - lastImportTime < intervalMs) return;
      lastImportTime = now;

      console.log("Enqueuing Ticketmaster event import job");
      jobQueue.enqueue("import_external_events", {
        latitude: lat,
        longitude: lng,
        radiusKm,
      });
    };

    // Run once on startup after 30s delay (let services initialize)
    setTimeout(() => {
      console.log("Running initial Ticketmaster event import");
      enqueueImport();
    }, 30_000);

    // Check every 5 minutes if interval has elapsed
    setInterval(enqueueImport, 5 * 60 * 1000);
  }
}
