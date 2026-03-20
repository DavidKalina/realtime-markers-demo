import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

export const getUserBadges: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const badgeService = c.get("badgeService");
  const badges = await badgeService.getUserBadges(user.id);
  return c.json(badges);
});
