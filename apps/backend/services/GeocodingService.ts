// services/GeocodingService.ts

import { CacheService } from "./shared/CacheService";

interface GeocodedPlace {
  placeName: string;
  neighborhood?: string;
  locality?: string;
  place?: string;
  district?: string;
  region?: string;
  country?: string;
  poi?: string;
  address?: string;
  context?: Array<{
    id: string;
    text: string;
  }>;
  confidence?: number;
  relevance?: number;
}

export class GeocodingService {
  private static instance: GeocodingService;
  private mapboxToken: string;
  private cacheTimeout = 30 * 24 * 60 * 60; // 30 days in seconds

  private constructor() {
    this.mapboxToken =
      process.env.MAPBOX_GEOCODING_TOKEN || process.env.MAPBOX_TOKEN || "";

    if (!this.mapboxToken) {
      console.warn(
        "Mapbox token not provided for GeocodingService. Geocoding functionality will be limited.",
      );
    }
  }

  public static getInstance(): GeocodingService {
    if (!this.instance) {
      this.instance = new GeocodingService();
    }
    return this.instance;
  }

  /**
   * Reverse geocode coordinates to get place information
   * @param coordinates [longitude, latitude] coordinates to geocode
   * @returns Geocoded place information
   */
  public async reverseGeocode(
    coordinates: [number, number],
  ): Promise<GeocodedPlace | null> {
    if (!this.mapboxToken) {
      console.error("Cannot perform geocoding: Mapbox token not configured");
      return null;
    }

    try {
      // Check cache first
      const cacheKey = `geocode:${coordinates[0].toFixed(5)},${coordinates[1].toFixed(5)}`;
      const cachedResult = await CacheService.getCachedData(cacheKey);

      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // If not in cache, query Mapbox API
      const [longitude, latitude] = coordinates;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${this.mapboxToken}&types=neighborhood,locality,place,district,region,country,poi,address`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocoding failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.warn(
          "No geocoding results found for coordinates:",
          coordinates,
        );
        return null;
      }

      // Process the results to extract useful information
      const result = this.processGeocodingResults(data.features);

      // Cache the result
      await CacheService.setCachedData(
        cacheKey,
        JSON.stringify(result),
        this.cacheTimeout,
      );

      return result;
    } catch (error) {
      console.error("Error during reverse geocoding:", error);
      return null;
    }
  }

  /**
   * Extract useful information from geocoding results
   */
  private processGeocodingResults(features: any[]): GeocodedPlace {
    const primaryFeature = features[0];
    const result: GeocodedPlace = {
      placeName: primaryFeature.place_name,
      confidence: primaryFeature.relevance,
      context: [],
    };

    // Extract specific place types from all features
    for (const feature of features) {
      const placeType = feature.place_type?.[0];

      if (placeType) {
        switch (placeType) {
          case "neighborhood":
            result.neighborhood = feature.text;
            break;
          case "locality":
            result.locality = feature.text;
            break;
          case "place":
            result.place = feature.text;
            break;
          case "district":
            result.district = feature.text;
            break;
          case "region":
            result.region = feature.text;
            break;
          case "country":
            result.country = feature.text;
            break;
          case "poi":
            result.poi = feature.text;
            break;
          case "address":
            result.address = feature.text;
            break;
        }
      }

      // Add to context array
      if (feature.id && feature.text) {
        result.context?.push({
          id: feature.id,
          text: feature.text,
        });
      }
    }

    return result;
  }

  /**
   * Get the most specific appropriate place name based on zoom level
   * @param place The geocoded place information
   * @param zoomLevel The current map zoom level
   * @returns The most appropriate place name for the zoom level
   */
  public getAppropriateNameForZoom(
    place: GeocodedPlace,
    zoomLevel: number,
  ): string {
    if (!place) return "";

    // At very high zoom levels, prefer POIs and specific addresses
    if (zoomLevel >= 17) {
      return (
        place.poi || place.address || place.neighborhood || place.placeName
      );
    }

    // At high zoom levels, prefer neighborhoods
    if (zoomLevel >= 14) {
      return (
        place.neighborhood || place.locality || place.place || place.placeName
      );
    }

    // At medium zoom levels, prefer localities and places
    if (zoomLevel >= 10) {
      return place.place || place.locality || place.district || place.placeName;
    }

    // At low zoom levels, prefer regions and countries
    return place.region || place.country || place.placeName;
  }
}
