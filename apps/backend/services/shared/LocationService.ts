// src/services/EnhancedLocationService.ts
import { createHash } from "crypto";
import { find } from "geo-tz"; // Import geo-tz for timezone lookup
import { OpenAIService } from "./OpenAIService";

// 1. Add a location cache to prevent redundant API calls
interface CachedLocation {
  cluesHash: string;
  address: string;
  coordinates: [number, number];
  timestamp: number;
  confidence: number;
  timezone?: string; // Add timezone to cache
  locationNotes?: string;
}

export class EnhancedLocationService {
  // Singleton implementation
  private static instance: EnhancedLocationService;

  private locationCache: Map<string, CachedLocation> = new Map();
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Private constructor for singleton pattern
  private constructor() { }

  // Static method to get the singleton instance
  public static getInstance(): EnhancedLocationService {
    if (!this.instance) {
      this.instance = new EnhancedLocationService();
    }
    return this.instance;
  }

  // New method to get timezone from coordinates
  public async getTimezoneFromCoordinates(lat: number, lng: number): Promise<string> {
    try {
      // Using geo-tz to find timezone from coordinates
      const timezones = find(lat, lng);
      return timezones.length > 0 ? timezones[0] : "UTC";
    } catch (error) {
      console.error("Error getting timezone from coordinates:", error);
      return "UTC"; // Default to UTC if lookup fails
    }
  }

  // 2. Create a fingerprint of location clues for consistent lookups
  private generateCluesFingerprint(clues: string[], userLocation?: string): string {
    const normalizedClues = clues
      .filter(Boolean)
      .map((clue) => clue.toLowerCase().trim())
      .sort()
      .join("|");

    const fingerprint = userLocation ? `${normalizedClues}|${userLocation}` : normalizedClues;

    return createHash("md5").update(fingerprint).digest("hex");
  }

  // 3. Lookup cached location or infer new one
  async resolveLocation(
    clues: string[],
    userCityState: string,
    userCoordinates?: { lat: number; lng: number }
  ): Promise<{
    address: string;
    coordinates: [number, number];
    confidence: number;
    timezone: string;
    locationNotes?: string;
  }> {
    // Generate unique fingerprint for these clues
    const cluesFingerprint = this.generateCluesFingerprint(clues, userCityState);

    // Check cache first
    const cachedLocation = this.locationCache.get(cluesFingerprint);
    if (cachedLocation && Date.now() - cachedLocation.timestamp < this.CACHE_EXPIRY) {
      return {
        address: cachedLocation.address,
        coordinates: cachedLocation.coordinates,
        confidence: cachedLocation.confidence,
        timezone: cachedLocation.timezone || "UTC",
        locationNotes: cachedLocation.locationNotes
      };
    }

    // Filter and deduplicate clues
    const uniqueClues = [...new Set(clues.filter(Boolean))];
    if (uniqueClues.length === 0) {
      throw new Error("No location clues provided");
    }

    const cluesText = uniqueClues.join(" | ");

    // Add user location context
    const userLocationContext = userCityState
      ? `User is in ${userCityState}.`
      : userCoordinates
        ? `User coordinates: ${userCoordinates.lat.toFixed(5)},${userCoordinates.lng.toFixed(5)}`
        : "";

    try {
      // Use AI to analyze location clues and extract structured information
      const response = await OpenAIService.executeChatCompletion({
        model: "gpt-4o",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a location analysis expert. Analyze the provided location clues and extract structured information.

KEY INSTRUCTIONS:
1. EXTRACT THREE DISTINCT PIECES OF INFORMATION:
   - FULL ADDRESS: If a complete street address is present, extract it in standard format (Street number + Street name, City, State ZIP)
   - LOCATION NOTES: Extract ALL relevant context like building names, room numbers, organizations, landmarks, or any other location details
   - CONFIDENCE: Rate your confidence in the extracted address (0.0 to 1.0)

2. STRICT RULES:
   - Only extract FULL ADDRESS if it's explicitly stated or can be determined with high confidence
   - If no full address is found, return "NO_ADDRESS" for the address field
   - Never guess or infer addresses
   - ALWAYS include location notes, even if we have a full address
   - Include any additional context that would help someone find the location

3. USER CONTEXT:
   ${userLocationContext}

RESPOND IN THIS EXACT JSON FORMAT:
{
  "address": "FULL ADDRESS or NO_ADDRESS",
  "locationNotes": "All relevant location context",
  "confidence": 0.0 to 1.0
}`
          },
          {
            role: "user",
            content: `LOCATION CLUES: ${cluesText}`
          }
        ],
        max_tokens: 300,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      let address = result.address === "NO_ADDRESS" ? "" : result.address;
      const locationNotes = result.locationNotes || "";
      let confidence = result.confidence || 0;



      let coordinates: [number, number];

      // Strict location hierarchy:
      if (address) {
        // If we have a valid address, geocode it
        coordinates = await this.geocodeAddress(address);
        confidence = 1.0; // Full confidence for explicit addresses

      } else if (userCoordinates) {
        // If no address but we have scan location, use that
        coordinates = [userCoordinates.lng, userCoordinates.lat];
        confidence = 0.5; // Medium confidence for scan location

      } else {
        // If no address and no scan location, we cannot determine location
        throw new Error("Cannot determine event location: No address or scan coordinates available");
      }

      // Get timezone for the coordinates
      const timezone = await this.getTimezoneFromCoordinates(coordinates[1], coordinates[0]);

      // Store in cache
      this.locationCache.set(cluesFingerprint, {
        cluesHash: cluesFingerprint,
        address,
        coordinates,
        timestamp: Date.now(),
        confidence,
        timezone,
        locationNotes
      });



      return {
        address,
        coordinates,
        confidence,
        timezone,
        locationNotes
      };
    } catch (error) {
      console.error("Error in location resolution:", error);
      throw error;
    }
  }

  // 8. Geocoding implementation
  private async geocodeAddress(address: string): Promise<[number, number]> {
    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${process.env.MAPBOX_GEOCODING_TOKEN}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        throw new Error("No coordinates found for address");
      }

      return data.features[0].center as [number, number];
    } catch (error) {
      console.error("Geocoding error:", error);
      // Fallback to a default location in Provo if geocoding fails
      return [-111.6585, 40.2338];
    }
  }
}
