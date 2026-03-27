import type { DataSource } from "typeorm";
import { IsNull, LessThan } from "typeorm";
import {
  Sidequest,
  ObjectiveCheckin,
  Objective,
  SidequestStatus,
  User,
} from "@realtime-markers/database";
import type {
  PushNotificationService,
  PushNotificationPayload,
} from "./PushNotificationService";
import type { RedisService } from "./shared/RedisService";
import type { ThirdSpaceScoreService } from "./ThirdSpaceScoreService";

const CHECKIN_RADIUS_METERS = 75;
const COMPLETION_MILESTONES = [5, 10, 25, 50, 100];
const THROTTLE_TTL = 60;

const STREAK_MILESTONES: Record<number, number> = {
  3: 100,
  7: 250,
  12: 500,
  26: 1000,
  52: 2500,
};

function getISOWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(mondayA: string, mondayB: string): number {
  const a = new Date(mondayA).getTime();
  const b = new Date(mondayB).getTime();
  return Math.round(Math.abs(b - a) / (7 * 24 * 60 * 60 * 1000));
}

export interface SidequestCheckinService {
  checkAndNotify(userId: string, lat: number, lng: number): Promise<void>;
  activateSidequest(userId: string, sidequestId: string): Promise<boolean>;
  deactivateSidequest(userId: string): Promise<boolean>;
  manualCheckin(
    userId: string,
    sidequestId: string,
    objectiveId: string,
  ): Promise<{ success: boolean; checkedInAt?: Date }>;
  getActiveSidequest(userId: string): Promise<Sidequest | null>;
}

interface SidequestCheckinServiceDeps {
  dataSource: DataSource;
  pushService: PushNotificationService;
  redisService: RedisService;
  thirdSpaceScoreService?: ThirdSpaceScoreService;
}

interface NearbyObjective {
  id: string;
  title: string;
  emoji: string;
  sort_order: number;
  distance_meters: number;
}

interface ProcessCheckinParams {
  userId: string;
  sidequestId: string;
  objectiveId: string;
  sortOrder: number;
  source: "proximity" | "manual";
  userLatitude?: number;
  userLongitude?: number;
  distanceMeters?: number;
}

interface ProcessCheckinResult {
  checkedInAt: Date;
  remaining: number;
}

class SidequestCheckinServiceImpl implements SidequestCheckinService {
  private dataSource: DataSource;
  private pushService: PushNotificationService;
  private redisService: RedisService;
  private thirdSpaceScoreService?: ThirdSpaceScoreService;

  constructor(deps: SidequestCheckinServiceDeps) {
    this.dataSource = deps.dataSource;
    this.pushService = deps.pushService;
    this.redisService = deps.redisService;
    this.thirdSpaceScoreService = deps.thirdSpaceScoreService;
  }

  async checkAndNotify(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const throttleKey = `sidequest-checkin-throttle:${userId}`;

    const throttled = await client.exists(throttleKey);
    if (throttled) return;
    await client.setex(throttleKey, THROTTLE_TTL, "1");

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "activeSidequestId"],
    });

    if (!user?.activeSidequestId) return;

    const nearbyObjectives: NearbyObjective[] = await this.dataSource.query(
      `
      SELECT
        o.id,
        o.title,
        o.emoji,
        o.sort_order,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        ) AS distance_meters
      FROM objectives o
      WHERE o.sidequest_id = $1
        AND o.checked_in_at IS NULL
        AND o.latitude IS NOT NULL
        AND o.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      ORDER BY o.sort_order ASC
      LIMIT 1
      `,
      [user.activeSidequestId, lng, lat, CHECKIN_RADIUS_METERS],
    );

    if (nearbyObjectives.length === 0) return;

    const objective = nearbyObjectives[0];

    const { remaining } = await this.processCheckin({
      userId,
      sidequestId: user.activeSidequestId,
      objectiveId: objective.id,
      sortOrder: objective.sort_order,
      source: "proximity",
      userLatitude: lat,
      userLongitude: lng,
      distanceMeters: Number(objective.distance_meters),
    });

    const emoji = objective.emoji || "\u2705";
    const payload: PushNotificationPayload =
      remaining === 0
        ? {
            title: "\u{1F389} Sidequest Complete!",
            body: "You crushed every objective! Amazing adventure.",
            sound: "default",
            data: {
              type: "objective_checkin",
              sidequestId: user.activeSidequestId,
              objectiveId: objective.id,
              completed: true,
            },
          }
        : {
            title: `${emoji} Checked in!`,
            body: `You made it to ${objective.title}${remaining > 0 ? ` — ${remaining} objective${remaining === 1 ? "" : "s"} left` : ""}`,
            sound: "default",
            data: {
              type: "objective_checkin",
              sidequestId: user.activeSidequestId,
              objectiveId: objective.id,
              completed: false,
            },
          };

    try {
      await this.pushService.sendToUser(userId, payload);
      console.log(
        `[SidequestCheckin] User ${userId} checked in at "${objective.title}" (${Number(objective.distance_meters).toFixed(0)}m away, ${remaining} remaining)`,
      );
    } catch (err) {
      console.error("[SidequestCheckin] Failed to send push:", err);
    }
  }

  async manualCheckin(
    userId: string,
    sidequestId: string,
    objectiveId: string,
  ): Promise<{ success: boolean; checkedInAt?: Date }> {
    const objective = await this.dataSource.getRepository(Objective).findOne({
      where: { id: objectiveId, sidequestId },
      relations: ["sidequest"],
    });

    if (!objective) return { success: false };
    if ((objective.sidequest as Sidequest).userId !== userId) {
      return { success: false };
    }

    if (objective.checkedInAt) {
      return { success: true, checkedInAt: objective.checkedInAt };
    }

    const { checkedInAt } = await this.processCheckin({
      userId,
      sidequestId,
      objectiveId,
      sortOrder: objective.sortOrder,
      source: "manual",
    });

    return { success: true, checkedInAt };
  }

  private async processCheckin(
    params: ProcessCheckinParams,
  ): Promise<ProcessCheckinResult> {
    const {
      userId,
      sidequestId,
      objectiveId,
      sortOrder,
      source,
      userLatitude,
      userLongitude,
      distanceMeters,
    } = params;
    const now = new Date();

    await this.dataSource
      .getRepository(Objective)
      .update({ id: objectiveId }, { checkedInAt: now });

    const skippedObjectives = await this.dataSource
      .getRepository(Objective)
      .find({
        where: {
          sidequestId,
          checkedInAt: IsNull(),
          sortOrder: LessThan(sortOrder),
        },
        select: ["id"],
      });

    const checkinRecord = this.dataSource
      .getRepository(ObjectiveCheckin)
      .create({
        userId,
        sidequestId,
        objectiveId,
        userLatitude,
        userLongitude,
        distanceMeters,
        source,
        objectiveSortOrder: sortOrder,
        skippedObjectiveIds: skippedObjectives.map((s) => s.id),
        checkedInAt: now,
      });
    await this.dataSource.getRepository(ObjectiveCheckin).save(checkinRecord);

    const remaining = await this.dataSource.getRepository(Objective).count({
      where: { sidequestId, checkedInAt: IsNull() },
    });

    await this.updateStreak(userId, now);

    if (remaining === 0) {
      await this.completeSidequest(userId, sidequestId, now);
    }

    return { checkedInAt: now, remaining };
  }

  private async completeSidequest(
    userId: string,
    sidequestId: string,
    completedAt: Date,
  ): Promise<void> {
    await Promise.all([
      this.dataSource
        .getRepository(Sidequest)
        .update({ id: sidequestId }, { completedAt }),
      this.dataSource
        .getRepository(User)
        .update({ id: userId }, { activeSidequestId: null }),
    ]);

    console.log(
      `[SidequestCheckin] User ${userId} completed sidequest ${sidequestId}`,
    );

    this.refreshCityScoreForSidequest(sidequestId);

    this.checkCompletionMilestone(userId).catch((err) => {
      console.error("[SidequestCheckin] Milestone check failed:", err);
    });
  }

  private async checkCompletionMilestone(userId: string): Promise<void> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND parent_id IS NOT NULL`,
      [userId],
    );
    const completedCount = Number(result[0]?.count ?? 0);

    if (COMPLETION_MILESTONES.includes(completedCount)) {
      try {
        await this.pushService.sendToUser(userId, {
          title: "Milestone reached!",
          body: `You've completed ${completedCount} sidequests! Keep exploring.`,
          sound: "default",
          data: {
            type: "milestone",
            milestoneType: "completions",
            count: completedCount,
          },
        });
        console.log(
          `[SidequestCheckin] User ${userId} hit completion milestone: ${completedCount}`,
        );
      } catch (err) {
        console.error("[SidequestCheckin] Failed to send milestone push:", err);
      }
    }
  }

  async activateSidequest(
    userId: string,
    sidequestId: string,
  ): Promise<boolean> {
    const sidequest = await this.dataSource.getRepository(Sidequest).findOne({
      where: { id: sidequestId, userId, status: SidequestStatus.READY },
      relations: ["objectives"],
    });

    if (!sidequest) return false;

    await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { activeSidequestId: sidequestId });

    console.log(
      `[SidequestCheckin] User ${userId} activated sidequest ${sidequestId}`,
    );
    return true;
  }

  async deactivateSidequest(userId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { activeSidequestId: null });

    return (result.affected ?? 0) > 0;
  }

  private refreshCityScoreForSidequest(sidequestId: string): void {
    this.dataSource
      .getRepository(Sidequest)
      .findOne({ where: { id: sidequestId }, select: ["city"] })
      .then((sidequest) => {
        if (sidequest?.city) {
          this.thirdSpaceScoreService
            ?.refreshCityScore(sidequest.city)
            .catch(() => {});
        }
      })
      .catch(() => {});
  }

  private async updateStreak(userId: string, now: Date): Promise<void> {
    try {
      const currentMonday = getISOWeekMonday(now);
      const user = await this.dataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ["id", "currentStreak", "longestStreak", "lastStreakWeek"],
      });

      if (!user) return;

      const lastWeek = user.lastStreakWeek;
      if (lastWeek === currentMonday) return;

      let newStreak: number;

      if (!lastWeek) {
        newStreak = 1;
      } else {
        const gap = weeksBetween(lastWeek, currentMonday);
        if (gap === 1) {
          newStreak = (user.currentStreak || 0) + 1;
        } else {
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
        `[SidequestCheckin] Streak updated for user ${userId}: week=${newStreak}, longest=${newLongest}`,
      );
    } catch (err) {
      console.error("[SidequestCheckin] Failed to update streak:", err);
    }
  }

  async getActiveSidequest(userId: string): Promise<Sidequest | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "activeSidequestId"],
    });

    if (!user?.activeSidequestId) return null;

    return this.dataSource.getRepository(Sidequest).findOne({
      where: { id: user.activeSidequestId },
      relations: ["objectives"],
      order: { objectives: { sortOrder: "ASC" } },
    });
  }
}

export function createSidequestCheckinService(
  deps: SidequestCheckinServiceDeps,
): SidequestCheckinService {
  return new SidequestCheckinServiceImpl(deps);
}
