import { DataSource } from "typeorm";
import { Redis } from "ioredis";
import { RedisService } from "./shared/RedisService";
import { OpenAIService } from "./shared/OpenAIService";
import { EmbeddingService } from "./shared/EmbeddingService";
import { StorageService } from "./shared/StorageService";
import { AuthService } from "./AuthService";
import { EmailService, MockEmailService } from "./shared/EmailService";
import { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import { GooglePlacesService } from "./shared/GooglePlacesService";
import { JobQueue } from "./JobQueue";

import { User } from "../entities";
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

export interface ServiceContainer {
  dataSource: DataSource;
  openAIService: OpenAIService;
  embeddingService: EmbeddingService;
  jobQueue: JobQueue;
  redisService: RedisService;
  geocodingService: GoogleGeocodingService;
  placesService: GooglePlacesService;
  overpassService: OverpassService;
  comfortZoneService: ComfortZoneService;
  coverageService: CoverageService;
  resonanceService: ResonanceService;
  pathwayService: PathwayService;
  sidequestPrescriptionService: SidequestPrescriptionService;
  pushNotificationService: PushNotificationService;
  jobNotificationService: JobNotificationService;
  // HTTP-only services (null in worker mode)
  storageService: StorageService | null;
  authService: AuthService | null;
  emailService: EmailService | null;
  sidequestService: SidequestService | null;
  sidequestCheckinService: SidequestCheckinService | null;
}

export type InitMode = "http" | "worker";

export async function createServices(
  dataSource: DataSource,
  redisClient: Redis,
  mode: InitMode = "http",
): Promise<ServiceContainer> {
  console.log(`Initializing services (mode: ${mode})...`);

  const redisService = new RedisService(redisClient);
  const jobQueue = new JobQueue({ redisService });

  const openAIService = new OpenAIService({
    redisService,
    dataSource,
  });

  const embeddingService = new EmbeddingService({
    openAIService,
  });

  const geocodingService = new GoogleGeocodingService(
    openAIService,
    redisService,
  );

  const placesService = new GooglePlacesService(
    openAIService,
    redisService,
    geocodingService,
  );

  // Wire the lazy binding so resolveLocationInternal can call searchPlaces
  geocodingService.setPlacesService(placesService);

  const overpassService = new OverpassService({ redisService });

  const comfortZoneService = new ComfortZoneService({
    dataSource,
    openAIService,
  });

  const coverageService = new CoverageService({ dataSource });
  const resonanceService = new ResonanceService({ dataSource });
  const pathwayService = new PathwayService({ dataSource });

  const sidequestPrescriptionService = new SidequestPrescriptionService({
    dataSource,
    openAIService,
    geocodingService,
    placesService,
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

  const pushNotificationService = new PushNotificationService({ dataSource });
  const jobNotificationService = new JobNotificationService({
    dataSource,
    pushNotificationService,
  });

  // HTTP-only services — skip in worker mode
  let storageService: StorageService | null = null;
  let authService: AuthService | null = null;
  let emailService: EmailService | null = null;
  let sidequestService: SidequestService | null = null;
  let sidequestCheckinService: SidequestCheckinService | null = null;

  if (mode === "http") {
    storageService = new StorageService();

    emailService = process.env.RESEND_API_KEY
      ? new EmailService({
          apiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.EMAIL_FROM || "noreply@mail.davidkalina.com",
          adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
        })
      : new MockEmailService();

    authService = new AuthService({
      userRepository: dataSource.getRepository(User),
      dataSource,
      emailService,
    });

    sidequestService = new SidequestService({
      dataSource,
      openAIService,
      embeddingService,
      redisService,
      comfortZoneService,
      coverageService,
      resonanceService,
      pathwayService,
    });

    sidequestCheckinService = new SidequestCheckinService({
      dataSource,
      pushService: pushNotificationService,
      redisService,
      openAIService,
      coverageService,
      jobQueue,
    });
  }

  console.log("Services initialized successfully");

  return {
    dataSource,
    openAIService,
    embeddingService,
    jobQueue,
    redisService,
    geocodingService,
    placesService,
    overpassService,
    comfortZoneService,
    coverageService,
    resonanceService,
    pathwayService,
    sidequestPrescriptionService,
    pushNotificationService,
    jobNotificationService,
    storageService,
    authService,
    emailService,
    sidequestService,
    sidequestCheckinService,
  };
}
