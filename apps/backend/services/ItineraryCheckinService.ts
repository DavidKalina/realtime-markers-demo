import type { DataSource } from "typeorm";
import { IsNull, LessThan } from "typeorm";
import {
  Itinerary,
  ItineraryCheckin,
  ItineraryItem,
  ItineraryStatus,
  User,
} from "@realtime-markers/database";
import type {
  PushNotificationService,
  PushNotificationPayload,
} from "./PushNotificationService";
import type { RedisService } from "./shared/RedisService";

const CHECKIN_RADIUS_METERS = 75;
const THROTTLE_TTL = 60; // 1 minute between proximity checks for checkins

export interface ItineraryCheckinService {
  checkAndNotify(userId: string, lat: number, lng: number): Promise<void>;
  activateItinerary(userId: string, itineraryId: string): Promise<boolean>;
  deactivateItinerary(userId: string): Promise<boolean>;
  manualCheckin(
    userId: string,
    itineraryId: string,
    itemId: string,
  ): Promise<{ success: boolean; checkedInAt?: Date }>;
  getActiveItinerary(userId: string): Promise<Itinerary | null>;
}

interface ItineraryCheckinServiceDeps {
  dataSource: DataSource;
  pushService: PushNotificationService;
  redisService: RedisService;
}

interface NearbyItem {
  id: string;
  title: string;
  emoji: string;
  sort_order: number;
  start_time: string;
  distance_meters: number;
}

class ItineraryCheckinServiceImpl implements ItineraryCheckinService {
  private dataSource: DataSource;
  private pushService: PushNotificationService;
  private redisService: RedisService;

  constructor(deps: ItineraryCheckinServiceDeps) {
    this.dataSource = deps.dataSource;
    this.pushService = deps.pushService;
    this.redisService = deps.redisService;
  }

  async checkAndNotify(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const throttleKey = `itinerary-checkin-throttle:${userId}`;

    // Throttle: skip if checked recently
    const throttled = await client.exists(throttleKey);
    if (throttled) return;
    await client.setex(throttleKey, THROTTLE_TTL, "1");

    // Get active itinerary
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "activeItineraryId"],
    });

    if (!user?.activeItineraryId) return;

    // Find unchecked items with coordinates nearby — also return distance and metadata
    const nearbyItems: NearbyItem[] = await this.dataSource.query(
      `
      SELECT
        ii.id,
        ii.title,
        ii.emoji,
        ii.sort_order,
        ii.start_time,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(ii.longitude, ii.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        ) AS distance_meters
      FROM itinerary_items ii
      WHERE ii.itinerary_id = $1
        AND ii.checked_in_at IS NULL
        AND ii.latitude IS NOT NULL
        AND ii.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ii.longitude, ii.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      ORDER BY ii.sort_order ASC
      LIMIT 1
      `,
      [user.activeItineraryId, lng, lat, CHECKIN_RADIUS_METERS],
    );

    if (nearbyItems.length === 0) return;

    const item = nearbyItems[0];
    const now = new Date();

    // Mark as checked in on the item (fast UX read path)
    await this.dataSource
      .getRepository(ItineraryItem)
      .update({ id: item.id }, { checkedInAt: now });

    // Find skipped items (lower sortOrder, still unchecked)
    const skippedItems = await this.dataSource
      .getRepository(ItineraryItem)
      .find({
        where: {
          itineraryId: user.activeItineraryId,
          checkedInAt: IsNull(),
          sortOrder: LessThan(item.sort_order),
        },
        select: ["id"],
      });

    // Write analytics record
    const checkinRecord = this.dataSource
      .getRepository(ItineraryCheckin)
      .create({
        userId,
        itineraryId: user.activeItineraryId,
        itineraryItemId: item.id,
        userLatitude: lat,
        userLongitude: lng,
        distanceMeters: Number(item.distance_meters),
        plannedTime: item.start_time,
        source: "proximity",
        itemSortOrder: item.sort_order,
        skippedItemIds: skippedItems.map((s) => s.id),
        checkedInAt: now,
      });
    await this.dataSource.getRepository(ItineraryCheckin).save(checkinRecord);

    // Check how many items are left
    const remaining = await this.dataSource.getRepository(ItineraryItem).count({
      where: {
        itineraryId: user.activeItineraryId,
        checkedInAt: IsNull(),
      },
    });

    // Send push notification
    const emoji = item.emoji || "\u2705";
    const payload: PushNotificationPayload =
      remaining === 0
        ? {
            title: "\u{1F389} Itinerary Complete!",
            body: "You visited every stop! Amazing day.",
            sound: "default",
            data: {
              type: "itinerary_checkin",
              itineraryId: user.activeItineraryId,
              itemId: item.id,
              completed: true,
            },
          }
        : {
            title: `${emoji} Checked in!`,
            body: `You made it to ${item.title}${remaining > 0 ? ` — ${remaining} stop${remaining === 1 ? "" : "s"} left` : ""}`,
            sound: "default",
            data: {
              type: "itinerary_checkin",
              itineraryId: user.activeItineraryId,
              itemId: item.id,
              completed: false,
            },
          };

    try {
      await this.pushService.sendToUser(userId, payload);
      console.log(
        `[ItineraryCheckin] User ${userId} checked in at "${item.title}" (${Number(item.distance_meters).toFixed(0)}m away, ${skippedItems.length} skipped, ${remaining} remaining)`,
      );
    } catch (err) {
      console.error("[ItineraryCheckin] Failed to send push:", err);
    }

    // Auto-deactivate when complete
    if (remaining === 0) {
      await this.dataSource
        .getRepository(User)
        .update({ id: userId }, { activeItineraryId: undefined });
      console.log(
        `[ItineraryCheckin] User ${userId} completed itinerary ${user.activeItineraryId}`,
      );
    }
  }

  async activateItinerary(
    userId: string,
    itineraryId: string,
  ): Promise<boolean> {
    // Verify the itinerary belongs to the user and is ready
    const itinerary = await this.dataSource.getRepository(Itinerary).findOne({
      where: { id: itineraryId, userId, status: ItineraryStatus.READY },
    });

    if (!itinerary) return false;

    await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { activeItineraryId: itineraryId });

    console.log(
      `[ItineraryCheckin] User ${userId} activated itinerary ${itineraryId}`,
    );
    return true;
  }

  async deactivateItinerary(userId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { activeItineraryId: undefined });

    return (result.affected ?? 0) > 0;
  }

  async manualCheckin(
    userId: string,
    itineraryId: string,
    itemId: string,
  ): Promise<{ success: boolean; checkedInAt?: Date }> {
    // Verify item belongs to user's itinerary
    const item = await this.dataSource.getRepository(ItineraryItem).findOne({
      where: { id: itemId, itineraryId },
      relations: ["itinerary"],
    });

    if (!item) return { success: false };
    if ((item.itinerary as Itinerary).userId !== userId) {
      return { success: false };
    }

    // Already checked in
    if (item.checkedInAt) {
      return { success: true, checkedInAt: item.checkedInAt };
    }

    const now = new Date();

    // Mark on item
    await this.dataSource
      .getRepository(ItineraryItem)
      .update({ id: itemId }, { checkedInAt: now });

    // Find skipped items
    const skippedItems = await this.dataSource
      .getRepository(ItineraryItem)
      .find({
        where: {
          itineraryId,
          checkedInAt: IsNull(),
          sortOrder: LessThan(item.sortOrder),
        },
        select: ["id"],
      });

    // Write analytics record (no coordinates for manual check-in)
    const checkinRecord = this.dataSource
      .getRepository(ItineraryCheckin)
      .create({
        userId,
        itineraryId,
        itineraryItemId: itemId,
        plannedTime: item.startTime,
        source: "manual",
        itemSortOrder: item.sortOrder,
        skippedItemIds: skippedItems.map((s) => s.id),
        checkedInAt: now,
      });
    await this.dataSource.getRepository(ItineraryCheckin).save(checkinRecord);

    return { success: true, checkedInAt: now };
  }

  async getActiveItinerary(userId: string): Promise<Itinerary | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "activeItineraryId"],
    });

    if (!user?.activeItineraryId) return null;

    return this.dataSource.getRepository(Itinerary).findOne({
      where: { id: user.activeItineraryId },
      relations: ["items"],
      order: { items: { sortOrder: "ASC" } },
    });
  }
}

export function createItineraryCheckinService(
  deps: ItineraryCheckinServiceDeps,
): ItineraryCheckinService {
  return new ItineraryCheckinServiceImpl(deps);
}
