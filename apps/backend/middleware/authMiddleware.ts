// src/middleware/authMiddleware.ts

import type { Context, Next } from "hono";
import { createAuthService } from "../services/AuthService";
import { User } from "@realtime-markers/database";
import dataSource from "../data-source";
import type { AppContext } from "../types/context";
import { redisService } from "../services/shared/redis";
import { createOpenAIService } from "../services/shared/OpenAIService";
import { createOpenAICacheService } from "../services/shared/OpenAICacheService";
import {
  createEmailService,
  MockEmailService,
} from "../services/shared/EmailService";

const userRepository = dataSource.getRepository(User);

const openAICacheService = createOpenAICacheService();
const openAIService = createOpenAIService({
  redisService,
  openAICacheService,
  dataSource,
});

const emailService = process.env.RESEND_API_KEY
  ? createEmailService({
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || "noreply@mail.davidkalina.com",
      adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
    })
  : new MockEmailService();

const authService = createAuthService({
  userRepository,
  dataSource,
  openAIService,
  emailService,
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

  c.set("user", {
    ...decoded,
    userId: decoded.id,
  });
  return next();
};
