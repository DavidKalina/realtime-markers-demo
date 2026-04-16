import type { DataSource } from "typeorm";
import { IsNull, LessThan } from "typeorm";
import {
  Sidequest,
  ObjectiveCheckin,
  Objective,
  SidequestStatus,
  User,
} from "../entities";
import type {
  PushNotificationService,
  PushNotificationPayload,
} from "./PushNotificationService";
import type { RedisService } from "./shared/RedisService";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { CoverageService } from "./CoverageService";
import type { JobQueue } from "./JobQueue";
import {
  CHECKIN_RADIUS_M as CHECKIN_RADIUS_METERS,
  COMPLETION_MILESTONES,
  STREAK_MILESTONES,
} from "@realtime-markers/shared";
const THROTTLE_TTL = 60;

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

interface SidequestCheckinServiceDeps {
  dataSource: DataSource;
  pushService: PushNotificationService;
  redisService: RedisService;
  openAIService: OpenAIService;
  coverageService?: CoverageService;
  jobQueue?: JobQueue;
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

export class SidequestCheckinService {
  private dataSource: DataSource;
  private pushService: PushNotificationService;
  private redisService: RedisService;
  private openAIService: OpenAIService;
  private coverageService?: CoverageService;
  private jobQueue?: JobQueue;
  constructor(deps: SidequestCheckinServiceDeps) {
    this.dataSource = deps.dataSource;
    this.pushService = deps.pushService;
    this.redisService = deps.redisService;
    this.openAIService = deps.openAIService;
    this.coverageService = deps.coverageService;
    this.jobQueue = deps.jobQueue;
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

    // Update coverage cluster with objective's stable coordinates
    if (this.coverageService) {
      try {
        const objective = await this.dataSource
          .getRepository(Objective)
          .findOne({
            where: { id: objectiveId },
            select: ["id", "latitude", "longitude", "venueCategory"],
          });
        if (objective?.latitude && objective?.longitude) {
          await this.coverageService.upsertCluster(
            userId,
            Number(objective.latitude),
            Number(objective.longitude),
            objective.venueCategory ?? undefined,
          );
        }
      } catch (err) {
        console.error("[SidequestCheckin] Coverage cluster update failed:", err);
      }
    }

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

    this.generateQuestReflection(sidequestId, userId).catch((err) => {
      console.error("[SidequestCheckin] Quest reflection generation failed:", err);
    });

    this.checkCompletionMilestone(userId).catch((err) => {
      console.error("[SidequestCheckin] Milestone check failed:", err);
    });

    this.generateBehavioralProfile(userId).then(() => {
      this.generateAIFocus(userId).catch((err) => {
        console.error("[SidequestCheckin] AI focus generation failed:", err);
      });
    }).catch((err) => {
      console.error("[SidequestCheckin] Behavioral profile generation failed:", err);
    });

    this.checkAndAutoPrescribe(userId).catch((err) => {
      console.error("[SidequestCheckin] Auto-prescribe check failed:", err);
    });

    this.scheduleProgressiveOnboardingNudge(userId).catch((err) => {
      console.error("[SidequestCheckin] Progressive onboarding nudge failed:", err);
    });
  }

  /**
   * If the user hasn't finished progressive onboarding (phase < 3),
   * send a delayed push notification nudging them to fill in more profile data.
   * Delay: 30 minutes after quest completion.
   */
  private async scheduleProgressiveOnboardingNudge(userId: string): Promise<void> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "onboardingPhase"],
    });

    if (!user || user.onboardingPhase >= 3) return;

    const DELAY_MS = 30 * 60 * 1000; // 30 minutes
    const phaseMessages = [
      { title: "Nice work out there!", body: "Take 30 seconds to set your pace — it helps us dial in your next quest." },
      { title: "You're building momentum!", body: "A quick question about what's held you back — so we can work around it." },
      { title: "Almost there!", body: "One last step: map your comfort zone so we can push you in the right ways." },
    ];

    const message = phaseMessages[user.onboardingPhase] ?? phaseMessages[0];

    setTimeout(async () => {
      try {
        // Re-check phase in case they completed it in the meantime
        const freshUser = await this.dataSource.getRepository(User).findOne({
          where: { id: userId },
          select: ["id", "onboardingPhase"],
        });
        if (!freshUser || freshUser.onboardingPhase >= 3) return;

        await this.pushService.sendToUser(userId, {
          title: message.title,
          body: message.body,
          sound: "default",
          data: {
            type: "progressive_onboarding",
            phase: freshUser.onboardingPhase,
          },
        });
        console.log(
          `[SidequestCheckin] Sent progressive onboarding nudge to user ${userId} (phase ${freshUser.onboardingPhase})`,
        );
      } catch (err) {
        console.error("[SidequestCheckin] Failed to send progressive onboarding nudge:", err);
      }
    }, DELAY_MS);
  }

  async replenishDeck(userId: string): Promise<void> {
    this.checkAndAutoPrescribe(userId).catch((err) => {
      console.error("[SidequestCheckin] Deck replenish failed:", err);
    });
  }

  private async checkAndAutoPrescribe(userId: string): Promise<void> {
    if (!this.jobQueue) return;

    const client = this.redisService.getClient();
    const lockKey = `auto-prescribe:${userId}`;

    // Prevent duplicate triggers with a 3-minute lock
    const acquired = await client.set(lockKey, "1", "EX", 180, "NX");
    if (!acquired) return;

    try {
      // Skip if user already has pending concepts waiting to be picked
      const hasPending = await client.exists(`pending_concepts:${userId}`);
      if (hasPending) return;

      // Fetch user's home location for quest generation
      const user = await this.dataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ["id", "homeLatitude", "homeLongitude"],
      });

      if (!user?.homeLatitude || !user?.homeLongitude) return;

      // Always generate concepts after quest completion — user picks their next quest
      const jobId = await this.jobQueue.enqueue("generate_concepts", {
        userId,
        creatorId: userId,
        latitude: Number(user.homeLatitude),
        longitude: Number(user.homeLongitude),
      });

      console.log(
        `[SidequestCheckin] Generated concepts for user ${userId}, jobId=${jobId}`,
      );
    } catch (err) {
      // Release lock on failure so it can be retried
      await client.del(lockKey);
      throw err;
    }
  }

  private async checkCompletionMilestone(userId: string): Promise<void> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND parent_id IS NOT NULL`,
      [userId],
    );
    const completedCount = Number(result[0]?.count ?? 0);

    if ((COMPLETION_MILESTONES as readonly number[]).includes(completedCount)) {
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

  private async generateQuestReflection(
    sidequestId: string,
    userId: string,
  ): Promise<void> {
    const sidequest = await this.dataSource.getRepository(Sidequest).findOne({
      where: { id: sidequestId },
      relations: ["objectives"],
    });

    if (!sidequest) return;

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "comfortProfile", "fearLadder", "pacePreference"],
    });

    // Gather journal entries and social contexts from objectives
    const journalEntries = sidequest.objectives
      .filter((o: any) => o.journalEntry)
      .map((o: any) => o.journalEntry)
      .join("; ");

    const socialContexts = sidequest.objectives
      .filter((o: any) => o.socialContext)
      .map((o: any) => o.socialContext);

    const venueCategories = sidequest.objectives
      .filter((o: any) => o.venueCategory)
      .map((o: any) => o.venueCategory);

    // Count how many times user has visited this venue category
    const categoryVisitCount: { count: number }[] = venueCategories.length > 0
      ? await this.dataSource.query(
          `SELECT COUNT(DISTINCT s.id)::int AS count
           FROM sidequests s
           JOIN objectives o ON o.sidequest_id = s.id
           WHERE s.user_id = $1
             AND s.completed_at IS NOT NULL
             AND s.deleted_at IS NULL
             AND o.venue_category = $2`,
          [userId, venueCategories[0]],
        )
      : [{ count: 0 }];

    const journalSection = journalEntries
      ? `USER JOURNAL: ${journalEntries}`
      : "";

    const prompt = `The user just completed a quest. In 1-2 sentences, celebrate what they did and tell them how it shapes what comes next. Write as "I" (the AI). Be warm and encouraging — like a friend who's genuinely proud of them.

QUEST:
- Title: "${sidequest.title}"
- Category: ${venueCategories.join(", ") || "unknown"}
- Difficulty: ${sidequest.objectives[0]?.difficulty ?? "unknown"}
- Rating: ${sidequest.rating ?? "not yet rated"}
- Times user has done this category: ${categoryVisitCount[0]?.count ?? 1}
${journalSection}
SOCIAL CONTEXT: ${socialContexts.join(", ") || "solo"}
USER GOAL: "${user?.comfortProfile?.primaryGoal ?? "unknown"}"

GUIDELINES:
- Focus on what they DID, not what they didn't do. Never mention missing data, empty journals, or things they skipped.
- If they went solo, celebrate the courage of going alone — that IS the win
- If they met someone new or went with someone, highlight that social progress
- If this is a repeat category, note the familiarity they're building
- Reference the specific venue or activity, not abstract concepts
- Sound like a proud friend, not a therapist analyzing data
- 1-2 sentences max. Keep it light and forward-looking.
- Examples:
  "You showed up at Juniper Goods and stayed for the full session — that takes real guts. I'm sending you back next week so you can start becoming a regular."
  "A yoga class with strangers! That's a big step from solo bookstore visits. I'll keep finding group activities at this pace."
  "Third time at a coffee shop and you met someone new. The regularity is paying off — I'll keep building on this."`;

    const completion = await this.openAIService.executeChatCompletion(
      {
        model: OpenAIModel.GPT54Nano,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      },
      "quest-reflection-generator",
    );

    const reflection = completion.choices[0]?.message?.content?.trim();
    if (!reflection) return;

    await this.dataSource.getRepository(Sidequest).update(
      { id: sidequestId },
      { aiReflection: reflection },
    );

    console.log(
      `[SidequestCheckin] Quest reflection generated for sidequest ${sidequestId}`,
    );
  }

  private async generateAIFocus(userId: string): Promise<void> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "behavioralProfile",
        "comfortProfile",
        "pacePreference",
        "comfortRadiusMiles",
        "fearLadder",
      ],
    });

    if (!user?.behavioralProfile?.summary) return;

    // Get social context counts
    const socialCounts: { context: string; count: number }[] =
      await this.dataSource.query(
        `SELECT o.social_context AS context, COUNT(*)::int AS count
         FROM objectives o
         JOIN sidequests s ON s.id = o.sidequest_id
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND o.social_context IS NOT NULL
         GROUP BY o.social_context`,
        [userId],
      );

    const completedCount: { count: number }[] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM sidequests
       WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
      [userId],
    );

    const socialSummary = socialCounts
      .map((s) => `${s.context}: ${s.count}`)
      .join(", ");

    const prompt = `You are the AI behind a quest app that helps people build their social life and expand their comfort zone. The user can see this message — write directly to them as "I".

In 1-2 sentences, explain what you're currently focused on for their growth. Be specific — reference their actual patterns, not generic encouragement.

USER CONTEXT:
- Goal: "${user.comfortProfile?.primaryGoal ?? "unknown"}"
- Barriers: "${user.comfortProfile?.barriers ?? "unknown"}"
- Pace: ${user.pacePreference ?? "steady"}
- Comfort radius: ${user.comfortRadiusMiles ?? "unknown"} miles
- Quests completed: ${completedCount[0]?.count ?? 0}
- Social contexts: ${socialSummary || "none yet"}
- Fear ladder social score: ${user.fearLadder?.dimensionScores?.social ?? "unknown"}

BEHAVIORAL PROFILE (internal notes):
${user.behavioralProfile.summary}

GUIDELINES:
- Write as "I" — "Right now I'm focused on..."
- Be specific: reference their patterns, venues, or social progression
- Don't be clinical or therapist-like — sound like a thoughtful friend
- 1-2 sentences max
- Examples:
  "Right now I'm building your habit of going out regularly. Once that feels natural, I'll start introducing social situations."
  "You've been going out consistently — I'm starting to suggest places where you'll see the same people repeatedly."
  "I noticed you light up at creative activities. I'm leaning into that while keeping social elements gentle."`;

    const completion = await this.openAIService.executeChatCompletion(
      {
        model: OpenAIModel.GPT54Nano,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      },
      "ai-focus-generator",
    );

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) return;

    await this.dataSource.getRepository(User).update(
      { id: userId },
      {
        aiFocus: {
          summary,
          generatedAt: new Date().toISOString(),
        },
      },
    );

    console.log(
      `[SidequestCheckin] AI focus generated for user ${userId}`,
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

