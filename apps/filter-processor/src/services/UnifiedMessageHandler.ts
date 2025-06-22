import type {
  UnifiedMessageHandler as IUnifiedMessageHandler,
  SpatialEntity,
  EntityRegistry,
  EntityProcessor,
} from "../types/entities";
import type { Redis } from "ioredis";
import { ViewportProcessor } from "../handlers/ViewportProcessor";

export interface UnifiedMessageHandlerConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  enableMetrics?: boolean;
  enableWebSocketNotifications?: boolean;
  enableViewportTracking?: boolean;
  maxAffectedUsersPerUpdate?: number;
  batchProcessingEnabled?: boolean;
  batchSize?: number;
  batchTimeoutMs?: number;
  onUserDirty?: (
    userId: string,
    context?: {
      reason: string;
      entityId?: string;
      operation?: string;
      timestamp?: number;
    },
  ) => void;
}

export interface MessageProcessingResult {
  success: boolean;
  entityType: string;
  operation: string;
  entityId: string;
  affectedUsersCount: number;
  processingTimeMs: number;
  error?: string;
}

export class UnifiedMessageHandler implements IUnifiedMessageHandler {
  private readonly config: Required<UnifiedMessageHandlerConfig>;
  private readonly metrics = {
    messagesProcessed: 0,
    messagesFailed: 0,
    entitiesProcessed: 0,
    errors: 0,
    processingTimes: [] as number[],
    totalProcessingTimeMs: 0,
    averageProcessingTimeMs: 0,
    lastProcessedAt: null as Date | null,
    entityTypeStats: new Map<string, { processed: number; failed: number }>(),
  };

  private readonly messageQueue: Array<{
    entityType: string;
    operation: string;
    data: unknown;
    timestamp: number;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  private readonly onUserDirty?: (
    userId: string,
    context?: {
      reason: string;
      entityId?: string;
      operation?: string;
      timestamp?: number;
    },
  ) => void;

  constructor(
    private readonly entityRegistry: EntityRegistry,
    private readonly redisPub?: Redis,
    private readonly viewportProcessor?: ViewportProcessor,
    config: UnifiedMessageHandlerConfig = {},
  ) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      enableMetrics: config.enableMetrics ?? true,
      enableWebSocketNotifications: config.enableWebSocketNotifications ?? true,
      enableViewportTracking: config.enableViewportTracking ?? true,
      maxAffectedUsersPerUpdate: config.maxAffectedUsersPerUpdate ?? 1000,
      batchProcessingEnabled: config.batchProcessingEnabled ?? false,
      batchSize: config.batchSize ?? 10,
      batchTimeoutMs: config.batchTimeoutMs ?? 100,
    } as Required<UnifiedMessageHandlerConfig>;

    // Store the optional callback separately
    this.onUserDirty = config.onUserDirty;
  }

  async handleEntityMessage(
    entityType: string,
    operation: string,
    data: unknown,
  ): Promise<MessageProcessingResult> {
    const startTime = Date.now();
    const result: MessageProcessingResult = {
      success: false,
      entityType,
      operation,
      entityId: "",
      affectedUsersCount: 0,
      processingTimeMs: 0,
    };

    try {
      // Add to batch queue if enabled
      if (this.config.batchProcessingEnabled) {
        this.messageQueue.push({
          entityType,
          operation,
          data,
          timestamp: Date.now(),
        });

        if (this.messageQueue.length >= this.config.batchSize) {
          await this.processBatch();
        } else if (!this.batchTimeout) {
          this.batchTimeout = setTimeout(() => {
            this.processBatch().catch(console.error);
          }, this.config.batchTimeoutMs);
        }

        result.success = true;
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }

      // Process immediately
      return await this.processSingleMessage(
        entityType,
        operation,
        data,
        startTime,
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.processingTimeMs = Date.now() - startTime;
      this.updateMetrics(entityType, false);
      console.error(
        `[UnifiedMessageHandler] Error processing ${entityType} ${operation}:`,
        error,
      );
      return result;
    }
  }

  private async processSingleMessage(
    entityType: string,
    operation: string,
    data: unknown,
    startTime: number,
  ): Promise<MessageProcessingResult> {
    const processor = this.entityRegistry.getProcessor(entityType);
    if (!processor) {
      throw new Error(`No processor found for entity type: ${entityType}`);
    }

    // For DELETE operations, we need to get the affected users BEFORE processing the deletion
    // because once the entity is removed from cache, we can't determine which users had it in their viewport
    let affectedUsers = new Set<string>();
    let entity: unknown;
    let entityId: string;

    if (operation.toUpperCase() === "DELETE") {
      // For DELETE operations, extract coordinates from the deletion message
      const entityData = data as Record<string, unknown>;
      if (!entityData.id || typeof entityData.id !== "string") {
        throw new Error("Missing required entity ID for deletion");
      }

      entityId = entityData.id;

      // Debug logging to see what data we're receiving
      console.log("[UnifiedMessageHandler] DELETE operation data:", {
        entityId,
        entityData,
        hasLocation: !!entityData.location,
        locationType: typeof entityData.location,
        locationKeys: entityData.location
          ? Object.keys(entityData.location as object)
          : null,
      });

      // Extract coordinates if available in the deletion message
      let coordinates: [number, number] | undefined;
      if (entityData.location && typeof entityData.location === "object") {
        const location = entityData.location as Record<string, unknown>;
        if (
          location.coordinates &&
          Array.isArray(location.coordinates) &&
          location.coordinates.length >= 2
        ) {
          coordinates = [
            location.coordinates[0] as number,
            location.coordinates[1] as number,
          ];
          console.log(
            "[UnifiedMessageHandler] Extracted coordinates for DELETE:",
            coordinates,
          );
        }
      }

      // For DELETE, use minimal entity data for processing
      entity = { id: entityId };

      // Get affected users AFTER deletion using coordinates if available
      if (coordinates) {
        // Create a minimal entity with location for affected user calculation
        const minimalEntity = {
          id: entityId,
          location: {
            type: "Point" as const,
            coordinates,
          },
          creatorId: entityData.creatorId as string | undefined,
          sharedWith: entityData.sharedWith as
            | Array<{ sharedWithId: string }>
            | undefined,
          createdAt:
            (entityData.createdAt as string) || new Date().toISOString(),
          updatedAt:
            (entityData.updatedAt as string) || new Date().toISOString(),
        } as SpatialEntity;

        affectedUsers = await this.getAffectedUsers(
          entityType,
          minimalEntity,
          operation,
        );
      } else {
        // No coordinates available, just notify creator if available
        if (entityData.creatorId && typeof entityData.creatorId === "string") {
          affectedUsers.add(entityData.creatorId);
        }
      }
    } else {
      // For CREATE and UPDATE operations, validate and normalize the full entity
      entity = this.validateAndNormalizeEntity(
        processor,
        data,
        entityType,
        operation,
      );
      entityId = (entity as { id: string }).id;

      // Get affected users for CREATE and UPDATE operations
      affectedUsers = await this.getAffectedUsers(
        entityType,
        entity as SpatialEntity,
        operation,
      );
    }

    // Process with retry logic
    await this.processWithRetry(processor, operation, entity);

    // Mark affected users as dirty if callback is provided
    if (this.onUserDirty && affectedUsers.size > 0) {
      for (const userId of affectedUsers) {
        this.onUserDirty(userId, {
          reason: "entity_update",
          entityId,
          operation,
          timestamp: Date.now(),
        });
      }
    }

    // Send WebSocket notifications
    if (this.config.enableWebSocketNotifications && affectedUsers.size > 0) {
      await this.sendWebSocketNotifications(
        entityType,
        operation,
        entity,
        affectedUsers,
      );
    }

    const processingTime = Date.now() - startTime;
    this.updateMetrics(entityType, true, processingTime);

    console.log(
      `[UnifiedMessageHandler] Processed ${operation} for ${entityType} ${entityId} in ${processingTime}ms (${affectedUsers.size} affected users)`,
    );

    return {
      success: true,
      entityType,
      operation,
      entityId,
      affectedUsersCount: affectedUsers.size,
      processingTimeMs: processingTime,
    };
  }

  private async processBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.messageQueue.length === 0) return;

    const batch = this.messageQueue.splice(0, this.config.batchSize);
    const startTime = Date.now();

    console.log(
      `[UnifiedMessageHandler] Processing batch of ${batch.length} messages`,
    );

    const results = await Promise.allSettled(
      batch.map(({ entityType, operation, data }) =>
        this.processSingleMessage(entityType, operation, data, Date.now()),
      ),
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `[UnifiedMessageHandler] Batch completed: ${successful} successful, ${failed} failed in ${Date.now() - startTime}ms`,
    );
  }

  private validateAndNormalizeEntity(
    processor: EntityProcessor,
    data: unknown,
    entityType: string,
    operation?: string,
  ): unknown {
    try {
      // For DELETE operations, we only need the entity ID
      if (operation?.toUpperCase() === "DELETE") {
        if (typeof data !== "object" || data === null) {
          throw new Error("Invalid entity data for deletion");
        }

        const entityData = data as Record<string, unknown>;
        if (!entityData.id || typeof entityData.id !== "string") {
          throw new Error("Missing required entity ID for deletion");
        }

        // For DELETE, return a minimal object with just the ID
        return { id: entityData.id };
      }

      // For CREATE and UPDATE operations, normalize and validate the full entity
      const entity = processor.normalizeEntity(data);

      // Validate the entity
      if (!processor.validateEntity(entity)) {
        throw new Error(`Invalid entity data for type: ${entityType}`);
      }

      return entity;
    } catch (error) {
      console.warn(
        `[UnifiedMessageHandler] Entity validation failed for ${entityType}:`,
        error,
      );
      throw error;
    }
  }

  private async processWithRetry(
    processor: EntityProcessor,
    operation: string,
    entity: unknown,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await processor.processEntity(operation, entity);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          console.warn(
            `[UnifiedMessageHandler] Attempt ${attempt} failed, retrying in ${this.config.retryDelayMs}ms:`,
            lastError.message,
          );
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    throw lastError || new Error("Processing failed after all retries");
  }

  async getAffectedUsers(
    entityType: string,
    entity: SpatialEntity,
    operation: string,
  ): Promise<Set<string>> {
    const affectedUsers = new Set<string>();
    const processor = this.entityRegistry.getProcessor(entityType);
    const entityConfig = this.entityRegistry.getEntityType(entityType);

    if (!processor || !entityConfig) {
      return affectedUsers;
    }

    // 1. Add entity creator for CREATE, updates, and deletes
    if (
      (operation === "CREATE" ||
        operation === "add" ||
        operation === "update" ||
        operation === "delete") &&
      entity.creatorId
    ) {
      affectedUsers.add(entity.creatorId);
    }

    // 2. Add users whose explicitly sharedWith list contains the entity (if applicable)
    if (entity.sharedWith && Array.isArray(entity.sharedWith)) {
      (entity.sharedWith as Array<{ sharedWithId: string }>).forEach(
        (share) => {
          affectedUsers.add(share.sharedWithId);
        },
      );
    }

    // 3. Find users whose viewports intersect the entity's location
    if (
      entityConfig.hasLocation &&
      entity.location &&
      (operation === "CREATE" ||
        operation === "add" ||
        operation === "update" ||
        operation === "DELETE")
    ) {
      const entityBounds = processor.getSpatialBounds(entity);
      if (entityBounds && this.viewportProcessor) {
        try {
          const intersectingViewportUsers =
            await this.viewportProcessor.getIntersectingViewports(entityBounds);

          console.log(
            `[UnifiedMessageHandler] Found ${intersectingViewportUsers.length} users with intersecting viewports for ${operation} operation on ${entityType} ${entity.id}`,
          );

          for (const { userId } of intersectingViewportUsers) {
            // Further check: Does this user have access to this specific entity?
            if (processor.isAccessible(entity, userId)) {
              affectedUsers.add(userId);
              console.log(
                `[UnifiedMessageHandler] Added user ${userId} to affected users for ${operation} operation on ${entityType} ${entity.id}`,
              );
            }
          }
        } catch (error) {
          console.error(
            `[UnifiedMessageHandler] Error getting intersecting viewports for entity ${entity.id}:`,
            error,
          );
        }
      }
    }

    // 4. Limit the number of affected users to prevent performance issues
    if (affectedUsers.size > this.config.maxAffectedUsersPerUpdate) {
      const originalSize = affectedUsers.size;
      const limitedUsers = new Set<string>();
      let count = 0;
      for (const userId of affectedUsers) {
        if (count >= this.config.maxAffectedUsersPerUpdate) break;
        limitedUsers.add(userId);
        count++;
      }
      console.warn(
        `[UnifiedMessageHandler] Limited affected users from ${originalSize} to ${limitedUsers.size} for ${entityType} ${entity.id}`,
      );
      return limitedUsers;
    }

    return affectedUsers;
  }

  private async sendWebSocketNotifications(
    entityType: string,
    operation: string,
    entity: unknown,
    affectedUsers: Set<string>,
  ): Promise<void> {
    if (!this.redisPub) {
      console.warn(
        "[UnifiedMessageHandler] Redis publisher not available for WebSocket notifications",
      );
      return;
    }

    try {
      const processor = this.entityRegistry.getProcessor(entityType);
      if (!processor) return;

      const config = this.entityRegistry.getEntityType(entityType);
      if (!config) return;

      // For DELETE operations, we only need the entity ID, not the full formatted entity
      let formattedEntity: Record<string, unknown>;
      if (operation.toUpperCase() === "DELETE") {
        formattedEntity = {
          type: entityType,
          operation,
          data: {
            id: (entity as { id: string }).id,
          },
        };
      } else {
        // For CREATE and UPDATE operations, format the full entity
        formattedEntity = processor.formatForWebSocket(entity, operation);
      }

      // Get the message type, handling potential undefined access
      const messageTypes = config.webSocket.messageTypes;
      const messageType =
        messageTypes[operation as keyof typeof messageTypes] || operation;

      // Send notification to each affected user
      const notificationPromises = Array.from(affectedUsers).map((userId) =>
        this.redisPub!.publish(
          `user:${userId}:notifications`,
          JSON.stringify({
            type: messageType,
            entityType,
            data: formattedEntity,
            timestamp: new Date().toISOString(),
          }),
        ),
      );

      await Promise.all(notificationPromises);

      console.log(
        `[UnifiedMessageHandler] Sent ${affectedUsers.size} WebSocket notifications for ${entityType} ${operation}`,
      );
    } catch (error) {
      console.error(
        `[UnifiedMessageHandler] Error sending WebSocket notifications:`,
        error,
      );
    }
  }

  /**
   * Handle Redis messages for any entity type
   */
  async handleRedisMessage(channel: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      // Extract entity type and operation from channel name
      // Expected format: entity_type:operation (e.g., "event:created", "civic_engagement:updated")
      const [entityType, operation] = channel.split(":");

      if (!entityType || !operation) {
        console.warn(
          `[UnifiedMessageHandler] Invalid channel format: ${channel}`,
        );
        return;
      }

      await this.handleEntityMessage(entityType, operation, data);
    } catch (error) {
      console.error(
        `[UnifiedMessageHandler] Error handling Redis message from ${channel}:`,
        error,
      );
    }
  }

  /**
   * Track user viewport for affected user calculation
   */
  trackUserViewport(
    entityType: string,
    userId: string,
    viewport: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    },
  ): void {
    if (!this.config.enableViewportTracking || !this.viewportProcessor) return;

    this.viewportProcessor.updateUserViewport(userId, viewport);
  }

  /**
   * Remove user viewport tracking
   */
  removeUserViewport(entityType: string, userId: string): void {
    if (this.viewportProcessor) {
      this.viewportProcessor.removeUserViewport(userId);
    }
  }

  /**
   * Get all supported entity types
   */
  getSupportedEntityTypes(): string[] {
    return this.entityRegistry.getAllEntityTypes();
  }

  /**
   * Get Redis channels to subscribe to
   */
  getRedisChannels(): string[] {
    const channels: string[] = [];

    for (const entityType of this.entityRegistry.getAllEntityTypes()) {
      const config = this.entityRegistry.getEntityType(entityType);
      if (config) {
        channels.push(config.webSocket.redisChannels.changes);
        channels.push(config.webSocket.redisChannels.discovered);
      }
    }

    return channels;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Record<string, unknown> {
    if (!this.config.enableMetrics) {
      return { metricsDisabled: true };
    }

    const entityTypeStats: Record<string, unknown> = {};
    for (const [entityType, stats] of this.metrics.entityTypeStats) {
      entityTypeStats[entityType] = {
        processed: stats.processed,
        failed: stats.failed,
        successRate: stats.processed / (stats.processed + stats.failed),
      };
    }

    return {
      messagesProcessed: this.metrics.messagesProcessed,
      messagesFailed: this.metrics.messagesFailed,
      totalProcessingTimeMs: this.metrics.totalProcessingTimeMs,
      averageProcessingTimeMs: this.metrics.averageProcessingTimeMs,
      lastProcessedAt: this.metrics.lastProcessedAt,
      entityTypeStats,
      activeViewportsCount: 0, // ViewportProcessor handles this now
      queueSize: this.messageQueue.length,
      batchProcessingEnabled: this.config.batchProcessingEnabled,
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.messagesProcessed = 0;
    this.metrics.messagesFailed = 0;
    this.metrics.totalProcessingTimeMs = 0;
    this.metrics.averageProcessingTimeMs = 0;
    this.metrics.lastProcessedAt = null;
    this.metrics.entityTypeStats.clear();
  }

  /**
   * Update metrics for an entity type
   */
  private updateMetrics(
    entityType: string,
    success: boolean,
    processingTimeMs?: number,
  ): void {
    if (!this.config.enableMetrics) return;

    if (success) {
      this.metrics.messagesProcessed++;
    } else {
      this.metrics.messagesFailed++;
    }

    if (processingTimeMs) {
      this.metrics.totalProcessingTimeMs += processingTimeMs;
      this.metrics.averageProcessingTimeMs =
        this.metrics.totalProcessingTimeMs / this.metrics.messagesProcessed;
    }

    this.metrics.lastProcessedAt = new Date();

    // Update entity type stats
    if (!this.metrics.entityTypeStats.has(entityType)) {
      this.metrics.entityTypeStats.set(entityType, { processed: 0, failed: 0 });
    }

    const stats = this.metrics.entityTypeStats.get(entityType)!;
    if (success) {
      stats.processed++;
    } else {
      stats.failed++;
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
