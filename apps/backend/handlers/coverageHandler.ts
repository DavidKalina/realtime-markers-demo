import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { CoverageService } from "../services/CoverageService";

export const getCoverageHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const coverageService = c.get("coverageService") as CoverageService;
  const summary = await coverageService.getCoverageSummary(user.id);
  return c.json(summary);
});
