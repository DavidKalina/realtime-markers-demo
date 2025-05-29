// src/routes/group.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware"; // Assuming you have this
import { ip } from "../middleware/ip"; // Reusing from auth.ts
import * as groupHandlers from "../handlers/groupHandlers";
import { rateLimit } from "../middleware/rateLimit"; // Reusing from auth.ts

export const groupsRouter = new Hono<AppContext>();

// Apply IP and rate limiting middleware to all group routes
groupsRouter.use("*", ip());
groupsRouter.use(
  "*",
  rateLimit({
    maxRequests: 30, // Adjust as needed for group routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `group:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// --- Group CRUD ---
// Create a new group (requires auth)
groupsRouter.post("/create", authMiddleware, groupHandlers.createGroupHandler);

// Search groups (requires auth)
groupsRouter.get("/search", authMiddleware, groupHandlers.searchGroupsHandler);

// Get a specific group (publicly accessible for public groups, auth for private)
groupsRouter.get("/:groupId", groupHandlers.getGroupHandler); // Auth check is within handler

// Update a group (requires auth and ownership/admin role)
groupsRouter.put("/:groupId", authMiddleware, groupHandlers.updateGroupHandler);

// Delete a group (requires auth and ownership)
groupsRouter.delete(
  "/:groupId",
  authMiddleware,
  groupHandlers.deleteGroupHandler,
);

// List groups for the authenticated user (requires auth)
groupsRouter.get(
  "/user/me",
  authMiddleware,
  groupHandlers.getUserGroupsHandler,
);

// --- Group Membership Management ---
// Join or request to join a group (requires auth)
groupsRouter.post(
  "/:groupId/join",
  authMiddleware,
  groupHandlers.joinGroupHandler,
);

// Leave a group (requires auth)
groupsRouter.post(
  "/:groupId/leave",
  authMiddleware,
  groupHandlers.leaveGroupHandler,
);

// Admin: Manage membership status (approve/reject/ban) (requires auth and admin/owner role)
groupsRouter.post(
  "/:groupId/members/:memberUserId/status",
  authMiddleware,
  groupHandlers.manageMembershipStatusHandler,
);

// Admin: Update a member's role (requires auth and admin/owner role)
groupsRouter.put(
  "/:groupId/members/:memberUserId/role",
  authMiddleware,
  groupHandlers.updateMemberRoleHandler,
);

// Admin: Remove a member from a group (requires auth and admin/owner role)
// User: Can also use this to represent "being removed" by an admin.
groupsRouter.delete(
  "/:groupId/members/:memberUserId",
  authMiddleware,
  groupHandlers.removeMemberHandler,
);

// Get list of members for a group (public for approved members of public groups, auth for private/pending)
groupsRouter.get("/:groupId/members", groupHandlers.getGroupMembersHandler); // Auth checks within handler

// --- Group Events ---
// Get events for a specific group with search, filtering, and pagination
groupsRouter.get("/:groupId/events", groupHandlers.getGroupEventsHandler); // Auth checks within handler

// Get recent groups with filtering and pagination (requires auth)
groupsRouter.get(
  "/recent",
  authMiddleware,
  groupHandlers.getRecentGroupsHandler,
);

// List public groups (no auth required) - Must be last to avoid catching other routes
groupsRouter.get("/", groupHandlers.listPublicGroupsHandler);

// --- Example of how to integrate into your main app router (e.g., src/index.ts or src/app.ts) ---
/*
import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { groupRouter } from './routes/group';
import { AppContext } from './types/context'; // Your AppContext

const app = new Hono<AppContext>();

// ... other middleware ...

app.route('/auth', authRouter);
app.route('/groups', groupRouter);

// ... export app ...
*/
