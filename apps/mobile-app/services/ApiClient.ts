// src/services/ApiClient.ts

import { BaseApiClient } from "./api/base/ApiClient";
import { EventApiClient } from "./api/modules/events";
import { ClusterApiClient } from "./api/modules/clusters";
import { PlacesApiClient } from "./api/modules/places";
import { AuthModule } from "./api/modules/auth";
import { FriendsModule } from "./api/modules/friends";
import { NotificationsModule } from "./api/modules/notifications";
import { FiltersModule } from "./api/modules/filters";
import { RSVPModule } from "./api/modules/rsvp";
import { PlansModule } from "./api/modules/plans";
import { CategoriesModule } from "./api/modules/categories";
import { PushNotificationsModule } from "./api/modules/pushNotifications";

// Re-export types and enums
export * from "./api/base/types";
export * from "./api/modules/auth";
export * from "./api/modules/events";
export * from "./api/modules/friends";
// export * from "./api/modules/notifications"; // Types are now in base/types
export * from "./api/modules/filters";
export * from "./api/modules/rsvp";
export * from "./api/modules/plans";
export * from "./api/modules/clusters";
export * from "./api/modules/places";

class ApiClient extends BaseApiClient {
  private static instance: ApiClient | null = null;
  private _events: EventApiClient | null = null;
  private _clusters: ClusterApiClient | null = null;
  private _places: PlacesApiClient | null = null;
  private _auth: AuthModule | null = null;
  private _friends: FriendsModule | null = null;
  private _notifications: NotificationsModule | null = null;
  private _filters: FiltersModule | null = null;
  private _rsvp: RSVPModule | null = null;
  private _plans: PlansModule | null = null;
  private _categories: CategoriesModule | null = null;
  private _pushNotifications: PushNotificationsModule | null = null;

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

  public get clusters(): ClusterApiClient {
    if (!this._clusters) {
      this._clusters = new ClusterApiClient(this);
    }
    return this._clusters;
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

  public get friends(): FriendsModule {
    if (!this._friends) {
      this._friends = new FriendsModule(this);
    }
    return this._friends;
  }

  public get notifications(): NotificationsModule {
    if (!this._notifications) {
      this._notifications = new NotificationsModule(this);
    }
    return this._notifications;
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

  public get plans(): PlansModule {
    if (!this._plans) {
      this._plans = new PlansModule(this);
    }
    return this._plans;
  }

  public get categories(): CategoriesModule {
    if (!this._categories) {
      this._categories = new CategoriesModule(this);
    }
    return this._categories;
  }

  public get pushNotifications(): PushNotificationsModule {
    if (!this._pushNotifications) {
      this._pushNotifications = new PushNotificationsModule(this);
    }
    return this._pushNotifications;
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
