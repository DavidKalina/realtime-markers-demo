import { createHash } from "crypto";
import { find } from "geo-tz";
import { OpenAIService } from "./OpenAIService";

interface CachedLocation {
    cluesHash: string;
    address: string;
    coordinates: [number, number];
    timestamp: number;
    confidence: number;
    timezone?: string;
    locationNotes?: string;
}

export class GoogleGeocodingService {
    private static instance: GoogleGeocodingService;
    private locationCache: Map<string, CachedLocation> = new Map();
    private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

    private constructor() {
        // We specifically use the Geocoding API key since we're only using the Geocoding API
        if (!process.env.GOOGLE_GEOCODING_API_KEY) {
            throw new Error("GOOGLE_GEOCODING_API_KEY environment variable is required for geocoding functionality. This should be a key with Geocoding API enabled.");
        }
        console.log("=== Google Geocoding Service Initialization ===");
        console.log("GOOGLE_GEOCODING_API_KEY exists:", !!process.env.GOOGLE_GEOCODING_API_KEY);
        console.log("GOOGLE_GEOCODING_API_KEY length:", process.env.GOOGLE_GEOCODING_API_KEY.length);
        console.log("NODE_ENV:", process.env.NODE_ENV);
        console.log("=============================================");
    }

    public static getInstance(): GoogleGeocodingService {
        if (!this.instance) {
            this.instance = new GoogleGeocodingService();
        }
        return this.instance;
    }

    public async getTimezoneFromCoordinates(lat: number, lng: number): Promise<string> {
        try {
            const timezones = find(lat, lng);
            return timezones.length > 0 ? timezones[0] : "UTC";
        } catch (error) {
            console.error("Error getting timezone from coordinates:", error);
            return "UTC";
        }
    }

    private generateCluesFingerprint(clues: string[], userLocation?: string): string {
        const normalizedClues = clues
            .filter(Boolean)
            .map((clue) => clue.toLowerCase().trim())
            .sort()
            .join("|");

        const fingerprint = userLocation ? `${normalizedClues}|${userLocation}` : normalizedClues;
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
        expectedAddress: string
    ): Promise<boolean> {
        try {
            const data = await this.makeGeocodingRequest(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates[1]},${coordinates[0]}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`
            );

            if (!data.results || data.results.length === 0) return false;

            const reverseGeocodedAddress = data.results[0].formatted_address;
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

        const cluesFingerprint = this.generateCluesFingerprint(clues, userCityState);

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

        const uniqueClues = [...new Set(clues.filter(Boolean))];
        if (uniqueClues.length === 0) {
            throw new Error("No location clues provided");
        }

        const cluesText = uniqueClues.join(" | ");
        console.warn('🔍 Processed Clues:', cluesText);

        try {
            console.warn('\n🤖 Querying LLM for location analysis...');
            const response = await OpenAIService.executeChatCompletion({
                model: "gpt-4o",
                temperature: 0.1,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `You are a location analysis expert working with Google's Geocoding API. Extract location information that will be used to query Google's Geocoding API.

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
            let formattedAddress = address;

            if (address) {
                console.log('\nTrying to resolve address:', address);
                const geocodeResult = await this.geocodeAddress(address, `${address} | ${locationNotes}`);
                coordinates = geocodeResult.coordinates;
                formattedAddress = geocodeResult.formattedAddress;

                if (!this.validateCoordinates(coordinates)) {
                    throw new Error("Invalid coordinates obtained from geocoding");
                }

                const reverseGeocodingVerified = await this.verifyLocationWithReverseGeocoding(
                    coordinates,
                    formattedAddress
                );
                confidence = 0.5 + (reverseGeocodingVerified ? 0.3 : 0);
                console.log('Reverse Geocoding Verification:', reverseGeocodingVerified ? 'Passed' : 'Failed');
            } else if (locationNotes) {
                console.log('\nTrying to resolve from location notes:', locationNotes);
                const geocodeResult = await this.geocodeAddress(locationNotes, locationNotes);
                coordinates = geocodeResult.coordinates;
                formattedAddress = geocodeResult.formattedAddress;

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

            const timezone = await this.getTimezoneFromCoordinates(coordinates[1], coordinates[0]);

            console.log('\nFinal Resolution:');
            console.log('Coordinates:', coordinates);
            console.log('Final Confidence:', confidence);
            console.log('Timezone:', timezone);

            this.locationCache.set(cluesFingerprint, {
                cluesHash: cluesFingerprint,
                address: formattedAddress,
                coordinates,
                timestamp: Date.now(),
                confidence,
                timezone,
                locationNotes
            });

            console.log('=== Location Resolution End ===\n');

            return {
                address: formattedAddress,
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

    private async makeGeocodingRequest(url: string): Promise<any> {
        if (!process.env.GOOGLE_GEOCODING_API_KEY) {
            throw new Error("Geocoding API key is required for geocoding requests");
        }

        console.log("\n=== Google Geocoding API Request ===");
        console.log("Request URL:", url);
        console.log("API Key length:", process.env.GOOGLE_GEOCODING_API_KEY.length);
        console.log("API Key first 4 chars:", process.env.GOOGLE_GEOCODING_API_KEY.substring(0, 4));
        console.log("API Key last 4 chars:", process.env.GOOGLE_GEOCODING_API_KEY.substring(process.env.GOOGLE_GEOCODING_API_KEY.length - 4));

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

    public async geocodeAddress(query: string, locationContext?: string): Promise<{
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
            console.warn('🌍🌍🌍 GEOCODING START 🌍🌍🌍');
            console.warn('Query:', query);
            console.warn('Context:', locationContext);

            const encodedQuery = encodeURIComponent(query);
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`;
            console.warn('🔍 Google Maps URL:', url);

            const data = await this.makeGeocodingRequest(url);
            console.warn('📍 Raw Google Maps Response:', JSON.stringify(data, null, 2));

            if (!data.results || data.results.length === 0) {
                throw new Error("No coordinates found for address");
            }

            // Get the first result (most relevant match)
            const result = data.results[0];
            const { lat, lng } = result.geometry.location;

            // Format the address components for better readability
            const addressComponents = result.address_components;
            const streetNumber = addressComponents.find((c: { types: string[] }) => c.types.includes('street_number'))?.long_name;
            const streetName = addressComponents.find((c: { types: string[] }) => c.types.includes('route'))?.long_name;
            const city = addressComponents.find((c: { types: string[] }) => c.types.includes('locality'))?.long_name;
            const state = addressComponents.find((c: { types: string[] }) => c.types.includes('administrative_area_level_1'))?.short_name;
            const zipCode = addressComponents.find((c: { types: string[] }) => c.types.includes('postal_code'))?.long_name;

            // Construct a clean address string
            const formattedAddress = [
                streetNumber,
                streetName,
                city,
                state,
                zipCode
            ].filter(Boolean).join(', ');

            console.log('\nFormatted Address:', formattedAddress);
            console.log('Coordinates:', [lng, lat]);
            console.log('Location Type:', result.geometry.location_type);
            console.log('Place ID:', result.place_id);
            console.log('Partial Match:', result.partial_match);

            return {
                coordinates: [lng, lat],
                formattedAddress,
                addressComponents: {
                    streetNumber,
                    streetName,
                    city,
                    state,
                    zipCode
                },
                locationType: result.geometry.location_type,
                placeId: result.place_id,
                isPartialMatch: result.partial_match || false
            };
        } catch (error) {
            console.error("❌ Geocoding error:", error);
            throw error;
        }
    }

    public async reverseGeocodeCityState(lat: number, lng: number): Promise<string> {
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`
            );

            if (!response.ok) {
                throw new Error(`Reverse geocoding failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                const addressComponents = result.address_components;

                const city = addressComponents.find((component: any) =>
                    component.types.includes('locality') || component.types.includes('postal_town')
                );
                const state = addressComponents.find((component: any) =>
                    component.types.includes('administrative_area_level_1')
                );

                if (city && state) {
                    return `${city.long_name}, ${state.short_name}`;
                }
            }

            return "";
        } catch (error) {
            console.error("Error reverse geocoding:", error);
            return "";
        }
    }
} 