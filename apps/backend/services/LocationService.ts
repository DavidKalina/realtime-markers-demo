// src/services/EnhancedLocationService.ts
import { createHash } from "crypto";
import { OpenAIService } from "./OpenAIService";

// 1. Add a location cache to prevent redundant API calls
interface CachedLocation {
  cluesHash: string;
  address: string;
  coordinates: [number, number];
  timestamp: number;
  confidence: number;
}

export class EnhancedLocationService {
  // Singleton implementation
  private static instance: EnhancedLocationService;

  private locationCache: Map<string, CachedLocation> = new Map();
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Private constructor for singleton pattern
  private constructor() {}

  // Static method to get the singleton instance
  public static getInstance(): EnhancedLocationService {
    if (!this.instance) {
      this.instance = new EnhancedLocationService();
    }
    return this.instance;
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
  ): Promise<{ address: string; coordinates: [number, number]; confidence: number }> {
    // Generate unique fingerprint for these clues
    const cluesFingerprint = this.generateCluesFingerprint(clues, userCityState);

    // Check cache first
    const cachedLocation = this.locationCache.get(cluesFingerprint);
    if (cachedLocation && Date.now() - cachedLocation.timestamp < this.CACHE_EXPIRY) {
      console.log("Using cached location for clues fingerprint:", cluesFingerprint);
      return {
        address: cachedLocation.address,
        coordinates: cachedLocation.coordinates,
        confidence: cachedLocation.confidence,
      };
    }

    // Not in cache, proceed with inference
    const address = await this.inferAddressFromClues(clues, userCityState, userCoordinates);

    // If address was inferred successfully, geocode it
    if (address) {
      const coordinates = await this.geocodeAddress(address);
      const confidence = this.calculateAddressConfidence(clues, address);

      // Store in cache
      this.locationCache.set(cluesFingerprint, {
        cluesHash: cluesFingerprint,
        address,
        coordinates,
        timestamp: Date.now(),
        confidence,
      });

      return { address, coordinates, confidence };
    }

    // Fallback to user coordinates or default
    const fallbackCoords = userCoordinates
      ? ([userCoordinates.lng, userCoordinates.lat] as [number, number])
      : ([-111.6585, 40.2338] as [number, number]); // Default to Provo

    return {
      address: "",
      coordinates: fallbackCoords,
      confidence: 0.1,
    };
  }

  // 4. Improved address inference with validation
  private async inferAddressFromClues(
    clues: string[],
    userCityState: string,
    userCoordinates?: { lat: number; lng: number }
  ): Promise<string> {
    // Filter and deduplicate clues
    const uniqueClues = [...new Set(clues.filter(Boolean))];

    // Early return if no meaningful clues
    if (uniqueClues.length === 0) return "";

    const cluesText = uniqueClues.join(" | ");

    // Add precise user location context
    const userLocationContext = userCityState
      ? `User is in ${userCityState}.`
      : userCoordinates
      ? `User coordinates: ${userCoordinates.lat.toFixed(5)},${userCoordinates.lng.toFixed(5)}`
      : "";

    try {
      // First attempt - standard address inference using OpenAIService
      const response = await OpenAIService.executeChatCompletion({
        model: "gpt-4o",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are an address resolution expert specialized in standardizing location information for events.
            
KEY INSTRUCTIONS:
1. ANALYZE all location clues in hierarchical priority:
   - Explicit street addresses have highest priority
   - Venue/building names with room numbers second priority
   - Campus/institutional locations third priority
   - Vague location references lowest priority

2. STANDARDIZE the address in this exact format:
   - Street number + Street name
   - City, State ZIP
   - No abbreviations except for state codes
   - No extraneous information (no "Located at", "near", etc.)

3. RESOLVE AMBIGUITY using user context:
   - ${userLocationContext}
   - If a venue has multiple locations, choose the one closest to user
   - For campus buildings or coded locations (like "LC 301"), resolve to the full address
   
4. If you cannot determine a specific street address with high confidence, return "UNKNOWN" only.`,
          },
          {
            role: "user",
            content: `LOCATION CLUES: ${cluesText}
            
RESPOND WITH THE STANDARDIZED ADDRESS ONLY - NO EXPLANATIONS, PREFIXES, OR ADDITIONAL TEXT.`,
          },
        ],
        max_tokens: 100,
      });

      const inferredAddress = response.choices[0].message.content?.trim();

      // If we got a valid address, verify it looks reasonable
      if (inferredAddress && inferredAddress !== "UNKNOWN") {
        const isValidAddress = this.validateAddressFormat(inferredAddress);
        if (isValidAddress) {
          return inferredAddress;
        } else {
          // Try once more with explicit formatting instructions
          return await this.retryAddressInference(cluesText, userLocationContext);
        }
      }

      return inferredAddress === "UNKNOWN" ? "" : inferredAddress || "";
    } catch (error) {
      console.error("Error inferring address from clues:", error);
      return "";
    }
  }

  // 5. Validation for address format
  private validateAddressFormat(address: string): boolean {
    // Check for common address patterns
    // - Must contain numbers (usually street number)
    // - Must have city, state pattern
    // - Shouldn't be too short

    const hasNumbers = /\d/.test(address);
    const hasCityState = /[A-Z][a-z]+,\s*[A-Z]{2}/.test(address);
    const isReasonableLength = address.length > 10;

    return hasNumbers && hasCityState && isReasonableLength;
  }

  // 6. Retry with more explicit instructions if first attempt fails validation
  private async retryAddressInference(
    cluesText: string,
    userLocationContext: string
  ): Promise<string> {
    try {
      const response = await OpenAIService.executeChatCompletion({
        model: "gpt-4o",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are an address standardization system. ${userLocationContext}
            
YOUR ONLY JOB is to output a properly formatted US address from the provided clues.
The address MUST follow this exact pattern:
123 Main Street
City, ST 12345

Where:
- 123 is the street number
- Main Street is the street name
- City is the city name
- ST is the two-letter state code
- 12345 is the ZIP code (optional)

DO NOT include any explanations or extraneous text.
If you cannot determine an address with high confidence, respond only with "UNKNOWN".`,
          },
          {
            role: "user",
            content: cluesText,
          },
        ],
        max_tokens: 100,
      });

      const inferredAddress = response.choices[0].message.content?.trim();
      return inferredAddress === "UNKNOWN" ? "" : inferredAddress || "";
    } catch (error) {
      console.error("Error in retry address inference:", error);
      return "";
    }
  }

  // 7. Calculate confidence score for the inferred address
  private calculateAddressConfidence(clues: string[], address: string): number {
    if (!address) return 0;

    // Base confidence starts at 0.5
    let confidence = 0.5;

    // Increase confidence if address contains direct matches to clues
    for (const clue of clues) {
      if (clue && address.toLowerCase().includes(clue.toLowerCase())) {
        confidence += 0.1;
      }
    }

    // Check for address completeness
    const hasStreetNumber = /^\d+\s/.test(address);
    const hasStreetName = /\d+\s+[A-Za-z\s]+/.test(address);
    const hasCityState = /[A-Za-z\s]+,\s*[A-Z]{2}/.test(address);
    const hasZip = /\d{5}(?:-\d{4})?$/.test(address);

    if (hasStreetNumber) confidence += 0.1;
    if (hasStreetName) confidence += 0.1;
    if (hasCityState) confidence += 0.1;
    if (hasZip) confidence += 0.1;

    // Cap at 1.0
    return Math.min(1.0, confidence);
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
