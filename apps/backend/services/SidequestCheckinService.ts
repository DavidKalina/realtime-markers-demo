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
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
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
  openAIService: OpenAIService;
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
  private openAIService: OpenAIService;
  constructor(deps: SidequestCheckinServiceDeps) {
    this.dataSource = deps.dataSource;
    this.pushService = deps.pushService;
    this.redisService = deps.redisService;
    this.openAIService = deps.openAIService;
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
        .update({ id: userId }, { activeSidequestId: null as unknown as string }),
    ]);

    console.log(
      `[SidequestCheckin] User ${userId} completed sidequest ${sidequestId}`,
    );

    this.checkCompletionMilestone(userId).catch((err) => {
      console.error("[SidequestCheckin] Milestone check failed:", err);
    });

    this.generateBehavioralProfile(userId).catch((err) => {
      console.error("[SidequestCheckin] Behavioral profile generation failed:", err);
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
      .update({ id: userId }, { activeSidequestId: null as unknown as string });

    return (result.affected ?? 0) > 0;
  }

  private async generateBehavioralProfile(userId: string): Promise<void> {
    // 1. Gather quest history
    const quests: {
      title: string;
      venue_category: string;
      distance_from_home: number;
      rating: number | null;
      rating_comment: string | null;
      completed_at: string;
    }[] = await this.dataSource.query(
      `
      SELECT
        s.title,
        o.venue_category,
        s.distance_from_home,
        s.rating,
        s.rating_comment,
        s.completed_at
      FROM sidequests s
      LEFT JOIN objectives o ON o.sidequest_id = s.id
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
      LIMIT 30
      `,
      [userId],
    );

    if (quests.length < 2) return; // Not enough data to summarize

    // 2. Gather journal + activity data from objectives
    const journals: {
      journal_entry: string | null;
      completed_activity: string | null;
      venue_category: string | null;
      difficulty: number | null;
      checked_in_at: string;
    }[] = await this.dataSource.query(
      `
      SELECT
        o.journal_entry,
        o.completed_activity,
        o.venue_category,
        o.difficulty,
        o.checked_in_at
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND o.checked_in_at IS NOT NULL
      ORDER BY o.checked_in_at DESC
      LIMIT 50
      `,
      [userId],
    );

    // 3. Get user context
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "pacePreference",
        "comfortProfile",
        "onboardingProfile",
        "comfortRadiusMiles",
      ],
    });

    // 4. Build the raw data for summarization
    const questSummaries = quests
      .map(
        (q) =>
          `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"}${q.rating ? `, ${q.rating}★` : ""}${q.rating_comment ? `: "${q.rating_comment}"` : ""})`,
      )
      .join("\n");

    const journalEntries = journals
      .filter((j) => j.journal_entry || j.completed_activity)
      .map(
        (j) =>
          `- [${j.venue_category ?? "unknown"}${j.difficulty ? ` d${j.difficulty}` : ""}] ${j.completed_activity ? `Did: "${j.completed_activity}"` : ""}${j.journal_entry ? ` Wrote: "${j.journal_entry}"` : ""}`,
      )
      .join("\n");

    const dayOfWeekCounts: Record<string, number> = {};
    const hourCounts: Record<string, number> = {};
    for (const j of journals) {
      if (!j.checked_in_at) continue;
      const d = new Date(j.checked_in_at);
      const day = d.toLocaleDateString("en-US", { weekday: "long" });
      const hour = d.getHours();
      dayOfWeekCounts[day] = (dayOfWeekCounts[day] ?? 0) + 1;
      const timeSlot =
        hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      hourCounts[timeSlot] = (hourCounts[timeSlot] ?? 0) + 1;
    }
    const temporalPattern = [
      ...Object.entries(dayOfWeekCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([day, count]) => `${day}: ${count}`),
      ...Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([slot, count]) => `${slot}: ${count}`),
    ].join(", ");

    // 5. Call GPT-4o-mini for summarization
    const prompt = `You are analyzing a user's quest completion history for a comfort zone expansion app. Produce a concise behavioral profile (150-200 words max) that a quest-prescribing AI can use to calibrate the next quest.

USER CONTEXT:
- Pace preference: ${user?.pacePreference ?? "unknown"}
- Current comfort radius: ${user?.comfortRadiusMiles ?? "unknown"} miles
- Onboarding activities: ${user?.onboardingProfile?.activities?.join(", ") ?? "unknown"}
- Self-described barriers: ${user?.comfortProfile?.barriers ?? "unknown"}
- Self-described goals: ${user?.comfortProfile?.goals ?? "unknown"}

COMPLETED QUESTS (${quests.length} total, most recent first):
${questSummaries}

JOURNAL ENTRIES & ACTIVITIES:
${journalEntries || "(none yet)"}

TEMPORAL PATTERNS: ${temporalPattern || "not enough data"}

Write a profile covering:
1. What types of places they gravitate toward vs avoid (based on ratings, frequency, journal sentiment)
2. What activities they actually do vs what onboarding says they like
3. Their comfort trajectory — is their distance from home growing? Are they branching into new categories?
4. Journal sentiment themes — are they mentioning enjoyment, anxiety, surprise, social connection?
5. When they tend to go out (days/times)
6. One specific recommendation for what to prescribe next and one thing to avoid

Be direct and specific. No filler. Write as notes for another AI, not for the user.`;

    const completion = await this.openAIService.executeChatCompletion(
      {
        model: OpenAIModel.GPT4OMini,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.3,
      },
      "behavioral-profile-summarizer",
    );

    const summary = completion.choices[0]?.message?.content;
    if (!summary) return;

    // 6. Cache on user record
    await this.dataSource.getRepository(User).update(
      { id: userId },
      {
        behavioralProfile: {
          summary,
          generatedAt: new Date().toISOString(),
          questCount: quests.length,
        },
      },
    );

    console.log(
      `[SidequestCheckin] Behavioral profile generated for user ${userId} (${quests.length} quests)`,
    );
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
