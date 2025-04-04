// src/handlers/authHandlers.ts

import type { Context } from "hono";
import type { AppContext } from "../types/context";
import dataSource from "../data-source";
import { User } from "../entities/User";
import { AuthService } from "../services/AuthService";
import { UserPreferencesService } from "../services/UserPreferences";
import Redis from "ioredis";

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Create instances of required services
const userRepository = dataSource.getRepository(User);
const userPreferencesService = new UserPreferencesService(dataSource, redis);
const authService = new AuthService(userRepository, userPreferencesService);

export type AuthHandler = (c: Context<AppContext>) => Promise<Response> | Response;

/**
 * Register a new user
 */
export const registerHandler: AuthHandler = async (c) => {
  try {
    const { email, password, displayName } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Register user via the auth service
    const registeredUser = await authService.register({ email, password, displayName });
    // Optionally, log in the user right after registration to generate tokens
    const { user, tokens } = await authService.login(email, password);

    return c.json(
      {
        message: "User registered successfully",
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken, // Add refresh token here too
      },
      201
    );
  } catch (error: any) {
    console.error("Error during registration:", error);
    return c.json({ error: error.message || "Registration failed" }, 500);
  }
};

/**
 * Login a user
 */
export const loginHandler: AuthHandler = async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const { user, tokens } = await authService.login(email, password);

    return c.json({
      message: "Login successful",
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken, // Add the refresh token to the response
    });
  } catch (error: any) {
    console.error("Error during login:", error);
    return c.json({ error: error.message || "Login failed" }, 401);
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

    const tokens = await authService.refreshToken(refreshToken);

    return c.json({
      message: "Token refreshed successfully",
      accessToken: tokens.accessToken,
    });
  } catch (error: any) {
    console.error("Error refreshing token:", error);
    return c.json({ error: error.message || "Failed to refresh token" }, 401);
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

    const success = await authService.logout(userId);
    if (!success) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ message: "Logged out successfully" });
  } catch (error: any) {
    console.error("Error during logout:", error);
    return c.json({ error: error.message || "Logout failed" }, 500);
  }
};

/**
 * Get current user profile
 */
export const getCurrentUserHandler: AuthHandler = async (c) => {
  try {
    const userId = getUserIdFromToken(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const user = await authService.getUserProfile(userId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(user);
  } catch (error: any) {
    console.error("Error fetching current user:", error);
    return c.json({ error: error.message || "Failed to fetch user" }, 500);
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
    const updatedUser = await authService.updateUserProfile(userId, userData);
    if (!updatedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return c.json({ error: error.message || "Failed to update profile" }, 500);
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
      return c.json({ error: "Current password and new password are required" }, 400);
    }

    await authService.changePassword(userId, currentPassword, newPassword);
    return c.json({ message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Error changing password:", error);
    return c.json({ error: error.message || "Failed to change password" }, 500);
  }
};

/**
 * Delete user account
 */
export const deleteAccountHandler: AuthHandler = async (c) => {
  try {
    const userId = getUserIdFromToken(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { password } = await c.req.json();
    if (!password) {
      return c.json({ error: "Password is required" }, 400);
    }

    await authService.deleteAccount(userId, password);
    return c.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting account:", error);
    return c.json({ error: error.message || "Failed to delete account" }, 500);
  }
};

/**
 * Helper function to extract user ID from token.
 * This is just an example; adjust the implementation based on your authentication scheme.
 */
function getUserIdFromToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    // Validate the token using the AuthService (or your JWT secret)
    const decoded = authService.validateToken(token) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
}
