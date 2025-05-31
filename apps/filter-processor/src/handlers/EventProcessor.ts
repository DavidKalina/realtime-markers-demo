import { Event, SpatialItem } from "../types/types";
import RBush from "rbush";

export class EventProcessor {
  private spatialIndex: RBush<SpatialItem>;
  private eventCache: Map<string, Event>;

  constructor(
    spatialIndex: RBush<SpatialItem>,
    eventCache: Map<string, Event>,
  ) {
    this.spatialIndex = spatialIndex;
    this.eventCache = eventCache;
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
    // Remove from spatial index and cache
    this.removeEventFromIndex(event.id);
    this.eventCache.delete(event.id);
  }

  private async handleUpdate(event: Event): Promise<void> {
    // Get the existing spatial item
    const currentItems = this.spatialIndex.all();
    const existingItem = currentItems.find((item) => item.id === event.id);

    // Create new spatial item
    const newSpatialItem = this.eventToSpatialItem(event);

    if (existingItem) {
      // Update existing item in spatial index
      this.spatialIndex.remove(existingItem);
      this.spatialIndex.insert(newSpatialItem);
    } else {
      // If item doesn't exist, insert it
      this.spatialIndex.insert(newSpatialItem);
    }

    // Update cache
    this.eventCache.set(event.id, event);
  }

  private async handleCreate(event: Event): Promise<void> {
    // Add to spatial index and cache
    const spatialItem = this.eventToSpatialItem(event);
    this.spatialIndex.insert(spatialItem);
    this.eventCache.set(event.id, event);
  }

  private removeEventFromIndex(eventId: string): void {
    const currentItems = this.spatialIndex.all();
    const itemToRemove = currentItems.find((item) => item.id === eventId);

    if (itemToRemove) {
      this.spatialIndex.remove(itemToRemove, (a, b) => a.id === b.id);
    }
  }

  private eventToSpatialItem(event: Event): SpatialItem {
    const [lng, lat] = event.location.coordinates;

    return {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      id: event.id,
      event,
    };
  }

  public getEventCache(): Map<string, Event> {
    return this.eventCache;
  }

  public getSpatialIndex(): RBush<SpatialItem> {
    return this.spatialIndex;
  }
}
