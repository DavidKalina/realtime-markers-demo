import type { DataSource } from "typeorm";
import type { PushNotificationService } from "./PushNotificationService";

export interface NotificationSchedulerDeps {
  dataSource: DataSource;
  pushNotificationService: PushNotificationService;
}

export class NotificationSchedulerService {
  private dataSource: DataSource;
  private pushNotificationService: PushNotificationService;

  constructor(deps: NotificationSchedulerDeps) {
    this.dataSource = deps.dataSource;
    this.pushNotificationService = deps.pushNotificationService;
  }

  start(): void {
    if (process.env.DISABLE_NOTIFICATION_SCHEDULE === "true") {
      console.log(
        "Notification schedule disabled via DISABLE_NOTIFICATION_SCHEDULE environment variable",
      );
      return;
    }

    console.log(
      "Setting up streak-at-risk and weekly nudge notification schedules",
    );

    // Check every 15 minutes
    setInterval(
      async () => {
        const now = new Date();
        const dayOfWeek = now.getUTCDay(); // 0=Sun, 4=Thu
        const utcHour = now.getUTCHours();

        // Streak-at-risk: Sunday ~18:00 UTC
        if (dayOfWeek === 0 && utcHour === 18) {
          await this.sendStreakAtRiskNotifications();
        }

        // Weekly nudge: Thursday ~18:00 UTC
        if (dayOfWeek === 4 && utcHour === 18) {
          await this.sendWeeklyNudgeNotifications();
        }
      },
      15 * 60 * 1000,
    );
  }

  private async sendStreakAtRiskNotifications(): Promise<void> {
    try {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      const currentWeekMonday = monday.toISOString().slice(0, 10);

      const usersAtRisk: { id: string; current_streak: number }[] =
        await this.dataSource.query(
          `SELECT id, current_streak FROM users
           WHERE current_streak > 0
           AND (last_streak_week IS NULL OR last_streak_week < $1)`,
          [currentWeekMonday],
        );

      for (const user of usersAtRisk) {
        try {
          await this.pushNotificationService.sendToUser(user.id, {
            title: "Your streak is at risk!",
            body: `Your ${user.current_streak}-week adventure streak ends this week if you don't check in!`,
            sound: "default",
            data: {
              type: "streak_at_risk",
              currentStreak: user.current_streak,
            },
          });
        } catch (err) {
          console.error(
            `[NotificationSchedule] Failed to send streak-at-risk to ${user.id}:`,
            err,
          );
        }
      }

      if (usersAtRisk.length > 0) {
        console.log(
          `[NotificationSchedule] Sent streak-at-risk notifications to ${usersAtRisk.length} users`,
        );
      }
    } catch (err) {
      console.error("[NotificationSchedule] Streak-at-risk check failed:", err);
    }
  }

  private async sendWeeklyNudgeNotifications(): Promise<void> {
    try {
      const usersWithoutPlans: { id: string }[] = await this.dataSource.query(
        `SELECT u.id FROM users u
         WHERE u.id NOT IN (
           SELECT DISTINCT s.user_id FROM sidequests s
           WHERE s.planned_date >= CURRENT_DATE
           AND s.status = 'READY'
         )
         AND EXISTS (
           SELECT 1 FROM user_push_tokens upt
           WHERE upt.user_id = u.id AND upt.is_active = true
         )`,
      );

      for (const user of usersWithoutPlans) {
        try {
          await this.pushNotificationService.sendToUser(user.id, {
            title: "No adventure planned this weekend?",
            body: "Open the app and plan something fun — your next streak point awaits!",
            sound: "default",
            data: { type: "weekly_nudge" },
          });
        } catch (err) {
          console.error(
            `[NotificationSchedule] Failed to send weekly nudge to ${user.id}:`,
            err,
          );
        }
      }

      if (usersWithoutPlans.length > 0) {
        console.log(
          `[NotificationSchedule] Sent weekly nudge to ${usersWithoutPlans.length} users`,
        );
      }
    } catch (err) {
      console.error("[NotificationSchedule] Weekly nudge check failed:", err);
    }
  }
}

