import type Redis from "ioredis";
import type { DataSource } from "typeorm";
import { User, UserFollow } from "@realtime-markers/database";
import type {
  PushNotificationService,
  PushNotificationPayload,
} from "./PushNotificationService";

interface EventChangeMessage {
  type: string;
  data: {
    operation: string;
    record: {
      id: string;
      title?: string;
      emoji?: string;
    };
    changeType: string;
    userId: string;
  };
}

const THROTTLE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const THROTTLE_CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const NOTIFIABLE_CHANGE_TYPES = new Set([
  "SAVE_ADDED",
  "RSVP_ADDED",
  "SCAN_ADDED",
]);

const ACTION_LABELS: Record<string, string> = {
  SAVE_ADDED: "saved",
  RSVP_ADDED: "RSVP'd to",
  SCAN_ADDED: "discovered",
};

export class FollowNotificationService {
  private subscriber: Redis;
  private dataSource: DataSource;
  private pushService: PushNotificationService;
  private throttleMap = new Map<string, number>(); // followerId:followingId → last push timestamp
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    subscriber: Redis,
    dataSource: DataSource,
    pushService: PushNotificationService,
  ) {
    this.subscriber = subscriber;
    this.dataSource = dataSource;
    this.pushService = pushService;
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe("event_changes");

    this.subscriber.on("message", (channel: string, message: string) => {
      if (channel === "event_changes") {
        this.handleMessage(message).catch((err) =>
          console.error("[FollowNotification] Error handling message:", err),
        );
      }
    });

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.throttleMap) {
        if (now - timestamp > THROTTLE_WINDOW_MS) {
          this.throttleMap.delete(key);
        }
      }
    }, THROTTLE_CLEANUP_INTERVAL_MS);

    console.log("[FollowNotification] Subscribed to event_changes");
  }

  private async handleMessage(raw: string): Promise<void> {
    let data: EventChangeMessage;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const changeType = data.data?.changeType;
    const actingUserId = data.data?.userId;
    const event = data.data?.record;

    if (!changeType || !actingUserId || !event?.id) {
      return;
    }

    if (!NOTIFIABLE_CHANGE_TYPES.has(changeType)) {
      return;
    }

    // Find followers of the acting user
    const repo = this.dataSource.getRepository(UserFollow);
    const follows = await repo.find({
      where: { followingId: actingUserId },
      select: ["followerId"],
    });

    if (follows.length === 0) {
      return;
    }

    // Throttle per follower:following pair
    const now = Date.now();
    const eligibleFollowerIds = follows
      .map((f) => f.followerId)
      .filter((followerId) => {
        const key = `${followerId}:${actingUserId}`;
        const lastPush = this.throttleMap.get(key);
        return !lastPush || now - lastPush > THROTTLE_WINDOW_MS;
      });

    if (eligibleFollowerIds.length === 0) {
      return;
    }

    // Mark as throttled
    for (const followerId of eligibleFollowerIds) {
      this.throttleMap.set(`${followerId}:${actingUserId}`, now);
    }

    // Get acting user's name for the notification body
    const actingUser = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: actingUserId }, select: ["firstName"] });

    const actorName = actingUser?.firstName || "Someone you follow";
    const action = ACTION_LABELS[changeType] || "interacted with";
    const eventTitle = event.title || "an event";
    const emoji = event.emoji || "";

    const payload: PushNotificationPayload = {
      title: `${emoji} Follow Activity`.trim(),
      body: `${actorName} ${action} "${eventTitle}"`,
      sound: "default",
      data: {
        type: "follow_activity",
        eventId: event.id,
        actingUserId,
      },
    };

    try {
      const result = await this.pushService.sendToUsers(
        eligibleFollowerIds,
        payload,
      );
      console.log(
        `[FollowNotification] Sent push to ${result.success} followers (${result.failed} failed)`,
      );
    } catch (err) {
      console.error("[FollowNotification] Failed to send push:", err);
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.subscriber.unsubscribe("event_changes").catch(() => {});
  }
}
