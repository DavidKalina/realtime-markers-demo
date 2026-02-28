import type Redis from "ioredis";
import type {
  PushNotificationService,
  PushNotificationPayload,
} from "./PushNotificationService";

interface PushDiscoveryMessage {
  userIds: string[];
  event: {
    id: string;
    title: string;
    emoji?: string;
    coordinates: [number, number];
  };
  isOwnDiscovery?: boolean;
}

const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const THROTTLE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export class DiscoveryNotificationService {
  private subscriber: Redis;
  private pushService: PushNotificationService;
  private throttleMap = new Map<string, number>(); // userId → last push timestamp
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(subscriber: Redis, pushService: PushNotificationService) {
    this.subscriber = subscriber;
    this.pushService = pushService;
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe("push:discovery");

    this.subscriber.on("message", (channel: string, message: string) => {
      if (channel === "push:discovery") {
        this.handleMessage(message).catch((err) =>
          console.error("[DiscoveryNotification] Error handling message:", err),
        );
      }
    });

    // Periodic cleanup of stale throttle entries
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [userId, timestamp] of this.throttleMap) {
        if (now - timestamp > THROTTLE_WINDOW_MS) {
          this.throttleMap.delete(userId);
        }
      }
    }, THROTTLE_CLEANUP_INTERVAL_MS);

    console.log("[DiscoveryNotification] Subscribed to push:discovery");
  }

  private async handleMessage(raw: string): Promise<void> {
    let data: PushDiscoveryMessage;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[DiscoveryNotification] Invalid JSON:", raw);
      return;
    }

    if (!data.userIds?.length || !data.event) {
      return;
    }

    const now = Date.now();
    const eligibleUserIds = data.userIds.filter((userId) => {
      const lastPush = this.throttleMap.get(userId);
      return !lastPush || now - lastPush > THROTTLE_WINDOW_MS;
    });

    if (eligibleUserIds.length === 0) {
      return;
    }

    // Mark all eligible users as throttled
    for (const userId of eligibleUserIds) {
      this.throttleMap.set(userId, now);
    }

    const emoji = data.event.emoji || "\u{1F4CD}";
    const title = data.isOwnDiscovery
      ? `${emoji} Your Discovery`
      : `${emoji} Nearby Discovery`;

    const payload: PushNotificationPayload = {
      title,
      body: data.event.title,
      sound: "default",
      data: {
        type: "discovery",
        eventId: data.event.id,
        coordinates: data.event.coordinates,
        isOwnDiscovery: data.isOwnDiscovery || false,
      },
    };

    try {
      const result = await this.pushService.sendToUsers(
        eligibleUserIds,
        payload,
      );
      console.log(
        `[DiscoveryNotification] Sent push to ${result.success} users (${result.failed} failed)`,
      );
    } catch (err) {
      console.error("[DiscoveryNotification] Failed to send push:", err);
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.subscriber.unsubscribe("push:discovery").catch(() => {});
  }
}
