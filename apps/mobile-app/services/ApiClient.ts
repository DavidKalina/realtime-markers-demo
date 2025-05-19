// src/services/ApiClient.ts

import { BaseApiClient } from "./api/base/ApiClient";
import { EventApiClient } from "./api/modules/events";
import { ClusterApiClient } from "./api/modules/clusters";
import { authModule } from "./api/modules/auth";
import { groupsModule } from "./api/modules/groups";
import { friendsModule } from "./api/modules/friends";
import { notificationsModule } from "./api/modules/notifications";
import { filtersModule } from "./api/modules/filters";
import { rsvpModule } from "./api/modules/rsvp";
import { plansModule } from "./api/modules/plans";

// Re-export types and enums
export * from "./api/base/types";
export * from "./api/modules/auth";
export * from "./api/modules/events";
export * from "./api/modules/groups";
export * from "./api/modules/friends";
export * from "./api/modules/notifications";
export * from "./api/modules/filters";
export * from "./api/modules/rsvp";
export * from "./api/modules/plans";
export * from "./api/modules/clusters";

export class ApiClient extends BaseApiClient {
  public readonly auth = authModule;
  public readonly events: EventApiClient;
  public readonly groups = groupsModule;
  public readonly friends = friendsModule;
  public readonly notifications = notificationsModule;
  public readonly filters = filtersModule;
  public readonly rsvp = rsvpModule;
  public readonly plans = plansModule;
  public readonly clusters: ClusterApiClient;

  constructor(baseUrl: string) {
    super(baseUrl);
    this.events = new EventApiClient(baseUrl);
    this.clusters = new ClusterApiClient(baseUrl);
  }

  override setBaseUrl(baseUrl: string): void {
    super.setBaseUrl(baseUrl);
    // Update base URL for modules that are instances
    this.events.setBaseUrl(baseUrl);
    this.clusters.setBaseUrl(baseUrl);
  }
}

// Export as singleton
export const apiClient = new ApiClient(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
);
