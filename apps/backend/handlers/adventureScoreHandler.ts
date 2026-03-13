import type { Context } from "hono";
import type { AppContext } from "../types/context";

export const getAdventureScore = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const userId = user.userId || user.id;
  const adventureScoreService = c.get("adventureScoreService");

  try {
    const score = await adventureScoreService.getScore(userId);
    return c.json(score);
  } catch (error) {
    console.error("Error fetching adventure score:", error);
    return c.json({ error: "Failed to fetch adventure score" }, 500);
  }
};
