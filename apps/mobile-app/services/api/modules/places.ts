import { BaseApiClient } from "../base/ApiClient";

// Types for the places API
export interface PlaceSearchResult {
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
}

export interface PlaceSearchParams {
  query: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface CityStateSearchResult {
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
}

export interface CityStateSearchParams {
  query: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export class PlacesApiClient extends BaseApiClient {
  /**
   * Search for a place using Google Places API
   * @param params Search parameters including query and optional coordinates
   * @returns Place search result with place details if found
   */
  async searchPlace(params: PlaceSearchParams): Promise<PlaceSearchResult> {
    const url = `${this.baseUrl}/api/places/search`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    return this.handleResponse<PlaceSearchResult>(response);
  }

  /**
   * Search for a city or state using Google Places API
   * @param params Search parameters including query and optional coordinates
   * @returns City/state search result with location details if found
   */
  async searchCityState(
    params: CityStateSearchParams,
  ): Promise<CityStateSearchResult> {
    const url = `${this.baseUrl}/api/places/search-city-state`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    return this.handleResponse<CityStateSearchResult>(response);
  }
}
