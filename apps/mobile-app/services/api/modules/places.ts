import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import { Place, PlaceCreateInput, PlaceUpdateInput } from "../base/types";

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

export class PlacesApiClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getPlaces(params: {
    lat: number;
    lng: number;
    radius: number;
  }): Promise<Place[]> {
    const queryParams = new URLSearchParams({
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      radius: params.radius.toString(),
    });

    const url = `${this.client.baseUrl}/api/places?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Place[]>(response);
  }

  async getPlace(id: string): Promise<Place> {
    const url = `${this.client.baseUrl}/api/places/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Place>(response);
  }

  async createPlace(input: PlaceCreateInput): Promise<Place> {
    const url = `${this.client.baseUrl}/api/places`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Place>(response);
  }

  async updatePlace(id: string, input: PlaceUpdateInput): Promise<Place> {
    const url = `${this.client.baseUrl}/api/places/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Place>(response);
  }

  async deletePlace(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/places/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Search for a place using Google Places API
   * @param params Search parameters including query and optional coordinates
   * @returns Place search result with place details if found
   */
  async searchPlace(params: PlaceSearchParams): Promise<PlaceSearchResult> {
    const url = `${this.client.baseUrl}/api/places/search`;
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
    const url = `${this.client.baseUrl}/api/places/search-city-state`;
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
