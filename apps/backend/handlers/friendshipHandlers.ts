// handlers/friendshipHandlers.ts

import type { Context } from "hono";
import { FriendshipService } from "../services/FriendshipService";

export type FriendshipHandler = (c: Context) => Promise<Response>;

export const sendFriendRequestHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const { addresseeId } = await c.req.json();
    if (!addresseeId) {
      return c.json({ error: "Addressee ID is required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const friendship = await friendshipService.sendFriendRequest(
      user.userId,
      addresseeId,
    );

    return c.json(friendship);
  } catch (error) {
    console.error("Error sending friend request:", error);
    return c.json(
      {
        error: "Failed to send friend request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const sendFriendRequestByCodeHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const { friendCode } = await c.req.json();
    if (!friendCode) {
      return c.json({ error: "Friend code is required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const friendship = await friendshipService.sendFriendRequestByCode(
      user.userId,
      friendCode,
    );

    return c.json(friendship);
  } catch (error) {
    console.error("Error sending friend request by code:", error);
    return c.json(
      {
        error: "Failed to send friend request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const sendFriendRequestByUsernameHandler: FriendshipHandler = async (
  c,
) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const { username } = await c.req.json();
    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const friendship = await friendshipService.sendFriendRequestByUsername(
      user.userId,
      username,
    );

    return c.json(friendship);
  } catch (error) {
    console.error("Error sending friend request by username:", error);
    return c.json(
      {
        error: "Failed to send friend request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const acceptFriendRequestHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipId = c.req.param("id");
    if (!friendshipId) {
      return c.json({ error: "Friendship ID is required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const friendship = await friendshipService.acceptFriendRequest(
      friendshipId,
      user.userId,
    );

    return c.json(friendship);
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return c.json(
      {
        error: "Failed to accept friend request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const rejectFriendRequestHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipId = c.req.param("id");
    if (!friendshipId) {
      return c.json({ error: "Friendship ID is required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const friendship = await friendshipService.rejectFriendRequest(
      friendshipId,
      user.userId,
    );

    return c.json(friendship);
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    return c.json(
      {
        error: "Failed to reject friend request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getFriendsHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipService = c.get("friendshipService");
    const friends = await friendshipService.getFriends(user.userId);

    return c.json(friends);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return c.json(
      {
        error: "Failed to fetch friends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getPendingFriendRequestsHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipService = c.get("friendshipService");
    const pendingRequests = await friendshipService.getPendingFriendRequests(
      user.userId,
    );

    return c.json(pendingRequests);
  } catch (error) {
    console.error("Error fetching pending friend requests:", error);
    return c.json(
      {
        error: "Failed to fetch pending friend requests",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getOutgoingFriendRequestsHandler: FriendshipHandler = async (
  c,
) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipService = c.get("friendshipService");
    const outgoingRequests = await friendshipService.getOutgoingFriendRequests(
      user.userId,
    );

    return c.json(outgoingRequests);
  } catch (error) {
    console.error("Error fetching outgoing friend requests:", error);
    return c.json(
      {
        error: "Failed to fetch outgoing friend requests",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const cancelFriendRequestHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipId = c.req.param("id");
    if (!friendshipId) {
      return c.json({ error: "Friendship ID is required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const friendship = await friendshipService.cancelFriendRequest(
      friendshipId,
      user.userId,
    );

    return c.json(friendship);
  } catch (error) {
    console.error("Error canceling friend request:", error);
    return c.json(
      {
        error: "Failed to cancel friend request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const updateContactsHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const { contacts } = await c.req.json();
    if (!contacts) {
      return c.json({ error: "Contacts are required" }, 400);
    }

    const friendshipService = c.get("friendshipService");
    const updatedUser = await friendshipService.updateContacts(
      user.userId,
      contacts,
    );

    return c.json(updatedUser);
  } catch (error) {
    console.error("Error updating contacts:", error);
    return c.json(
      {
        error: "Failed to update contacts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const findPotentialFriendsHandler: FriendshipHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const friendshipService = c.get("friendshipService");
    const potentialFriends =
      await friendshipService.findPotentialFriendsFromContacts(user.userId);

    return c.json(potentialFriends);
  } catch (error) {
    console.error("Error finding potential friends:", error);
    return c.json(
      {
        error: "Failed to find potential friends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
