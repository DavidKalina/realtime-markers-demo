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
import type { GamificationService } from "./GamificationService";
import type { BadgeService } from "./BadgeService";

const CHECKIN_RADIUS_METERS = 75;
const COMPLETION_MILESTONES = [5, 10, 25, 50, 100];
const THROTTLE_TTL = 60; // 1 minute between proximity checks for checkins

// Streak milestone XP bonuses
const STREAK_MILESTONES: Record<number, number> = {
  3: 100,
  7: 250,
  12: 500,
  26: 1000,
  52: 2500,
};

/**
 * Get the Monday of the ISO week for a given date (ISO 8601: Monday = start of week).
 * Returns YYYY-MM-DD string.
 */
function getISOWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  // day 0 = Sunday → offset 6, day 1 = Monday → offset 0, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate how many weeks apart two Monday dates are.
 * Returns 0 for same week, 1 for consecutive weeks, >1 for a gap.
 */
function weeksBetween(mondayA: string, mondayB: string): number {
  const a = new Date(mondayA).getTime();
  const b = new Date(mondayB).getTime();
  return Math.round(Math.abs(b - a) / (7 * 24 * 60 * 60 * 1000));
}

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
  gamificationService: GamificationService;
  badgeService: BadgeService;
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
  private gamificationService: GamificationService;
  private badgeService: BadgeService;

  constructor(deps: ItineraryCheckinServiceDeps) {
    this.dataSource = deps.dataSource;
    this.pushService = deps.pushService;
    this.redisService = deps.redisService;
    this.gamificationService = deps.gamificationService;
    this.badgeService = deps.badgeService;
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

    // Award XP for check-in and update streak
    try {
      await this.gamificationService.awardXP(userId, 50, "itinerary_checkin");
    } catch (err) {
      console.error("[ItineraryCheckin] Failed to award check-in XP:", err);
    }
    await this.updateStreak(userId, now);

    // Check badge progress (fire-and-forget)
    this.badgeService.checkBadges(userId).catch((err) => {
      console.error("[ItineraryCheckin] Badge check failed:", err);
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

    // Auto-deactivate and mark completed when complete
    if (remaining === 0) {
      await Promise.all([
        this.dataSource
          .getRepository(User)
          .update({ id: userId }, { activeItineraryId: undefined }),
        this.dataSource
          .getRepository(Itinerary)
          .update({ id: user.activeItineraryId }, { completedAt: now }),
      ]);

      // Award completion XP
      try {
        await this.gamificationService.awardXP(
          userId,
          200,
          "itinerary_completion",
        );
      } catch (err) {
        console.error("[ItineraryCheckin] Failed to award completion XP:", err);
      }

      console.log(
        `[ItineraryCheckin] User ${userId} completed itinerary ${user.activeItineraryId}`,
      );

      // Check for completion milestones
      this.checkCompletionMilestone(userId).catch((err) => {
        console.error("[ItineraryCheckin] Milestone check failed:", err);
      });
    }
  }

  private async checkCompletionMilestone(userId: string): Promise<void> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM itineraries WHERE user_id = $1 AND completed_at IS NOT NULL`,
      [userId],
    );
    const completedCount = Number(result[0]?.count ?? 0);

    if (COMPLETION_MILESTONES.includes(completedCount)) {
      try {
        await this.pushService.sendToUser(userId, {
          title: "Milestone reached!",
          body: `You've completed ${completedCount} itineraries! Keep exploring.`,
          sound: "default",
          data: {
            type: "milestone",
            milestoneType: "completions",
            count: completedCount,
          },
        });
        console.log(
          `[ItineraryCheckin] User ${userId} hit completion milestone: ${completedCount}`,
        );
      } catch (err) {
        console.error("[ItineraryCheckin] Failed to send milestone push:", err);
      }
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

    // Award XP for check-in and update streak
    try {
      await this.gamificationService.awardXP(userId, 50, "itinerary_checkin");
    } catch (err) {
      console.error("[ItineraryCheckin] Failed to award check-in XP:", err);
    }
    await this.updateStreak(userId, now);

    // Check badge progress (fire-and-forget)
    this.badgeService.checkBadges(userId).catch((err) => {
      console.error("[ItineraryCheckin] Badge check failed:", err);
    });

    // Check if all items are now done — mark itinerary completed + deactivate
    const remaining = await this.dataSource.getRepository(ItineraryItem).count({
      where: {
        itineraryId,
        checkedInAt: IsNull(),
      },
    });

    if (remaining === 0) {
      await Promise.all([
        this.dataSource
          .getRepository(Itinerary)
          .update({ id: itineraryId }, { completedAt: now }),
        this.dataSource
          .getRepository(User)
          .update({ id: userId }, { activeItineraryId: undefined }),
      ]);

      // Award completion XP
      try {
        await this.gamificationService.awardXP(
          userId,
          200,
          "itinerary_completion",
        );
      } catch (err) {
        console.error("[ItineraryCheckin] Failed to award completion XP:", err);
      }

      console.log(
        `[ItineraryCheckin] User ${userId} completed itinerary ${itineraryId} via manual checkin`,
      );

      // Check for completion milestones
      this.checkCompletionMilestone(userId).catch((err) => {
        console.error("[ItineraryCheckin] Milestone check failed:", err);
      });
    }

    return { success: true, checkedInAt: now };
  }

  /**
   * Update the user's adventure streak on check-in.
   * Same week = no-op, next week = increment, gap > 1 week = reset to 1.
   * Awards bonus XP at streak milestones.
   */
  private async updateStreak(userId: string, now: Date): Promise<void> {
    try {
      const currentMonday = getISOWeekMonday(now);
      const user = await this.dataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ["id", "currentStreak", "longestStreak", "lastStreakWeek"],
      });

      if (!user) return;

      const lastWeek = user.lastStreakWeek;

      // Same week — already counted
      if (lastWeek === currentMonday) return;

      let newStreak: number;

      if (!lastWeek) {
        // First ever check-in
        newStreak = 1;
      } else {
        const gap = weeksBetween(lastWeek, currentMonday);
        if (gap === 1) {
          // Consecutive week — extend streak
          newStreak = (user.currentStreak || 0) + 1;
        } else {
          // Gap — reset
          newStreak = 1;
        }
      }

      const newLongest = Math.max(newStreak, user.longestStreak || 0);

      await this.dataSource.getRepository(User).update(
        { id: userId },
        {
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastStreakWeek: currentMonday,
        },
      );

      console.log(
        `[ItineraryCheckin] Streak updated for user ${userId}: week=${newStreak}, longest=${newLongest}`,
      );

      // Check for milestone XP bonus
      const milestoneXP = STREAK_MILESTONES[newStreak];
      if (milestoneXP) {
        await this.gamificationService.awardXP(
          userId,
          milestoneXP,
          `streak_milestone_${newStreak}`,
        );
        console.log(
          `[ItineraryCheckin] Streak milestone ${newStreak} weeks! Awarded ${milestoneXP} XP to user ${userId}`,
        );
      }
    } catch (err) {
      console.error("[ItineraryCheckin] Failed to update streak:", err);
    }
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
