// src/middleware/authMiddleware.ts

import type { Context, Next } from "hono";
import { createAuthService } from "../services/AuthService";
import { User } from "../entities/User";
import dataSource from "../data-source";
import type { AppContext } from "../types/context";
import { createUserPreferencesService } from "../services/UserPreferences";
import { createLevelingService } from "../services/LevelingService";
import { redisService } from "../services/shared/redis";
import { createOpenAIService } from "../services/shared/OpenAIService";
import { createOpenAICacheService } from "../services/shared/OpenAICacheService";
import { createEmbeddingService } from "../services/shared/EmbeddingService";
import { createEmbeddingCacheService } from "../services/shared/EmbeddingCacheService";
import { createLevelingCacheService } from "../services/shared/LevelingCacheService";
import { createConfigService } from "../services/shared/ConfigService";

// Create an instance of AuthService (or import it if already instantiated)
const userRepository = dataSource.getRepository(User);

// Create dependencies for UserPreferencesService
const openAICacheService = createOpenAICacheService();
const openAIService = createOpenAIService({
  redisService,
  openAICacheService,
});

const configService = createConfigService();
const embeddingCacheService = createEmbeddingCacheService({ configService });
const embeddingService = createEmbeddingService({
  openAIService,
  configService,
  embeddingCacheService,
});

const userPreferencesService = createUserPreferencesService({
  dataSource,
  redisService,
  embeddingService,
  openAIService,
});

const levelingCacheService = createLevelingCacheService(
  redisService.getClient(),
);
const levelingService = createLevelingService({
  dataSource,
  redisService,
  levelingCacheService,
});

const authService = createAuthService({
  userRepository,
  userPreferencesService,
  levelingService,
  dataSource,
  openAIService,
});

export const authMiddleware = async (c: Context<AppContext>, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const decoded = authService.validateToken(token);

  if (!decoded) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Attach the decoded payload to context, ensuring we use 'id' consistently
  c.set("user", {
    ...decoded,
    userId: decoded.id, // Add userId as an alias for backward compatibility
  });
  return next();
};
