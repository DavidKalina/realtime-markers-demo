import { Hono } from "hono";
import type { AppContext } from "../types/context";
import type { ServiceContainer } from "../services/ServiceInitializer";

/**
 * Setup context injection middleware
 */
export function setupContext(
  app: Hono<AppContext>,
  services: ServiceContainer,
): void {
  app.use("*", async (c, next) => {
    c.set("dataSource", services.dataSource);
    c.set("jobQueue", services.jobQueue);
    c.set("redisClient", services.redisService.getClient());
    c.set("redisService", services.redisService);
    c.set("storageService", services.storageService);
    c.set("authService", services.authService);
    c.set("geocodingService", services.geocodingService);
    c.set("emailService", services.emailService);
    c.set("sidequestService", services.sidequestService);
    c.set("sidequestPrescriptionService", services.sidequestPrescriptionService);
    c.set("sidequestCheckinService", services.sidequestCheckinService);
    c.set("overpassService", services.overpassService);
    c.set("comfortZoneService", services.comfortZoneService);
    c.set("coverageService", services.coverageService);
    c.set("pathwayService", services.pathwayService);
    c.set("pushNotificationService", services.pushNotificationService);
    c.set("jobNotificationService", services.jobNotificationService);
    c.set("fearLadderGenerationService", services.fearLadderGenerationService);
    c.set("barrierGenerationService", services.barrierGenerationService);
    c.set("goalRefinementService", services.goalRefinementService);

    await next();
  });
}
