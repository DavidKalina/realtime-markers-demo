import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

export const suggestSidequestsHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);

    const { latitude, longitude } = await c.req.json<{
      latitude: number;
      longitude: number;
    }>();

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return c.json({ error: "Invalid coordinates" }, 400);
    }

    const sidequestService = c.get("sidequestService");
    const result = await sidequestService.generateSuggestions(
      latitude,
      longitude,
    );

    return c.json(result);
  },
);
