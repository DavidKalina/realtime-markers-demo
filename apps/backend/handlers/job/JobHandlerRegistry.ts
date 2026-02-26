import type { JobHandler, JobHandlerContext } from "./BaseJobHandler";
import { ProcessFlyerHandler } from "./ProcessFlyerHandler";
import { CleanupEventsHandler } from "./CleanupEventsHandler";
import { ImportEventsHandler } from "./ImportEventsHandler";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { EventService } from "../../services/EventServiceRefactored";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import { StorageService } from "../../services/shared/StorageService";
import type { TicketmasterService } from "../../services/TicketmasterService";
import type { CategoryProcessingService } from "../../services/CategoryProcessingService";
import type { IEmbeddingService } from "../../services/event-processing/interfaces/IEmbeddingService";

export class JobHandlerRegistry {
  private handlers: Map<string, JobHandler> = new Map();

  constructor(
    private readonly eventProcessingService: EventProcessingService,
    private readonly eventService: EventService,
    private readonly jobQueue: JobQueue,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
    private readonly ticketmasterService: TicketmasterService | null = null,
    private readonly categoryProcessingService: CategoryProcessingService | null = null,
    private readonly embeddingService: IEmbeddingService | null = null,
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
    this.registerHandler(new CleanupEventsHandler(this.eventService));

    // Conditionally register import handler (opt-in via TICKETMASTER_API_KEY)
    if (
      this.ticketmasterService &&
      this.categoryProcessingService &&
      this.embeddingService
    ) {
      this.registerHandler(
        new ImportEventsHandler(
          this.eventService,
          this.ticketmasterService,
          this.categoryProcessingService,
          this.embeddingService,
        ),
      );
    }
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
