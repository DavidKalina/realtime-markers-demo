import Redis from "ioredis";
import { BoundingBox, Event } from "../types/types";
import RBush from "rbush";
import { SpatialItem } from "../types/types";

export class ViewportProcessor {
  private redisPub: Redis;
  private spatialIndex: RBush<SpatialItem>;
  private eventCache: Map<string, Event>;

  constructor(
    redisPub: Redis,
    spatialIndex: RBush<SpatialItem>,
    eventCache: Map<string, Event>,
  ) {
    this.redisPub = redisPub;
    this.spatialIndex = spatialIndex;
    this.eventCache = eventCache;
  }

  public async updateUserViewport(
    userId: string,
    viewport: BoundingBox,
  ): Promise<void> {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log(`Updating viewport for user ${userId}`, viewport);
      }

      const viewportKey = `viewport:${userId}`;

      // Store the full viewport data
      await this.redisPub.set(viewportKey, JSON.stringify(viewport));

      // Calculate center point for GEO indexing
      const centerLng = (viewport.minX + viewport.maxX) / 2;
      const centerLat = (viewport.minY + viewport.maxY) / 2;

      // Add to GEO index
      await this.redisPub.geoadd(
        "viewport:geo",
        centerLng,
        centerLat,
        viewportKey,
      );
    } catch (error) {
      console.error(`Error updating viewport for user ${userId}:`, error);
    }
  }

  public async removeUserViewport(userId: string): Promise<void> {
    try {
      const viewportKey = `viewport:${userId}`;

      // Remove from GEO index first
      await this.redisPub.zrem("viewport:geo", viewportKey);

      // Then remove viewport data
      await this.redisPub.del(viewportKey);

      if (process.env.NODE_ENV !== "production") {
        console.log(`Removed viewport data for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error removing viewport for user ${userId}:`, error);
    }
  }

  public async getIntersectingViewports(
    eventBounds: BoundingBox,
  ): Promise<{ userId: string; viewport: BoundingBox }[]> {
    const intersectingViewports: { userId: string; viewport: BoundingBox }[] =
      [];

    try {
      // Calculate the center point of the event
      const centerLng = (eventBounds.minX + eventBounds.maxX) / 2;
      const centerLat = (eventBounds.minY + eventBounds.maxY) / 2;

      // Use a fixed search radius of 50km to ensure we catch all potentially relevant viewports
      const SEARCH_RADIUS_METERS = 50000;

      // Use GEORADIUS to find nearby viewports
      const nearbyViewports = (await this.redisPub.georadius(
        "viewport:geo",
        centerLng,
        centerLat,
        SEARCH_RADIUS_METERS,
        "m", // meters
        "WITHDIST", // include distance
        "ASC", // sort by distance
      )) as [string, string][]; // Type assertion for GEORADIUS response

      // Process results
      for (const [viewportKey] of nearbyViewports) {
        const userId = viewportKey.replace("viewport:", "");
        const viewportData = await this.redisPub.get(viewportKey);

        if (viewportData) {
          const viewport = JSON.parse(viewportData);

          // Double-check intersection (GEORADIUS is approximate)
          if (this.boundsIntersect(eventBounds, viewport)) {
            intersectingViewports.push({ userId, viewport });
          }
        }
      }
    } catch (error) {
      console.error("Error querying intersecting viewports:", error);
    }

    return intersectingViewports;
  }

  public getEventsInViewport(viewport: BoundingBox): Event[] {
    try {
      // Query spatial index for events in viewport
      const spatialItems = this.spatialIndex.search(viewport);

      // Deduplicate spatial items by ID
      const uniqueSpatialItems = Array.from(
        new Map(spatialItems.map((item) => [item.id, item])).values(),
      );

      // Get the full events from cache
      return uniqueSpatialItems
        .map((item) => this.eventCache.get(item.id))
        .filter(Boolean) as Event[];
    } catch (error) {
      console.error("Error getting events in viewport:", error);
      return [];
    }
  }

  public isEventInViewport(event: Event, viewport: BoundingBox): boolean {
    const [lng, lat] = event.location.coordinates;

    return (
      lng >= viewport.minX &&
      lng <= viewport.maxX &&
      lat >= viewport.minY &&
      lat <= viewport.maxY
    );
  }

  private boundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.maxX < b.minX ||
      a.minX > b.maxX ||
      a.maxY < b.minY ||
      a.minY > b.maxY
    );
  }
}
