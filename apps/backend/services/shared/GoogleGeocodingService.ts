import { createHash } from "crypto";
import { find } from "geo-tz";
import { OpenAIModel, type OpenAIService } from "./OpenAIService";
import type { Point } from "geojson";
import type { LocationResolutionResult } from "../event-processing/dto/LocationResolutionResult";
import type { ILocationResolutionService } from "../event-processing/interfaces/ILocationResolutionService";

interface CachedLocation {
  cluesHash: string;
  address: string;
  coordinates: [number, number];
  timestamp: number;
  confidence: number;
  timezone?: string;
  locationNotes?: string;
}

export interface GoogleGeocodingService extends ILocationResolutionService {
  getTimezoneFromCoordinates(lat: number, lng: number): Promise<string>;
  resolveLocation(
    locationClues: string[],
    userContext?: {
      cityState?: string;
      coordinates?: { lat: number; lng: number };
    },
  ): Promise<LocationResolutionResult>;
  geocodeAddress(address: string): Promise<[number, number]>;
  reverseGeocodeCityState(lat: number, lng: number): Promise<string>;
  getTimezone(lat: number, lng: number): Promise<string>;
  searchPlaceForFrontend(
    query: string,
    userCoordinates?: { lat: number; lng: number },
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
      distance?: number;
      locationNotes?: string;
    };
  }>;
  searchCityState(
    query: string,
    userCoordinates?: { lat: number; lng: number },
  ): Promise<{
    success: boolean;
    error?: string;
    cityState?: {
      city: string;
      state: string;
      coordinates: [number, number];
      formattedAddress: string;
      placeId: string;
      distance?: number;
    };
  }>;
  reverseGeocodeAddress(
    lat: number,
    lng: number,
  ): Promise<{
    success: boolean;
    error?: string;
    address?: {
      formattedAddress: string;
      addressComponents: {
        streetNumber?: string;
        streetName?: string;
        city?: string;
        state?: string;
        zipCode?: string;
      };
      placeId: string;
      locationType: string;
      partialMatch: boolean;
      coordinates: [number, number];
    };
  }>;
}

export class GoogleGeocodingServiceImpl implements GoogleGeocodingService {
  private locationCache: Map<string, CachedLocation> = new Map();
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private openAIService: OpenAIService;

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
    // We use the Geocoding API key for both Geocoding and Places APIs
    if (!process.env.GOOGLE_GEOCODING_API_KEY) {
      throw new Error(
        "GOOGLE_GEOCODING_API_KEY environment variable is required for geocoding functionality. This should be a key with both Geocoding and Places APIs enabled.",
      );
    }
    console.log("=== Google Geocoding Service Initialization ===");
    console.log(
      "GOOGLE_GEOCODING_API_KEY exists:",
      !!process.env.GOOGLE_GEOCODING_API_KEY,
    );
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("=============================================");
  }

  public async getTimezoneFromCoordinates(
    lat: number,
    lng: number,
  ): Promise<string> {
    try {
      const timezones = find(lat, lng);
      return timezones.length > 0 ? timezones[0] : "UTC";
    } catch (error) {
      console.error("Error getting timezone from coordinates:", error);
      return "UTC";
    }
  }

  private generateCluesFingerprint(
    clues: string[],
    userLocation?: string,
  ): string {
    const normalizedClues = clues
      .filter(Boolean)
      .map((clue) => clue.toLowerCase().trim())
      .sort()
      .join("|");

    const fingerprint = userLocation
      ? `${normalizedClues}|${userLocation}`
      : normalizedClues;
    return createHash("md5").update(fingerprint).digest("hex");
  }

  private validateCoordinates(coordinates: [number, number]): boolean {
    return (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number" &&
      coordinates[0] >= -180 &&
      coordinates[0] <= 180 &&
      coordinates[1] >= -90 &&
      coordinates[1] <= 90
    );
  }

  private async verifyLocationWithReverseGeocoding(
    coordinates: [number, number],
    expectedAddress: string,
  ): Promise<boolean> {
    try {
      const data = await this.makeGeocodingRequest(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates[1]},${coordinates[0]}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`,
      );

      if (!data.results || data.results.length === 0) return false;

      const reverseGeocodedAddress = data.results[0].formatted_address;
      const similarity = this.calculateStringSimilarity(
        expectedAddress.toLowerCase(),
        reverseGeocodedAddress.toLowerCase(),
      );

      return similarity > 0.7; // 70% similarity threshold
    } catch (error) {
      console.error("Error in reverse geocoding verification:", error);
      return false;
    }
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private async searchPlaces(
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
        cityState = await this.reverseGeocodeCityState(
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
            "places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.id",
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
            ? this.calculateDistance(
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
          const distance = this.calculateDistance(
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
        locationNotes,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Places API error:", error);
      }
      return null;
    }
  }

  // Calculate distance between two points using the Haversine formula
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public async resolveLocation(
    locationClues: string[],
    userContext?: {
      cityState?: string;
      coordinates?: { lat: number; lng: number };
    },
  ): Promise<LocationResolutionResult> {
    try {
      // First try to get user's city and state if coordinates are provided but city/state is not
      let userCityState = userContext?.cityState || "";

      if (!userCityState && userContext?.coordinates) {
        userCityState = await this.reverseGeocodeCityState(
          userContext.coordinates.lat,
          userContext.coordinates.lng,
        );
      }

      // Filter out empty clues and normalize
      const validClues = locationClues
        .filter(Boolean)
        .map((clue) => clue.trim());

      // Delegate to the existing resolveLocation method
      const resolvedLocation = await this.resolveLocationInternal(
        validClues,
        userCityState,
        userContext?.coordinates,
      );

      // Create a proper GeoJSON Point
      const point: Point = {
        type: "Point",
        coordinates: resolvedLocation.coordinates,
      };

      return {
        address: resolvedLocation.address,
        coordinates: point,
        confidence: resolvedLocation.confidence,
        timezone: resolvedLocation.timezone,
        resolvedAt: new Date().toISOString(),
        locationNotes: resolvedLocation.locationNotes,
      };
    } catch (error) {
      console.error("Error resolving location:", error);

      // Return a default value centered on UTC timezone in case of error
      const defaultPoint: Point = {
        type: "Point",
        coordinates: [0, 0],
      };

      return {
        address: "",
        coordinates: defaultPoint,
        confidence: 0,
        timezone: "UTC",
        resolvedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown error resolving location",
        locationNotes: "",
      };
    }
  }

  private async resolveLocationInternal(
    clues: string[],
    userCityState: string,
    userCoordinates?: { lat: number; lng: number },
  ): Promise<{
    address: string;
    coordinates: [number, number];
    confidence: number;
    timezone: string;
    locationNotes?: string;
  }> {
    console.warn("\n🔍🔍🔍 LOCATION RESOLUTION START 🔍🔍🔍");
    console.warn("Input Clues:", clues);
    console.warn("User City/State:", userCityState);
    console.warn("User Coordinates:", userCoordinates);

    const cluesFingerprint = this.generateCluesFingerprint(
      clues,
      userCityState,
    );

    const cachedLocation = this.locationCache.get(cluesFingerprint);
    if (
      cachedLocation &&
      Date.now() - cachedLocation.timestamp < this.CACHE_EXPIRY
    ) {
      console.warn("📍 Using cached location:", cachedLocation);
      return {
        address: cachedLocation.address,
        coordinates: cachedLocation.coordinates,
        confidence: cachedLocation.confidence,
        timezone: cachedLocation.timezone || "UTC",
        locationNotes: cachedLocation.locationNotes,
      };
    }

    const uniqueClues = [...new Set(clues.filter(Boolean))];
    if (uniqueClues.length === 0) {
      throw new Error("No location clues provided");
    }

    const cluesText = uniqueClues.join(" | ");
    console.warn("🔍 Processed Clues:", cluesText);

    try {
      console.warn("\n🤖 Querying LLM for location analysis...");
      const response = await this.openAIService.executeChatCompletion({
        model: "gpt-4o" as OpenAIModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a location analysis expert working with Google's Geocoding and Places APIs. Extract location information that will be used to query these APIs.

KEY INSTRUCTIONS:
1. PRIORITIZE EXPLICIT VENUES OVER ORGANIZATIONS:
   - If both a venue (e.g., "Provo Airport") and an organization (e.g., "UVU Career Center") are present, the VENUE is the location
   - Recognize venue types vs. organization names based on context and common knowledge
   - For known venue types like airports, the exact venue name should be the primary search query

2. For campus buildings and specific rooms:
   - Extract specific building names (e.g., "Sorensen Center")
   - Extract specific room/area names (e.g., "Grande Ballroom", "Room 101")
   - Prioritize these details in the Places API query
   - Example: "Grande Ballroom Sorensen Center" is better than just "UVU Campus"

3. For ambiguous city names (like Washington, Springfield, etc):
   - Look for state context in the full text
   - Check phone area codes (e.g., 435 is Utah)
   - Use landmarks or business names as context
   - If a city could be confused with a state/DC, explicitly add the state

4. When extracting addresses:
   - Must include street number, street name, city, and state
   - Always use full state names or standard 2-letter codes (UT not Ut.)
   - For cities that share names with states/DC, always add the state
   - Format: "Street number + Street name, City, State ZIP"

5. If no complete address is found:
   - Extract business names, landmarks, and cross-streets
   - Include city and state when known
   - Note any phone area codes as they help confirm state

6. SPECIAL HANDLING FOR NOTABLE VENUES:
   - For well-known locations, use the exact venue name as the primary query
   - When the venue is a landmark, prioritize the landmark name in the query
   - Do not add organization names to venue queries unless the organization IS the venue

7. Places API Analysis:
   - Look for business names, landmarks, or points of interest
   - Consider if the location is likely to be in Google's Places database
   - Note if the location is a business, venue, or landmark
   - When constructing Places API queries:
     * For specific venues, use ONLY the venue name first
     * Start with the most specific identifier (room/area + building name)
     * Add city and state for context
     * Include any distinguishing features (e.g., "downtown", "north side")
     * Keep queries concise but specific
     * If user coordinates are provided:
       - Focus on finding places near the user's location
       - Include neighborhood/area context if known
       - Prioritize exact matches over general searches

8. RESPONSE FORMAT:
   You MUST respond with a valid JSON object in this exact format:
   {
     "address": "complete address if found, or empty string",
     "locationNotes": "additional location context, or empty string",
     "confidence": number between 0 and 1,
     "shouldTryPlacesApi": boolean indicating if we should try Places API,
     "placesQuery": "query string for Places API if shouldTryPlacesApi is true",
     "placesQueryContext": {
       "isNotableVenue": boolean indicating if this is a well-known venue like an airport or stadium,
       "buildingName": "specific building name if found",
       "roomArea": "specific room/area if found",
       "businessType": "type of business/venue if applicable",
       "area": "specific area/neighborhood if known",
       "city": "city name if known",
       "state": "state name if known",
       "isNearUser": boolean indicating if this is likely near user coordinates
     }
   }

USER CONTEXT:
${userCityState ? `User is in ${userCityState}.` : userCoordinates ? `User coordinates: ${userCoordinates.lat.toFixed(5)},${userCoordinates.lng.toFixed(5)}` : ""}`,
          },
          {
            role: "user",
            content: `LOCATION CLUES: ${cluesText}`,
          },
        ],
        max_tokens: 150,
      });

      console.warn("LLM Response:", response.choices[0].message.content);

      let result;
      try {
        result = JSON.parse(response.choices[0].message.content || "{}");
      } catch (error) {
        console.warn(
          "Failed to parse LLM response as JSON, attempting to extract address from text",
        );
        const content = response.choices[0].message.content || "";
        const addressMatch =
          content.match(/EXTRACTED LOCATION:\s*(.+)/i) ||
          content.match(/ADDRESS:\s*(.+)/i) ||
          content.match(/(\d+.*?,\s*[A-Za-z\s]+,\s*[A-Z]{2})/);

        if (addressMatch) {
          result = {
            address: addressMatch[1].trim(),
            locationNotes: "",
            confidence: 0.8,
            shouldTryPlacesApi: false,
            placesQuery: "",
            placesQueryContext: {},
          };
        } else {
          throw new Error("Could not extract address from LLM response");
        }
      }

      const address = result.address === "NO_ADDRESS" ? "" : result.address;
      let locationNotes = result.locationNotes || "";
      let confidence = result.confidence || 0;
      const shouldTryPlacesApi = result.shouldTryPlacesApi || false;
      const placesQuery = result.placesQuery || "";
      const placesQueryContext = result.placesQueryContext || {};

      let coordinates: [number, number];
      let formattedAddress = address;

      if (address) {
        // Step 1: Try complete address first
        console.log("\nTrying to resolve address:", address);
        const geocodeResult = await this.geocodeAddressInternal(address);
        coordinates = geocodeResult.coordinates;
        formattedAddress = geocodeResult.formattedAddress;

        if (!this.validateCoordinates(coordinates)) {
          throw new Error("Invalid coordinates obtained from geocoding");
        }

        const reverseGeocodingVerified =
          await this.verifyLocationWithReverseGeocoding(
            coordinates,
            formattedAddress,
          );
        confidence = 0.5 + (reverseGeocodingVerified ? 0.3 : 0);
        console.log(
          "Reverse Geocoding Verification:",
          reverseGeocodingVerified ? "Passed" : "Failed",
        );
      } else if (shouldTryPlacesApi && placesQuery) {
        // Step 2: Try Places API with user location context
        console.log("\nTrying Places API with query:", placesQuery);
        // Construct a more specific query using context
        const isNotableVenue =
          result.placesQueryContext?.isNotableVenue || false;

        // Construct the Places API query based on context
        let enhancedQuery = "";

        // For notable venues like airports, use the venue name directly
        if (isNotableVenue && placesQuery) {
          enhancedQuery = placesQuery; // Use the exact placesQuery provided by the LLM
          console.log("Using notable venue query:", enhancedQuery);
        } else if (
          placesQueryContext.roomArea &&
          placesQueryContext.buildingName
        ) {
          enhancedQuery = `${placesQueryContext.roomArea} ${placesQueryContext.buildingName}`;
        } else if (placesQueryContext.buildingName) {
          enhancedQuery = placesQueryContext.buildingName;
        } else {
          enhancedQuery = placesQuery;
        }

        // Add area context if available and not redundant
        if (
          placesQueryContext.area &&
          !enhancedQuery
            .toLowerCase()
            .includes(placesQueryContext.area.toLowerCase())
        ) {
          enhancedQuery += ` ${placesQueryContext.area}`;
        }

        // Always add city and state from user context if available
        if (userCityState) {
          const [city, state] = userCityState.split(",").map((s) => s.trim());
          if (
            city &&
            !enhancedQuery.toLowerCase().includes(city.toLowerCase())
          ) {
            enhancedQuery += ` ${city}`;
          }
          if (
            state &&
            !enhancedQuery.toLowerCase().includes(state.toLowerCase())
          ) {
            enhancedQuery += ` ${state}`;
          }
        }

        const skipCityState =
          isNotableVenue &&
          (enhancedQuery
            .toLowerCase()
            .includes(placesQueryContext.city?.toLowerCase() || "") ||
            enhancedQuery
              .toLowerCase()
              .includes(placesQueryContext.state?.toLowerCase() || ""));

        // Add city/state if needed
        if (!skipCityState) {
          if (
            placesQueryContext.city &&
            !enhancedQuery
              .toLowerCase()
              .includes(placesQueryContext.city.toLowerCase())
          ) {
            enhancedQuery += ` ${placesQueryContext.city}`;
          }
          if (
            placesQueryContext.state &&
            !enhancedQuery
              .toLowerCase()
              .includes(placesQueryContext.state.toLowerCase())
          ) {
            enhancedQuery += ` ${placesQueryContext.state}`;
          }
        }

        console.log("Enhanced Places Query:", enhancedQuery);
        const placesResult = await this.searchPlaces(
          enhancedQuery,
          locationNotes,
          userCoordinates,
          userCityState,
        );

        if (placesResult) {
          coordinates = placesResult.coordinates;
          formattedAddress = placesResult.formattedAddress;
          // Use the Places API generated location notes instead of LLM notes
          locationNotes = placesResult.locationNotes || locationNotes;

          // Adjust confidence based on distance from user if coordinates available
          if (userCoordinates) {
            const distance = this.calculateDistance(
              userCoordinates.lat,
              userCoordinates.lng,
              coordinates[1],
              coordinates[0],
            );
            // Higher confidence for places closer to user
            confidence = 0.6 + (distance < 1 ? 0.2 : distance < 5 ? 0.1 : 0);
            console.log("Distance from user:", distance.toFixed(2), "km");
          } else {
            confidence = 0.6;
          }
          console.log("Places API Resolution:", placesResult.name);
        } else {
          throw new Error("No places found matching the query");
        }
      } else if (locationNotes) {
        // Step 3: Try general geocoding with location notes
        console.log("\nTrying to resolve from location notes:", locationNotes);
        const geocodeResult = await this.geocodeAddressInternal(locationNotes);
        coordinates = geocodeResult.coordinates;
        formattedAddress = geocodeResult.formattedAddress;

        if (!this.validateCoordinates(coordinates)) {
          throw new Error("Invalid coordinates obtained from geocoding");
        }

        confidence = 0.4;
      } else {
        throw new Error(
          "Cannot determine event location: No address or location information available",
        );
      }

      const timezone = await this.getTimezoneFromCoordinates(
        coordinates[1],
        coordinates[0],
      );

      this.locationCache.set(cluesFingerprint, {
        cluesHash: cluesFingerprint,
        address: formattedAddress,
        coordinates,
        timestamp: Date.now(),
        confidence,
        timezone,
        locationNotes,
      });

      return {
        address: formattedAddress,
        coordinates,
        confidence,
        timezone,
        locationNotes,
      };
    } catch (error) {
      console.error("Error in location resolution:", error);
      throw error;
    }
  }

  private async makeGeocodingRequest(url: string) {
    if (!process.env.GOOGLE_GEOCODING_API_KEY) {
      throw new Error("Geocoding API key is required for geocoding requests");
    }

    const response = await fetch(url);
    console.log("Response status:", response.status);
    console.log("Response status text:", response.statusText);

    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
    console.log("=== End Request ===\n");

    if (!response.ok) {
      throw new Error(`Geocoding API request failed: ${response.statusText}`);
    }

    if (data.status === "REQUEST_DENIED") {
      console.error("Geocoding API request denied. Full response:", data);
      throw new Error(`Geocoding API request denied: ${data.error_message}`);
    }

    return data;
  }

  public async geocodeAddress(address: string): Promise<[number, number]> {
    if (!address.trim()) {
      // Return default coordinates (0,0) for empty address
      return [0, 0];
    }

    try {
      const result = await this.geocodeAddressInternal(address);
      return result.coordinates;
    } catch (error) {
      console.error("Geocoding error:", error);
      // Return default coordinates in case of error
      return [0, 0];
    }
  }

  // Rename the existing geocodeAddress method to geocodeAddressInternal
  private async geocodeAddressInternal(
    query: string,
    locationContext?: string,
  ): Promise<{
    coordinates: [number, number];
    formattedAddress: string;
    addressComponents: {
      streetNumber?: string;
      streetName?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
    locationType: string;
    placeId: string;
    isPartialMatch: boolean;
  }> {
    try {
      console.warn("🌍🌍🌍 GEOCODING START 🌍🌍🌍");
      console.warn("Query:", query);
      console.warn("Context:", locationContext);

      const encodedQuery = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`;
      console.warn("🔍 Google Maps URL:", url);

      const data = await this.makeGeocodingRequest(url);
      console.warn(
        "📍 Raw Google Maps Response:",
        JSON.stringify(data, null, 2),
      );

      if (!data.results || data.results.length === 0) {
        throw new Error("No coordinates found for address");
      }

      // Get the first result (most relevant match)
      const result = data.results[0];
      const { lat, lng } = result.geometry.location;

      // Format the address components for better readability
      const addressComponents = result.address_components;
      const streetNumber = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("street_number"),
      )?.long_name;
      const streetName = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("route"),
      )?.long_name;
      const city = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("locality"),
      )?.long_name;
      const state = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("administrative_area_level_1"),
      )?.short_name;
      const zipCode = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("postal_code"),
      )?.long_name;

      // Construct a clean address string
      const formattedAddress = [streetNumber, streetName, city, state, zipCode]
        .filter(Boolean)
        .join(", ");

      console.log("\nFormatted Address:", formattedAddress);
      console.log("Coordinates:", [lng, lat]);
      console.log("Location Type:", result.geometry.location_type);
      console.log("Place ID:", result.place_id);
      console.log("Partial Match:", result.partial_match);

      return {
        coordinates: [lng, lat],
        formattedAddress,
        addressComponents: {
          streetNumber,
          streetName,
          city,
          state,
          zipCode,
        },
        locationType: result.geometry.location_type,
        placeId: result.place_id,
        isPartialMatch: result.partial_match || false,
      };
    } catch (error) {
      console.error("❌ Geocoding error:", error);
      throw error;
    }
  }

  public async reverseGeocodeCityState(
    lat: number,
    lng: number,
  ): Promise<string> {
    try {
      console.warn("🌍 Reverse Geocoding for city/state:", { lat, lng });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`,
      );

      if (!response.ok) {
        console.error("Reverse geocoding failed:", response.statusText);
        throw new Error(`Reverse geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.warn(
        "Reverse geocoding response:",
        JSON.stringify(data, null, 2),
      );

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        console.warn("No results found for reverse geocoding");
        return "";
      }

      const result = data.results[0];
      const addressComponents = result.address_components;

      // Try to find city from various possible types
      const city = addressComponents.find(
        (component: { types: string[] }) =>
          component.types.includes("locality") ||
          component.types.includes("postal_town") ||
          component.types.includes("sublocality") ||
          component.types.includes("sublocality_level_2"),
      );

      // Try to find state from various possible types
      const state = addressComponents.find(
        (component: { types: string[] }) =>
          component.types.includes("administrative_area_level_1") ||
          component.types.includes("administrative_area_level_2"),
      );

      if (city && state) {
        const cityState = `${city.long_name}, ${state.short_name}`;
        console.warn("Found city/state:", cityState);
        return cityState;
      } else {
        console.warn("Could not find both city and state:", {
          foundCity: !!city,
          foundState: !!state,
          addressComponents: addressComponents.map(
            (c: { long_name: string; types: string[] }) => ({
              name: c.long_name,
              types: c.types,
            }),
          ),
        });
        return "";
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return "";
    }
  }

  public async getTimezone(lat: number, lng: number): Promise<string> {
    try {
      return await this.getTimezoneFromCoordinates(lat, lng);
    } catch (error) {
      console.error("Error getting timezone:", error);
      return "UTC";
    }
  }

  public async searchPlaceForFrontend(
    query: string,
    userCoordinates?: { lat: number; lng: number },
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

      // Get user's city/state if coordinates are provided
      let userCityState = "";
      if (userCoordinates) {
        userCityState = await this.reverseGeocodeCityState(
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
        distance = this.calculateDistance(
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

  public async searchCityState(
    query: string,
    userCoordinates?: { lat: number; lng: number },
  ): Promise<{
    success: boolean;
    error?: string;
    cityState?: {
      city: string;
      state: string;
      coordinates: [number, number];
      formattedAddress: string;
      placeId: string;
      distance?: number;
    };
  }> {
    try {
      if (!query.trim()) {
        return {
          success: false,
          error: "Search query cannot be empty",
        };
      }

      // Use the Places API with type restrictions for cities
      const url = "https://places.googleapis.com/v1/places:searchText";

      // Construct the request body according to Places API v1 format
      const requestBody = {
        textQuery: query,
        locationBias: userCoordinates
          ? {
              circle: {
                center: {
                  latitude: userCoordinates.lat,
                  longitude: userCoordinates.lng,
                },
                radius: 50000.0, // 50km radius for city search
              },
            }
          : undefined,
        // Add language code for better results
        languageCode: "en",
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_GEOCODING_API_KEY || "",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.id,places.types",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Places API error response:", errorData);
        throw new Error(
          `Places API request failed: ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ""}`,
        );
      }

      const data = await response.json();

      if (!data.places || data.places.length === 0) {
        return {
          success: false,
          error: "No cities or states found matching your search",
        };
      }

      interface Place {
        types: string[];
        formattedAddress: string;
        location: {
          latitude: number;
          longitude: number;
        };
        id: string;
        displayName: {
          text: string;
        };
      }

      // Filter results to only include cities and states
      const cityStateResults = data.places.filter((place: Place) =>
        place.types.some((type: string) =>
          [
            "locality",
            "administrative_area_level_1",
            "administrative_area_level_2",
          ].includes(type),
        ),
      );

      if (cityStateResults.length === 0) {
        return {
          success: false,
          error: "No cities or states found matching your search",
        };
      }

      // Use the first result that matches our criteria
      const result = cityStateResults[0];

      // Parse the address components to get city and state
      const addressParts = result.formattedAddress.split(", ");
      let city = "";
      let state = "";

      // The last part is usually the state
      state = addressParts[addressParts.length - 1];

      // The second-to-last part is usually the city
      if (addressParts.length >= 2) {
        city = addressParts[addressParts.length - 2];
      }

      // If we only got a state (like "California"), use it as both city and state
      if (addressParts.length === 1) {
        city = state;
      }

      // Calculate distance if user coordinates are provided
      let distance: number | undefined;
      if (userCoordinates) {
        distance = this.calculateDistance(
          userCoordinates.lat,
          userCoordinates.lng,
          result.location.latitude,
          result.location.longitude,
        );
      }

      return {
        success: true,
        cityState: {
          city,
          state,
          coordinates: [result.location.longitude, result.location.latitude],
          formattedAddress: result.formattedAddress,
          placeId: result.id,
          distance,
        },
      };
    } catch (error) {
      console.error("Error in city/state search:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  public async reverseGeocodeAddress(
    lat: number,
    lng: number,
  ): Promise<{
    success: boolean;
    error?: string;
    address?: {
      formattedAddress: string;
      addressComponents: {
        streetNumber?: string;
        streetName?: string;
        city?: string;
        state?: string;
        zipCode?: string;
      };
      placeId: string;
      locationType: string;
      partialMatch: boolean;
      coordinates: [number, number];
    };
  }> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`,
      );
      if (!response.ok) {
        return {
          success: false,
          error: `Reverse geocoding failed: ${response.statusText}`,
        };
      }
      const data = await response.json();
      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        return {
          success: false,
          error: "No results found for reverse geocoding",
        };
      }
      const result = data.results[0];
      const addressComponents = result.address_components;
      const streetNumber = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("street_number"),
      )?.long_name;
      const streetName = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("route"),
      )?.long_name;
      const city = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("locality"),
      )?.long_name;
      const state = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("administrative_area_level_1"),
      )?.short_name;
      const zipCode = addressComponents.find((c: { types: string[] }) =>
        c.types.includes("postal_code"),
      )?.long_name;
      const formattedAddress = result.formatted_address;
      const placeId = result.place_id;
      const locationType = result.geometry.location_type;
      const partialMatch = result.partial_match || false;
      const coordinates: [number, number] = [
        result.geometry.location.lng,
        result.geometry.location.lat,
      ];
      return {
        success: true,
        address: {
          formattedAddress,
          addressComponents: {
            streetNumber,
            streetName,
            city,
            state,
            zipCode,
          },
          placeId,
          locationType,
          partialMatch,
          coordinates,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

/**
 * Factory function to create a GoogleGeocodingService instance
 */
export function createGoogleGeocodingService(
  openAIService: OpenAIService,
): GoogleGeocodingService {
  return new GoogleGeocodingServiceImpl(openAIService);
}
