import type { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
import type { GooglePlacesService } from "../services/shared/GooglePlacesService";
import { z } from "zod";
import { withErrorHandling, type Handler } from "../utils/handlerUtils";

// Validation schema for place search request
const placeSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

// Validation schema for reverse geocoding request
const reverseGeocodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const searchPlace: Handler = withErrorHandling(async (c) => {
  const body = await c.req.json();

  // Validate request body
  const validationResult = placeSearchSchema.safeParse(body);
  if (!validationResult.success) {
    return c.json(
      {
        success: false,
        error: validationResult.error.errors[0].message,
      },
      400,
    );
  }

  const { query, coordinates } = validationResult.data;

  // Get the places service from context
  const placesService = c.get("placesService") as GooglePlacesService;

  // Search for the place
  const result = await placesService.searchPlaceForFrontend(
    query,
    coordinates,
  );

  // Return the result
  if (!result.success) {
    return c.json(result, 404);
  }

  return c.json(result);
});

export const searchCityState: Handler = withErrorHandling(async (c) => {
  const { query, coordinates } = await c.req.json();

  if ((!query || typeof query !== "string") && !coordinates) {
    return c.json(
      {
        success: false,
        error: "Query or coordinates must be provided",
      },
      400,
    );
  }

  const geocodingService = c.get("geocodingService") as GoogleGeocodingService;

  // When no query but coordinates provided, reverse-geocode the city
  if (
    (!query || !query.trim()) &&
    coordinates?.lat != null &&
    coordinates?.lng != null
  ) {
    const cityState = await geocodingService.reverseGeocodeCityState(
      coordinates.lat,
      coordinates.lng,
    );
    const parts = cityState.split(", ");
    return c.json({
      success: true,
      cityState: {
        city: parts[0] || cityState,
        state: parts[1] || "",
        coordinates: [coordinates.lng, coordinates.lat] as [number, number],
        formattedAddress: cityState,
        placeId: "",
      },
    });
  }

  const result = await geocodingService.searchCityState(query, coordinates);

  return c.json(result);
});

const nearbySearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(50).max(5000).optional(),
  maxResults: z.number().min(1).max(20).optional(),
});

export const searchNearbyHandler: Handler = withErrorHandling(async (c) => {
  const body = await c.req.json();
  const validationResult = nearbySearchSchema.safeParse(body);
  if (!validationResult.success) {
    return c.json(
      {
        success: false,
        error: validationResult.error.errors[0].message,
      },
      400,
    );
  }

  const { lat, lng, radius, maxResults } = validationResult.data;
  const placesService = c.get("placesService") as GooglePlacesService;

  const result = await placesService.searchNearby(
    lat,
    lng,
    radius,
    maxResults,
  );

  return c.json(result);
});

export const reverseGeocodeAddressHandler: Handler = withErrorHandling(
  async (c) => {
    const body = await c.req.json();
    const validationResult = reverseGeocodeSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        400,
      );
    }
    const { lat, lng } = validationResult.data;
    const geocodingService = c.get(
      "geocodingService",
    ) as GoogleGeocodingService;
    const result = await geocodingService.reverseGeocodeAddress(lat, lng);
    if (!result.success) {
      return c.json(result, 404);
    }
    return c.json(result);
  },
);
