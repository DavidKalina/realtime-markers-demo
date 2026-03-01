import type { EventService } from "./EventServiceRefactored";
import type {
  PushNotificationService,
  PushNotificationPayload,
} from "./PushNotificationService";
import type { RedisService } from "./shared/RedisService";

const THROTTLE_TTL = 300; // 5 minutes
const NOTIFIED_TTL = 86400; // 24 hours
const RADIUS_METERS = 500;

export class ProximityNotificationService {
  private eventService: EventService;
  private pushService: PushNotificationService;
  private redisService: RedisService;

  constructor(
    eventService: EventService,
    pushService: PushNotificationService,
    redisService: RedisService,
  ) {
    this.eventService = eventService;
    this.pushService = pushService;
    this.redisService = redisService;
  }

  async checkAndNotify(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const throttleKey = `proximity-throttle:${userId}`;

    // Throttle: skip if checked recently
    const throttled = await client.exists(throttleKey);
    if (throttled) {
      return;
    }
    await client.setex(throttleKey, THROTTLE_TTL, "1");

    // Query nearby future events
    const now = new Date();
    const events = await this.eventService.getNearbyEvents(
      lat,
      lng,
      RADIUS_METERS,
      now,
    );

    if (events.length === 0) {
      return;
    }

    // Dedup: filter out already-notified events
    const notifiedKey = `proximity-notified:${userId}`;
    const pipeline = client.pipeline();
    for (const event of events) {
      pipeline.sismember(notifiedKey, event.id);
    }
    const results = await pipeline.exec();

    const newEvents = events.filter((_, i) => {
      const [err, isMember] = results![i];
      return !err && isMember === 0;
    });

    if (newEvents.length === 0) {
      return;
    }

    // Mark as notified
    const markPipeline = client.pipeline();
    markPipeline.sadd(notifiedKey, ...newEvents.map((e) => e.id));
    markPipeline.expire(notifiedKey, NOTIFIED_TTL);
    await markPipeline.exec();

    // Build and send push notification
    const primary = newEvents[0];
    const emoji = primary.emoji || "\u{1F4CD}";
    const title = `${emoji} Event Nearby`;
    const body =
      newEvents.length === 1
        ? primary.title
        : `${primary.title} + ${newEvents.length - 1} more nearby`;

    const coordinates: [number, number] = [
      (primary.location as { coordinates: [number, number] }).coordinates[0],
      (primary.location as { coordinates: [number, number] }).coordinates[1],
    ];

    const payload: PushNotificationPayload = {
      title,
      body,
      sound: "default",
      data: {
        type: "discovery",
        eventId: primary.id,
        coordinates,
      },
    };

    try {
      const result = await this.pushService.sendToUser(userId, payload);
      console.log(
        `[ProximityNotification] Sent push to user ${userId}: ${result.success} success, ${result.failed} failed (${newEvents.length} events)`,
      );
    } catch (err) {
      console.error("[ProximityNotification] Failed to send push:", err);
    }
  }
}
