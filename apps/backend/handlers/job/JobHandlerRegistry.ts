import type { JobHandler, JobHandlerContext } from "./BaseJobHandler";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import { PrescribeQuestHandler } from "./PrescribeQuestHandler";
import type { SidequestService } from "../../services/SidequestService";

export class JobHandlerRegistry {
  private handlers: Map<string, JobHandler> = new Map();

  constructor(
    private readonly jobQueue: JobQueue,
    private readonly redisService: RedisService,
    private readonly sidequestService: SidequestService | null = null,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    if (this.sidequestService) {
      this.registerHandler(new PrescribeQuestHandler(this.sidequestService));
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
