import { DataSource } from "typeorm";
import { Redis } from "ioredis";
import { RedisService } from "./shared/RedisService";
import { OpenAIService } from "./shared/OpenAIService";
import { OpenAICacheService } from "./shared/OpenAICacheService";
import { EmbeddingService } from "./shared/EmbeddingService";
import { StorageService } from "./shared/StorageService";
import { AuthService } from "./AuthService";
import { EmailService, MockEmailService } from "./shared/EmailService";
import { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import { JobQueue } from "./JobQueue";

import { User } from "@realtime-markers/database";
import { PushNotificationService } from "./PushNotificationService";
import { JobNotificationService } from "./JobNotificationService";
import { SidequestService } from "./SidequestService";
import { SidequestPrescriptionService } from "./SidequestPrescriptionService";
import { OverpassService } from "./shared/OverpassService";
import { SidequestCheckinService } from "./SidequestCheckinService";
import { ComfortZoneService } from "./ComfortZoneService";
import { CoverageService } from "./CoverageService";
import { ResonanceService } from "./ResonanceService";
import { PathwayService } from "./PathwayService";
import { FearLadderGenerationService } from "./FearLadderGenerationService";
import { BarrierGenerationService } from "./BarrierGenerationService";
import { GoalRefinementService } from "./GoalRefinementService";
export interface ServiceContainer {
  dataSource: DataSource;
  storageService: StorageService;
  authService: AuthService;
  openAIService: OpenAIService;
  embeddingService: EmbeddingService;
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
  fearLadderGenerationService: FearLadderGenerationService;
  barrierGenerationService: BarrierGenerationService;
  goalRefinementService: GoalRefinementService;
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

    const redisService = new RedisService(this.redisClient);
    const jobQueue = new JobQueue({ redisService });

    // Initialize cache services
    const openAICacheService = new OpenAICacheService();

    // Initialize AI services
    const openAIService = new OpenAIService({
      redisService,
      openAICacheService,
      dataSource: this.dataSource,
    });

    const embeddingService = new EmbeddingService({
      openAIService,
    });

    // Initialize business services
    const storageService = new StorageService({});

    const emailService = process.env.RESEND_API_KEY
      ? new EmailService({
          apiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.EMAIL_FROM || "noreply@mail.davidkalina.com",
          adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
        })
      : new MockEmailService();

    const authService = new AuthService({
      userRepository: this.dataSource.getRepository(User),
      dataSource: this.dataSource,
      emailService,
    });

    const geocodingService = new GoogleGeocodingService(
      openAIService,
      redisService,
    );

    const overpassService = new OverpassService({ redisService });

    const comfortZoneService = new ComfortZoneService({
      dataSource: this.dataSource,
      openAIService,
    });

    const coverageService = new CoverageService({
      dataSource: this.dataSource,
    });

    const resonanceService = new ResonanceService({
      dataSource: this.dataSource,
    });

    const pathwayService = new PathwayService({
      dataSource: this.dataSource,
    });

    const sidequestService = new SidequestService({
      dataSource: this.dataSource,
      openAIService,
      embeddingService,
      redisService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
    });

    const sidequestPrescriptionService = new SidequestPrescriptionService({
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
      prescriptionModel: process.env.PRESCRIPTION_MODEL || undefined,
      promptVersion: process.env.PRESCRIPTION_PROMPT_VERSION || undefined,
    });

    const pushNotificationService = new PushNotificationService({
      dataSource: this.dataSource,
    });

    const jobNotificationService = new JobNotificationService({
      dataSource: this.dataSource,
      pushNotificationService,
    });

    const fearLadderGenerationService = new FearLadderGenerationService({
      openAIService,
    });

    const barrierGenerationService = new BarrierGenerationService({
      openAIService,
    });

    const goalRefinementService = new GoalRefinementService({
      openAIService,
    });

    const sidequestCheckinService = new SidequestCheckinService({
      dataSource: this.dataSource,
      pushService: pushNotificationService,
      redisService,
      openAIService,
      coverageService,
      jobQueue,
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
      fearLadderGenerationService,
      barrierGenerationService,
      goalRefinementService,
    };
  }
}
