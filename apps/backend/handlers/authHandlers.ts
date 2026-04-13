// src/handlers/authHandlers.ts

import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { withErrorHandling, type Handler } from "../utils/handlerUtils";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";

function getAuthService(c: Context<AppContext>) {
  return c.get("authService");
}

/**
 * Extract user ID from the Authorization header JWT.
 * Throws AuthenticationError if the token is missing or invalid.
 */
function requireUserId(c: Context<AppContext>): string {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError();
  }
  const token = authHeader.substring(7);
  try {
    const decoded = getAuthService(c).validateToken(token) as { id: string };
    return decoded.id;
  } catch {
    throw new AuthenticationError();
  }
}

/**
 * Register a new user
 */
export const registerHandler: Handler = withErrorHandling(async (c) => {
  const { email, password, firstName, lastName } = await c.req.json();
  const authService = getAuthService(c);

  const user = await authService.register({
    email,
    password,
    firstName,
    lastName,
  });
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
});

/**
 * Login a user
 */
export const loginHandler: Handler = withErrorHandling(async (c) => {
  const { email, password } = await c.req.json();
  const authService = getAuthService(c);

  const { user, tokens } = await authService.login(email, password);
  return c.json({
    message: "Login successful",
    user,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

/**
 * Refresh access token
 */
export const refreshTokenHandler: Handler = withErrorHandling(async (c) => {
  const { refreshToken } = await c.req.json();
  if (!refreshToken) {
    throw new ValidationError("Refresh token is required");
  }

  const authService = getAuthService(c);
  const tokens = await authService.refreshToken(refreshToken);

  return c.json({
    message: "Token refreshed successfully",
    accessToken: tokens.accessToken,
  });
});

/**
 * Logout a user
 */
export const logoutHandler: Handler = withErrorHandling(async (c) => {
  const userId = requireUserId(c);
  const authService = getAuthService(c);

  const success = await authService.logout(userId);
  if (!success) {
    throw new NotFoundError("User not found");
  }

  return c.json({ message: "Logged out successfully" });
});

/**
 * Get current user profile
 */
export const getCurrentUserHandler: Handler = withErrorHandling(async (c) => {
  const user = c.get("user");
  if (!user || !user.id) {
    throw new AuthenticationError();
  }

  const authService = getAuthService(c);
  const userData = await authService.getUserProfile(user.id);
  if (!userData) {
    throw new NotFoundError("User not found");
  }

  return c.json(userData);
});

/**
 * Update user profile
 */
export const updateProfileHandler: Handler = withErrorHandling(async (c) => {
  const userId = requireUserId(c);
  const userData = await c.req.json();

  const authService = getAuthService(c);
  const updatedUser = await authService.updateUserProfile(userId, userData);
  if (!updatedUser) {
    throw new NotFoundError("User not found");
  }

  return c.json({
    message: "Profile updated successfully",
    user: updatedUser,
  });
});

/**
 * Change password
 */
export const changePasswordHandler: Handler = withErrorHandling(async (c) => {
  const userId = requireUserId(c);
  const { currentPassword, newPassword } = await c.req.json();
  if (!currentPassword || !newPassword) {
    throw new ValidationError(
      "Current password and new password are required",
    );
  }

  const authService = getAuthService(c);
  await authService.changePassword(userId, currentPassword, newPassword);
  return c.json({ message: "Password changed successfully" });
});

/**
 * Delete user account
 */
export const deleteAccountHandler: Handler = withErrorHandling(async (c) => {
  const user = c.get("user");
  if (!user || !user.userId) {
    throw new AuthenticationError();
  }

  const { password } = await c.req.json();
  if (!password) {
    throw new ValidationError("Password is required");
  }

  const authService = getAuthService(c);
  await authService.deleteAccount(user.userId, password);
  return c.json({ message: "Account deleted successfully" });
});

/**
 * Request a password reset (public, unauthenticated)
 */
export const requestPasswordResetHandler: Handler = withErrorHandling(
  async (c) => {
    const { email } = await c.req.json();
    const authService = getAuthService(c);

    // Always returns 200 to prevent email enumeration
    try {
      await authService.requestPasswordReset(email || "");
    } catch (err) {
      console.error("Password reset request error:", err);
    }

    return c.json({ message: "If that email exists, a reset code was sent." });
  },
);

/**
 * Confirm password reset with code (public, unauthenticated)
 */
export const confirmPasswordResetHandler: Handler = withErrorHandling(
  async (c) => {
    const { email, code, newPassword } = await c.req.json();

    if (!email || !code || !newPassword) {
      throw new ValidationError(
        "Email, code, and new password are required",
      );
    }

    if (newPassword.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    const authService = getAuthService(c);
    await authService.confirmPasswordReset(email, code, newPassword);

    return c.json({ message: "Password reset successfully" });
  },
);
