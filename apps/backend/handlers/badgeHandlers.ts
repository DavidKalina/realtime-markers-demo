import type { Context } from "hono";
import type { AppContext } from "../types/context";

export const getUserBadges = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const userId = user.userId || user.id;
  const badgeService = c.get("badgeService");

  try {
    const badges = await badgeService.getUserBadges(userId);
    return c.json(badges);
  } catch (error) {
    console.error("Error fetching user badges:", error);
    return c.json({ error: "Failed to fetch badges" }, 500);
  }
};
