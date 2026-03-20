import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

export const getAdventureScore: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const adventureScoreService = c.get("adventureScoreService");
  const score = await adventureScoreService.getScore(user.id);
  return c.json(score);
});
