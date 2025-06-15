import type { JobHandler, JobHandlerContext } from "./BaseJobHandler";
import { ProcessFlyerHandler } from "./ProcessFlyerHandler";
import { ProcessPrivateEventHandler } from "./ProcessPrivateEventHandler";
import { CleanupEventsHandler } from "./CleanupEventsHandler";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { EventService } from "../../services/EventService";
import { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import { PlanService } from "../../services/PlanService";
import { StorageService } from "../../services/shared/StorageService";

export class JobHandlerRegistry {
  private handlers: Map<string, JobHandler> = new Map();

  constructor(
    private readonly eventProcessingService: EventProcessingService,
    private readonly eventService: EventService,
    private readonly jobQueue: JobQueue,
    private readonly redisService: RedisService,
    private readonly planService: PlanService,
    private readonly storageService: StorageService,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Register all job handlers
    this.registerHandler(
      new ProcessFlyerHandler(
        this.eventProcessingService,
        this.eventService,
        this.planService,
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
