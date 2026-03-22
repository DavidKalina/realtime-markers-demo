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
import { createLeaderboardService } from "./LeaderboardService";
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
import type { GamificationService } from "./GamificationService";
import type { LeaderboardService } from "./LeaderboardService";
import type { ThirdSpaceScoreService } from "./ThirdSpaceScoreService";
import { createAreaScanService } from "./AreaScanService";
import type { AreaScanService } from "./AreaScanService";
import { createEventHypeService } from "./EventHypeService";
import type { EventHypeService } from "./EventHypeService";
import { createCityHypeService } from "./CityHypeService";
import type { CityHypeService } from "./CityHypeService";
import {
  createTicketmasterService,
  type TicketmasterService,
} from "./TicketmasterService";
import { ProximityNotificationService } from "./ProximityNotificationService";
import { pushNotificationService } from "./PushNotificationService";
import { createItineraryService } from "./ItineraryService";
import type { ItineraryService } from "./ItineraryService";
import { createOverpassService } from "./shared/OverpassService";
import type { OverpassService } from "./shared/OverpassService";
import { createWeatherService } from "./shared/WeatherService";
import { createItineraryCheckinService } from "./ItineraryCheckinService";
import type { ItineraryCheckinService } from "./ItineraryCheckinService";
import { createBadgeService } from "./BadgeService";
import type { BadgeService } from "./BadgeService";
import { createAdventureScoreService } from "./AdventureScoreService";
import type { AdventureScoreService } from "./AdventureScoreService";
import { createDistrictService } from "./DistrictService";
import type { DistrictService } from "./DistrictService";

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
  leaderboardService: LeaderboardService;
  areaScanService: AreaScanService;
  eventHypeService: EventHypeService;
  cityHypeService: CityHypeService;
  ticketmasterService: TicketmasterService | null;
  proximityNotificationService: ProximityNotificationService;
  thirdSpaceScoreService: ThirdSpaceScoreService;
  itineraryService: ItineraryService;
  itineraryCheckinService: ItineraryCheckinService;
  overpassService: OverpassService;
  badgeService: BadgeService;
  adventureScoreService: AdventureScoreService;
  districtService: DistrictService;
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
    const gamificationService = createGamificationService({
      dataSource: this.dataSource,
      redisService,
    });

    const leaderboardService = createLeaderboardService({
      dataSource: this.dataSource,
      redisService,
    });

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
      gamificationService,
      thirdSpaceScoreService,
    });

    const proximityNotificationService = new ProximityNotificationService(
      eventService,
      pushNotificationService,
      redisService,
    );

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

    const areaScanService = createAreaScanService({
      dataSource: this.dataSource,
      openAIService,
      redisService,
      overpassService,
    });

    const eventHypeService = createEventHypeService({
      dataSource: this.dataSource,
      openAIService,
      redisService,
    });

    const cityHypeService = createCityHypeService({
      openAIService,
      redisService,
    });
    const weatherService = createWeatherService({ redisService });

    const itineraryService = createItineraryService({
      dataSource: this.dataSource,
      openAIService,
      geocodingService,
      overpassService,
      weatherService,
      gamificationService,
      embeddingService,
      redisService,
    });

    const adventureScoreService = createAdventureScoreService({
      dataSource: this.dataSource,
      redisService,
    });

    const badgeService = createBadgeService({
      dataSource: this.dataSource,
      gamificationService,
      redisService,
      pushService: pushNotificationService,
    });

    const districtService = createDistrictService({
      dataSource: this.dataSource,
      embeddingService,
      openAIService,
      redisService,
    });

    const itineraryCheckinService = createItineraryCheckinService({
      dataSource: this.dataSource,
      pushService: pushNotificationService,
      redisService,
      gamificationService,
      badgeService,
      thirdSpaceScoreService,
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
      leaderboardService,
      areaScanService,
      eventHypeService,
      cityHypeService,
      ticketmasterService,
      proximityNotificationService,
      thirdSpaceScoreService,
      itineraryService,
      itineraryCheckinService,
      overpassService,
      badgeService,
      adventureScoreService,
      districtService,
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
           SELECT DISTINCT i.user_id FROM itineraries i
           WHERE i.planned_date >= CURRENT_DATE
           AND i.status = 'READY'
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

  setupSeedItinerarySchedule(
    jobQueue: JobQueue,
    dataSource: DataSource,
  ): void {
    if (process.env.DISABLE_SEED_ITINERARIES === "true") {
      console.log(
        "Seed itineraries disabled via DISABLE_SEED_ITINERARIES environment variable",
      );
      return;
    }

    const TARGET_PER_CITY = parseInt(
      process.env.SEED_ITINERARIES_PER_CITY || "30",
    );
    const intervalHours = 24;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(
      `Setting up seed itinerary schedule: target=${TARGET_PER_CITY}/city, interval=${intervalHours}h`,
    );

    const runSeed = async () => {
      try {
        // Find an admin user to own the seeded itineraries
        const [adminUser] = await dataSource.query(
          `SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`,
        );
        if (!adminUser) {
          console.log("[SeedItineraries] No admin user found, skipping");
          return;
        }

        // Get all cities with published itineraries and count seeded ones
        const cities: { city: string; seed_count: number }[] =
          await dataSource.query(
            `SELECT i.city, COUNT(*) FILTER (
               WHERE i.user_id = $1 AND i.is_published = true
             ) AS seed_count
             FROM itineraries i
             WHERE i.city IS NOT NULL
               AND i.status = 'READY'
               AND i.deleted_at IS NULL
             GROUP BY i.city
             HAVING COUNT(*) >= 1`,
            [adminUser.id],
          );

        const activities = [
          "food", "coffee", "music", "art", "outdoors", "boarding",
          "hiking", "walking", "nightlife", "brews", "thrifting",
          "sports", "culture",
        ];
        const intentions = [
          "recharge", "explore", "socialize", "move",
          "learn", "treat_yourself", "lock_in",
        ];
        // Weighted toward shorter itineraries — more quick hits
        const durations = [1.5, 2, 2, 3, 3, 4, 6];
        const budgets = [15, 25, 30, 50, 75, 100];
        // Mostly 2-3 stops, occasional 1-stop quickie
        const stopCounts = [1, 2, 2, 2, 3, 3];

        // Build all unique activity combos (1-3 activities each)
        const activityCombos: string[][] = [];
        // Singles
        for (const a of activities) {
          activityCombos.push([a]);
        }
        // Pairs — every unique pair
        for (let i = 0; i < activities.length; i++) {
          for (let j = i + 1; j < activities.length; j++) {
            activityCombos.push([activities[i], activities[j]]);
          }
        }
        // Triples — sample interesting combos (every 3rd pair + a third)
        for (let i = 0; i < activities.length; i++) {
          for (let j = i + 1; j < activities.length; j += 3) {
            const k = (j + 2) % activities.length;
            if (k !== i && k !== j) {
              activityCombos.push([activities[i], activities[j], activities[k]]);
            }
          }
        }

        let totalEnqueued = 0;

        for (const { city, seed_count } of cities) {
          const needed = TARGET_PER_CITY - Number(seed_count);
          if (needed <= 0) continue;

          console.log(
            `[SeedItineraries] ${city}: ${seed_count}/${TARGET_PER_CITY} seeded, generating ${needed} more`,
          );

          // Shuffle combos deterministically per city for even coverage
          const cityHash = city.split("").reduce((h, c) => h * 31 + c.charCodeAt(0), 0);
          const shuffledCombos = [...activityCombos].sort(
            (a, b) => Math.sin(cityHash + activityCombos.indexOf(a) * 7919) -
                       Math.sin(cityHash + activityCombos.indexOf(b) * 7919),
          );

          for (let i = 0; i < needed; i++) {
            const activityTypes = shuffledCombos[i % shuffledCombos.length];
            const intention = intentions[(totalEnqueued + i) % intentions.length];
            const duration = durations[(totalEnqueued + i) % durations.length];
            const budget = budgets[(totalEnqueued + i) % budgets.length];
            const stopCount = stopCounts[(totalEnqueued + i) % stopCounts.length];

            const plannedDate = new Date();
            plannedDate.setDate(plannedDate.getDate() + 1 + (i % 7));

            await jobQueue.enqueue("seed_itinerary", {
              userId: adminUser.id,
              city,
              plannedDate: plannedDate.toISOString(),
              budgetMin: 0,
              budgetMax: budget,
              durationHours: duration,
              activityTypes,
              stopCount,
              intention,
              surpriseMe: false,
            });

            totalEnqueued++;
          }
        }

        if (totalEnqueued > 0) {
          console.log(
            `[SeedItineraries] Enqueued ${totalEnqueued} seed jobs across ${cities.length} cities`,
          );
        } else {
          console.log("[SeedItineraries] All cities at target, nothing to seed");
        }
      } catch (err) {
        console.error("[SeedItineraries] Seed run failed:", err);
      }
    };

    // Run once on startup after 120s delay (let everything initialize)
    setTimeout(() => {
      console.log("Running initial seed itinerary check");
      runSeed();
    }, 120_000);

    // Run every 24 hours
    setInterval(() => {
      console.log("Running scheduled seed itinerary check");
      runSeed();
    }, intervalMs);
  }

  setupDistrictClusteringSchedule(
    districtService: DistrictService,
    redisService: RedisService,
  ): void {
    if (process.env.DISABLE_DISTRICT_CLUSTERING === "true") {
      console.log(
        "District clustering disabled via DISABLE_DISTRICT_CLUSTERING environment variable",
      );
      return;
    }

    const intervalHours = 4;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(
      `Setting up district clustering schedule: interval=${intervalHours}h`,
    );

    // Subscribe to itinerary changes for incremental clustering
    const subscriber = redisService.getClient().duplicate();
    subscriber.subscribe("itinerary_changes", (err) => {
      if (err) {
        console.error(
          "[DistrictClustering] Failed to subscribe to itinerary_changes:",
          err,
        );
      }
    });
    subscriber.on("message", async (_channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        if (
          data.operation === "CREATE" &&
          data.record?.entryLatitude &&
          data.record?.entryLongitude
        ) {
          const ngeohash = await import("ngeohash");
          const gh = ngeohash.default.encode(
            Number(data.record.entryLatitude),
            Number(data.record.entryLongitude),
            4,
          );
          console.log(
            `[DistrictClustering] Itinerary published, clustering region ${gh}`,
          );
          await districtService.clusterRegion(gh);
        }
      } catch (err) {
        console.error(
          "[DistrictClustering] Error processing itinerary change:",
          err,
        );
      }
    });

    // Run once on startup after 5min delay (gives seed itineraries time to generate + get embeddings)
    setTimeout(async () => {
      console.log("Running initial district clustering");
      try {
        await districtService.clusterAllRegions();
        await districtService.computeAllSnapshots();
      } catch (err) {
        console.error("Initial district clustering failed:", err);
      }
    }, 5 * 60 * 1000);

    // Run every 4 hours
    setInterval(async () => {
      console.log("Running scheduled district clustering");
      try {
        await districtService.clusterAllRegions();
      } catch (err) {
        console.error("Scheduled district clustering failed:", err);
      }
    }, intervalMs);
  }

  setupThirdSpaceScoreSchedule(
    thirdSpaceScoreService: ThirdSpaceScoreService,
  ): void {
    if (process.env.DISABLE_TSS_COMPUTATION === "true") {
      console.log(
        "Third Space Score computation disabled via DISABLE_TSS_COMPUTATION environment variable",
      );
      return;
    }

    const intervalHours = 4;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(
      `Setting up Third Space Score schedule: interval=${intervalHours}h`,
    );

    // Run once on startup after 60s delay
    setTimeout(async () => {
      console.log("Running initial Third Space Score computation");
      try {
        await thirdSpaceScoreService.computeAllCities();
        await thirdSpaceScoreService.cleanupOldSnapshots();
      } catch (err) {
        console.error("Initial Third Space Score computation failed:", err);
      }
    }, 60_000);

    // Run every 4 hours
    setInterval(async () => {
      console.log("Running scheduled Third Space Score computation");
      try {
        await thirdSpaceScoreService.computeAllCities();
        await thirdSpaceScoreService.cleanupOldSnapshots();
      } catch (err) {
        console.error("Scheduled Third Space Score computation failed:", err);
      }
    }, intervalMs);
  }
}
