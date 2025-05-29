// src/routes/group.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware"; // Assuming you have this
import { ip } from "../middleware/ip"; // Reusing from auth.ts
import * as groupHandlers from "../handlers/groupHandlers";
import { rateLimit } from "../middleware/rateLimit"; // Reusing from auth.ts

/**
 * Group Router
 *
 * Handles all group-related operations including:
 * - Group CRUD operations
 * - Group membership management
 * - Group event management
 * - Group search and discovery
 * - Group tagging and categorization
 *
 * Tag-related endpoints:
 * - POST /groups/create - Create group with tags
 * - PUT /groups/:groupId - Update group tags
 *
 * Tag validation:
 * - Tags are validated for appropriateness using OpenAI
 * - Tags are normalized and deduplicated
 * - Tags are converted to categories for better organization
 */

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

// --- Group Creation and Updates (with tag support) ---
/**
 * Create a new group
 * @body {CreateGroupDto} - Group data including optional tags
 * @returns {Group} - Created group with processed tags/categories
 */
groupsRouter.post("/create", authMiddleware, groupHandlers.createGroupHandler);

/**
 * Update a group
 * @param {string} groupId - ID of the group to update
 * @body {UpdateGroupDto} - Update data including optional tags
 * @returns {Group} - Updated group with processed tags/categories
 */
groupsRouter.put("/:groupId", authMiddleware, groupHandlers.updateGroupHandler);

// --- Group Discovery and Search ---
/**
 * Search groups with optional category/tag filtering
 * @query {string} query - Search query
 * @query {string} categoryId - Optional category filter
 * @returns {Group[]} - Matching groups
 */
groupsRouter.get("/search", authMiddleware, groupHandlers.searchGroupsHandler);

/**
 * Get recent groups with filtering
 * @query {string} categoryId - Optional category filter
 * @query {number} minMemberCount - Optional minimum member count
 * @query {number} maxDistance - Optional maximum distance for location-based filtering
 * @query {number} lat - Optional latitude for location-based filtering
 * @query {number} lng - Optional longitude for location-based filtering
 * @returns {Group[]} - Recent groups matching filters
 */
groupsRouter.get(
  "/recent",
  authMiddleware,
  groupHandlers.getRecentGroupsHandler,
);

/**
 * Get nearby groups
 * @query {number} lat - Required latitude
 * @query {number} lng - Required longitude
 * @query {number} maxDistance - Optional maximum distance in kilometers
 * @query {string} categoryId - Optional category filter
 * @query {number} minMemberCount - Optional minimum member count
 * @returns {GroupWithDistance[]} - Nearby groups with distance information
 */
groupsRouter.get("/nearby", groupHandlers.getNearbyGroupsHandler);

// --- Group Details and Management ---
/**
 * Get a specific group
 * @param {string} groupId - ID of the group to fetch
 * @returns {Group} - Group details including categories (processed tags)
 */
groupsRouter.get("/:groupId", groupHandlers.getGroupHandler);

/**
 * Delete a group
 * @param {string} groupId - ID of the group to delete
 * @returns {boolean} - Success status
 */
groupsRouter.delete(
  "/:groupId",
  authMiddleware,
  groupHandlers.deleteGroupHandler,
);

/**
 * Get groups for the authenticated user
 * @returns {Group[]} - User's groups including their categories
 */
groupsRouter.get(
  "/user/me",
  authMiddleware,
  groupHandlers.getUserGroupsHandler,
);

// --- Group Membership Management ---
/**
 * Join or request to join a group
 * @param {string} groupId - ID of the group to join
 * @returns {GroupMembership} - Membership status
 */
groupsRouter.post(
  "/:groupId/join",
  authMiddleware,
  groupHandlers.joinGroupHandler,
);

/**
 * Leave a group
 * @param {string} groupId - ID of the group to leave
 * @returns {boolean} - Success status
 */
groupsRouter.post(
  "/:groupId/leave",
  authMiddleware,
  groupHandlers.leaveGroupHandler,
);

/**
 * Manage membership status (approve/reject/ban)
 * @param {string} groupId - ID of the group
 * @param {string} memberUserId - ID of the member to manage
 * @body {object} - Status and optional role update
 * @returns {GroupMembership} - Updated membership
 */
groupsRouter.post(
  "/:groupId/members/:memberUserId/status",
  authMiddleware,
  groupHandlers.manageMembershipStatusHandler,
);

/**
 * Update a member's role
 * @param {string} groupId - ID of the group
 * @param {string} memberUserId - ID of the member to update
 * @body {UpdateMemberRoleDto} - New role
 * @returns {GroupMembership} - Updated membership
 */
groupsRouter.put(
  "/:groupId/members/:memberUserId/role",
  authMiddleware,
  groupHandlers.updateMemberRoleHandler,
);

/**
 * Remove a member from a group
 * @param {string} groupId - ID of the group
 * @param {string} memberUserId - ID of the member to remove
 * @returns {boolean} - Success status
 */
groupsRouter.delete(
  "/:groupId/members/:memberUserId",
  authMiddleware,
  groupHandlers.removeMemberHandler,
);

/**
 * Get list of members for a group
 * @param {string} groupId - ID of the group
 * @query {string} status - Optional membership status filter
 * @returns {GroupMembership[]} - List of memberships
 */
groupsRouter.get("/:groupId/members", groupHandlers.getGroupMembersHandler);

// --- Group Events ---
/**
 * Get events for a specific group
 * @param {string} groupId - ID of the group
 * @query {string} query - Optional search query
 * @query {string} categoryId - Optional category filter
 * @query {string} startDate - Optional start date filter
 * @query {string} endDate - Optional end date filter
 * @returns {Event[]} - List of events
 */
groupsRouter.get("/:groupId/events", groupHandlers.getGroupEventsHandler);

// --- Public Groups List (must be last to avoid catching other routes) ---
/**
 * List public groups
 * @query {string} categoryId - Optional category filter
 * @returns {Group[]} - List of public groups
 */
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
