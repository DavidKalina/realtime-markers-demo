// routes/friendships.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import * as handlers from "../handlers/friendshipHandlers";

export const friendshipsRouter = new Hono<AppContext>();

// Apply IP, rate limiting, and auth middleware to all routes
friendshipsRouter.use("*", ip());
friendshipsRouter.use(
  "*",
  rateLimit({
    maxRequests: 30, // 30 requests per minute for friendship routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `friendships:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
friendshipsRouter.use("*", authMiddleware);

// Friend request endpoints
friendshipsRouter.post("/requests", handlers.sendFriendRequestHandler);

friendshipsRouter.post(
  "/requests/by-username",
  handlers.sendFriendRequestByUsernameHandler,
);
friendshipsRouter.get(
  "/requests/pending",
  handlers.getPendingFriendRequestsHandler,
);
friendshipsRouter.get(
  "/requests/outgoing",
  handlers.getOutgoingFriendRequestsHandler,
);
friendshipsRouter.post(
  "/requests/:id/accept",
  handlers.acceptFriendRequestHandler,
);
friendshipsRouter.post(
  "/requests/:id/reject",
  handlers.rejectFriendRequestHandler,
);
friendshipsRouter.post(
  "/requests/:id/cancel",
  handlers.cancelFriendRequestHandler,
);

// Friends list endpoints
friendshipsRouter.get("/", handlers.getFriendsHandler);

// Contact management endpoints
friendshipsRouter.post("/contacts", handlers.updateContactsHandler);
friendshipsRouter.get(
  "/contacts/potential",
  handlers.findPotentialFriendsHandler,
);
