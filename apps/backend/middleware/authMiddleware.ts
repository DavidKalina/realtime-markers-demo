// src/middleware/authMiddleware.ts

import type { Context, Next } from "hono";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";
import dataSource from "../data-source";
import type { AppContext } from "../types/context";

// Create an instance of AuthService (or import it if already instantiated)
const userRepository = dataSource.getRepository(User);
const authService = new AuthService(userRepository);

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
