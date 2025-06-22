import type { Point } from "geojson";

/**
 * Base interface for all spatial entities that can be processed by the filter processor
 */
export interface SpatialEntity {
  id: string;
  type?: string;
  location?: Point;
  creatorId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown;
}

/**
 * Filtering strategy interface for different entity types
 */
export interface FilteringStrategy<T = unknown> {
  readonly entityType: string;

  /**
   * Filter entities based on the strategy's algorithm
   */
  filterEntities(
    entities: T[],
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
      maxResults?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<Array<T & { relevanceScore?: number }>>;

  /**
   * Update strategy configuration
   */
  updateConfig(config: Record<string, unknown>): void;

  /**
   * Get strategy statistics
   */
  getStats(): Record<string, unknown>;
}

/**
 * Entity type registry for extensible entity handling
 */
export interface EntityTypeConfig {
  type: string;
  displayName: string;
  hasLocation: boolean;
  isPublic: boolean;
  supportsImages: boolean;
  supportsCategories: boolean;
  relevanceScoring: {
    enabled: boolean;
    weights: {
      time?: number;
      distance?: number;
      popularity?: number;
    };
  };
  filtering: {
    supportedFilters: string[];
    defaultFilters: Record<string, unknown>;
    strategy: string; // Strategy name (e.g., "mapmoji", "simple", "none")
  };
  webSocket: {
    messageTypes: {
      add: string;
      update: string;
      delete: string;
      discovered: string;
    };
    redisChannels: {
      changes: string;
      discovered: string;
    };
  };
}

/**
 * Entity processor interface for handling different entity types
 */
export interface EntityProcessor<T = unknown> {
  readonly entityType: string;

  // Core processing methods
  processEntity(operation: string, entity: T): Promise<void>;
  validateEntity(entity: T): boolean;
  normalizeEntity(data: unknown): T;

  // Spatial operations
  getSpatialBounds(
    entity: T,
  ): { minX: number; minY: number; maxX: number; maxY: number } | null;
  isInViewport(
    entity: T,
    viewport: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean;

  // Relevance scoring
  calculateRelevanceScore(
    entity: T,
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
    },
  ): number;

  // Access control
  isAccessible(entity: T, userId: string): boolean;

  // WebSocket formatting
  formatForWebSocket(entity: T, operation: string): Record<string, unknown>;
}

/**
 * Entity initialization service interface
 */
export interface EntityInitializationService {
  readonly entityType: string;
  initializeEntities(): Promise<void>;
  clearAllEntities(): void;
  getStats(): Record<string, unknown>;
}

/**
 * Entity cache service interface
 */
export interface EntityCacheService<T = unknown> {
  readonly entityType: string;

  // CRUD operations
  addEntity(entity: T): void;
  updateEntity(entity: T): void;
  removeEntity(entityId: string): void;
  getEntity(entityId: string): T | undefined;
  getAllEntities(): T[];

  // Spatial operations
  addToSpatialIndex(entity: T): void;
  updateSpatialIndex(entity: T): void;
  removeFromSpatialIndex(entityId: string): void;
  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): T[];

  // Bulk operations
  clearAll(): void;
  bulkLoad(entities: T[]): void;

  // Stats
  getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
  };
}

/**
 * Entity registry for managing different entity types
 */
export interface EntityRegistry {
  registerEntityType<T = unknown>(
    config: EntityTypeConfig,
    processor: EntityProcessor<T>,
    initializationService: EntityInitializationService,
    cacheService: EntityCacheService<T>,
    filteringStrategy: FilteringStrategy<T>,
  ): void;

  getEntityType(type: string): EntityTypeConfig | undefined;
  getProcessor(type: string): EntityProcessor | undefined;
  getInitializationService(
    type: string,
  ): EntityInitializationService | undefined;
  getCacheService(type: string): EntityCacheService | undefined;
  getFilteringStrategy(type: string): FilteringStrategy | undefined;

  getAllEntityTypes(): string[];
  getAllProcessors(): EntityProcessor[];
  getAllInitializationServices(): EntityInitializationService[];
  getAllCacheServices(): EntityCacheService[];
  getAllFilteringStrategies(): FilteringStrategy[];

  // Entity processing
  processEntityUpdate(
    entityType: string,
    operation: string,
    entity: unknown,
  ): Promise<void>;

  initializeAllEntities(): Promise<void>;
  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: unknown[] }[];
  getAllStats(): Record<string, unknown>;
}

/**
 * Unified message handler for all entity types
 */
export interface UnifiedMessageHandler {
  handleEntityMessage(
    entityType: string,
    operation: string,
    data: unknown,
  ): Promise<{
    success: boolean;
    entityType: string;
    operation: string;
    entityId: string;
    affectedUsersCount: number;
    processingTimeMs: number;
    error?: string;
  }>;

  getAffectedUsers(
    entityType: string,
    entity: SpatialEntity,
    operation: string,
  ): Promise<Set<string>>;

  handleRedisMessage(channel: string, message: string): Promise<void>;
  getSupportedEntityTypes(): string[];
  getRedisChannels(): string[];
  trackUserViewport(
    entityType: string,
    userId: string,
    viewport: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    },
  ): void;
  removeUserViewport(entityType: string, userId: string): void;
  getMetrics(): Record<string, unknown>;
  clearMetrics(): void;
}
