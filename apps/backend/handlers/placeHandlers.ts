import type { Context } from "hono";
import type { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
import { z } from "zod";
import type { AppContext } from "../types/context";

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

export const searchPlace = async (c: Context<AppContext>) => {
  try {
    console.log("🔍 Places Search Request:", {
      method: c.req.method,
      path: c.req.path,
      headers: {
        authorization: c.req.header("authorization"),
        "content-type": c.req.header("content-type"),
      },
      timestamp: new Date().toISOString(),
    });

    const body = await c.req.json();
    console.log("🔍 Places Search Body:", body);

    // Validate request body
    const validationResult = placeSearchSchema.safeParse(body);
    if (!validationResult.success) {
      console.log(
        "🔍 Places Search Validation Failed:",
        validationResult.error.errors,
      );
      return c.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        400,
      );
    }

    const { query, coordinates } = validationResult.data;
    console.log("🔍 Places Search Validated Input:", { query, coordinates });

    // Get the geocoding service from context
    const geocodingService = c.get(
      "geocodingService",
    ) as GoogleGeocodingService;

    // Search for the place
    const result = await geocodingService.searchPlaceForFrontend(
      query,
      coordinates,
    );

    console.log("🔍 Places Search Result:", {
      success: result.success,
      error: result.error,
      hasPlace: !!result.place,
      timestamp: new Date().toISOString(),
    });

    // Return the result
    if (!result.success) {
      return c.json(result, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error("Error in place search handler:", error);
    return c.json(
      {
        success: false,
        error: "Internal server error occurred while searching for place",
      },
      500,
    );
  }
};

export async function searchCityState(c: Context<AppContext>) {
  try {
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

    const geocodingService = c.get(
      "geocodingService",
    ) as GoogleGeocodingService;

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
  } catch (error) {
    console.error("Error in searchCityState handler:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      500,
    );
  }
}

const nearbySearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(50).max(5000).optional(),
  maxResults: z.number().min(1).max(20).optional(),
});

export const searchNearbyHandler = async (c: Context<AppContext>) => {
  try {
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
    const geocodingService = c.get(
      "geocodingService",
    ) as GoogleGeocodingService;

    const result = await geocodingService.searchNearby(
      lat,
      lng,
      radius,
      maxResults,
    );

    return c.json(result);
  } catch (error) {
    console.error("Error in nearby search handler:", error);
    return c.json(
      {
        success: false,
        error: "Internal server error occurred while searching nearby",
        places: [],
      },
      500,
    );
  }
};

export const reverseGeocodeAddressHandler = async (c: Context<AppContext>) => {
  try {
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
  } catch (error) {
    console.error("Error in reverse geocode handler:", error);
    return c.json(
      {
        success: false,
        error: "Internal server error occurred while reverse geocoding",
      },
      500,
    );
  }
};
