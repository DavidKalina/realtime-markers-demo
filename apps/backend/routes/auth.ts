// src/routes/auth.ts
import { Hono } from "hono";
import * as handlers from "../handlers/authHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

// Create a router with the correct typing
export const authRouter = new Hono<AppContext>();

// Apply IP and rate limiting middleware to all routes
authRouter.use("*", ip());
authRouter.use("*", rateLimit({
    maxRequests: 20, // 5 requests per minute for auth routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
        const ipInfo = c.get("ip");
        return `auth:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    }
}));

// Public routes (no session required)
authRouter.post("/register", handlers.registerHandler);
authRouter.post("/login", handlers.loginHandler);
authRouter.post("/refresh-token", handlers.refreshTokenHandler);

// Protected routes (session required)
// You can attach the middleware as a parameter for each route
authRouter.post("/logout", authMiddleware, handlers.logoutHandler);
authRouter.post("/reset-password", authMiddleware, handlers.changePasswordHandler);
authRouter.post("/me", authMiddleware, handlers.getCurrentUserHandler);
authRouter.delete("/account", authMiddleware, handlers.deleteAccountHandler);
