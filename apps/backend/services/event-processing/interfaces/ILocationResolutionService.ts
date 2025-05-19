// services/event-processing/interfaces/ILocationResolutionService.ts

import type { LocationResolutionResult } from "../dto/LocationResolutionResult";

/**
 * Interface for location resolution services
 * Responsible for resolving locations from textual clues
 */
export interface ILocationResolutionService {
  /**
   * Resolve location information from a set of textual clues
   * @param locationClues Array of textual clues about the location
   * @param userContext User location context to help with resolution
   * @returns Resolved location information
   */
  resolveLocation(
    locationClues: string[],
    userContext?: {
      cityState?: string;
      coordinates?: { lat: number; lng: number };
    },
  ): Promise<LocationResolutionResult>;

  /**
   * Get timezone for specific coordinates
   * @param lat Latitude
   * @param lng Longitude
   * @returns IANA timezone identifier
   */
  getTimezone(lat: number, lng: number): Promise<string>;

  /**
   * Convert a textual address to coordinates
   * @param address Address to geocode
   * @returns Coordinates as [longitude, latitude]
   */
  geocodeAddress(address: string): Promise<[number, number]>;

  /**
   * Reverse geocode coordinates to city and state
   * @param lat Latitude
   * @param lng Longitude
   * @returns City and state as a string (e.g., "San Francisco, CA")
   */
  reverseGeocodeCityState(lat: number, lng: number): Promise<string>;
}
