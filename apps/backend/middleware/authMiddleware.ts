// src/middleware/authMiddleware.ts

import type { Context, Next } from "hono";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";
import dataSource from "../data-source";
import type { AppContext } from "../types/context";
import { UserPreferencesService } from "../services/UserPreferences";
import { LevelingService } from "../services/LevelingService";
import Redis from "ioredis";

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

// Create an instance of AuthService (or import it if already instantiated)
const userRepository = dataSource.getRepository(User);
const userPreferencesService = new UserPreferencesService(dataSource, redis);
const levelingService = new LevelingService(dataSource, redis);
const authService = new AuthService(
  userRepository,
  userPreferencesService,
  levelingService,
  dataSource,
);

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

  // Optionally, attach the decoded payload to context so subsequent handlers can use it
  c.set("user", decoded);
  return next();
};
