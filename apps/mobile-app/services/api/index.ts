// Export the legacy client for backward compatibility
export { apiClient, LegacyApiClient } from "./legacy";

// Export base types and client
export * from "./base/types";
export { BaseApiClient } from "./base/ApiClient";

// Export modules
export { GroupsModule } from "./modules/groups";
export { PlacesApiClient } from "./modules/places";
export type { PlaceSearchResult, PlaceSearchParams } from "./modules/places";

// Re-export types that are used across modules
export type { EventType } from "@/types/types";
