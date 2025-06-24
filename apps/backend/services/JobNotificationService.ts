import { Repository } from "typeorm";
import { User } from "../entities/User";
import { pushNotificationService } from "./PushNotificationService";
import AppDataSource from "../data-source";
import type { JobData } from "./JobQueue";

export interface JobCompletionResult {
  message?: string;
  confidence?: number;
  threshold?: number;
  daysFromNow?: number;
  date?: string;
  deletedCount?: number;
  hasMore?: boolean;
  eventId?: string;
  title?: string;
  emoji?: string;
  coordinates?: [number, number];
  civicEngagementId?: string;
  type?: string;
  status?: string;
  hasImages?: boolean;
  events?: Array<{
    eventId: string;
    title: string;
    emoji: string;
    coordinates: [number, number];
    confidence?: number;
    isDuplicate?: boolean;
  }>;
  isMultiEvent?: boolean;
  [key: string]: unknown;
}

export class JobNotificationService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
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
        const pushResult = await pushNotificationService.sendToUser(creatorId, {
          title: notification.title,
          body: notification.body,
          data: {
            type: "job_completion",
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
        const pushResult = await pushNotificationService.sendToUser(creatorId, {
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
      case "process_civic_engagement":
        return this.createCivicEngagementCompletionNotification(result);

      case "process_flyer":
        return this.createFlyerCompletionNotification(result);

      default:
        // Don't send notifications for other job types
        return null;
    }
  }

  /**
   * Create notification content for civic engagement completion
   */
  private createCivicEngagementCompletionNotification(
    result: JobCompletionResult,
  ): { title: string; body: string } {
    const title = result.title || "Civic Engagement Submitted";
    const type = result.type || "feedback";

    return {
      title: `✅ ${title}`,
      body: `Your ${type.toLowerCase()} has been successfully submitted and is now under review. We'll notify you when there are updates.`,
    };
  }

  /**
   * Create notification content for flyer completion
   */
  private createFlyerCompletionNotification(result: JobCompletionResult): {
    title: string;
    body: string;
  } {
    // Handle multi-event results
    if (result.isMultiEvent && result.events && result.events.length > 0) {
      const eventCount = result.events.length;
      return {
        title: `🎉 ${eventCount} Events Found!`,
        body: `We found ${eventCount} events in your flyer and added them to the community calendar.`,
      };
    }

    // Handle single event results
    if (result.eventId && result.title) {
      return {
        title: `🎉 Event Added!`,
        body: `"${result.title}" has been successfully added to the community calendar.`,
      };
    }

    // Handle duplicate events
    if (result.isDuplicate && result.title) {
      return {
        title: `🔍 Event Already Exists`,
        body: `"${result.title}" was already in our database, so we linked to the existing event.`,
      };
    }

    // Handle low confidence or no events
    if (result.confidence !== undefined && result.confidence < 0.75) {
      return {
        title: `❓ No Event Detected`,
        body: `We couldn't find a clear event in your image. Please try with a different flyer or contact support.`,
      };
    }

    // Default success message
    return {
      title: `✅ Flyer Processed`,
      body: result.message || "Your flyer has been processed successfully.",
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
      case "process_civic_engagement":
        return {
          title: `❌ Civic Engagement Failed`,
          body:
            message ||
            "There was an error processing your civic engagement. Please try again.",
        };

      case "process_flyer":
        return {
          title: `❌ Flyer Processing Failed`,
          body:
            message ||
            "There was an error processing your flyer. Please try again with a different image.",
        };

      default:
        // Don't send notifications for other job types
        return null;
    }
  }
}

// Export singleton instance
export const jobNotificationService = new JobNotificationService();
