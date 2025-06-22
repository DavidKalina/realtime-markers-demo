import type { EntityProcessor, SpatialEntity } from "../../types/entities";
import type { Event, CivicEngagement, Point } from "../../types/types";
import { EventProcessor } from "./EventProcessor";
import { CivicEngagementProcessor } from "./CivicEngagementProcessor";
import { UnifiedSpatialCacheService } from "../UnifiedSpatialCacheService";

export class UnifiedEntityProcessor implements EntityProcessor {
  public readonly entityType = "unified";
  private eventProcessor: EventProcessor;
  private civicEngagementProcessor: CivicEngagementProcessor;
  private eventCacheService: UnifiedSpatialCacheService;

  constructor(eventCacheService: UnifiedSpatialCacheService) {
    this.eventCacheService = eventCacheService;
    this.eventProcessor = new EventProcessor(eventCacheService);
    this.civicEngagementProcessor = new CivicEngagementProcessor(
      eventCacheService,
    );
  }

  /**
   * Process any entity type using the appropriate processor
   */
  async processEntity(operation: string, entity: SpatialEntity): Promise<void> {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      throw new Error(`No processor found for entity type: ${entityType}`);
    }

    await processor.processEntity(operation, entity);
  }

  /**
   * Validate an entity using the appropriate processor
   */
  validateEntity(entity: unknown): boolean {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      console.warn(`No processor found for entity type: ${entityType}`);
      return false;
    }

    return processor.validateEntity(entity);
  }

  /**
   * Normalize entity data using the appropriate processor
   */
  normalizeEntity(data: unknown): unknown {
    const entityType = this.getEntityTypeFromEntity(data);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      throw new Error(`No processor found for entity type: ${entityType}`);
    }

    return processor.normalizeEntity(data);
  }

  /**
   * Get spatial bounds for an entity
   */
  getSpatialBounds(
    entity: unknown,
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      return null;
    }

    return processor.getSpatialBounds(entity);
  }

  /**
   * Check if entity is in viewport
   */
  isInViewport(
    entity: unknown,
    viewport: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      return false;
    }

    return processor.isInViewport(entity, viewport);
  }

  /**
   * Calculate relevance score for an entity
   */
  calculateRelevanceScore(
    entity: unknown,
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
    },
  ): number {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      return 0.5; // Default score
    }

    return processor.calculateRelevanceScore(entity, context);
  }

  /**
   * Check if entity is accessible to user
   */
  isAccessible(entity: unknown, userId: string): boolean {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      return true; // Default to accessible
    }

    return processor.isAccessible(entity, userId);
  }

  /**
   * Format entity for WebSocket transmission
   */
  formatForWebSocket(
    entity: unknown,
    operation: string,
  ): Record<string, unknown> {
    const entityType = this.getEntityTypeFromEntity(entity);
    const processor = this.getProcessor(entityType);
    if (!processor) {
      return {
        type: entityType,
        operation,
        data: entity,
      };
    }

    return processor.formatForWebSocket(entity, operation);
  }

  /**
   * Process an event specifically
   */
  async processEvent(operation: string, event: Event): Promise<void> {
    await this.eventProcessor.processEntity(operation, event);
  }

  /**
   * Process a civic engagement specifically
   */
  async processCivicEngagement(
    operation: string,
    civicEngagement: CivicEngagement,
  ): Promise<void> {
    await this.civicEngagementProcessor.processEntity(
      operation,
      civicEngagement,
    );
  }

  /**
   * Get the appropriate processor for an entity type
   */
  private getProcessor(entityType: string): EntityProcessor | undefined {
    switch (entityType.toLowerCase()) {
      case "event":
        return this.eventProcessor;
      case "civic_engagement":
        return this.civicEngagementProcessor;
      default:
        return undefined;
    }
  }

  /**
   * Determine entity type from entity data
   */
  private getEntityTypeFromEntity(entity: unknown): string {
    if (typeof entity === "object" && entity !== null) {
      const entityObj = entity as Record<string, unknown>;

      // Check for type field first
      if (entityObj.type && typeof entityObj.type === "string") {
        return entityObj.type;
      }

      // Check for specific fields that indicate entity type
      if (entityObj.startTime || entityObj.endTime || entityObj.eventDate) {
        return "event";
      }

      if (entityObj.status || entityObj.priority || entityObj.issueType) {
        return "civic_engagement";
      }

      // Check for table name or entity type in metadata
      if (entityObj.tableName && typeof entityObj.tableName === "string") {
        return entityObj.tableName;
      }
    }

    // Default fallback
    return "event";
  }

  /**
   * Get all supported entity types
   */
  getSupportedEntityTypes(): string[] {
    return ["event", "civic_engagement"];
  }

  /**
   * Get stats from all processors
   */
  getStats(): Record<string, unknown> {
    return {
      supportedEntityTypes: this.getSupportedEntityTypes(),
      eventProcessor: {
        entityType: this.eventProcessor.entityType,
      },
      civicEngagementProcessor: {
        entityType: this.civicEngagementProcessor.entityType,
      },
    };
  }
}
