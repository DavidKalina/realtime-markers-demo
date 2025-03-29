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

  // Add new validation methods
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

  private calculateDistance(coords1: [number, number], coords2: [number, number]): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters

    const dLat = toRad(coords2[1] - coords1[1]);
    const dLng = toRad(coords2[0] - coords1[0]);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coords1[1])) *
      Math.cos(toRad(coords2[1])) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private async verifyLocationWithReverseGeocoding(
    coordinates: [number, number],
    expectedAddress: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?access_token=${process.env.MAPBOX_GEOCODING_TOKEN}`
      );

      if (!response.ok) return false;

      const data = await response.json();
      if (!data.features || data.features.length === 0) return false;

      // Get the most relevant feature
      const feature = data.features[0];
      const reverseGeocodedAddress = feature.place_name;

      // Simple string similarity check
      const similarity = this.calculateStringSimilarity(
        expectedAddress.toLowerCase(),
        reverseGeocodedAddress.toLowerCase()
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

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
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
        model: "gpt-4",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a location analysis expert. Analyze the provided location clues and extract structured information.

KEY INSTRUCTIONS:
1. EXTRACT THREE DISTINCT PIECES OF INFORMATION:
   - FULL ADDRESS: Extract if you find a complete address. Must include street number, street name, city, and state.
   - LOCATION NOTES: Extract ALL relevant context like:
     * Organization names (companies, schools, universities)
     * Building names
     * Room numbers
     * Landmarks
     * Campus information
     * Any other location details
   - CONFIDENCE: Rate your confidence in the extracted information (0.0 to 1.0)

2. STRICT RULES:
   - For addresses: Only extract if you have a complete, unambiguous address
   - If you find partial address information, include it in locationNotes
   - If no address is found, look for organizations, buildings, or landmarks
   - Location notes should include ALL relevant context that would help identify the location
   - If user context is provided, use it to help identify the city/state if missing

3. USER CONTEXT:
   ${userLocationContext}

4. LOCATION HIERARCHY:
   1. Complete addresses (highest priority)
   2. Organizations/Institutions (universities, companies, etc.)
   3. Buildings/Landmarks
   4. Partial address information
   5. User location (fallback)

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
      let verificationScore = 0;

      // Location resolution hierarchy
      if (address) {
        // Try to resolve the address
        coordinates = await this.geocodeAddress(address);

        // Validate coordinates
        if (!this.validateCoordinates(coordinates)) {
          throw new Error("Invalid coordinates obtained from geocoding");
        }

        // Verify with reverse geocoding
        const reverseGeocodingVerified = await this.verifyLocationWithReverseGeocoding(
          coordinates,
          address
        );
        verificationScore += reverseGeocodingVerified ? 0.5 : 0;

        // Base confidence for having an address
        confidence = 0.5 + verificationScore;
      } else if (locationNotes) {
        // Try to resolve organization/landmark
        const searchQuery = locationNotes.split('\n')[0]; // Use first line as primary search
        coordinates = await this.geocodeAddress(searchQuery);

        // Validate coordinates
        if (!this.validateCoordinates(coordinates)) {
          throw new Error("Invalid coordinates obtained from geocoding");
        }

        // Lower confidence for organization/landmark resolution
        confidence = 0.4;
      } else if (userCoordinates) {
        // Fall back to user location
        coordinates = [userCoordinates.lng, userCoordinates.lat];
        confidence = 0.3;
      } else {
        throw new Error("Cannot determine event location: No address, organization, or scan coordinates available");
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
