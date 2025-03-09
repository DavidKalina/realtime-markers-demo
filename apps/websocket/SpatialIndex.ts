// src/services/SpatialIndex.ts
import RBush from "rbush";
import { BoundingBox, Event } from "./filterTypes";

// Type for items stored in the RBush index
interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  event: Event;
}

export class SpatialIndex {
  private index: RBush<SpatialItem>;

  constructor() {
    this.index = new RBush();
  }

  /**
   * Add an event to the spatial index
   */
  addEvent(event: Event): void {
    if (!event.location?.coordinates) {
      console.warn(`Event ${event.id} missing coordinates, skipping spatial indexing`);
      return;
    }

    const [lng, lat] = event.location.coordinates;
    const item: SpatialItem = {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      id: event.id,
      event,
    };

    this.index.insert(item);
  }

  /**
   * Update an event in the spatial index
   */
  updateEvent(event: Event): void {
    this.removeEvent(event.id);
    this.addEvent(event);
  }

  /**
   * Remove an event from the spatial index
   */
  removeEvent(eventId: string): void {
    // Find the item
    const items = this.index
      .search({
        minX: -180,
        minY: -90,
        maxX: 180,
        maxY: 90,
      })
      .filter((item) => item.id === eventId);

    // Remove all matches
    for (const item of items) {
      this.index.remove(item, (a, b) => a.id === b.id);
    }
  }

  /**
   * Query events within a bounding box
   */
  queryBoundingBox(boundingBox: BoundingBox): Event[] {
    const items = this.index.search(boundingBox);
    return items.map((item) => item.event);
  }

  /**
   * Bulk load events into the spatial index
   * More efficient than adding one at a time
   */
  bulkLoad(events: Event[]): void {
    const items = events
      .filter((event) => event.location?.coordinates)
      .map((event) => {
        const [lng, lat] = event.location.coordinates;
        return {
          minX: lng,
          minY: lat,
          maxX: lng,
          maxY: lat,
          id: event.id,
          event,
        };
      });

    this.index.load(items);
  }

  /**
   * Clear the entire spatial index
   */
  clear(): void {
    this.index.clear();
  }

  /**
   * Get all events in the index
   */
  all(): Event[] {
    return this.index.all().map((item) => item.event);
  }

  /**
   * Get count of events in the index
   */
  size(): number {
    return this.index.all().length;
  }
}
