import { type DataSource, Repository } from "typeorm";
import { User } from "../entities";
import type { PushNotificationService } from "./PushNotificationService";
import type { JobData } from "./JobQueue";

export interface JobCompletionResult {
  message?: string;
  title?: string;
  emoji?: string;
  [key: string]: unknown;
}

export interface JobNotificationServiceDeps {
  dataSource: DataSource;
  pushNotificationService: PushNotificationService;
}

export class JobNotificationService {
  private userRepository: Repository<User>;
  private pushNotificationService: PushNotificationService;

  constructor(deps: JobNotificationServiceDeps) {
    this.userRepository = deps.dataSource.getRepository(User);
    this.pushNotificationService = deps.pushNotificationService;
  }

  /**
   * Send notification when a job completes successfully
   */
  async notifyJobCompletion(
    job: JobData,
    result: JobCompletionResult,
  ): Promise<void> {
    try {
      const creatorId = job.data.creatorId as string;
      if (!creatorId) {
        console.log(
          `No creator ID found for job ${job.id}, skipping notification`,
        );
        return;
      }

      // Get the user who created the job
      const user = await this.userRepository.findOne({
        where: { id: creatorId },
      });

      if (!user) {
        console.log(`User not found for job ${job.id}, skipping notification`);
        return;
      }

      // Determine notification content based on job type
      const notification = this.createJobCompletionNotification(job, result);

      if (notification) {
        // Use a specific notification type for week pack completions
        // so the mobile app can route directly to itineraries
        const notificationType = job.type === "prescribe_week_pack"
          ? "quests_ready"
          : "job_completion";

        const pushResult = await this.pushNotificationService.sendToUser(creatorId, {
          title: notification.title,
          body: notification.body,
          data: {
            type: notificationType,
            jobId: job.id,
            jobType: job.type,
            result: result,
            timestamp: new Date().toISOString(),
          },
          priority: "normal",
        });

        console.log(`Job completion notification sent to ${user.email}:`, {
          jobId: job.id,
          jobType: job.type,
          success: pushResult.success,
          failed: pushResult.failed,
        });
      }
    } catch (error) {
      console.error("Error sending job completion notification:", error);
      // Don't throw error to avoid breaking job completion
    }
  }

  /**
   * Send notification when a job fails
   */
  async notifyJobFailure(
    job: JobData,
    error: string,
    message?: string,
  ): Promise<void> {
    try {
      const creatorId = job.data.creatorId as string;
      if (!creatorId) {
        console.log(
          `No creator ID found for job ${job.id}, skipping failure notification`,
        );
        return;
      }

      // Get the user who created the job
      const user = await this.userRepository.findOne({
        where: { id: creatorId },
      });

      if (!user) {
        console.log(
          `User not found for job ${job.id}, skipping failure notification`,
        );
        return;
      }

      // Determine notification content based on job type
      const notification = this.createJobFailureNotification(
        job,
        error,
        message,
      );

      if (notification) {
        const pushResult = await this.pushNotificationService.sendToUser(creatorId, {
          title: notification.title,
          body: notification.body,
          data: {
            type: "job_failure",
            jobId: job.id,
            jobType: job.type,
            error: error,
            message: message,
            timestamp: new Date().toISOString(),
          },
          priority: "high",
        });

        console.log(`Job failure notification sent to ${user.email}:`, {
          jobId: job.id,
          jobType: job.type,
          success: pushResult.success,
          failed: pushResult.failed,
        });
      }
    } catch (error) {
      console.error("Error sending job failure notification:", error);
      // Don't throw error to avoid breaking job failure handling
    }
  }

  /**
   * Create notification content for job completion
   */
  private createJobCompletionNotification(
    job: JobData,
    result: JobCompletionResult,
  ): { title: string; body: string } | null {
    switch (job.type) {
      case "prescribe_week_pack":
        return this.createWeekPackCompletionNotification(result);

      default:
        return null;
    }
  }

  private createWeekPackCompletionNotification(result: JobCompletionResult): {
    title: string;
    body: string;
  } {
    const questCount = (result.questCount as number) ?? 0;
    if (questCount > 0) {
      return {
        title: "Your quests are ready!",
        body: `${questCount} new quest${questCount === 1 ? "" : "s"} just landed in your deck. Tap to check them out.`,
      };
    }
    return {
      title: "Quests ready",
      body: "Your new quests are waiting for you.",
    };
  }

  /**
   * Create notification content for job failure
   */
  private createJobFailureNotification(
    job: JobData,
    error: string,
    message?: string,
  ): { title: string; body: string } | null {
    switch (job.type) {
      case "prescribe_week_pack":
        return {
          title: "Quest generation hit a snag",
          body: "We couldn't generate your quests this time. Try again from the app.",
        };

      default:
        return null;
    }
  }
}

