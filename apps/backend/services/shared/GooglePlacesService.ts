import { OpenAIModel, type OpenAIService } from "./OpenAIService";
import type { RedisService } from "./RedisService";
import type { GoogleGeocodingService } from "./GoogleGeocodingService";
import { calculateDistance } from "./geo/utils";

export interface VerifiedVenue {
  name: string;
  address: string;
  coordinates: [number, number];
  placeId: string;
  types: string[];
  rating?: number;
  userRatingsTotal?: number;
  businessStatus?: string;
  priceLevel?: string;
  /** Google Places canonical primary type code, e.g. "restaurant", "book_store". */
  primaryType?: string;
  /** Human-readable Google Places primary type display name, e.g. "Restaurant". */
  primaryTypeDisplayName?: string;
}

export class GooglePlacesService {
  private static readonly PLACES_CACHE_TTL_SECONDS = 172800; // 48 hours
  private static readonly PLACES_CACHE_PREFIX = "places-category:";
  private static readonly ENTRY_POINT_CACHE_TTL_SECONDS = 604800; // 7 days
  private static readonly ENTRY_POINT_CACHE_PREFIX = "entry-point:";
  private placesInflight = new Map<string, Promise<VerifiedVenue[]>>();
  private openAIService: OpenAIService;
  private redisService: RedisService;
  private geocodingService: GoogleGeocodingService;

  constructor(
    openAIService: OpenAIService,
    redisService: RedisService,
    geocodingService: GoogleGeocodingService,
  ) {
    this.openAIService = openAIService;
    this.redisService = redisService;
    this.geocodingService = geocodingService;
  }

  public async searchPlaces(
    query: string,
    locationContext?: string,
    userCoordinates?: { lat: number; lng: number },
    userCityState?: string,
  ): Promise<{
    coordinates: [number, number];
    formattedAddress: string;
    placeId: string;
    name: string;
    types: string[];
    rating?: number;
    userRatingsTotal?: number;
    businessStatus?: string;
    primaryType?: string;
    primaryTypeDisplayName?: string;
    locationNotes?: string;
  } | null> {
    try {
      // Only log essential information in production
      if (process.env.NODE_ENV !== "production") {
        console.log("🔍 Places API Search:", {
          query,
          locationContext,
          userCityState,
        });
      }

      // First, try to get city/state from reverse geocoding if we have coordinates
      let cityState = userCityState;
      if (!cityState && userCoordinates) {
        cityState = await this.geocodingService.reverseGeocodeCityState(
          userCoordinates.lat,
          userCoordinates.lng,
        );
      }

      // Enhance the query with city/state context if available
      let enhancedQuery = query;
      if (cityState && !query.toLowerCase().includes(cityState.toLowerCase())) {
        enhancedQuery = `${query} ${cityState}`;
      }

      // Use the newer Places API v1
      const url = "https://places.googleapis.com/v1/places:searchText";

      // Define the request body type
      interface PlacesSearchRequest {
        textQuery: string;
        locationBias?: {
          circle: {
            center: {
              latitude: number;
              longitude: number;
            };
            radius: number;
          };
        };
      }

      // Prepare the request body
      const requestBody: PlacesSearchRequest = {
        textQuery: enhancedQuery,
      };

      // Add location bias if we have coordinates
      if (userCoordinates) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: userCoordinates.lat,
              longitude: userCoordinates.lng,
            },
            radius: 5000.0, // 5km radius
          },
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_GEOCODING_API_KEY || "",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.types,places.id,places.businessStatus,places.primaryType,places.primaryTypeDisplayName",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Places API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.places || data.places.length === 0) {
        if (process.env.NODE_ENV !== "production") {
          console.log("No places found for query:", enhancedQuery);
        }
        return null;
      }

      // Use the first (most relevant) result directly
      const result = data.places[0];
      const { latitude, longitude } = result.location;
      const formattedAddress = result.formattedAddress;

      if (process.env.NODE_ENV !== "production") {
        console.log("Selected Place:", {
          name: result.displayName.text,
          address: formattedAddress,
          coordinates: [longitude, latitude],
          types: result.types,
          rating: result.rating,
          totalRatings: result.userRatingCount,
          distance: userCoordinates
            ? calculateDistance(
                userCoordinates.lat,
                userCoordinates.lng,
                latitude,
                longitude,
              ).toFixed(2) + " km"
            : undefined,
        });
      }

      // After getting the result, construct detailed location notes
      let locationNotes = "";
      if (result) {
        const details = [];

        // Always include the venue name from Places API
        if (result.displayName.text) {
          details.push(result.displayName.text);
        }

        // Add rating info only for appropriate venues (not for campus buildings)
        if (result.rating && !result.types.includes("university")) {
          details.push(
            `Rating: ${result.rating}/5${result.userRatingCount ? ` (${result.userRatingCount} reviews)` : ""}`,
          );
        }

        // Add relevant place types (cleaned up and filtered)
        if (result.types && result.types.length > 0) {
          const relevantTypes = result.types
            .filter(
              (type: string) =>
                !["point_of_interest", "establishment", "university"].includes(
                  type,
                ),
            )
            .map((type: string) => type.replace(/_/g, " ").toLowerCase())
            .slice(0, 2); // Limit to first 2 most relevant types

          if (relevantTypes.length > 0) {
            details.push(`Type: ${relevantTypes.join(", ")}`);
          }
        }

        // Add distance from user if coordinates available
        if (userCoordinates) {
          const distance = calculateDistance(
            userCoordinates.lat,
            userCoordinates.lng,
            latitude,
            longitude,
          );
          details.push(`${distance.toFixed(1)} km from user location`);
        }

        // Add the original location context if it contains additional details
        if (
          locationContext &&
          !details.some((detail) =>
            locationContext.toLowerCase().includes(detail.toLowerCase()),
          )
        ) {
          details.push(locationContext);
        }

        locationNotes = details.join(" | ");
      }

      return {
        coordinates: [longitude, latitude],
        formattedAddress,
        placeId: result.id,
        name: result.displayName.text,
        types: result.types,
        rating: result.rating,
        userRatingsTotal: result.userRatingCount,
        businessStatus: result.businessStatus,
        primaryType:
          result.primaryType ??
          result.primaryTypeDisplayName?.text ??
          undefined,
        primaryTypeDisplayName:
          result.primaryTypeDisplayName?.text ?? undefined,
        locationNotes,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Places API error:", error);
      }
      return null;
    }
  }

  public async searchPlaceForFrontend(
    query: string,
    userCoordinates?: { lat: number; lng: number },
    knownCityState?: string,
  ): Promise<{
    success: boolean;
    error?: string;
    place?: {
      name: string;
      address: string;
      coordinates: [number, number];
      placeId: string;
      types: string[];
      rating?: number;
      userRatingsTotal?: number;
      businessStatus?: string;
      primaryType?: string;
      primaryTypeDisplayName?: string;
      distance?: number;
      locationNotes?: string;
    };
  }> {
    try {
      if (!query.trim()) {
        return {
          success: false,
          error: "Search query cannot be empty",
        };
      }

      // Use provided city/state or reverse geocode if needed
      let userCityState = knownCityState || "";
      if (!userCityState && userCoordinates) {
        userCityState = await this.geocodingService.reverseGeocodeCityState(
          userCoordinates.lat,
          userCoordinates.lng,
        );
      }

      // Use the existing searchPlaces method
      const placesResult = await this.searchPlaces(
        query,
        "", // No additional location context needed
        userCoordinates,
        userCityState,
      );

      if (!placesResult) {
        return {
          success: false,
          error: "No places found matching your search",
        };
      }

      // Calculate distance if user coordinates are provided
      let distance: number | undefined;
      if (userCoordinates) {
        distance = calculateDistance(
          userCoordinates.lat,
          userCoordinates.lng,
          placesResult.coordinates[1],
          placesResult.coordinates[0],
        );
      }

      return {
        success: true,
        place: {
          name: placesResult.name,
          address: placesResult.formattedAddress,
          coordinates: placesResult.coordinates,
          placeId: placesResult.placeId,
          types: placesResult.types,
          rating: placesResult.rating,
          userRatingsTotal: placesResult.userRatingsTotal,
          businessStatus: placesResult.businessStatus,
          primaryType: placesResult.primaryType,
          distance,
          locationNotes: placesResult.locationNotes,
        },
      };
    } catch (error) {
      console.error("Error in frontend place search:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  public async searchPlacesByCategory(
    category: string,
    city: string,
    cityCenter?: { lat: number; lng: number },
    maxResults = 5,
    radiusMeters = 15000,
  ): Promise<VerifiedVenue[]> {
    try {
      // Coarser cache key — round coords to ~5km so nearby searches share results
      const cacheKey = cityCenter
        ? `${GooglePlacesService.PLACES_CACHE_PREFIX}${category.toLowerCase()}:${city.toLowerCase()}:${Math.round(cityCenter.lat * 20) / 20},${Math.round(cityCenter.lng * 20) / 20}`
        : `${GooglePlacesService.PLACES_CACHE_PREFIX}${category.toLowerCase()}:${city.toLowerCase()}`;
      const cached = await this.redisService.get<VerifiedVenue[]>(cacheKey);
      if (cached) {
        console.log(
          `[searchPlacesByCategory] Cache hit for "${category}" in ${city}`,
        );
        return cached.slice(0, maxResults);
      }

      // Dedup concurrent identical requests (3 parallel options often search the same thing)
      const inflight = this.placesInflight.get(cacheKey);
      if (inflight) {
        console.log(
          `[searchPlacesByCategory] Joining inflight request for "${category}" in ${city}`,
        );
        const result = await inflight;
        return result.slice(0, maxResults);
      }

      const fetchPromise = this.fetchPlaces(
        category,
        city,
        cityCenter,
        maxResults,
        radiusMeters,
        cacheKey,
      );
      this.placesInflight.set(cacheKey, fetchPromise);
      try {
        const result = await fetchPromise;
        return result.slice(0, maxResults);
      } finally {
        this.placesInflight.delete(cacheKey);
      }
    } catch (error) {
      console.error(
        `[searchPlacesByCategory] Error for "${category}" in ${city}:`,
        error,
      );
      return [];
    }
  }

  private async fetchPlaces(
    category: string,
    city: string,
    cityCenter: { lat: number; lng: number } | undefined,
    maxResults: number,
    radiusMeters: number,
    cacheKey: string,
  ): Promise<VerifiedVenue[]> {
    try {
      const url = "https://places.googleapis.com/v1/places:searchText";
      const looksLikeFullQuery =
        /\bnear\b/i.test(category) ||
        /\bin\b/i.test(category) ||
        /,\s*[A-Z]{2}\b/.test(category);
      const requestBody: Record<string, unknown> = {
        textQuery: looksLikeFullQuery ? category : `${category} in ${city}`,
      };
      if (cityCenter) {
        const clampedRadius = Math.min(50000, Math.max(500, radiusMeters));
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: cityCenter.lat,
              longitude: cityCenter.lng,
            },
            radius: clampedRadius,
          },
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_GEOCODING_API_KEY || "",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.id,places.businessStatus,places.priceLevel,places.primaryType,places.primaryTypeDisplayName",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error(
          `[searchPlacesByCategory] Places API failed for "${category}":`,
          response.statusText,
        );
        return [];
      }

      const data = await response.json();
      if (!data.places || data.places.length === 0) return [];

      const venues: VerifiedVenue[] = [];
      for (const place of data.places) {
        if (venues.length >= maxResults) break;

        // Skip closed businesses
        if (
          place.businessStatus === "CLOSED_PERMANENTLY" ||
          place.businessStatus === "CLOSED_TEMPORARILY"
        ) {
          continue;
        }

        venues.push({
          name: place.displayName.text,
          address: place.formattedAddress,
          coordinates: [place.location.longitude, place.location.latitude],
          placeId: place.id,
          types: place.types || [],
          rating: place.rating,
          userRatingsTotal: place.userRatingCount,
          businessStatus: place.businessStatus,
          priceLevel: place.priceLevel ?? undefined,
          primaryType:
            place.primaryType ??
            place.primaryTypeDisplayName?.text ??
            undefined,
          primaryTypeDisplayName:
            place.primaryTypeDisplayName?.text ?? undefined,
        });
      }

      // Cache results for 48 hours
      if (venues.length > 0) {
        await this.redisService.set(
          cacheKey,
          venues,
          GooglePlacesService.PLACES_CACHE_TTL_SECONDS,
        );
      }

      return venues;
    } catch (error) {
      console.error(
        `[searchPlacesByCategory] fetchPlaces error for "${category}" in ${city}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Search for a navigable entry point (trailhead, parking lot, visitor center)
   * near the given venue coordinates. Returns the closest relevant result.
   */
  public async searchEntryPoint(
    lat: number,
    lng: number,
    venueCategory: string,
  ): Promise<{
    latitude: number;
    longitude: number;
    name: string;
    placeId: string;
  } | null> {
    // Round to ~100m precision for cache key
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;
    const cacheKey = `${GooglePlacesService.ENTRY_POINT_CACHE_PREFIX}${venueCategory}:${roundedLat},${roundedLng}`;

    const cached = await this.redisService.get<{
      latitude: number;
      longitude: number;
      name: string;
      placeId: string;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Determine search terms based on venue category
    const searchTerms: string[] = [];
    switch (venueCategory) {
      case "trail":
        searchTerms.push("trailhead", "trailhead parking");
        break;
      case "park":
        searchTerms.push("parking lot", "visitor center", "park entrance");
        break;
      case "attraction":
        searchTerms.push("parking lot", "visitor entrance");
        break;
      default:
        return null;
    }

    const url = "https://places.googleapis.com/v1/places:searchText";

    for (const term of searchTerms) {
      try {
        const requestBody = {
          textQuery: term,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 3000.0, // 3km radius around the venue
            },
          },
          maxResultCount: 3,
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.GOOGLE_GEOCODING_API_KEY || "",
            "X-Goog-FieldMask":
              "places.displayName,places.location,places.id,places.businessStatus",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) continue;

        const data = await response.json();
        if (!data.places || data.places.length === 0) continue;

        // Find the closest non-closed result
        let bestPlace = null;
        let bestDistance = Infinity;

        for (const place of data.places) {
          if (
            place.businessStatus === "CLOSED_PERMANENTLY" ||
            place.businessStatus === "CLOSED_TEMPORARILY"
          ) {
            continue;
          }

          const placeLat = place.location.latitude;
          const placeLng = place.location.longitude;
          const dist = Math.sqrt(
            Math.pow(placeLat - lat, 2) + Math.pow(placeLng - lng, 2),
          );

          if (dist < bestDistance) {
            bestDistance = dist;
            bestPlace = place;
          }
        }

        if (bestPlace) {
          const result = {
            latitude: bestPlace.location.latitude,
            longitude: bestPlace.location.longitude,
            name: bestPlace.displayName.text,
            placeId: bestPlace.id,
          };
          await this.redisService.set(
            cacheKey,
            result,
            GooglePlacesService.ENTRY_POINT_CACHE_TTL_SECONDS,
          );
          return result;
        }
      } catch (error) {
        console.warn(
          `[searchEntryPoint] Error searching "${term}" near [${lat}, ${lng}]:`,
          error,
        );
      }
    }

    return null;
  }

  public async searchNearby(
    lat: number,
    lng: number,
    radius = 200,
    maxResults = 8,
  ): Promise<{
    success: boolean;
    error?: string;
    places: {
      name: string;
      address: string;
      coordinates: [number, number];
      placeId: string;
      types: string[];
      rating?: number;
      primaryType?: string;
      primaryTypeDisplayName?: string;
      distance?: number;
    }[];
  }> {
    try {
      const url = "https://places.googleapis.com/v1/places:searchNearby";
      const requestBody = {
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(Math.max(radius, 50), 5000),
          },
        },
        excludedTypes: [
          // Automotive
          "car_dealer",
          "car_rental",
          "car_repair",
          "car_wash",
          "gas_station",
          // Finance
          "accounting",
          "atm",
          "bank",
          // Health & medical
          "chiropractor",
          "dental_clinic",
          "dentist",
          "doctor",
          "drugstore",
          "hospital",
          "medical_center",
          "medical_clinic",
          "medical_lab",
          "pharmacy",
          "physiotherapist",
          // Services & contractors
          "cemetery",
          "funeral_home",
          "insurance_agency",
          "lawyer",
          "locksmith",
          "real_estate_agency",
          "plumber",
          "electrician",
          "roofing_contractor",
          "moving_company",
          "storage",
          "painter",
          "consultant",
          "marketing_consultant",
          "courier_service",
          "shipping_service",
          "telecommunications_service_provider",
          "employment_agency",
          "child_care_agency",
          // Government
          "courthouse",
          "post_office",
          "fire_station",
          "police",
          // Education (schools, not libraries)
          "preschool",
          "primary_school",
          "secondary_school",
          // Transportation
          "bus_station",
          "bus_stop",
          // Housing
          "apartment_complex",
        ],
        maxResultCount: Math.min(maxResults, 20),
        rankPreference: "DISTANCE",
      };

      console.log(
        "[searchNearby] Request:",
        JSON.stringify({
          lat,
          lng,
          radius: requestBody.locationRestriction.circle.radius,
          maxResultCount: requestBody.maxResultCount,
          excludedTypesCount: requestBody.excludedTypes.length,
        }),
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_GEOCODING_API_KEY || "",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.types,places.id,places.primaryType,places.primaryTypeDisplayName",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          "[searchNearby] Places API failed:",
          response.status,
          response.statusText,
          errorBody,
        );
        return {
          success: false,
          error: "Places API request failed",
          places: [],
        };
      }

      const data = await response.json();
      console.log(
        "[searchNearby] Response:",
        JSON.stringify({
          placesCount: data.places?.length ?? 0,
          firstPlace: data.places?.[0]?.displayName?.text,
          error: data.error,
        }),
      );

      if (!data.places || data.places.length === 0) {
        return { success: true, places: [] };
      }

      // Table B types we can't exclude via the API but don't want to show.
      // These are checked against a place's *primary* type only, since generic
      // Table B labels like "establishment" appear on nearly everything.
      const EXCLUDED_PRIMARY_TYPES = new Set([
        "general_contractor",
        "corporate_office",
        "business_center",
        "supplier",
        "manufacturer",
        "farm",
        "ranch",
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const places = data.places
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((place: any) => {
          const primary = place.primaryType ?? place.types?.[0] ?? "";
          return !EXCLUDED_PRIMARY_TYPES.has(primary);
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((place: any) => {
          const pLat = place.location?.latitude ?? 0;
          const pLng = place.location?.longitude ?? 0;
          // Haversine distance in meters
          const R = 6371000;
          const dLat = ((pLat - lat) * Math.PI) / 180;
          const dLng = ((pLng - lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) *
              Math.cos((pLat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          return {
            name: place.displayName?.text ?? "",
            address: place.formattedAddress ?? "",
            coordinates: [pLng, pLat] as [number, number],
            placeId: place.id ?? "",
            types: place.types ?? [],
            rating: place.rating ?? undefined,
            primaryType:
              place.primaryType ??
              place.primaryTypeDisplayName?.text ??
              undefined,
            primaryTypeDisplayName:
              place.primaryTypeDisplayName?.text ?? undefined,
            distance: Math.round(dist),
          };
        });

      // Use a fast LLM to filter out places that aren't relevant for an
      // adventure / outing app (e.g. landscapers, contractors, offices).
      const filtered = await this.filterPlacesWithLLM(places);

      return { success: true, places: filtered };
    } catch (error) {
      console.error("[searchNearby] Error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        places: [],
      };
    }
  }

  /**
   * Use GPT-4o-mini to filter nearby places to only those relevant for
   * a personal adventure / "touch grass" app. Falls back to the unfiltered
   * list if the LLM call fails.
   */
  private async filterPlacesWithLLM(
    places: {
      name: string;
      address: string;
      coordinates: [number, number];
      placeId: string;
      types: string[];
      rating?: number;
      primaryType?: string;
      primaryTypeDisplayName?: string;
      distance?: number;
    }[],
  ): Promise<typeof places> {
    if (places.length === 0) return places;

    try {
      const placeList = places
        .map(
          (p, i) =>
            `${i}: "${p.name}" (${p.primaryType ?? p.types[0] ?? "unknown"})`,
        )
        .join("\n");

      const completion = await this.openAIService.executeChatCompletion(
        {
          model: OpenAIModel.GPT4OMini,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You filter places for a personal adventure app. Keep places someone would actually visit for fun, food, culture, fitness, nature, entertainment, or community. Remove service businesses (contractors, landscapers, cleaners, accountants, etc.), offices, and anything you wouldn\'t suggest as an outing destination. Return JSON: {"keep":[0,2,5]} with the indices to keep.',
            },
            {
              role: "user",
              content: placeList,
            },
          ],
        },
        "searchNearby-filter",
      );

      const content = completion.choices[0]?.message?.content;
      if (!content) return places;

      const parsed = JSON.parse(content) as { keep: number[] };
      if (!Array.isArray(parsed.keep)) return places;

      const kept = parsed.keep
        .filter((i) => typeof i === "number" && i >= 0 && i < places.length)
        .map((i) => places[i]);

      return kept.length > 0 ? kept : places;
    } catch (error) {
      console.warn(
        "[searchNearby] LLM filter failed, returning unfiltered:",
        error,
      );
      return places;
    }
  }
}
