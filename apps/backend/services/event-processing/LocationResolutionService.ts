// services/event-processing/LocationResolutionService.ts

import type { Point } from "geojson";

import type { ConfigService } from "../shared/ConfigService";
import { EnhancedLocationService } from "../shared/LocationService";
import type { LocationResolutionResult } from "./dto/LocationResolutionResult";
import type { ILocationResolutionService } from "./interfaces/ILocationResolutionService";
import { GoogleGeocodingService } from "../shared/GoogleGeocodingService";

/**
 * Service for resolving location information from textual clues
 * Wraps EnhancedLocationService to provide a cleaner interface
 */
export class LocationResolutionService implements ILocationResolutionService {
  private locationService: GoogleGeocodingService;
  private readonly geocodingApiKey: string;

  /**
   * Create a new LocationResolutionService
   * @param configService Optional configuration service for settings
   */
  constructor(private configService?: ConfigService) {
    this.locationService = GoogleGeocodingService.getInstance();
    this.geocodingApiKey = process.env.GOOGLE_GEOCODING_API_KEY || "";
  }

  /**
   * Resolve location information from a set of textual clues
   * @param locationClues Array of textual clues about the location
   * @param userContext User location context to help with resolution
   * @returns Resolved location information including address, coordinates, timezone, and confidence
   */
  public async resolveLocation(
    locationClues: string[],
    userContext?: {
      cityState?: string;
      coordinates?: { lat: number; lng: number };
    }
  ): Promise<LocationResolutionResult> {
    try {
      // First try to get user's city and state if coordinates are provided but city/state is not
      let userCityState = userContext?.cityState || "";

      if (!userCityState && userContext?.coordinates) {
        userCityState = await this.reverseGeocodeCityState(
          userContext.coordinates.lat,
          userContext.coordinates.lng
        );
      }

      // Filter out empty clues and normalize
      const validClues = locationClues.filter(Boolean).map((clue) => clue.trim());


      // Delegate to EnhancedLocationService for the heavy lifting
      const resolvedLocation = await this.locationService.resolveLocation(
        validClues,
        userCityState,
        userContext?.coordinates
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
        locationNotes: resolvedLocation.locationNotes
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
        error: error instanceof Error ? error.message : "Unknown error resolving location",
        locationNotes: ""
      };
    }
  }

  /**
   * Get timezone for specific coordinates
   * @param lat Latitude
   * @param lng Longitude
   * @returns IANA timezone identifier
   */
  public async getTimezone(lat: number, lng: number): Promise<string> {
    try {
      return await this.locationService.getTimezoneFromCoordinates(lat, lng);
    } catch (error) {
      console.error("Error getting timezone:", error);
      return "UTC";
    }
  }

  /**
   * Convert a textual address to coordinates
   * @param address Address to geocode
   * @returns Coordinates as [longitude, latitude]
   */
  public async geocodeAddress(address: string): Promise<[number, number]> {
    if (!address.trim()) {
      // Return default coordinates (0,0) for empty address
      return [0, 0];
    }

    try {
      const result = await this.locationService.geocodeAddress(address);
      return result.coordinates;
    } catch (error) {
      console.error("Geocoding error:", error);
      // Return default coordinates in case of error
      return [0, 0];
    }
  }

  /**
   * Reverse geocode coordinates to get city and state
   * @param lat Latitude
   * @param lng Longitude
   * @returns City and state as a string (e.g., "San Francisco, CA")
   */
  public async reverseGeocodeCityState(lat: number, lng: number): Promise<string> {
    try {
      return await this.locationService.reverseGeocodeCityState(lat, lng);
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return "";
    }
  }
}
