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
    console.warn('\n🔍🔍🔍 LOCATION RESOLUTION START 🔍🔍🔍');
    console.warn('Input Clues:', clues);
    console.warn('User City/State:', userCityState);
    console.warn('User Coordinates:', userCoordinates);

    // Generate unique fingerprint for these clues
    const cluesFingerprint = this.generateCluesFingerprint(clues, userCityState);

    // Check cache first
    const cachedLocation = this.locationCache.get(cluesFingerprint);
    if (cachedLocation && Date.now() - cachedLocation.timestamp < this.CACHE_EXPIRY) {
      console.warn('📍 Using cached location:', cachedLocation);
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
    console.warn('🔍 Processed Clues:', cluesText);

    try {
      // Use AI to analyze location clues and extract structured information
      console.warn('\n🤖 Querying LLM for location analysis...');
      const response = await OpenAIService.executeChatCompletion({
        model: "gpt-4o",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a location analysis expert working with Mapbox's geocoding API. Extract location information that will be used to query Mapbox's geocoding API.

KEY INSTRUCTIONS:
1. For ambiguous city names (like Washington, Springfield, etc):
   - Look for state context in the full text
   - Check phone area codes (e.g., 435 is Utah)
   - Use landmarks or business names as context
   - If a city could be confused with a state/DC, explicitly add the state

2. When extracting addresses:
   - Must include street number, street name, city, and state
   - Always use full state names or standard 2-letter codes (UT not Ut.)
   - For cities that share names with states/DC, always include state
   - Format: "Street number + Street name, City, State ZIP"

3. If no complete address is found:
   - Extract business names, landmarks, and cross-streets
   - Include city and state when known
   - Note any phone area codes as they help confirm state

4. Phone Area Code Reference:
   - 435: Utah (outside Salt Lake area)
   - Add other relevant area codes as needed

5. RESPONSE FORMAT:
   You MUST respond with a valid JSON object in this exact format:
   {
     "address": "complete address if found, or empty string",
     "locationNotes": "additional location context, or empty string",
     "confidence": number between 0 and 1
   }

USER CONTEXT:
${userCityState ? `User is in ${userCityState}.` : userCoordinates ? `User coordinates: ${userCoordinates.lat.toFixed(5)},${userCoordinates.lng.toFixed(5)}` : ""}`
          },
          {
            role: "user",
            content: `LOCATION CLUES: ${cluesText}`
          }
        ],
        max_tokens: 150,
      });

      console.warn('LLM Response:', response.choices[0].message.content);

      let result;
      try {
        result = JSON.parse(response.choices[0].message.content || "{}");
      } catch (error) {
        console.warn('Failed to parse LLM response as JSON, attempting to extract address from text');
        const content = response.choices[0].message.content || "";
        const addressMatch = content.match(/EXTRACTED LOCATION:\s*(.+)/i) ||
          content.match(/ADDRESS:\s*(.+)/i) ||
          content.match(/(\d+.*?,\s*[A-Za-z\s]+,\s*[A-Z]{2})/);

        if (addressMatch) {
          result = {
            address: addressMatch[1].trim(),
            locationNotes: "",
            confidence: 0.8
          };
        } else {
          throw new Error("Could not extract address from LLM response");
        }
      }

      let address = result.address === "NO_ADDRESS" ? "" : result.address;
      const locationNotes = result.locationNotes || "";
      let confidence = result.confidence || 0;

      console.log('\nParsed LLM Result:');
      console.log('Address:', address || '(none)');
      console.log('Location Notes:', locationNotes || '(none)');
      console.log('Initial Confidence:', confidence);

      let coordinates: [number, number];

      // Location resolution hierarchy
      if (address) {
        console.log('\nTrying to resolve address:', address);
        coordinates = await this.geocodeAddress(address, `${address} | ${locationNotes}`);

        // Validate coordinates
        if (!this.validateCoordinates(coordinates)) {
          throw new Error("Invalid coordinates obtained from geocoding");
        }

        // Verify with reverse geocoding
        const reverseGeocodingVerified = await this.verifyLocationWithReverseGeocoding(
          coordinates,
          address
        );
        confidence = 0.5 + (reverseGeocodingVerified ? 0.3 : 0);
        console.log('Reverse Geocoding Verification:', reverseGeocodingVerified ? 'Passed' : 'Failed');
      } else if (locationNotes) {
        console.log('\nTrying to resolve from location notes:', locationNotes);
        coordinates = await this.geocodeAddress(locationNotes, locationNotes);

        // Validate coordinates
        if (!this.validateCoordinates(coordinates)) {
          throw new Error("Invalid coordinates obtained from geocoding");
        }

        confidence = 0.4;
      } else if (userCoordinates) {
        console.log('\nFalling back to user coordinates');
        coordinates = [userCoordinates.lng, userCoordinates.lat];
        confidence = 0.3;
      } else {
        throw new Error("Cannot determine event location: No address, organization, or scan coordinates available");
      }

      // Get timezone for the coordinates
      const timezone = await this.getTimezoneFromCoordinates(coordinates[1], coordinates[0]);

      console.log('\nFinal Resolution:');
      console.log('Coordinates:', coordinates);
      console.log('Final Confidence:', confidence);
      console.log('Timezone:', timezone);

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

      console.log('=== Location Resolution End ===\n');

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

  private async geocodeAddress(query: string, locationContext?: string): Promise<[number, number]> {
    try {
      console.warn('🌍🌍🌍 GEOCODING START 🌍🌍🌍');
      console.warn('Query:', query);
      console.warn('Context:', locationContext);

      const params = new URLSearchParams({
        access_token: process.env.MAPBOX_GEOCODING_TOKEN || '',
        country: 'us',
        limit: '5', // Get multiple options
        types: 'address,poi,place'
      });

      const encodedQuery = encodeURIComponent(query);
      console.warn('🔍 Mapbox URL:', `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?${params.toString()}`);

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.warn('📍 Raw Mapbox Response:', JSON.stringify(data, null, 2));

      if (!data.features || data.features.length === 0) {
        throw new Error("No coordinates found for address");
      }

      console.log('\nMapbox Raw Results:');
      data.features.forEach((f: any, i: number) => {
        console.log(`${i + 1}. ${f.place_name}`);
        console.log(`   Type: ${f.place_type.join(', ')}`);
        console.log(`   Context: ${f.context?.map((c: any) => c.text).join(', ') || 'none'}`);
        console.log(`   Coordinates: [${f.center[1]}, ${f.center[0]}]`);
        console.log('');
      });

      // Format the location options for the LLM
      const options = data.features.map((feature: any, index: number) => {
        const place = feature.place_name;
        const [lng, lat] = feature.center;
        const context = feature.context?.map((c: any) => c.text).join(', ') || '';
        return `Option ${index + 1}: ${place} (${context}) [${lat}, ${lng}]`;
      }).join('\n');

      console.log('\nPrompting LLM with:');
      console.log('Location Context:', locationContext || query);
      console.log('Options:\n', options);

      // Use LLM to pick the best option
      const llmResponse = await OpenAIService.executeChatCompletion({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a location selection expert. Given multiple location options and context, select the most appropriate location.
Choose the option that best matches the context, considering:
1. Area codes mentioned (e.g., 435 is Utah)
2. Business names and landmarks
3. Geographic context
4. Local knowledge (e.g., Washington, UT is near St. George)

Respond with TWO lines:
1. The option number you choose (1, 2, 3, etc)
2. A brief explanation of why you chose it`
          },
          {
            role: "user",
            content: `Location Context: ${locationContext || query}

Available Options:
${options}

Which option best matches the context? Respond with the number and brief explanation.`
          }
        ],
        max_tokens: 100
      });

      console.log('\nLLM Response:', llmResponse.choices[0].message.content);

      // Parse just the number from the first line of the LLM response
      const selectedIndex = parseInt(llmResponse.choices[0].message.content.split('\n')[0].trim()) - 1;

      // Fallback to first result if LLM response isn't valid
      const validIndex = isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= data.features.length
        ? 0
        : selectedIndex;

      console.log(`\nSelected option ${validIndex + 1}: ${data.features[validIndex].place_name}`);
      console.log('=== End Debug ===\n');

      return data.features[validIndex].center as [number, number];
    } catch (error) {
      console.error("❌ Geocoding error:", error);
      throw error;
    }
  }
}
