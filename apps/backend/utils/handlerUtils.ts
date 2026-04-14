import type { Context } from "hono";
import type { AppContext } from "../types/context";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "./errors";

// Type for handler functions
export type Handler = (c: Context<AppContext>) => Promise<Response> | Response;

// Type for async handler functions that can throw errors
export type AsyncHandler = (c: Context<AppContext>) => Promise<Response>;

// Authentication validation utilities
export const requireAuth = (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user || !user.id) {
    throw new AuthenticationError();
  }
  return user;
};

// Error handling utility
const handleError = (
  c: Context<AppContext>,
  error: unknown,
): Response => {
  console.error("Handler error:", error);

  if (error instanceof AuthenticationError) {
    return c.json({ error: error.message }, 401);
  }

  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, 400);
  }

  if (error instanceof NotFoundError) {
    return c.json({ error: error.message }, 404);
  }

  if (error instanceof AuthorizationError) {
    return c.json({ error: error.message }, 403);
  }

  // Default error response
  return c.json(
    {
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    },
    500,
  );
};

// Wrapper for async handlers with error handling
export const withErrorHandling = (handler: AsyncHandler): Handler => {
  return async (c: Context<AppContext>) => {
    try {
      return await handler(c);
    } catch (error) {
      return handleError(c, error);
    }
  };
};
