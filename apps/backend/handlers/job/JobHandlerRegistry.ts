import type { JobHandler, JobHandlerContext } from "./BaseJobHandler";
import { ProcessFlyerHandler } from "./ProcessFlyerHandler";
import { ProcessPrivateEventHandler } from "./ProcessPrivateEventHandler";
import { CleanupEventsHandler } from "./CleanupEventsHandler";
import { ProcessCivicEngagementHandler } from "./ProcessCivicEngagementHandler";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { EventService } from "../../services/EventServiceRefactored";
import type { CivicEngagementService } from "../../services/CivicEngagementService";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import { StorageService } from "../../services/shared/StorageService";
import type { IEmbeddingService } from "../../services/event-processing/interfaces/IEmbeddingService";

export class JobHandlerRegistry {
  private handlers: Map<string, JobHandler> = new Map();

  constructor(
    private readonly eventProcessingService: EventProcessingService,
    private readonly eventService: EventService,
    private readonly civicEngagementService: CivicEngagementService,
    private readonly jobQueue: JobQueue,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
    private readonly embeddingService: IEmbeddingService,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Register all job handlers
    this.registerHandler(
      new ProcessFlyerHandler(
        this.eventProcessingService,
        this.eventService,
        this.storageService,
      ),
    );
    this.registerHandler(
      new ProcessPrivateEventHandler(
        this.eventProcessingService,
        this.eventService,
      ),
    );
    this.registerHandler(new CleanupEventsHandler(this.eventService));
    this.registerHandler(
      new ProcessCivicEngagementHandler(
        this.civicEngagementService,
        this.storageService,
        this.embeddingService,
      ),
    );
  }

  private registerHandler(handler: JobHandler): void {
    this.handlers.set(handler.jobType, handler);
  }

  getHandler(jobType: string): JobHandler | undefined {
    return this.handlers.get(jobType);
  }

  getAllHandlers(): JobHandler[] {
    return Array.from(this.handlers.values());
  }

  getContext(): JobHandlerContext {
    return {
      jobQueue: this.jobQueue,
      redisService: this.redisService,
    };
  }
}
