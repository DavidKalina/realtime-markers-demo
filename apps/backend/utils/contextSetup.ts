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
    c.set("eventService", services.eventService);
    c.set("eventProcessingService", services.eventProcessingService);
    c.set("jobQueue", services.jobQueue);
    c.set("redisClient", services.redisService.getClient());
    c.set("redisService", services.redisService);
    c.set("userPreferencesService", services.userPreferencesService);
    c.set("storageService", services.storageService);
    c.set("planService", services.planService);
    c.set("friendshipService", services.friendshipService);
    c.set("notificationService", services.notificationService);
    c.set("authService", services.authService);
    c.set("geocodingService", services.geocodingService);
    c.set("embeddingService", services.embeddingService);
    c.set("categoryProcessingService", services.categoryProcessingService);
    c.set("emailService", services.emailService);
    await next();
  });
}
