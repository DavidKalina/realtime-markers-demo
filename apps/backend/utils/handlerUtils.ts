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

export const requireAuthHandler = (handler: AsyncHandler): Handler => {
  return async (c: Context<AppContext>) => {
    try {
      requireAuth(c);
      return await handler(c);
    } catch (error) {
      return handleError(c, error);
    }
  };
};

// Parameter validation utilities
export const requireParam = (
  c: Context<AppContext>,
  paramName: string,
): string => {
  const param = c.req.param(paramName);
  if (!param || typeof param !== "string") {
    throw new ValidationError(`Missing required parameter: ${paramName}`);
  }
  return param;
};

export const requireQueryParam = (
  c: Context<AppContext>,
  paramName: string,
): string => {
  const param = c.req.query(paramName);
  if (!param) {
    throw new ValidationError(`Missing required query parameter: ${paramName}`);
  }
  return param;
};

export const requireBodyField = async <T>(
  c: Context<AppContext>,
  fieldName: string,
): Promise<T> => {
  const body = await c.req.json();
  const field = body[fieldName];
  if (field === undefined || field === null) {
    throw new ValidationError(`Missing required field: ${fieldName}`);
  }
  return field;
};

// Event existence validation
export const requireEvent = async (c: Context<AppContext>, eventId: string) => {
  const eventService = c.get("eventService");
  const event = await eventService.getEventById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }
  return event;
};

// Error handling utility
export const handleError = (
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

// Common response patterns
export const successResponse = (
  c: Context<AppContext>,
  data: Record<string, unknown>,
) => {
  return c.json(data);
};

// Validation utilities
export const validateArray = (value: unknown, fieldName: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  return value;
};

export const validateEnum = (
  value: unknown,
  allowedValues: string[],
  fieldName: string,
): string => {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Must be one of: ${allowedValues.join(", ")}`,
    );
  }
  return value;
};

// Service getter utilities
export const getEventService = (c: Context<AppContext>) => {
  return c.get("eventService");
};

export const getAuthService = (c: Context<AppContext>) => {
  return c.get("authService");
};

export const getJobQueue = (c: Context<AppContext>) => {
  return c.get("jobQueue");
};

export const getRedisClient = (c: Context<AppContext>) => {
  return c.get("redisClient");
};
