// src/services/ApiClient.ts

import { BaseApiClient } from "./api/base/ApiClient";
import { EventApiClient } from "./api/modules/events";
import { PlacesApiClient } from "./api/modules/places";
import { AuthModule } from "./api/modules/auth";
import { FiltersModule } from "./api/modules/filters";
import { RSVPModule } from "./api/modules/rsvp";
import { CategoriesModule } from "./api/modules/categories";

// Re-export types and enums
export * from "./api/base/types";
export * from "./api/modules/auth";
export * from "./api/modules/events";
// export * from "./api/modules/notifications"; // Types are now in base/types
export * from "./api/modules/filters";
export * from "./api/modules/rsvp";
export * from "./api/modules/places";

class ApiClient extends BaseApiClient {
  private static instance: ApiClient | null = null;
  private _events: EventApiClient | null = null;
  private _places: PlacesApiClient | null = null;
  private _auth: AuthModule | null = null;
  private _filters: FiltersModule | null = null;
  private _rsvp: RSVPModule | null = null;
  private _categories: CategoriesModule | null = null;

  private constructor(baseUrl: string) {
    super(baseUrl);
  }

  public static getInstance(baseUrl?: string): ApiClient {
    if (!ApiClient.instance) {
      if (!baseUrl) {
        throw new Error(
          "Base URL must be provided when creating ApiClient instance",
        );
      }
      ApiClient.instance = new ApiClient(baseUrl);
    }
    return ApiClient.instance;
  }

  // Lazy-loaded instance modules
  public get events(): EventApiClient {
    if (!this._events) {
      this._events = new EventApiClient(this);
    }
    return this._events;
  }

  public get places(): PlacesApiClient {
    if (!this._places) {
      this._places = new PlacesApiClient(this);
    }
    return this._places;
  }

  public get auth(): AuthModule {
    if (!this._auth) {
      this._auth = new AuthModule(this);
    }
    return this._auth;
  }

  public get filters(): FiltersModule {
    if (!this._filters) {
      this._filters = new FiltersModule(this);
    }
    return this._filters;
  }

  public get rsvp(): RSVPModule {
    if (!this._rsvp) {
      this._rsvp = new RSVPModule(this);
    }
    return this._rsvp;
  }

  public get categories(): CategoriesModule {
    if (!this._categories) {
      this._categories = new CategoriesModule(this);
    }
    return this._categories;
  }

  override setBaseUrl(baseUrl: string): void {
    super.setBaseUrl(baseUrl);
    // No need to update module baseUrls since they use this.client.baseUrl
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
);
