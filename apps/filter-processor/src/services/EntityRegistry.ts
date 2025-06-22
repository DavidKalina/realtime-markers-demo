import type {
  EntityRegistry as IEntityRegistry,
  EntityTypeConfig,
  EntityProcessor,
  EntityInitializationService,
  EntityCacheService,
  FilteringStrategy,
  SpatialEntity,
} from "../types/entities";

export class EntityRegistry implements IEntityRegistry {
  private entityTypes = new Map<string, EntityTypeConfig>();
  private processors = new Map<string, EntityProcessor>();
  private initializationServices = new Map<
    string,
    EntityInitializationService
  >();
  private cacheServices = new Map<string, EntityCacheService>();
  private filteringStrategies = new Map<string, FilteringStrategy>();

  registerEntityType<T = unknown>(
    config: EntityTypeConfig,
    processor: EntityProcessor<T>,
    initializationService: EntityInitializationService,
    cacheService: EntityCacheService<T>,
    filteringStrategy: FilteringStrategy<T>,
  ): void {
    const { type } = config;

    this.entityTypes.set(type, config);
    this.processors.set(type, processor);
    this.initializationServices.set(type, initializationService);
    this.cacheServices.set(type, cacheService);
    this.filteringStrategies.set(type, filteringStrategy);

    console.log(
      `[EntityRegistry] Registered entity type: ${type} with filtering strategy: ${config.filtering.strategy}`,
    );
  }

  getEntityType(type: string): EntityTypeConfig | undefined {
    return this.entityTypes.get(type);
  }

  getProcessor(type: string): EntityProcessor | undefined {
    return this.processors.get(type);
  }

  getInitializationService(
    type: string,
  ): EntityInitializationService | undefined {
    return this.initializationServices.get(type);
  }

  getCacheService(type: string): EntityCacheService | undefined {
    return this.cacheServices.get(type);
  }

  getFilteringStrategy(type: string): FilteringStrategy | undefined {
    return this.filteringStrategies.get(type);
  }

  getAllEntityTypes(): string[] {
    return Array.from(this.entityTypes.keys());
  }

  getAllProcessors(): EntityProcessor[] {
    return Array.from(this.processors.values());
  }

  getAllInitializationServices(): EntityInitializationService[] {
    return Array.from(this.initializationServices.values());
  }

  getAllCacheServices(): EntityCacheService[] {
    return Array.from(this.cacheServices.values());
  }

  getAllFilteringStrategies(): FilteringStrategy[] {
    return Array.from(this.filteringStrategies.values());
  }

  /**
   * Initialize all registered entity types
   */
  async initializeAllEntities(): Promise<void> {
    const services = this.getAllInitializationServices();

    console.log(
      `[EntityRegistry] Initializing ${services.length} entity types...`,
    );

    await Promise.all(
      services.map(async (service) => {
        try {
          await service.initializeEntities();
          console.log(`[EntityRegistry] Initialized ${service.entityType}`);
        } catch (error) {
          console.error(
            `[EntityRegistry] Failed to initialize ${service.entityType}:`,
            error,
          );
        }
      }),
    );
  }

  /**
   * Process an entity update using the appropriate processor
   */
  async processEntityUpdate(
    entityType: string,
    operation: string,
    entity: SpatialEntity,
  ): Promise<void> {
    const processor = this.getProcessor(entityType);
    if (!processor) {
      throw new Error(`No processor found for entity type: ${entityType}`);
    }

    await processor.processEntity(operation, entity);
  }

  /**
   * Get all entities in viewport across all entity types
   */
  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: SpatialEntity[] }[] {
    return this.getAllCacheServices().map((cacheService) => ({
      type: cacheService.entityType,
      entities: cacheService.getEntitiesInViewport(viewport) as SpatialEntity[],
    }));
  }

  /**
   * Get stats for all entity types
   */
  getAllStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};

    for (const [type, cacheService] of this.cacheServices) {
      stats[type] = {
        ...cacheService.getStats(),
        filteringStrategy: this.filteringStrategies.get(type)?.getStats(),
      };
    }

    return stats;
  }
}
