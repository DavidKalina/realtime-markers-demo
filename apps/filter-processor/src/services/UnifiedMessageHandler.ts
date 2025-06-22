import type {
  UnifiedMessageHandler as IUnifiedMessageHandler,
  SpatialEntity,
  EntityRegistry,
  EntityProcessor,
} from "../types/entities";
import type { Redis } from "ioredis";

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
    totalProcessingTimeMs: 0,
    averageProcessingTimeMs: 0,
    lastProcessedAt: null as Date | null,
    entityTypeStats: new Map<string, { processed: number; failed: number }>(),
  };

  private readonly activeViewports = new Map<string, Set<string>>(); // entityType -> Set<userId>
  private readonly messageQueue: Array<{
    entityType: string;
    operation: string;
    data: unknown;
    timestamp: number;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly entityRegistry: EntityRegistry,
    private readonly redisPub?: Redis,
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
    };
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

    // Validate and normalize entity data
    const entity = this.validateAndNormalizeEntity(processor, data, entityType);
    const entityId = (entity as { id: string }).id;

    // Process with retry logic
    await this.processWithRetry(processor, operation, entity);

    // Get affected users
    const affectedUsers = await this.getAffectedUsers(
      entityType,
      entity as SpatialEntity,
      operation,
    );

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
  ): unknown {
    try {
      // Normalize the entity data
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

    if (!processor) {
      return affectedUsers;
    }

    // Add entity creator for updates/deletes
    if (
      (operation === "update" || operation === "delete") &&
      entity.creatorId
    ) {
      affectedUsers.add(entity.creatorId);
    }

    // Get users in viewport for new entities or updates
    if (entity.location && (operation === "add" || operation === "update")) {
      const viewportUsers = await this.getUsersInEntityViewport(
        entityType,
        entity,
        processor,
      );

      viewportUsers.forEach((userId) => affectedUsers.add(userId));
    }

    // Limit the number of affected users to prevent performance issues
    if (affectedUsers.size > this.config.maxAffectedUsersPerUpdate) {
      const limitedUsers = new Set<string>();
      let count = 0;
      for (const userId of affectedUsers) {
        if (count >= this.config.maxAffectedUsersPerUpdate) break;
        limitedUsers.add(userId);
        count++;
      }
      console.warn(
        `[UnifiedMessageHandler] Limited affected users from ${affectedUsers.size} to ${limitedUsers.size} for ${entityType} ${entity.id}`,
      );
      return limitedUsers;
    }

    return affectedUsers;
  }

  private async getUsersInEntityViewport(
    entityType: string,
    entity: SpatialEntity,
    processor: EntityProcessor,
  ): Promise<Set<string>> {
    const users = new Set<string>();

    if (!this.config.enableViewportTracking) {
      return users;
    }

    try {
      // Get spatial bounds of the entity
      const bounds = processor.getSpatialBounds(entity);
      if (!bounds) {
        return users;
      }

      // Get active viewports for this entity type
      const activeViewports = this.activeViewports.get(entityType);
      if (!activeViewports) {
        return users;
      }

      // Check which users have viewports that intersect with the entity
      for (const userId of activeViewports) {
        // This is a simplified check - in a real implementation,
        // you'd want to store actual viewport data and check intersection
        users.add(userId);
      }

      // For now, we'll add a small buffer around the entity bounds
      // and assume users within that area might be affected
      const buffer = 0.01; // ~1km buffer
      const bufferedBounds = {
        minX: bounds.minX - buffer,
        minY: bounds.minY - buffer,
        maxX: bounds.maxX + buffer,
        maxY: bounds.maxY + buffer,
      };

      // This would need to be implemented with actual viewport tracking
      console.log(
        `[UnifiedMessageHandler] Entity ${entity.id} affects area:`,
        bufferedBounds,
      );
    } catch (error) {
      console.error(
        `[UnifiedMessageHandler] Error getting users in viewport for ${entityType}:`,
        error,
      );
    }

    return users;
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

      // Format entity for WebSocket
      const formattedEntity = processor.formatForWebSocket(entity, operation);

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
  trackUserViewport(entityType: string, userId: string): void {
    if (!this.config.enableViewportTracking) return;

    if (!this.activeViewports.has(entityType)) {
      this.activeViewports.set(entityType, new Set());
    }

    const viewportSet = this.activeViewports.get(entityType);
    if (viewportSet) {
      viewportSet.add(userId);
    }

    // Store viewport data (simplified - in real implementation you'd want to store the actual viewport)
    console.log(
      `[UnifiedMessageHandler] Tracking viewport for user ${userId} on ${entityType}`,
    );
  }

  /**
   * Remove user viewport tracking
   */
  removeUserViewport(entityType: string, userId: string): void {
    this.activeViewports.get(entityType)?.delete(userId);
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
      activeViewportsCount: Array.from(this.activeViewports.values()).reduce(
        (sum, users) => sum + users.size,
        0,
      ),
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
