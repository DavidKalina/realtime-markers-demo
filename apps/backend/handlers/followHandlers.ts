import type { Context } from "hono";
import type { AppContext } from "../types/context";
import {
  withErrorHandling,
  requireAuth,
  requireParam,
} from "../utils/handlerUtils";
import { ValidationError } from "../utils/errors";

export const toggleFollowHandler = withErrorHandling(
  async (c: Context<AppContext>) => {
    const user = requireAuth(c);
    const targetUserId = requireParam(c, "userId");
    const followService = c.get("followService");

    if (user.id === targetUserId) {
      throw new ValidationError("Cannot follow yourself");
    }

    const result = await followService.toggleFollow(user.id, targetUserId);
    return c.json(result);
  },
);

export const isFollowingHandler = withErrorHandling(
  async (c: Context<AppContext>) => {
    const user = requireAuth(c);
    const targetUserId = requireParam(c, "userId");
    const followService = c.get("followService");

    const following = await followService.isFollowing(user.id, targetUserId);
    return c.json({ following });
  },
);

export const getFollowersHandler = withErrorHandling(
  async (c: Context<AppContext>) => {
    const targetUserId = requireParam(c, "userId");
    const followService = c.get("followService");

    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!)
      : undefined;
    const cursor = c.req.query("cursor") || undefined;

    const result = await followService.getFollowers(targetUserId, {
      limit,
      cursor,
    });
    return c.json(result);
  },
);

export const getFollowingHandler = withErrorHandling(
  async (c: Context<AppContext>) => {
    const targetUserId = requireParam(c, "userId");
    const followService = c.get("followService");

    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!)
      : undefined;
    const cursor = c.req.query("cursor") || undefined;

    const result = await followService.getFollowing(targetUserId, {
      limit,
      cursor,
    });
    return c.json(result);
  },
);
