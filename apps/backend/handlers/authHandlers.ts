// src/handlers/authHandlers.ts

import type { Context } from "hono";
import type { AppContext } from "../types/context";
import Redis from "ioredis";

// Initialize Redis client with proper configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis retry attempt ${times} with delay ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    console.log("Redis reconnectOnError triggered:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return true;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  authRetry: true,
  enableReadyCheck: true,
};

// Initialize Redis client
const redisClient = new Redis(redisConfig);

// Add error handling for Redis
redisClient.on("error", (error: Error & { code?: string }) => {
  console.error("Redis connection error:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
});

redisClient.on("connect", () => {
  console.log("Redis connected successfully");
});

redisClient.on("ready", () => {
  console.log("Redis is ready to accept commands");
});

// Initialize services using the shared Redis instance from context
export type AuthHandler = (
  c: Context<AppContext>,
) => Promise<Response> | Response;

// Helper function to get services from context
function getServices(c: Context<AppContext>) {
  const authService = c.get("authService");
  const userPreferencesService = c.get("userPreferencesService");
  const levelingService = c.get("levelingService");
  const redisService = c.get("redisService");

  return {
    authService,
    userPreferencesService,
    levelingService,
    redisService,
  };
}

/**
 * Register a new user
 */
export const registerHandler: AuthHandler = async (c) => {
  try {
    const { email, password, displayName } = await c.req.json();
    const { authService } = getServices(c);

    const user = await authService.register({ email, password, displayName });
    // Log in the user right after registration
    const { tokens } = await authService.login(email, password);

    return c.json(
      {
        message: "User registered successfully",
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      201,
    );
  } catch (error) {
    console.error("Registration error:", error);
    return c.json(
      {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      400,
    );
  }
};

/**
 * Login a user
 */
export const loginHandler: AuthHandler = async (c) => {
  try {
    const { email, password } = await c.req.json();
    const { authService } = getServices(c);

    const { user, tokens } = await authService.login(email, password);
    return c.json({
      message: "Login successful",
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      {
        error: "Login failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      401,
    );
  }
};

/**
 * Refresh access token
 */
export const refreshTokenHandler: AuthHandler = async (c) => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({ error: "Refresh token is required" }, 400);
    }

    const { authService } = getServices(c);
    const tokens = await authService.refreshToken(refreshToken);

    return c.json({
      message: "Token refreshed successfully",
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to refresh token",
      },
      401,
    );
  }
};

/**
 * Logout a user
 */
export const logoutHandler: AuthHandler = async (c) => {
  try {
    // For example, assume the user id is extracted from a token.
    // You can create a helper to get the user id from the Authorization header.
    const userId = getUserIdFromToken(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { authService } = getServices(c);
    const success = await authService.logout(userId);
    if (!success) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Logout failed" },
      500,
    );
  }
};

/**
 * Get current user profile
 */
export const getCurrentUserHandler: AuthHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const { authService } = getServices(c);
    const userData = await authService.getUserProfile(user.userId);
    if (!userData) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(userData);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return c.json(
      {
        error: "Failed to fetch user data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Update user profile
 */
export const updateProfileHandler: AuthHandler = async (c) => {
  try {
    const userId = getUserIdFromToken(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userData = await c.req.json();

    // Update profile via auth service
    const { authService } = getServices(c);
    const updatedUser = await authService.updateUserProfile(userId, userData);
    if (!updatedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update profile",
      },
      500,
    );
  }
};

/**
 * Change password
 */
export const changePasswordHandler: AuthHandler = async (c) => {
  try {
    const userId = getUserIdFromToken(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) {
      return c.json(
        { error: "Current password and new password are required" },
        400,
      );
    }

    const { authService } = getServices(c);
    await authService.changePassword(userId, currentPassword, newPassword);
    return c.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to change password",
      },
      500,
    );
  }
};

/**
 * Delete user account
 */
export const deleteAccountHandler: AuthHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const { password } = await c.req.json();
    if (!password) {
      return c.json({ error: "Password is required" }, 400);
    }

    const { authService } = getServices(c);
    await authService.deleteAccount(user.userId, password);
    return c.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    return c.json(
      {
        error: "Failed to delete account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Helper function to extract user ID from token.
 * This is just an example; adjust the implementation based on your authentication scheme.
 */
function getUserIdFromToken(c: Context<AppContext>): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    // Get services from context
    const { authService } = getServices(c);
    // Validate the token using the AuthService
    const decoded = authService.validateToken(token) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
}
