import type { DataSource } from "typeorm";
import {
  isConcreteGoalActionType,
  normalizeGoalActionType,
} from "./GoalMilestoneContext";
import type {
  CapabilityEvidence,
  JourneyCapabilityState,
  QuestContract,
} from "./GoalProgram";
import {
  capabilityFromEvidence,
  DATING_GOAL_PROGRAM,
  patternForRepShape,
  repShapeForPatternId,
  resolveDatingJourneyState,
  type DatingRepShape as ProgramDatingRepShape,
} from "./programs/DatingGoalProgram";
import { CapabilityProgressService } from "./CapabilityProgressService";

type BlockerMeta = { type: string; severity: string; phase: string } | null;
type RejectionPatternMeta = { reason: string; count: number } | null;

export type DatingStage =
  | "room_exposure"
  | "warm_signal"
  | "conversation_continuation"
  | "message_closure";

export type DatingRepShape = ProgramDatingRepShape;

interface DatingSignalRow {
  quest_role: string | null;
  goal_action_type: string | null;
  rating: number | null;
  deleted_at: Date | string | null;
  social_context: string | null;
  rep_intent: string | null;
  description: string | null;
  action_items: string[] | null;
  venue_category: string | null;
}

export interface DatingProgressionContext {
  isRelevant: boolean;
  stage: DatingStage;
  capabilityId: string;
  capabilityLabel: string;
  enactmentMode: "bfs" | "dfs";
  currentPatternId: string | null;
  currentPatternLabel: string | null;
  questContract: QuestContract | null;
  allowDirectDatingRep: boolean;
  cooldownActive: boolean;
  preferredRepShapes: DatingRepShape[];
  preferredPatternIds: string[];
  recentRepShapes: DatingRepShape[];
  recentDirectDatingRepCount: number;
  recentDraftDatingRepCount: number;
  questsSinceDirectDatingRep: number | null;
  promptBlock: string;
  debug: {
    completedQuestCount: number;
    avgRecentRating: number;
    recentStructuredCount: number;
    recentNonSoloCount: number;
    milestoneQuestSeen: boolean;
    goalClosureDue: boolean;
    baseCapabilityId: string | null;
    finalCapabilityId: string | null;
    baseStage: DatingStage;
    finalStage: DatingStage;
    stagePromotedByGoalClosure: boolean;
    bridgedToDraftInvite: boolean;
    stageLoweredByBlocker: boolean;
    stageLoweredByRecentDirectRep: boolean;
    blockerType: string | null;
    blockerPhase: string | null;
  };
}

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

function average(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function isStructuredCategory(category: string | null | undefined): boolean {
  return [
    "Art Studio / Workshop",
    "Board Game Venue",
    "Climbing Gym",
    "College / Adult Education",
    "Community Center",
    "Coworking Space",
    "Gym / Fitness Studio",
    "Karaoke Venue",
    "Library",
    "Maker Space",
    "Music Venue / Concert Hall",
    "Recreation Center",
    "Sports Club",
    "Theatre / Performing Arts",
    "Workshop / Class Venue",
    "Yoga / Pilates Studio",
  ].includes(category ?? "");
}

export function inferDatingRepShape(input: {
  goalActionType?: unknown;
  text?: string | null;
}): DatingRepShape | null {
  const normalizedGoalActionType = normalizeGoalActionType(
    input.goalActionType,
  );
  if (isConcreteGoalActionType(normalizedGoalActionType)) {
    return "send_specific_invite";
  }

  const text = (input.text ?? "").toLowerCase();
  if (!text.trim()) return null;
  if (
    /\b(draft|write|compose|save)\b.{0,40}\b(message|text|invite|opening line|reply)\b/i.test(
      text,
    )
  ) {
    return "draft_message";
  }
  if (
    /\b(reply|respond|continue|keep)\b.{0,50}\b(conversation|chat|message|thread|match)\b/i.test(
      text,
    )
  ) {
    return "continue_conversation";
  }
  if (
    /\b(pick|choose|save|find)\b.{0,50}\b(venue|spot|place|date spot|date-worthy)\b/i.test(
      text,
    )
  ) {
    return "venue_selection";
  }
  return null;
}

export function downgradeDatingRepShape(shape: DatingRepShape): DatingRepShape {
  switch (shape) {
    case "send_specific_invite":
      return "draft_message";
    case "draft_message":
      return "venue_selection";
    case "continue_conversation":
      return "draft_message";
    case "venue_selection":
    default:
      return "venue_selection";
  }
}

function stageFromCapability(capabilityId: string): DatingStage {
  if (
    capabilityId === "activation" ||
    capabilityId === "dateable_life" ||
    capabilityId === "public_comfort"
  ) {
    return "room_exposure";
  }
  if (
    capabilityId === "micro_conversation" ||
    capabilityId === "repeatable_social_context"
  ) {
    return "warm_signal";
  }
  if (
    capabilityId === "attraction_awareness" ||
    capabilityId === "interest_signal" ||
    capabilityId === "rejection_recovery"
  ) {
    return "conversation_continuation";
  }
  return "message_closure";
}

function preferredShapesForStage(input: {
  stage: DatingStage;
  allowDirectDatingRep: boolean;
}): DatingRepShape[] {
  switch (input.stage) {
    case "room_exposure":
      return ["venue_selection"];
    case "warm_signal":
      return ["venue_selection"];
    case "conversation_continuation":
      return ["continue_conversation", "draft_message", "venue_selection"];
    case "message_closure":
      return input.allowDirectDatingRep
        ? ["send_specific_invite", "continue_conversation", "draft_message"]
        : ["continue_conversation", "draft_message", "venue_selection"];
    default:
      return ["venue_selection"];
  }
}

function rotateAwayFromRecent(
  shapes: DatingRepShape[],
  recentRepShapes: DatingRepShape[],
): DatingRepShape[] {
  if (!shapes[0] || shapes.length === 1 || !recentRepShapes[0]) return shapes;
  if (shapes[0] !== recentRepShapes[0]) return shapes;
  return [...shapes.slice(1), shapes[0]];
}

function shapesFromJourneyState(
  state: JourneyCapabilityState,
): DatingRepShape[] {
  const shapes = state.preferredPatterns
    .map((pattern) => repShapeForPatternId(pattern.id))
    .filter((value): value is DatingRepShape => Boolean(value));
  return shapes.length > 0 ? shapes : ["venue_selection"];
}

export async function buildDatingProgressionContext(input: {
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
  milestoneQuestSeen: boolean;
  goalClosureDue: boolean;
  blockerMeta: BlockerMeta;
  city?: string;
  rejectionPattern?: RejectionPatternMeta;
}): Promise<DatingProgressionContext> {
  if (!isDatingGoal(input.comfortProfile, input.goalTags)) {
    return {
      isRelevant: false,
      stage: "room_exposure",
      allowDirectDatingRep: false,
      cooldownActive: false,
      capabilityId: "activation",
      capabilityLabel: "Leave the dating avoidance loop",
      enactmentMode: "bfs",
      currentPatternId: null,
      currentPatternLabel: null,
      questContract: null,
      preferredRepShapes: ["venue_selection"],
      preferredPatternIds: [],
      recentRepShapes: [],
      recentDirectDatingRepCount: 0,
      recentDraftDatingRepCount: 0,
      questsSinceDirectDatingRep: null,
      promptBlock: "",
      debug: {
        completedQuestCount: input.completedQuestCount,
        avgRecentRating: 0,
        recentStructuredCount: 0,
        recentNonSoloCount: 0,
        milestoneQuestSeen: input.milestoneQuestSeen,
        goalClosureDue: input.goalClosureDue,
        baseCapabilityId: null,
        finalCapabilityId: null,
        baseStage: "room_exposure",
        finalStage: "room_exposure",
        stagePromotedByGoalClosure: false,
        bridgedToDraftInvite: false,
        stageLoweredByBlocker: false,
        stageLoweredByRecentDirectRep: false,
        blockerType: input.blockerMeta?.type ?? null,
        blockerPhase: input.blockerMeta?.phase ?? null,
      },
    };
  }

  const rows: DatingSignalRow[] = await input.dataSource.query(
    `SELECT
       s.quest_role,
       s.goal_action_type,
       s.rating,
       s.deleted_at,
       o.social_context,
       s.rep_intent,
       o.description,
       o.action_items,
       o.venue_category
     FROM sidequests s
     LEFT JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
     WHERE s.user_id = $1
       AND (s.completed_at IS NOT NULL OR s.status IN ('READY', 'GENERATING'))
     ORDER BY COALESCE(s.completed_at, s.created_at) DESC
     LIMIT 8`,
    [input.userId],
  );
  const retainedRows = rows.filter((row) => row.deleted_at == null);

  const recentDirectDatingRepCount = rows
    .slice(0, 5)
    .filter((row) =>
      isConcreteGoalActionType(normalizeGoalActionType(row.goal_action_type)),
    ).length;

  let questsSinceDirectDatingRep: number | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    if (
      isConcreteGoalActionType(
        normalizeGoalActionType(rows[index]?.goal_action_type),
      )
    ) {
      questsSinceDirectDatingRep = index;
      break;
    }
  }

  const recentRepShapes = rows
    .slice(0, 5)
    .map((row) =>
      inferDatingRepShape({
        goalActionType: row.goal_action_type,
        text: [row.rep_intent, row.description, ...(row.action_items ?? [])]
          .filter(Boolean)
          .join(" "),
      }),
    )
    .filter((value): value is DatingRepShape => Boolean(value));
  const recentRepPatternIds = recentRepShapes
    .map((shape) => patternForRepShape(shape)?.id)
    .filter((value): value is string => Boolean(value));
  const recentMilestoneQuestSeen = rows
    .slice(0, 5)
    .some((row) => row.quest_role === "milestone");
  const recentRelationshipEvidenceCount = recentRepShapes.filter((shape) =>
    ["draft_message", "continue_conversation", "send_specific_invite"].includes(
      shape,
    ),
  ).length;
  const recentDraftDatingRepCount = recentRepShapes.filter(
    (shape) => shape === "draft_message",
  ).length;

  const avgRecentRating = average(
    retainedRows
      .slice(0, 5)
      .map((row) => row.rating ?? 0)
      .filter((value) => value > 0),
  );
  const recentStructuredCount = retainedRows
    .slice(0, 5)
    .filter((row) => isStructuredCategory(row.venue_category)).length;
  const recentNonSoloCount = retainedRows
    .slice(0, 5)
    .filter(
      (row) =>
        row.social_context &&
        !["solo", "none", "unknown"].includes(row.social_context.toLowerCase()),
    ).length;

  const evidence: CapabilityEvidence = {
    completedQuestCount: input.completedQuestCount,
    avgRecentRating,
    recentStructuredCount,
    recentNonSoloCount,
    recentDirectGoalTouchCount: recentDirectDatingRepCount,
    recentDirectDatingRepCount,
    recentDraftDatingRepCount,
    recentRelationshipEvidenceCount,
    recentMilestoneQuestSeen,
    recentRepPatternIds,
    questsSinceDirectGoalTouch: questsSinceDirectDatingRep,
    questsSinceDirectDatingRep,
  };

  const capabilityProgressService = new CapabilityProgressService(
    input.dataSource,
  );
  const coldStartCapabilityId = capabilityFromEvidence(evidence);
  const active = await capabilityProgressService.getActive(
    input.userId,
    DATING_GOAL_PROGRAM,
    coldStartCapabilityId,
    evidence,
  );

  const journeyState = resolveDatingJourneyState({
    evidence,
    goalClosureDue: input.goalClosureDue,
    blockerMeta: input.blockerMeta,
    rejectionPattern: input.rejectionPattern,
    city: input.city ?? "the user's area",
    persistedProgress: {
      capabilityId: active.capability.id,
      mode: active.progress.phase === "dfs" ? "dfs" : "bfs",
      lockedPatternId: active.isLocked ? active.pattern.id : null,
    },
  });
  const baseStage = stageFromCapability(journeyState.debug.baseCapabilityId);
  let stage = stageFromCapability(journeyState.currentCapability.id);
  const allowDirectDatingRep = journeyState.allowTerminalAction;
  let preferredRepShapes = shapesFromJourneyState(journeyState);
  if (!allowDirectDatingRep) {
    preferredRepShapes = preferredRepShapes.filter(
      (shape) => shape !== "send_specific_invite",
    );
    if (preferredRepShapes.length === 0) {
      preferredRepShapes = preferredShapesForStage({
        stage,
        allowDirectDatingRep,
      });
    }
  }
  preferredRepShapes = rotateAwayFromRecent(
    preferredRepShapes,
    recentRepShapes,
  );

  const lines = [
    "\nDATING PROGRESSION:",
    `- Goal program: dating.`,
    `- Current capability: ${journeyState.currentCapability.id} — ${journeyState.currentCapability.label}.`,
    `- Capability search mode: ${journeyState.mode.toUpperCase()} (${journeyState.mode === "bfs" ? "try viable enactments" : "reinforce a working enactment"}).`,
    `- Current enactment pattern: ${journeyState.currentPattern.label}.`,
    `- Quest contract rep intent: ${journeyState.questContract.repIntent}`,
    `- Quest contract success criteria: ${journeyState.questContract.successCriteria.join("; ")}`,
    journeyState.questContract.forbiddenActions.length
      ? `- Quest contract forbids: ${journeyState.questContract.forbiddenActions.join("; ")}`
      : "- Quest contract allows direct dating action when the writer can keep it concrete and low-pressure.",
    `- Legacy dating stage compatibility: ${stage}.`,
    `- Direct dating reps in last 5 quests: ${recentDirectDatingRepCount}`,
    `- Draft-invite reps in last 5 quests: ${recentDraftDatingRepCount}`,
    `- Quests since last direct dating rep: ${questsSinceDirectDatingRep ?? "none yet"}`,
    `- Cooldown active: ${journeyState.cooldownActive ? "yes" : "no"}`,
    `- Preferred dating rep shapes now: ${preferredRepShapes.join(", ")}`,
    `- Preferred enactment pattern IDs: ${journeyState.preferredPatterns.map((p) => p.id).join(", ")}`,
  ];
  if (!allowDirectDatingRep) {
    lines.push(
      "- Do not prescribe a direct invite ask right now. Advance the ladder with a lighter rep shape.",
    );
  } else {
    lines.push(
      "- Direct dating action is allowed now, but keep it message-first and low-pressure.",
    );
  }

  return {
    isRelevant: true,
    stage,
    capabilityId: journeyState.currentCapability.id,
    capabilityLabel: journeyState.currentCapability.label,
    enactmentMode: journeyState.mode,
    currentPatternId: journeyState.currentPattern.id,
    currentPatternLabel: journeyState.currentPattern.label,
    questContract: journeyState.questContract,
    allowDirectDatingRep,
    cooldownActive: journeyState.cooldownActive,
    preferredRepShapes,
    preferredPatternIds: journeyState.preferredPatterns.map((p) => p.id),
    recentRepShapes,
    recentDirectDatingRepCount,
    recentDraftDatingRepCount,
    questsSinceDirectDatingRep,
    promptBlock: lines.join("\n"),
    debug: {
      completedQuestCount: input.completedQuestCount,
      avgRecentRating,
      recentStructuredCount,
      recentNonSoloCount,
      milestoneQuestSeen: recentMilestoneQuestSeen,
      goalClosureDue: input.goalClosureDue,
      baseCapabilityId: journeyState.debug.baseCapabilityId,
      finalCapabilityId: journeyState.debug.finalCapabilityId,
      baseStage,
      finalStage: stage,
      stagePromotedByGoalClosure: journeyState.debug.promotedByGoalClosure,
      bridgedToDraftInvite: journeyState.debug.bridgedToDraftInvite,
      stageLoweredByBlocker: journeyState.debug.loweredByBlocker,
      stageLoweredByRecentDirectRep:
        journeyState.debug.loweredByRecentDirectRep,
      blockerType: input.blockerMeta?.type ?? null,
      blockerPhase: input.blockerMeta?.phase ?? null,
    },
  };
}
