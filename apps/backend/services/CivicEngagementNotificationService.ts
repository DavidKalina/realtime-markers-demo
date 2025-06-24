import { Repository } from "typeorm";
import { User } from "../entities/User";
import {
  CivicEngagement,
  CivicEngagementStatus,
} from "../entities/CivicEngagement";
import { pushNotificationService } from "./PushNotificationService";
import AppDataSource from "../data-source";

export class CivicEngagementNotificationService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Send notification when a civic engagement status is updated by an admin
   */
  async notifyCivicEngagementStatusUpdate(
    civicEngagement: CivicEngagement,
    previousStatus: CivicEngagementStatus,
    updatedBy: User,
  ): Promise<void> {
    try {
      // Get the creator of the civic engagement
      const creator = await this.userRepository.findOne({
        where: { id: civicEngagement.creatorId },
      });

      if (!creator) {
        console.log(
          `Creator not found for civic engagement ${civicEngagement.id}`,
        );
        return;
      }

      // Don't notify if the creator is the same as the updater
      if (creator.id === updatedBy.id) {
        console.log(
          `Skipping notification - creator is the same as updater for civic engagement ${civicEngagement.id}`,
        );
        return;
      }

      const statusName = this.getStatusDisplayName(civicEngagement.status);
      const previousStatusName = this.getStatusDisplayName(previousStatus);

      const title = `Civic Engagement Status Updated`;
      const body = `Your civic engagement "${civicEngagement.title}" status has been updated from ${previousStatusName} to ${statusName}`;

      // Add admin notes if provided
      let fullBody = body;
      if (civicEngagement.adminNotes) {
        fullBody += `\n\nAdmin Notes: ${civicEngagement.adminNotes}`;
      }

      // Send notification to the creator
      const result = await pushNotificationService.sendToUser(creator.id, {
        title,
        body: fullBody,
        data: {
          type: "civic_engagement_update",
          civicEngagementId: civicEngagement.id,
          previousStatus,
          newStatus: civicEngagement.status,
          updatedBy: updatedBy.id,
        },
        priority: "high",
      });

      console.log(
        `Civic engagement status update notification sent to ${creator.email}:`,
        {
          civicEngagementId: civicEngagement.id,
          previousStatus,
          newStatus: civicEngagement.status,
          success: result.success,
          failed: result.failed,
        },
      );
    } catch (error) {
      console.error(
        "Error sending civic engagement status update notification:",
        error,
      );
    }
  }

  /**
   * Send notification when a civic engagement is implemented
   */
  async notifyCivicEngagementImplemented(
    civicEngagement: CivicEngagement,
    updatedBy: User,
  ): Promise<void> {
    try {
      // Get the creator of the civic engagement
      const creator = await this.userRepository.findOne({
        where: { id: civicEngagement.creatorId },
      });

      if (!creator) {
        console.log(
          `Creator not found for civic engagement ${civicEngagement.id}`,
        );
        return;
      }

      // Don't notify if the creator is the same as the updater
      if (creator.id === updatedBy.id) {
        console.log(
          `Skipping notification - creator is the same as updater for civic engagement ${civicEngagement.id}`,
        );
        return;
      }

      const title = `🎉 Civic Engagement Implemented!`;
      const body = `Great news! Your civic engagement "${civicEngagement.title}" has been implemented!`;

      // Add admin notes if provided
      let fullBody = body;
      if (civicEngagement.adminNotes) {
        fullBody += `\n\nImplementation Notes: ${civicEngagement.adminNotes}`;
      }

      // Send notification to the creator
      const result = await pushNotificationService.sendToUser(creator.id, {
        title,
        body: fullBody,
        data: {
          type: "civic_engagement_implemented",
          civicEngagementId: civicEngagement.id,
          implementedAt: civicEngagement.implementedAt,
          updatedBy: updatedBy.id,
        },
        priority: "high",
      });

      console.log(
        `Civic engagement implementation notification sent to ${creator.email}:`,
        {
          civicEngagementId: civicEngagement.id,
          success: result.success,
          failed: result.failed,
        },
      );
    } catch (error) {
      console.error(
        "Error sending civic engagement implementation notification:",
        error,
      );
    }
  }

  /**
   * Send notification when admin notes are added to a civic engagement
   */
  async notifyAdminNotesAdded(
    civicEngagement: CivicEngagement,
    updatedBy: User,
    previousAdminNotes?: string,
  ): Promise<void> {
    try {
      // Only notify if admin notes were actually added or changed
      if (
        !civicEngagement.adminNotes ||
        civicEngagement.adminNotes === previousAdminNotes
      ) {
        return;
      }

      // Get the creator of the civic engagement
      const creator = await this.userRepository.findOne({
        where: { id: civicEngagement.creatorId },
      });

      if (!creator) {
        console.log(
          `Creator not found for civic engagement ${civicEngagement.id}`,
        );
        return;
      }

      // Don't notify if the creator is the same as the updater
      if (creator.id === updatedBy.id) {
        console.log(
          `Skipping notification - creator is the same as updater for civic engagement ${civicEngagement.id}`,
        );
        return;
      }

      const title = `📝 Admin Notes Added`;
      const body = `Admin notes have been added to your civic engagement "${civicEngagement.title}"`;

      // Send notification to the creator
      const result = await pushNotificationService.sendToUser(creator.id, {
        title,
        body,
        data: {
          type: "civic_engagement_admin_notes",
          civicEngagementId: civicEngagement.id,
          adminNotes: civicEngagement.adminNotes,
          updatedBy: updatedBy.id,
        },
        priority: "normal",
      });

      console.log(`Admin notes notification sent to ${creator.email}:`, {
        civicEngagementId: civicEngagement.id,
        success: result.success,
        failed: result.failed,
      });
    } catch (error) {
      console.error("Error sending admin notes notification:", error);
    }
  }

  /**
   * Get display name for civic engagement status
   */
  private getStatusDisplayName(status: CivicEngagementStatus): string {
    switch (status) {
      case CivicEngagementStatus.PENDING:
        return "Pending";
      case CivicEngagementStatus.IN_REVIEW:
        return "In Review";
      case CivicEngagementStatus.IMPLEMENTED:
        return "Implemented";
      case CivicEngagementStatus.CLOSED:
        return "Closed";
      default:
        return status;
    }
  }
}

// Export singleton instance
export const civicEngagementNotificationService =
  new CivicEngagementNotificationService();
