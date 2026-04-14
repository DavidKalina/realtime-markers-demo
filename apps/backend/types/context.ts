import type Redis from "ioredis";
import type { ServiceContainer } from "../services/ServiceInitializer";

/**
 * Hono context variables. Derived from ServiceContainer so adding a service
 * only requires editing ServiceInitializer.ts and the injection middleware.
 */
export interface AppVariables extends ServiceContainer {
  // Override nullable HTTP-only services — handlers run in HTTP mode where these are always set
  storageService: NonNullable<ServiceContainer["storageService"]>;
  authService: NonNullable<ServiceContainer["authService"]>;
  emailService: NonNullable<ServiceContainer["emailService"]>;
  sidequestService: NonNullable<ServiceContainer["sidequestService"]>;
  sidequestCheckinService: NonNullable<ServiceContainer["sidequestCheckinService"]>;

  // Request-specific context (not part of ServiceContainer)
  redisClient: Redis;
  user?: { id: string; email: string; role: string; userId?: string };
  userId?: string;
}

export type AppContext = {
  Variables: AppVariables;
  Bindings: {};
};
