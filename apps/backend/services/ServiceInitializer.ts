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

import { createThirdSpaceScoreService } from "./ThirdSpaceScoreService";
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

import type { ThirdSpaceScoreService } from "./ThirdSpaceScoreService";
import { pushNotificationService } from "./PushNotificationService";
import { createSidequestService } from "./SidequestService";
import type { SidequestService } from "./SidequestService";
import { createOverpassService } from "./shared/OverpassService";
import type { OverpassService } from "./shared/OverpassService";
import { createSidequestCheckinService } from "./SidequestCheckinService";
import type { SidequestCheckinService } from "./SidequestCheckinService";
import { createAdventureScoreService } from "./AdventureScoreService";
import type { AdventureScoreService } from "./AdventureScoreService";

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
  thirdSpaceScoreService: ThirdSpaceScoreService;
  sidequestService: SidequestService;
  sidequestCheckinService: SidequestCheckinService;
  overpassService: OverpassService;
  adventureScoreService: AdventureScoreService;
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
      dataSource: this.dataSource,
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
    const thirdSpaceScoreService = createThirdSpaceScoreService({
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
      thirdSpaceScoreService,
    });

    const userPreferencesService = createUserPreferencesService({
      dataSource: this.dataSource,
      redisService,
      embeddingService,
      openAIService,
    });

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
      userPreferencesService,
      openAIService,
      emailService,
    });

    const geocodingService = createGoogleGeocodingService(
      openAIService,
      redisService,
    );

    const overpassService = createOverpassService({ redisService });

    const sidequestService = createSidequestService({
      dataSource: this.dataSource,
      openAIService,
      geocodingService,
      overpassService,
      embeddingService,
      redisService,
    });

    const adventureScoreService = createAdventureScoreService({
      dataSource: this.dataSource,
      redisService,
    });

    const sidequestCheckinService = createSidequestCheckinService({
      dataSource: this.dataSource,
      pushService: pushNotificationService,
      redisService,
      thirdSpaceScoreService,
    });

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
      thirdSpaceScoreService,
      sidequestService,
      sidequestCheckinService,
      overpassService,
      adventureScoreService,
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

  setupNotificationSchedule(): void {
    if (process.env.DISABLE_NOTIFICATION_SCHEDULE === "true") {
      console.log(
        "Notification schedule disabled via DISABLE_NOTIFICATION_SCHEDULE environment variable",
      );
      return;
    }

    console.log(
      "Setting up streak-at-risk and weekly nudge notification schedules",
    );

    // Check every 15 minutes
    setInterval(
      async () => {
        const now = new Date();
        const dayOfWeek = now.getUTCDay(); // 0=Sun, 4=Thu
        const utcHour = now.getUTCHours();

        // Streak-at-risk: Sunday ~18:00 UTC
        if (dayOfWeek === 0 && utcHour === 18) {
          await this.sendStreakAtRiskNotifications();
        }

        // Weekly nudge: Thursday ~18:00 UTC
        if (dayOfWeek === 4 && utcHour === 18) {
          await this.sendWeeklyNudgeNotifications();
        }
      },
      15 * 60 * 1000,
    );
  }

  private async sendStreakAtRiskNotifications(): Promise<void> {
    try {
      // Find users with active streaks who haven't checked in this ISO week
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      const currentWeekMonday = monday.toISOString().slice(0, 10);

      const usersAtRisk: { id: string; current_streak: number }[] =
        await this.dataSource.query(
          `SELECT id, current_streak FROM users
           WHERE current_streak > 0
           AND (last_streak_week IS NULL OR last_streak_week < $1)`,
          [currentWeekMonday],
        );

      for (const user of usersAtRisk) {
        try {
          await pushNotificationService.sendToUser(user.id, {
            title: "Your streak is at risk!",
            body: `Your ${user.current_streak}-week adventure streak ends this week if you don't check in!`,
            sound: "default",
            data: {
              type: "streak_at_risk",
              currentStreak: user.current_streak,
            },
          });
        } catch (err) {
          console.error(
            `[NotificationSchedule] Failed to send streak-at-risk to ${user.id}:`,
            err,
          );
        }
      }

      if (usersAtRisk.length > 0) {
        console.log(
          `[NotificationSchedule] Sent streak-at-risk notifications to ${usersAtRisk.length} users`,
        );
      }
    } catch (err) {
      console.error("[NotificationSchedule] Streak-at-risk check failed:", err);
    }
  }

  private async sendWeeklyNudgeNotifications(): Promise<void> {
    try {
      // Find users with no upcoming plannedDate itineraries
      const usersWithoutPlans: { id: string }[] = await this.dataSource.query(
        `SELECT u.id FROM users u
         WHERE u.id NOT IN (
           SELECT DISTINCT s.user_id FROM sidequests s
           WHERE s.planned_date >= CURRENT_DATE
           AND s.status = 'READY'
         )
         AND EXISTS (
           SELECT 1 FROM user_push_tokens upt
           WHERE upt.user_id = u.id AND upt.is_active = true
         )`,
      );

      for (const user of usersWithoutPlans) {
        try {
          await pushNotificationService.sendToUser(user.id, {
            title: "No adventure planned this weekend?",
            body: "Open the app and plan something fun — your next streak point awaits!",
            sound: "default",
            data: { type: "weekly_nudge" },
          });
        } catch (err) {
          console.error(
            `[NotificationSchedule] Failed to send weekly nudge to ${user.id}:`,
            err,
          );
        }
      }

      if (usersWithoutPlans.length > 0) {
        console.log(
          `[NotificationSchedule] Sent weekly nudge to ${usersWithoutPlans.length} users`,
        );
      }
    } catch (err) {
      console.error("[NotificationSchedule] Weekly nudge check failed:", err);
    }
  }

}
