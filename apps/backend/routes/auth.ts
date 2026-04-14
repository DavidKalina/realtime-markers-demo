import { Hono } from "hono";
import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import { withErrorHandling } from "../utils/handlerUtils";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";

export const authRouter = new Hono<AppContext>();

function getAuthService(c: Context<AppContext>) {
  return c.get("authService");
}

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

// Apply IP and rate limiting middleware to all routes
authRouter.use("*", ip());
authRouter.use(
  "*",
  rateLimit({
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `auth:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// Public routes
authRouter.post(
  "/register",
  withErrorHandling(async (c) => {
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
  }),
);

authRouter.post(
  "/login",
  withErrorHandling(async (c) => {
    const { email, password } = await c.req.json();
    const authService = getAuthService(c);

    const { user, tokens } = await authService.login(email, password);
    return c.json({
      message: "Login successful",
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }),
);

authRouter.post(
  "/refresh-token",
  withErrorHandling(async (c) => {
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
  }),
);

// Password reset (public, tighter rate limit)
authRouter.post(
  "/password-reset",
  rateLimit({
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `pw-reset:${ipInfo.ip}`;
    },
  }),
  withErrorHandling(async (c) => {
    const { email } = await c.req.json();
    const authService = getAuthService(c);

    // Always returns 200 to prevent email enumeration
    try {
      await authService.requestPasswordReset(email || "");
    } catch (err) {
      console.error("Password reset request error:", err);
    }

    return c.json({ message: "If that email exists, a reset code was sent." });
  }),
);

authRouter.post(
  "/password-reset/confirm",
  rateLimit({
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `pw-reset-confirm:${ipInfo.ip}`;
    },
  }),
  withErrorHandling(async (c) => {
    const { email, code, newPassword } = await c.req.json();

    if (!email || !code || !newPassword) {
      throw new ValidationError("Email, code, and new password are required");
    }

    if (newPassword.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    const authService = getAuthService(c);
    await authService.confirmPasswordReset(email, code, newPassword);

    return c.json({ message: "Password reset successfully" });
  }),
);

// Protected routes
authRouter.post(
  "/logout",
  authMiddleware,
  withErrorHandling(async (c) => {
    const userId = requireUserId(c);
    const authService = getAuthService(c);

    const success = await authService.logout(userId);
    if (!success) {
      throw new NotFoundError("User not found");
    }

    return c.json({ message: "Logged out successfully" });
  }),
);

authRouter.post(
  "/reset-password",
  authMiddleware,
  withErrorHandling(async (c) => {
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
  }),
);

authRouter.post(
  "/me",
  authMiddleware,
  withErrorHandling(async (c) => {
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
  }),
);

authRouter.delete(
  "/account",
  authMiddleware,
  withErrorHandling(async (c) => {
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
  }),
);
