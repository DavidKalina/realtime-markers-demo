import type { DataSource } from "typeorm";
import { Sidequest, SidequestStatus } from "@realtime-markers/database";
import { Not, IsNull } from "typeorm";

// ── Types ────────────────────────────────────────────────────

export interface TimelineState {
  targetDate: Date;
  startDate: Date;
  now: Date;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  percentElapsed: number;
  isPast: boolean;
}

export type TimelineMilestone =
  | "early_momentum"    // ~10-20% elapsed, 2+ weeks in
  | "midpoint"          // ~45-55% elapsed
  | "approaching"       // ~75-90% elapsed
  | "final_stretch"     // >90% elapsed, target within 2 weeks
  | "target_reached"    // target date has passed
  | null;               // nothing special — no context needed

export interface PacingContext {
  timeline: TimelineState;
  milestone: TimelineMilestone;
  completedQuestCount: number;
  recommendation: string;
}

export interface CheckInDue {
  isDue: boolean;
  milestone: TimelineMilestone;
  journalPrompt: string | null;
}

// ── Interface ────────────────────────────────────────────────

export interface PacingService {
  /** Returns timeline context for the strategist, or null if no context is needed (progressive disclosure). */
  getTimelineContext(userId: string): Promise<string | null>;

  /** Full pacing state — used by check-in logic and dashboards. */
  getPacingState(userId: string): Promise<PacingContext | null>;

  /** Determines if a goal check-in should be triggered. */
  getCheckInDue(userId: string): Promise<CheckInDue>;
}

// ── Pure functions ───────────────────────────────────────────

export function computeTimeline(
  startDate: Date,
  targetDate: Date,
  now: Date = new Date(),
): TimelineState {
  const totalMs = targetDate.getTime() - startDate.getTime();
  const elapsedMs = now.getTime() - startDate.getTime();
  const totalDays = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));
  const elapsedDays = Math.max(0, Math.round(elapsedMs / (24 * 60 * 60 * 1000)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const percentElapsed = Math.min(1, Math.max(0, elapsedMs / totalMs));

  return {
    targetDate,
    startDate,
    now,
    totalDays,
    elapsedDays,
    remainingDays,
    percentElapsed,
    isPast: now >= targetDate,
  };
}

export function detectMilestone(timeline: TimelineState): TimelineMilestone {
  const { percentElapsed, elapsedDays, remainingDays, isPast } = timeline;

  if (isPast) return "target_reached";

  // Final stretch: >90% elapsed OR less than 14 days remaining
  if (percentElapsed > 0.90 || (remainingDays <= 14 && percentElapsed > 0.7)) {
    return "final_stretch";
  }

  // Approaching: 75-90%
  if (percentElapsed >= 0.75) return "approaching";

  // Midpoint: 45-55%
  if (percentElapsed >= 0.45 && percentElapsed <= 0.55) return "midpoint";

  // Early momentum: 10-20% elapsed AND at least 14 days in
  if (percentElapsed >= 0.10 && percentElapsed <= 0.20 && elapsedDays >= 14) {
    return "early_momentum";
  }

  return null;
}

function buildTimelineContextString(
  timeline: TimelineState,
  milestone: TimelineMilestone,
  questCount: number,
  goalLocation: string | null,
): string {
  const lines: string[] = [];
  const targetStr = timeline.targetDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  switch (milestone) {
    case "early_momentum":
      lines.push(
        `TIMELINE: User has a target of ${targetStr}${goalLocation ? ` (${goalLocation})` : ""}. ` +
        `They're ${timeline.elapsedDays} days in (${Math.round(timeline.percentElapsed * 100)}% elapsed) ` +
        `with ${timeline.remainingDays} days remaining. ${questCount} quests completed so far.`,
      );
      lines.push(
        "This is early — focus on building momentum and foundational experiences. " +
        "Don't rush toward the end goal. Help them feel like they're making progress.",
      );
      break;

    case "midpoint":
      lines.push(
        `TIMELINE: Midpoint check — user is halfway to their ${targetStr} target` +
        `${goalLocation ? ` (${goalLocation})` : ""}. ` +
        `${questCount} quests completed. ${timeline.remainingDays} days remaining.`,
      );
      lines.push(
        "Good time to introduce slightly more challenging experiences. " +
        "They've built a foundation — start connecting quests more directly to their end goal.",
      );
      break;

    case "approaching":
      lines.push(
        `TIMELINE: User's target of ${targetStr}${goalLocation ? ` (${goalLocation})` : ""} is approaching. ` +
        `${Math.round(timeline.percentElapsed * 100)}% elapsed, ${timeline.remainingDays} days remaining. ` +
        `${questCount} quests completed.`,
      );
      lines.push(
        "Shift toward practical, directly goal-relevant experiences. " +
        "The quests should feel like preparation for the real thing, not exploration.",
      );
      break;

    case "final_stretch":
      lines.push(
        `TIMELINE: Final stretch — user's ${targetStr} target${goalLocation ? ` (${goalLocation})` : ""} ` +
        `is ${timeline.remainingDays} days away. ${questCount} quests completed.`,
      );
      lines.push(
        "Focus on confidence-building and practical readiness. " +
        "These quests should make them feel READY, not stressed. " +
        "Remember: this is a target, not a deadline — don't create pressure.",
      );
      break;

    case "target_reached": {
      const daysOver = Math.abs(timeline.remainingDays);
      lines.push(
        `TIMELINE: User's target date of ${targetStr} has passed` +
        `${daysOver > 0 ? ` (${daysOver} days ago)` : ""}. ` +
        `${questCount} quests completed on this journey.`,
      );
      lines.push(
        "The target date has arrived or passed. This is a reflection moment, not a failure. " +
        "Focus on celebrating progress made, regardless of whether the goal was fully achieved. " +
        "If prescribing a quest, make it about reflection and forward-looking next steps.",
      );
      break;
    }

    default:
      return "";
  }

  return lines.join("\n");
}

function buildCheckInPrompt(milestone: TimelineMilestone): string | null {
  switch (milestone) {
    case "early_momentum":
      return "You've been working toward your goal for a couple weeks now. How does it feel so far? What's been easier or harder than you expected?";

    case "midpoint":
      return "You're about halfway to your target. Take a moment to look back at where you started — what's changed? What feels different now compared to when you began?";

    case "approaching":
      return "Your target is getting closer. How ready do you feel? What's one thing that still feels like a gap, and one thing you feel solid on?";

    case "final_stretch":
      return "You're in the home stretch. Whether or not you hit your exact target, what's the most important thing you've gained from this journey so far?";

    case "target_reached":
      return "Your target date has arrived. Let's take stock — where are you now compared to where you started? Even if you're not all the way there, what progress are you proud of?";

    default:
      return null;
  }
}

// ── TODO ─────────────────────────────────────────────────────
//
// TODO: Feed goal reflection journal entries back into the strategist context.
// Right now GoalReflection records are stored (goal_reflections table) but never
// read back into the prescription flow. The strategist would benefit from seeing
// what the user wrote at their last check-in — e.g. "I found an apartment listing
// but I'm scared to call the landlord" tells the strategist to prescribe a quest
// that builds phone-call confidence, not another apartment-hunting quest.
//
// Implementation sketch:
//   1. Add a method like getReflectionContext(userId) that queries the most recent
//      1-2 goal_reflections and formats them as a context string.
//   2. Inject it into PrescriptionPromptContext alongside timelineContext.
//   3. The strategist prompt should treat it as "what the user said at their last
//      check-in" — high-signal, recent, in their own words.
//
// TODO: Schedule goal check-in push notifications via the PushNotificationService.
// Currently the check-in is only surfaced when the user opens the app and the
// bell icon lights up. Ideally, at each milestone the backend would send a push
// notification (type: "goal_checkin") so the user gets prompted even if they
// haven't opened the app in a while. This requires a background job or cron
// that evaluates milestone state periodically.
//

// ── Implementation ───────────────────────────────────────────

interface PacingServiceDeps {
  dataSource: DataSource;
}

class PacingServiceImpl implements PacingService {
  private dataSource: DataSource;

  constructor(deps: PacingServiceDeps) {
    this.dataSource = deps.dataSource;
  }

  async getTimelineContext(userId: string): Promise<string | null> {
    const state = await this.getPacingState(userId);
    if (!state || !state.milestone) return null;

    return state.recommendation;
  }

  async getPacingState(userId: string): Promise<PacingContext | null> {
    const { targetDate, goalLocation, createdAt } = await this.getUserGoalInfo(userId);
    if (!targetDate) return null;

    const startDate = createdAt ?? new Date();
    const now = new Date();
    const timeline = computeTimeline(startDate, targetDate, now);
    const milestone = detectMilestone(timeline);

    const completedQuestCount = await this.dataSource.getRepository(Sidequest).count({
      where: {
        userId,
        status: SidequestStatus.READY,
        completedAt: Not(IsNull()),
      },
    });

    const recommendation = buildTimelineContextString(
      timeline,
      milestone,
      completedQuestCount,
      goalLocation,
    );

    return {
      timeline,
      milestone,
      completedQuestCount,
      recommendation,
    };
  }

  async getCheckInDue(userId: string): Promise<CheckInDue> {
    const state = await this.getPacingState(userId);
    if (!state || !state.milestone) {
      return { isDue: false, milestone: null, journalPrompt: null };
    }

    const journalPrompt = buildCheckInPrompt(state.milestone);

    return {
      isDue: true,
      milestone: state.milestone,
      journalPrompt,
    };
  }

  private async getUserGoalInfo(userId: string): Promise<{
    targetDate: Date | null;
    goalLocation: string | null;
    createdAt: Date | null;
  }> {
    const rows = await this.dataSource.query(
      `SELECT comfort_profile, created_at FROM users WHERE id = $1`,
      [userId],
    );

    if (!rows[0]) return { targetDate: null, goalLocation: null, createdAt: null };

    const profile = rows[0].comfort_profile;
    const createdAt = rows[0].created_at ? new Date(rows[0].created_at) : null;

    if (!profile?.targetDate) return { targetDate: null, goalLocation: null, createdAt };

    return {
      targetDate: new Date(profile.targetDate),
      goalLocation: profile.goalLocation ?? null,
      createdAt,
    };
  }
}

export function createPacingService(deps: PacingServiceDeps): PacingService {
  return new PacingServiceImpl(deps);
}
