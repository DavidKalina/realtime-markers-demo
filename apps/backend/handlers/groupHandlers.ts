// src/handlers/groupHandlers.ts

import type { Context } from "hono";
import type { AppContext } from "../types/context";
import dataSource from "../data-source";
import { GroupService } from "../services/GroupService";
import {
  GroupMemberRole,
  GroupMembershipStatus,
} from "../entities/GroupMembership";
import type {
  CreateGroupDto,
  UpdateGroupDto,
  UpdateMemberRoleDto,
} from "../dtos/group.dto";

// Initialize services
const groupService = new GroupService(dataSource);

// Helper function to get userId from token (assuming it's set by authMiddleware)
function getAuthenticatedUserId(c: Context<AppContext>): string {
  const user = c.get("user");
  console.log({ user });
  if (!user || !user.userId) {
    throw new Error("User not authenticated"); // Should be caught and returned as 401
  }
  return user.userId;
}

export const createGroupHandler = async (c: Context<AppContext>) => {
  try {
    const userId = getAuthenticatedUserId(c);
    const groupData = await c.req.json<CreateGroupDto>();

    if (!groupData.name) {
      return c.json({ error: "Group name is required" }, 400);
    }

    const group = await groupService.createGroup(userId, groupData);
    return c.json(group, 201);
  } catch (error) {
    console.error("Error creating group:", error);
    if (
      error instanceof Error &&
      (error.message.includes("already exists") ||
        error.message.includes("inappropriate content"))
    ) {
      return c.json({ error: error.message }, 400);
    }
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create group",
      },
      500,
    );
  }
};

export const getGroupHandler = async (c: Context<AppContext>) => {
  try {
    const groupId = c.req.param("groupId");
    const user = c.get("user");
    const userId = user?.userId; // Optional: use for private group access check

    const group = await groupService.getGroupById(groupId);

    if (!group) {
      return c.json({ error: "Group not found" }, 404);
    }

    // If group is private, check if user is a member (or implement other access logic)
    if (group.visibility === "PRIVATE") {
      if (!userId || !(await groupService.isUserMember(groupId, userId))) {
        // Optionally, you could return a limited view or a 403/404
        return c.json(
          { error: "Private group, access denied or not found" },
          403,
        );
      }
    }
    // For public view, or if user has access, return full details
    return c.json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch group",
      },
      500,
    );
  }
};

export const updateGroupHandler = async (c: Context<AppContext>) => {
  try {
    const userId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");
    const updateData = await c.req.json<UpdateGroupDto>();

    const updatedGroup = await groupService.updateGroup(
      groupId,
      userId,
      updateData,
    );
    if (!updatedGroup) {
      return c.json({ error: "Group not found or update failed" }, 404); // Or 403 if permission issue
    }
    return c.json(updatedGroup);
  } catch (error) {
    console.error("Error updating group:", error);
    if (error instanceof Error && error.message.includes("not authorized")) {
      return c.json({ error: error.message }, 403);
    }
    if (
      error instanceof Error &&
      error.message.includes("inappropriate content")
    ) {
      return c.json({ error: error.message }, 400);
    }
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update group",
      },
      500,
    );
  }
};

export const deleteGroupHandler = async (c: Context<AppContext>) => {
  try {
    const userId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");

    const success = await groupService.deleteGroup(groupId, userId);
    if (!success) {
      return c.json({ error: "Group not found or deletion failed" }, 404); // Or 403
    }
    return c.json({ message: "Group deleted successfully" }, 200);
  } catch (error) {
    console.error("Error deleting group:", error);
    if (
      error instanceof Error &&
      (error.message.includes("not authorized") ||
        error.message.includes("Only the group owner"))
    ) {
      return c.json({ error: error.message }, 403);
    }
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete group",
      },
      500,
    );
  }
};

export const listPublicGroupsHandler = async (c: Context<AppContext>) => {
  try {
    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "10");
    const direction = (c.req.query("direction") || "forward") as
      | "forward"
      | "backward";
    const categoryId = c.req.query("categoryId");

    const result = await groupService.listPublicGroups({
      cursor,
      limit,
      direction,
      categoryId,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error listing public groups:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list public groups",
      },
      500,
    );
  }
};

export const getUserGroupsHandler = async (c: Context<AppContext>) => {
  try {
    const userId = getAuthenticatedUserId(c);
    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "10");
    const direction = (c.req.query("direction") || "forward") as
      | "forward"
      | "backward";

    const result = await groupService.getUserGroups(userId, {
      cursor,
      limit,
      direction,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error listing user groups:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list user groups",
      },
      500,
    );
  }
};

export const joinGroupHandler = async (c: Context<AppContext>) => {
  try {
    const userId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");

    const membership = await groupService.joinGroup(groupId, userId);
    const message =
      membership.status === GroupMembershipStatus.PENDING
        ? "Join request sent successfully"
        : "Successfully joined group";
    return c.json(
      { message, membershipStatus: membership.status, role: membership.role },
      200,
    );
  } catch (error) {
    console.error("Error joining group:", error);
    if (
      error instanceof Error &&
      (error.message.includes("already a member") ||
        error.message.includes("banned"))
    ) {
      return c.json({ error: error.message }, 400);
    }
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to join group",
      },
      500,
    );
  }
};

export const leaveGroupHandler = async (c: Context<AppContext>) => {
  try {
    const userId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");

    const success = await groupService.leaveGroup(groupId, userId);
    if (!success) {
      return c.json({ error: "Failed to leave group or not a member" }, 400);
    }
    return c.json({ message: "Successfully left group" });
  } catch (error) {
    console.error("Error leaving group:", error);
    if (
      error instanceof Error &&
      error.message.includes("Owner cannot leave")
    ) {
      return c.json({ error: error.message }, 403);
    }
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to leave group",
      },
      500,
    );
  }
};

export const manageMembershipStatusHandler = async (c: Context<AppContext>) => {
  try {
    const adminUserId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");
    const memberUserId = c.req.param("memberUserId");
    const { status, role } = await c.req.json<{
      status:
        | GroupMembershipStatus.APPROVED
        | GroupMembershipStatus.REJECTED
        | GroupMembershipStatus.BANNED;
      role?: GroupMemberRole;
    }>();

    if (
      ![
        GroupMembershipStatus.APPROVED,
        GroupMembershipStatus.REJECTED,
        GroupMembershipStatus.BANNED,
      ].includes(status)
    ) {
      return c.json(
        {
          error:
            "Invalid status provided. Must be APPROVED, REJECTED, or BANNED.",
        },
        400,
      );
    }

    const membership = await groupService.manageMembershipStatus(
      groupId,
      memberUserId,
      adminUserId,
      status,
      role,
    );
    return c.json({
      message: `Membership status updated to ${status}`,
      membership,
    });
  } catch (error) {
    console.error("Error managing membership status:", error);
    if (error instanceof Error && error.message.includes("not authorized")) {
      return c.json({ error: error.message }, 403);
    }
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to manage membership status",
      },
      500,
    );
  }
};

export const updateMemberRoleHandler = async (c: Context<AppContext>) => {
  try {
    const adminUserId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");
    const memberUserId = c.req.param("memberUserId");
    const { role } = await c.req.json<UpdateMemberRoleDto>();

    if (!role || !Object.values(GroupMemberRole).includes(role)) {
      return c.json({ error: "Invalid role provided." }, 400);
    }

    const membership = await groupService.updateMemberRole(
      groupId,
      memberUserId,
      adminUserId,
      role,
    );
    return c.json({ message: "Member role updated successfully", membership });
  } catch (error) {
    console.error("Error updating member role:", error);
    if (
      error instanceof Error &&
      (error.message.includes("not authorized") ||
        error.message.includes("Owner role cannot be changed"))
    ) {
      return c.json({ error: error.message }, 403);
    }
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update member role",
      },
      500,
    );
  }
};

export const removeMemberHandler = async (c: Context<AppContext>) => {
  try {
    const adminUserId = getAuthenticatedUserId(c);
    const groupId = c.req.param("groupId");
    const memberUserId = c.req.param("memberUserId");

    const success = await groupService.removeMember(
      groupId,
      memberUserId,
      adminUserId,
    );
    if (!success) {
      return c.json(
        { error: "Failed to remove member or member not found" },
        400,
      );
    }
    return c.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing member:", error);
    if (
      error instanceof Error &&
      (error.message.includes("not authorized") ||
        error.message.includes("Owner cannot be removed"))
    ) {
      return c.json({ error: error.message }, 403);
    }
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to remove member",
      },
      500,
    );
  }
};

export const getGroupMembersHandler = async (c: Context<AppContext>) => {
  try {
    const groupId = c.req.param("groupId");
    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "10");
    const direction = (c.req.query("direction") || "forward") as
      | "forward"
      | "backward";
    const status = c.req.query("status") as GroupMembershipStatus | undefined;

    const result = await groupService.getGroupMembers(groupId, {
      cursor,
      limit,
      direction,
      status,
    });
    // Rename memberships to members for frontend compatibility
    return c.json({
      members: result.memberships,
      nextCursor: result.nextCursor,
      prevCursor: result.prevCursor,
    });
  } catch (error) {
    console.error("Error fetching group members:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch group members",
      },
      500,
    );
  }
};

export const searchGroupsHandler = async (c: Context<AppContext>) => {
  try {
    const query = c.req.query("query");
    if (!query) {
      return c.json({ error: "Search query is required" }, 400);
    }

    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "10");
    const direction = (c.req.query("direction") || "forward") as
      | "forward"
      | "backward";
    const categoryId = c.req.query("categoryId");

    const result = await groupService.searchGroups({
      query,
      cursor,
      limit,
      direction,
      categoryId,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error searching groups:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to search groups",
      },
      500,
    );
  }
};

export const getGroupEventsHandler = async (c: Context<AppContext>) => {
  try {
    const groupId = c.req.param("groupId");
    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "10");
    const direction = (c.req.query("direction") || "forward") as
      | "forward"
      | "backward";
    const query = c.req.query("query");
    const categoryId = c.req.query("categoryId");
    const startDate = c.req.query("startDate")
      ? new Date(c.req.query("startDate")!)
      : undefined;
    const endDate = c.req.query("endDate")
      ? new Date(c.req.query("endDate")!)
      : undefined;

    const result = await groupService.getGroupEvents(groupId, {
      cursor,
      limit,
      direction,
      query,
      categoryId,
      startDate,
      endDate,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error fetching group events:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch group events",
      },
      500,
    );
  }
};
