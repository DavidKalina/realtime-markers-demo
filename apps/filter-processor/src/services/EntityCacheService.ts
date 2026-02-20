import type { EntityCacheService as IEntityCacheService } from "../types/entities";
import type { Event } from "../types/types";
import type { UnifiedSpatialCacheService } from "./UnifiedSpatialCacheService";

/**
 * Entity-specific cache service that wraps the UnifiedSpatialCacheService
 */
export class EntityCacheService<T = unknown> implements IEntityCacheService<T> {
  readonly entityType: string;
  private unifiedCache: UnifiedSpatialCacheService;

  constructor(entityType: string, unifiedCache: UnifiedSpatialCacheService) {
    this.entityType = entityType;
    this.unifiedCache = unifiedCache;
  }

  addEntity(entity: T): void {
    if (this.entityType === "event") {
      this.unifiedCache.addEvent(entity as Event);
    }
  }

  updateEntity(entity: T): void {
    if (this.entityType === "event") {
      this.unifiedCache.updateEvent(entity as Event);
    }
  }

  removeEntity(entityId: string): void {
    if (this.entityType === "event") {
      this.unifiedCache.removeEvent(entityId);
    }
  }

  getEntity(entityId: string): T | undefined {
    if (this.entityType === "event") {
      return this.unifiedCache.getEvent(entityId) as T;
    }
    return undefined;
  }

  getAllEntities(): T[] {
    if (this.entityType === "event") {
      return this.unifiedCache.getAllEvents() as T[];
    }
    return [];
  }

  addToSpatialIndex(entity: T): void {
    if (this.entityType === "event") {
      this.unifiedCache.addToSpatialIndex(entity as Event);
    }
  }

  updateSpatialIndex(entity: T): void {
    if (this.entityType === "event") {
      this.unifiedCache.updateSpatialIndex(entity as Event);
    }
  }

  removeFromSpatialIndex(entityId: string): void {
    if (this.entityType === "event") {
      this.unifiedCache.removeFromSpatialIndex(entityId);
    }
  }

  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): T[] {
    const allEntities = this.unifiedCache.getEntitiesInViewport(viewport);
    const entityGroup = allEntities.find(
      (group) => group.type === this.entityType,
    );
    return entityGroup ? (entityGroup.entities as T[]) : [];
  }

  clearAll(): void {
    // Note: This clears ALL entities, not just this type
    // In a more sophisticated implementation, you might want to track by type
    this.unifiedCache.clearAll();
  }

  bulkLoad(entities: T[]): void {
    entities.forEach((entity) => this.addEntity(entity));
  }

  getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
  } {
    const unifiedStats = this.unifiedCache.getStats();

    if (this.entityType === "event") {
      return {
        cacheSize: unifiedStats.cacheSize,
        spatialIndexSize: unifiedStats.spatialIndexSize,
      };
    }

    return {
      cacheSize: 0,
      spatialIndexSize: 0,
    };
  }
}

/**
 * Factory function to create entity-specific cache services
 */
export function createEntityCacheService<T = unknown>(
  entityType: string,
  unifiedCache: UnifiedSpatialCacheService,
): EntityCacheService<T> {
  return new EntityCacheService<T>(entityType, unifiedCache);
}
