import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

export const updateLocationHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);

  const body = await c.req.json();
  const { lng, lat } = body;

  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return c.json({ error: "Invalid coordinates" }, 400);
  }

  const redisService = c.get("redisService");
  const geocodingService = c.get("geocodingService");

  // Reverse-geocode to city name instead of storing exact coordinates
  const cityState = await geocodingService.reverseGeocodeCityState(lat, lng);
  if (cityState) {
    await redisService.storeUserCity(user.id, cityState);
  }

  // Fire-and-forget: check for itinerary stop proximity and auto-checkin
  c.get("itineraryCheckinService")
    .checkAndNotify(user.id, lat, lng)
    .catch((err: unknown) =>
      console.error("[ItineraryCheckin] check failed:", err),
    );

  return c.json({ success: true });
});
