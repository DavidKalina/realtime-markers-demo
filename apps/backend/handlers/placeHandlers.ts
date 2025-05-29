import type { Context } from "hono";
import { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
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

    // Get the geocoding service instance
    const geocodingService = GoogleGeocodingService.getInstance();

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

    if (!query || typeof query !== "string") {
      return c.json(
        {
          success: false,
          error: "Query parameter is required and must be a string",
        },
        400,
      );
    }

    const geocodingService = GoogleGeocodingService.getInstance();
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
