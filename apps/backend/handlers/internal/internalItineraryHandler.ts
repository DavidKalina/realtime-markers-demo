import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import { withErrorHandling } from "../../utils/handlerUtils";

export const getInternalItinerariesHandler = withErrorHandling(
  async (c: Context<AppContext>) => {
    const page = Math.max(1, Number(c.req.query("page") || "1"));
    const pageSize = Math.min(
      200,
      Math.max(1, Number(c.req.query("pageSize") || "100")),
    );

    const itineraryService = c.get("itineraryService");
    const result = await itineraryService.listPublishedInternal(page, pageSize);

    return c.json(result);
  },
);
