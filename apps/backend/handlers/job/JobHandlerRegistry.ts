import type { JobHandler, JobHandlerContext } from "./BaseJobHandler";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import { PrescribeQuestHandler } from "./PrescribeQuestHandler";
import type { SidequestPrescriptionService } from "../../services/SidequestPrescriptionService";
import type { JobNotificationService } from "../../services/JobNotificationService";

export class JobHandlerRegistry {
  private handlers: Map<string, JobHandler> = new Map();

  constructor(
    private readonly jobQueue: JobQueue,
    private readonly redisService: RedisService,
    private readonly sidequestPrescriptionService: SidequestPrescriptionService | null = null,
    private readonly jobNotificationService: JobNotificationService | null = null,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    if (this.sidequestPrescriptionService && this.jobNotificationService) {
      this.registerHandler(new PrescribeQuestHandler(this.sidequestPrescriptionService, this.jobNotificationService));
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
