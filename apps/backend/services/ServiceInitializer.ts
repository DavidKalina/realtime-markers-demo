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

import { pushNotificationService } from "./PushNotificationService";
import { createSidequestService } from "./SidequestService";
import type { SidequestService } from "./SidequestService";
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
  storageService: StorageService;
  authService: AuthService;
  openAIService: OpenAIService;
  embeddingService: EmbeddingServiceImpl;
  emailService: EmailService;
  jobQueue: JobQueue;
  redisService: RedisService;
  geocodingService: GoogleGeocodingService;
  sidequestService: SidequestService;
  sidequestCheckinService: SidequestCheckinService;
  overpassService: OverpassService;
  comfortZoneService: ComfortZoneService;
  coverageService: CoverageService;
  resonanceService: ResonanceService;
  pathwayService: PathwayService;
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
      geocodingService,
      overpassService,
      embeddingService,
      redisService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
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
      storageService,
      authService,
      openAIService,
      embeddingService,
      emailService,
      jobQueue,
      redisService,
      geocodingService,
      sidequestService,
      sidequestCheckinService,
      overpassService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
    };
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
