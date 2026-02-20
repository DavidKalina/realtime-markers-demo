import type { EntityTypeConfig } from "../types/entities";

/**
 * Configuration for Event entity type
 */
export const EVENT_CONFIG: EntityTypeConfig = {
  type: "event",
  displayName: "Events",
  hasLocation: true,
  isPublic: true,
  supportsImages: true,
  supportsCategories: true,
  relevanceScoring: {
    enabled: true,
    weights: {
      time: 0.4,
      distance: 0.3,
      popularity: 0.3,
    },
  },
  filtering: {
    supportedFilters: ["dateRange", "location", "status", "categories", "tags"],
    defaultFilters: {
      status: ["VERIFIED"],
    },
    strategy: "mapmoji",
  },
  webSocket: {
    messageTypes: {
      add: "event_added",
      update: "event_updated",
      delete: "event_deleted",
      discovered: "event_discovered",
    },
    redisChannels: {
      changes: "event:changes",
      discovered: "event:discovered",
    },
  },
};

/**
 * Registry of all entity type configurations
 */
export const ENTITY_TYPE_CONFIGS: Record<string, EntityTypeConfig> = {
  event: EVENT_CONFIG,
};

/**
 * Get configuration for a specific entity type
 */
export function getEntityTypeConfig(
  type: string,
): EntityTypeConfig | undefined {
  return ENTITY_TYPE_CONFIGS[type];
}

/**
 * Get all supported entity types
 */
export function getSupportedEntityTypes(): string[] {
  return Object.keys(ENTITY_TYPE_CONFIGS);
}
