import type { DataSource } from "typeorm";
import type { OpportunityScope } from "./DistancePolicy";

type BlockerMeta = { type: string; severity: string; phase: string } | null;

export type { OpportunityScope };

export type GoalActionType =
  | "none"
  | "dating_app_invite"
  | "suggest_coffee"
  | "ask_contact"
  | "natural_invitation"
  | "other_direct_goal_action";

export interface GoalMilestoneContext {
  isRelevant: boolean;
  isDatingGoal: boolean;
  activeMilestoneKey: string | null;
  activeMilestoneTitle: string | null;
  directGoalTouched: boolean;
  goalClosureDue: boolean;
  deferredByBlocker: boolean;
  promptBlock: string;
}

interface QuestSignalRow {
  title: string | null;
  summary: string | null;
  strategy_note: string | null;
  quest_role: string | null;
  capacity_track: string | null;
  rep_intent: string | null;
  direct_goal_touch: boolean | null;
  goal_action_type: string | null;
  rating: number | null;
  completed_at: Date | null;
  description: string | null;
  hook: string | null;
  suggested_activities: string[] | null;
  action_items: string[] | null;
  venue_category: string | null;
  social_context: string | null;
  would_return: boolean | null;
}

const STRUCTURED_CONTAINER_CATEGORIES = new Set([
  "Art Studio / Workshop",
  "Board Game Venue",
  "Climbing Gym",
  "College / Adult Education",
  "Community Center",
  "Gym / Fitness Studio",
  "Maker Space",
  "Recreation Center",
  "Sports Club",
  "Theatre / Performing Arts",
  "Workshop / Class Venue",
  "Yoga / Pilates Studio",
]);

const DATING_DIRECT_PATTERNS = [
  /\bask(?:ed|ing)?\b.{0,50}\b(out|for (?:their )?(?:number|phone|contact)|to (?:coffee|drinks?|dinner|brunch|meet|go out))\b/i,
  /\binvit(?:e|ed|ing)\b.{0,60}\b(?:coffee|drinks?|dinner|brunch|walk|date|meet|go out|sometime|again)\b/i,
  /\bsuggest(?:ed|ing)?\b.{0,60}\b(?:coffee|drinks?|dinner|brunch|a date|meet(?:ing)? up|a specific plan)\b/i,
  /\b(?:hinge|bumble|tinder|dating app|match)\b.{0,80}\b(?:message|invite|ask|suggest|send|reply|plan)\b/i,
  /\b(?:flirt|flirting|romantic interest|phone number|contact info|see you again|go out sometime|low-pressure date|dating move)\b/i,
];

const DATING_PREP_ONLY_PATTERNS = [
  /\bdate-friendly\b/gi,
  /\bdate-plausible\b/gi,
  /\bdate-able\b/gi,
  /\bdateable\b/gi,
  /\binvite-?able life\b/gi,
  /\bfuture (?:casual )?date\b/gi,
  /\bsomeday\b/gi,
  /\bsomeone could join\b/gi,
  /\bwould invite someone\b/gi,
  /\basking someone out\b.{0,80}\b(?:feel|feels|less theoretical|later|eventually|future)\b/gi,
  /\bmake(?:s)? asking someone out\b.{0,80}\b(?:less theoretical|easier later)\b/gi,
];

function isDatingGoal(
  comfortProfile:
    | {
        goalKey?: string;
        goalTags?: string[];
        primaryGoal?: string;
        goals?: string;
        barriers?: string;
      }
    | null
    | undefined,
  goalTags: string[],
): boolean {
  const tags = new Set([...(comfortProfile?.goalTags ?? []), ...goalTags]);
  const text = [
    comfortProfile?.goalKey,
    comfortProfile?.primaryGoal,
    comfortProfile?.goals,
    comfortProfile?.barriers,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    tags.has("dating") ||
    comfortProfile?.goalKey === "start_dating" ||
    /dating|date|romantic|flirt|ask.*out|partner/i.test(text)
  );
}

function questText(row: QuestSignalRow): string {
  return [
    row.title,
    row.summary,
    row.strategy_note,
    row.quest_role,
    row.capacity_track,
    row.rep_intent,
    row.description,
    row.hook,
    ...(row.suggested_activities ?? []),
    ...(row.action_items ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function directGoalActionText(row: QuestSignalRow): string {
  return [
    row.title,
    row.rep_intent,
    row.description,
    ...(row.suggested_activities ?? []),
    ...(row.action_items ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

export function normalizeGoalActionType(value: unknown): GoalActionType {
  return [
    "dating_app_invite",
    "suggest_coffee",
    "ask_contact",
    "natural_invitation",
    "other_direct_goal_action",
  ].includes(String(value))
    ? (String(value) as GoalActionType)
    : "none";
}

export function hasDirectDatingAction(text: string): boolean {
  let normalized = text;
  for (const pattern of DATING_PREP_ONLY_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }
  return DATING_DIRECT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectGoalActionType(text: string): GoalActionType {
  let normalized = text;
  for (const pattern of DATING_PREP_ONLY_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }

  if (
    /\b(?:hinge|bumble|tinder|dating app|match)\b.{0,80}\b(?:invite|ask|suggest|send|message|reply|plan)\b/i.test(
      normalized,
    )
  ) {
    return "dating_app_invite";
  }
  if (
    /\bsuggest(?:ed|ing)?\b.{0,60}\b(?:coffee|drinks?|dinner|brunch|meet(?:ing)? up|a specific plan|a date)\b/i.test(
      normalized,
    )
  ) {
    return "suggest_coffee";
  }
  if (
    /\bask(?:ed|ing)?\b.{0,50}\b(?:for (?:their )?(?:number|phone|contact|contact info)|to exchange)\b/i.test(
      normalized,
    )
  ) {
    return "ask_contact";
  }
  if (
    /\binvit(?:e|ed|ing)\b.{0,60}\b(?:coffee|drinks?|dinner|brunch|walk|date|meet|go out|sometime|again)\b/i.test(
      normalized,
    )
  ) {
    return "natural_invitation";
  }
  return hasDirectDatingAction(normalized)
    ? "other_direct_goal_action"
    : "none";
}

function isStructuredContainer(row: QuestSignalRow): boolean {
  const category = row.venue_category ?? "";
  const text = questText(row);
  return (
    STRUCTURED_CONTAINER_CATEGORIES.has(category) ||
    /\b(class|club|meetup|workshop|trivia|dance|volunteer|league|open play|open gym|board game|game night|run club|pickleball|yoga)\b/i.test(
      text,
    )
  );
}

function average(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function milestoneForSignals(input: {
  completedQuestCount: number;
  wouldReturnCount: number;
  structuredCount: number;
  nonSoloCount: number;
  metNewCount: number;
  directGoalTouched: boolean;
  goalClosureDue: boolean;
}): { key: string; title: string; purpose: string } {
  if (input.directGoalTouched) {
    return {
      key: "dating_intent",
      title: "Dating Intent",
      purpose:
        "Keep converting a richer offline life into honest, low-pressure dating initiative.",
    };
  }
  if (input.goalClosureDue) {
    return {
      key: "dating_intent",
      title: "Dating Intent",
      purpose: "Cross the named-goal threshold with one gentle dating move.",
    };
  }
  if (
    input.structuredCount >= 1 &&
    (input.nonSoloCount >= 2 || input.metNewCount >= 1)
  ) {
    return {
      key: "warm_social_signal",
      title: "Warm Social Signal",
      purpose:
        "Practice one real social signal inside a room where conversation can happen naturally.",
    };
  }
  if (input.structuredCount >= 1) {
    return {
      key: "people_rich_room",
      title: "People-Rich Room",
      purpose:
        "Enter a structured social container where repeated faces and shared activity are possible.",
    };
  }
  if (input.wouldReturnCount >= 2 || input.completedQuestCount >= 5) {
    return {
      key: "inviteable_life",
      title: "Invite-able Life",
      purpose:
        "Collect real places and rhythms that could become easy invitations later.",
    };
  }
  return {
    key: "visible_again",
    title: "Visible Again",
    purpose:
      "Rebuild comfort being out in date-friendly public places without hiding.",
  };
}

export async function buildGoalMilestoneContext(input: {
  dataSource: DataSource;
  userId: string;
  comfortProfile:
    | {
        goalKey?: string;
        goalTags?: string[];
        primaryGoal?: string;
        goals?: string;
        barriers?: string;
      }
    | null
    | undefined;
  goalTags: string[];
  completedQuestCount: number;
  blockerMeta: BlockerMeta;
}): Promise<GoalMilestoneContext> {
  const datingGoal = isDatingGoal(input.comfortProfile, input.goalTags);
  if (!datingGoal) {
    return {
      isRelevant: false,
      isDatingGoal: false,
      activeMilestoneKey: null,
      activeMilestoneTitle: null,
      directGoalTouched: false,
      goalClosureDue: false,
      deferredByBlocker: false,
      promptBlock: "",
    };
  }

  const rows: QuestSignalRow[] = await input.dataSource.query(
    `SELECT
       s.title,
       s.summary,
       s.strategy_note,
       s.quest_role,
       s.capacity_track,
       s.rep_intent,
       s.direct_goal_touch,
       s.goal_action_type,
       s.rating,
       s.completed_at,
       o.description,
       o.hook,
       o.suggested_activities,
       o.action_items,
       o.venue_category,
       o.social_context,
       o.would_return
     FROM sidequests s
     LEFT JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
     WHERE s.user_id = $1
       AND s.deleted_at IS NULL
       AND (s.completed_at IS NOT NULL OR s.status IN ('READY', 'GENERATING'))
     ORDER BY COALESCE(s.completed_at, s.created_at) DESC
     LIMIT 40`,
    [input.userId],
  );

  const completedRows = rows.filter((row) => row.completed_at !== null);
  const recentRatings = completedRows
    .filter((row) => row.rating !== null)
    .slice(0, 5)
    .map((row) => Number(row.rating));
  const directGoalTouched =
    rows.some(
      (row) =>
        row.direct_goal_touch === true ||
        normalizeGoalActionType(row.goal_action_type) !== "none",
    ) || rows.some((row) => hasDirectDatingAction(directGoalActionText(row)));
  const structuredCount = completedRows.filter(isStructuredContainer).length;
  const nonSoloCount = completedRows.filter(
    (row) => row.social_context && row.social_context !== "solo",
  ).length;
  const metNewCount = completedRows.filter(
    (row) =>
      row.social_context === "met_someone_new" ||
      row.social_context === "group_activity",
  ).length;
  const wouldReturnCount = completedRows.filter(
    (row) => row.would_return === true,
  ).length;
  const stableRatings =
    recentRatings.length >= 3 &&
    average(recentRatings) >= 3.2 &&
    recentRatings.every((rating) => rating >= 3);
  const adjacentEvidence =
    nonSoloCount >= 2 || metNewCount >= 1 || structuredCount >= 2;
  const deferredByBlocker =
    input.blockerMeta?.phase === "avoid" ||
    input.blockerMeta?.phase === "building";
  const goalClosureDue =
    input.completedQuestCount >= 10 &&
    stableRatings &&
    adjacentEvidence &&
    !directGoalTouched &&
    !deferredByBlocker;
  const active = milestoneForSignals({
    completedQuestCount: input.completedQuestCount,
    wouldReturnCount,
    structuredCount,
    nonSoloCount,
    metNewCount,
    directGoalTouched,
    goalClosureDue,
  });

  const lines = [
    "\nGOAL MILESTONE MAP — DATING:",
    `- North star: ${input.comfortProfile?.primaryGoal ?? "Start dating again through a richer offline life."}`,
    "- Ladder: Visible Again → Invite-able Life → People-Rich Room → Warm Social Signal → Dating Intent.",
    `- Current milestone: ${active.title} — ${active.purpose}`,
    `- Evidence: ${input.completedQuestCount} completed quests; ${wouldReturnCount} would-return anchors; ${structuredCount} structured containers; ${nonSoloCount} non-solo reps; ${metNewCount} met-new/group reps; recent rating avg ${recentRatings.length ? average(recentRatings).toFixed(1) : "n/a"}.`,
    `- Direct dating-goal touch so far: ${directGoalTouched ? "yes" : "no"}. Do not count "date-friendly", "date-plausible", or "invite-able life" language as direct dating action.`,
  ];

  if (goalClosureDue) {
    lines.push(
      "- GOAL-CLOSURE MILESTONE IS DUE NOW: the next non-recovery quest must directly touch the dating goal with one gentle dating-intent action.",
      "- Acceptable direct actions include: send a dating-app invite to a specific venue, suggest coffee/drinks to someone already in conversation, ask for contact info after a good interaction, or make a natural low-pressure invitation.",
      "- Smaller/tiny versions may soften the step, but the full rep must include the direct dating action. Do not prescribe another generic confidence-prep quest.",
    );
  } else if (deferredByBlocker) {
    lines.push(
      `- Dating-intent milestone is deferred because blocker phase is ${input.blockerMeta?.phase}. Build adjacent confidence, but do not pretend prep is goal closure.`,
    );
  } else {
    lines.push(
      "- Keep the milestone map in view. If the current milestone is not Dating Intent yet, build the evidence needed for that threshold rather than wandering generically.",
    );
  }

  return {
    isRelevant: true,
    isDatingGoal: true,
    activeMilestoneKey: active.key,
    activeMilestoneTitle: active.title,
    directGoalTouched,
    goalClosureDue,
    deferredByBlocker,
    promptBlock: `${lines.join("\n")}\n`,
  };
}
