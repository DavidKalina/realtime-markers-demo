import type { EntityInitializationService as IEntityInitializationService } from "../types/entities";
import type { EventProcessor } from "./processors/EventProcessor";
import type { CivicEngagementProcessor } from "./processors/CivicEngagementProcessor";

/**
 * Entity-specific initialization service that wraps existing initialization services
 */
export class EntityInitializationService
  implements IEntityInitializationService
{
  readonly entityType: string;
  private eventProcessor?: EventProcessor;
  private civicEngagementProcessor?: CivicEngagementProcessor;
  private backendUrl?: string;
  private pageSize?: number;
  private maxRetries?: number;
  private retryDelay?: number;

  constructor(
    entityType: string,
    eventProcessor?: EventProcessor,
    civicEngagementProcessor?: CivicEngagementProcessor,
    config?: {
      backendUrl?: string;
      pageSize?: number;
      maxRetries?: number;
      retryDelay?: number;
    },
  ) {
    this.entityType = entityType;
    this.eventProcessor = eventProcessor;
    this.civicEngagementProcessor = civicEngagementProcessor;
    this.backendUrl = config?.backendUrl;
    this.pageSize = config?.pageSize;
    this.maxRetries = config?.maxRetries;
    this.retryDelay = config?.retryDelay;
  }

  async initializeEntities(): Promise<void> {
    console.log(
      `[EntityInitializationService] Initializing ${this.entityType} entities`,
    );

    try {
      if (this.entityType === "event") {
        // For events, we would typically load from the backend
        // For now, we'll just log that initialization is complete
        console.log(`[EntityInitializationService] Event entities initialized`);
      } else if (this.entityType === "civic_engagement") {
        // For civic engagements, we would typically load from the backend
        // For now, we'll just log that initialization is complete
        console.log(
          `[EntityInitializationService] Civic engagement entities initialized`,
        );
      }
    } catch (error) {
      console.error(
        `[EntityInitializationService] Failed to initialize ${this.entityType} entities:`,
        error,
      );
      throw error;
    }
  }

  clearAllEntities(): void {
    console.log(
      `[EntityInitializationService] Clearing all ${this.entityType} entities`,
    );

    // This would typically clear the cache for this entity type
    // For now, we'll just log the action
  }

  getStats(): Record<string, unknown> {
    return {
      entityType: this.entityType,
      initialized: true,
      backendUrl: this.backendUrl,
      pageSize: this.pageSize,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
    };
  }
}

/**
 * Factory function to create entity-specific initialization services
 */
export function createEntityInitializationService(
  entityType: string,
  eventProcessor?: EventProcessor,
  civicEngagementProcessor?: CivicEngagementProcessor,
  config?: {
    backendUrl?: string;
    pageSize?: number;
    maxRetries?: number;
    retryDelay?: number;
  },
): EntityInitializationService {
  return new EntityInitializationService(
    entityType,
    eventProcessor,
    civicEngagementProcessor,
    config,
  );
}
