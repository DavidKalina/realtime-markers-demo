import { UnifiedSpatialCacheService } from "../services/UnifiedSpatialCacheService";
import { Event } from "../types/types";

export class LegacyEventCacheHandler {
  private eventCacheService: UnifiedSpatialCacheService;

  constructor(eventCacheService: UnifiedSpatialCacheService) {
    this.eventCacheService = eventCacheService;
  }

  public async processEvent(event: {
    operation: string;
    record: Event;
  }): Promise<void> {
    const { operation, record } = event;

    switch (operation) {
      case "DELETE":
        await this.handleDelete(record);
        break;
      case "UPDATE":
        await this.handleUpdate(record);
        break;
      case "CREATE":
      case "INSERT":
        await this.handleCreate(record);
        break;
      default:
        console.warn(`Unknown operation type: ${operation}`);
    }
  }

  private async handleDelete(event: Event): Promise<void> {
    // Remove from cache and spatial index
    this.eventCacheService.removeEvent(event.id);
  }

  private async handleUpdate(event: Event): Promise<void> {
    // Update in cache and spatial index
    this.eventCacheService.updateEvent(event);
  }

  private async handleCreate(event: Event): Promise<void> {
    // Add to cache and spatial index
    this.eventCacheService.addEvent(event);
  }

  /**
   * Get the underlying event cache service for direct access if needed
   */
  public getEventCacheService(): UnifiedSpatialCacheService {
    return this.eventCacheService;
  }
}
