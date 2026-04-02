import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { PathwayService } from "../services/PathwayService";

export const getPathways: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const pathwayService = c.get("pathwayService") as PathwayService;
  const phaseContext = await pathwayService.getUserPhaseContext(user.id);
  return c.json(phaseContext);
});
