import { CapacityTrack } from "../../entities/Sidequest";
import type { QuestContract } from "./GoalProgram";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { DatingRepShape, DatingStage } from "./DatingProgressionPolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";
import {
  type VenueQualityProfile,
  EMPTY_QUALITY_PROFILE,
} from "./VenueQualities";

export interface GoalMilestonePolicyDecision {
  applied: boolean;
  logLine?: string;
}

function isDatingMilestonePolicyDisabled(): boolean {
  return process.env.DISABLE_DATING_MILESTONE_POLICY === "true";
}

/**
 * Quality profile per dating stage. This is the *intent* expressed in the
 * vocabulary the strategist + validator share — what kind of room serves
 * this stage. Categories are picked by the Strategist LLM informed by the
 * qualities profile; the application layer no longer hardcodes which
 * category strings count as "right" for a given stage.
 */
function stageQualities(
  stage: DatingStage,
  gentleMode: boolean,
  shape: DatingRepShape,
): VenueQualityProfile {
  // Universal avoid set for all dating reps — these violate dating context
  // regardless of stage.
  const baseAvoid: VenueQualityProfile["avoid"] = [
    "couples-coded",
    "intimate-hushed",
    "scene-y-exclusive",
    "requires-membership",
    "high-friction-pricing",
    "family-saturated",
  ];

  if (stage === "room_exposure") {
    return gentleMode
      ? {
          must: ["single-friendly", "low-social-pressure", "drop-in-friendly"],
          prefer: [
            "people-rich",
            "bustling-neutral",
            "ambient-presence",
            "indoor-public",
          ],
          avoid: baseAvoid,
        }
      : {
          must: ["single-friendly", "people-rich", "drop-in-friendly"],
          prefer: [
            "bustling-neutral",
            "parallel-play",
            "structured-activity",
            "conversation-friendly",
          ],
          avoid: baseAvoid,
        };
  }
  if (stage === "warm_signal") {
    return gentleMode
      ? {
          must: ["single-friendly", "conversation-friendly"],
          prefer: [
            "people-rich",
            "parallel-play",
            "bustling-neutral",
            "low-social-pressure",
          ],
          avoid: baseAvoid,
        }
      : {
          must: ["single-friendly", "conversation-friendly", "people-rich"],
          prefer: [
            "structured-activity",
            "parallel-play",
            "bustling-neutral",
            "regulars-heavy",
          ],
          avoid: baseAvoid,
        };
  }
  if (stage === "conversation_continuation") {
    return {
      must: ["single-friendly", "conversation-friendly"],
      prefer: [
        "bustling-neutral",
        "low-social-pressure",
        "ambient-presence",
        "people-rich",
      ],
      avoid: [...baseAvoid, "loud-lively"],
    };
  }
  // message_closure / send_specific_invite — outcome rep where the venue
  // doesn't matter as much as it being date-appropriate.
  if (shape === "send_specific_invite") {
    return {
      must: ["single-friendly", "conversation-friendly"],
      prefer: [
        "bustling-neutral",
        "low-cost-drop-in",
        "mid-tier-drop-in",
        "indoor-public",
      ],
      avoid: [
        "intimate-hushed",
        "loud-lively",
        "couples-coded",
        "requires-membership",
        "high-friction-pricing",
        "scene-y-exclusive",
      ],
    };
  }
  return {
    must: ["single-friendly"],
    prefer: ["bustling-neutral", "conversation-friendly", "ambient-presence"],
    avoid: baseAvoid,
  };
}

/** Quality profile for the dating-enjoy adapter (recovery / treat-yourself reps). */
function enjoyAdapterQualities(): VenueQualityProfile {
  return {
    must: ["single-friendly"],
    prefer: [
      "ambient-presence",
      "low-social-pressure",
      "outdoor-public",
      "indoor-public",
      "quiet-contemplative",
      "bustling-neutral",
    ],
    avoid: [
      "requires-membership",
      "high-friction-pricing",
      "high-social-pressure",
      "scene-y-exclusive",
    ],
  };
}

function stageRepIntent(stage: DatingStage, shape: DatingRepShape): string {
  if (shape === "venue_selection") {
    return stage === "warm_signal"
      ? "Spend time in a date-worthy room and practice one warm, low-stakes social signal."
      : "Spend time in a date-worthy room and notice one place you would genuinely suggest later.";
  }
  if (shape === "draft_message") {
    return "Pick a real place and draft one honest dating message without sending it yet.";
  }
  if (shape === "continue_conversation") {
    return "Keep one promising conversation alive with one honest follow-up from a real outing.";
  }
  return "Send one specific, low-pressure invite tied to a real place.";
}

function stageExperienceType(
  stage: DatingStage,
  shape: DatingRepShape,
): string {
  if (shape === "venue_selection") {
    return stage === "warm_signal"
      ? "socially alive room with no closure pressure"
      : "date-worthy room with no romantic pressure";
  }
  if (shape === "draft_message") {
    return "date-worthy local place that supports drafting one honest message";
  }
  if (shape === "continue_conversation") {
    return "social container that supports one light conversation follow-up";
  }
  return "social container that supports one low-pressure dating invite";
}

function shapeDifficulty(
  stage: DatingStage,
  gentleMode: boolean,
): [number, number] {
  if (stage === "room_exposure") {
    return gentleMode ? [1, 3] : [2, 4];
  }
  if (stage === "warm_signal") {
    return gentleMode ? [2, 3] : [2, 4];
  }
  if (stage === "conversation_continuation") {
    return gentleMode ? [2, 3] : [3, 4];
  }
  return gentleMode ? [2, 3] : [3, 5];
}

function preferredShape(ctx: PrescriptionPromptContext): DatingRepShape {
  return (
    ctx.datingProgression?.preferredRepShapes?.[0] ??
    (ctx.datingProgression?.allowDirectDatingRep
      ? "send_specific_invite"
      : "venue_selection")
  );
}

function fallbackContract(input: {
  ctx: PrescriptionPromptContext;
  gentleMode: boolean;
}): QuestContract {
  const stage = input.ctx.datingProgression?.stage ?? "room_exposure";
  const shape = preferredShape(input.ctx);
  const directAllowed =
    shape === "send_specific_invite" &&
    input.ctx.datingProgression?.allowDirectDatingRep === true;
  return {
    programId: "dating",
    capabilityId: stage,
    capabilityLabel: stage,
    enactmentPatternId: shape,
    enactmentPatternLabel: shape,
    mode: "bfs",
    capacityTrack:
      stage === "room_exposure"
        ? CapacityTrack.PUBLIC_PRESENCE
        : shape === "venue_selection"
          ? CapacityTrack.MICRO_INTERACTION
          : CapacityTrack.SOCIAL_EXTENSION,
    repShape: shape,
    repIntent: stageRepIntent(stage, shape),
    experienceType: stageExperienceType(stage, shape),
    suggestedCategories: [],
    searchQueries: [],
    exampleActions: [],
    difficultyRange: shapeDifficulty(stage, input.gentleMode),
    socialChallengeLevel:
      stage === "room_exposure" ? "low" : directAllowed ? "low" : "none",
    directGoalTouch: directAllowed,
    allowedGoalActionTypes: directAllowed
      ? ["dating_app_invite", "suggest_coffee", "natural_invitation"]
      : [],
    requiredAction: directAllowed
      ? "Send one message-first, low-pressure dating invite to a real person using a specific venue and time window."
      : undefined,
    requiredElements: directAllowed
      ? [
          "Open one real dating-app match or existing romantic conversation.",
          "Name one specific venue from the quest.",
          "Offer one or two concrete time windows.",
          "Send or prepare a low-pressure invitation that clearly asks to meet.",
        ]
      : undefined,
    forbiddenActions: directAllowed
      ? []
      : [
          "Do not ask someone out yet.",
          "Do not ask for contact information yet.",
        ],
    forbiddenSubstitutions: directAllowed
      ? [
          "Do not replace the invite with smiling, thanking staff, or being friendly to a server.",
          "Do not replace the invite with observing the room, people-watching, or noticing attraction.",
          "Do not replace the invite with generic confidence prep or future-date menu language.",
          "Do not replace the invite with a warm exit line that has no concrete plan.",
        ]
      : undefined,
    successCriteria: [],
    smallerRep: directAllowed
      ? "Draft the exact invite to one real person, including the venue and time windows, but do not send it yet."
      : undefined,
    tinyRep: directAllowed
      ? "Pick the person and the venue, then write the first sentence of the invite."
      : undefined,
    minimumViableWin: directAllowed
      ? "You created a specific dating invite for a real person."
      : undefined,
    exitRamp: directAllowed
      ? "If sending feels too sharp, save the complete draft and decide later."
      : undefined,
    fallback:
      "If this feels too sharp, soften the rep while preserving the same dating capability.",
    rationale: directAllowed
      ? "This is a dating-ladder milestone: use a message-first, low-pressure direct invite."
      : `This is a dating-ladder milestone: advance the ${stage} stage without turning it into a direct ask yet.`,
  };
}

function buildDatingEnjoyContract(input: {
  contract: QuestContract;
}): QuestContract {
  return {
    ...input.contract,
    enactmentPatternId: `${input.contract.enactmentPatternId}_enjoy_adapter`,
    enactmentPatternLabel: `${input.contract.enactmentPatternLabel} (enjoy adapter)`,
    capacityTrack: CapacityTrack.IDENTITY_EVIDENCE,
    repShape: "venue_selection",
    repIntent:
      "Enjoy one date-worthy place and notice one detail you would genuinely want to share with someone later.",
    experienceType:
      "pleasant date-worthy outing that keeps the dating goal warm without performance pressure",
    suggestedCategories: [],
    searchQueries: [],
    exampleActions: [
      "Pick one thing you genuinely enjoyed about the place.",
      "Write one sentence you could honestly share with a future date.",
    ],
    difficultyRange: [1, 3],
    socialChallengeLevel: "none",
    directGoalTouch: false,
    allowedGoalActionTypes: [],
    requiredAction:
      "Have one genuinely enjoyable date-worthy outing and capture one shareable detail. Do not ask anyone out on this rep.",
    requiredElements: [
      "Choose a place that could plausibly be a future low-pressure date spot.",
      "Do one thing there for enjoyment, not performance.",
      "Name one specific detail you would feel comfortable mentioning to someone later.",
    ],
    forbiddenActions: [
      "Do not ask someone out yet.",
      "Do not ask for contact information yet.",
      "Do not make romantic closure the win.",
    ],
    forbiddenSubstitutions: [
      "Do not replace the outing with a generic errand.",
      "Do not replace enjoyment with confidence homework.",
      "Do not turn the rep into a direct invite.",
    ],
    successCriteria: [
      "enjoyed the place",
      "found one shareable detail",
      "kept dating from feeling all-or-nothing",
    ],
    smallerRep:
      "Visit for 15 minutes and capture one shareable detail before leaving.",
    tinyRep:
      "Stand inside the place, look around for five minutes, and save one detail you liked.",
    minimumViableWin:
      "You found one real detail from a date-worthy place that you would not mind sharing later.",
    exitRamp:
      "If the place feels wrong, leave after 10 minutes and write down why it is not a good fit.",
    fallback:
      "If the outing feels like pressure, treat it as taste-building for your future date menu.",
    rationale:
      "Goal-owned enjoy adapter: keep the dating lane alive through pleasure and taste-building instead of adding more closure pressure.",
  };
}

export function applyGoalMilestonePolicy(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
}): GoalMilestonePolicyDecision {
  const { brief, ctx } = input;
  if (!ctx.datingProgression?.isRelevant) {
    return { applied: false };
  }
  if (isDatingMilestonePolicyDisabled()) {
    return {
      applied: false,
      logLine:
        "[multi-agent] Goal milestone policy: skipped via DISABLE_DATING_MILESTONE_POLICY=true",
    };
  }
  if (
    !ctx.datingProgression.questContract &&
    !ctx.activeGoalMilestone?.goalClosureDue
  ) {
    return { applied: false };
  }

  const before = {
    capacityTrack: brief.capacityTrack,
    social: brief.socialChallengeLevel,
    diffMin: brief.difficultyRange[0],
    diffMax: brief.difficultyRange[1],
    categories: brief.suggestedCategories.join(", "),
  };

  const datingProgression = ctx.datingProgression;
  const gentleMode =
    input.ctx.lastRejection?.reason === "TOO_PUBLIC" ||
    input.ctx.lastRejection?.reason === "NEED_GENTLER" ||
    input.ctx.lastRejection?.reason === "TOO_SOCIAL" ||
    datingProgression.cooldownActive;
  const stage = datingProgression.stage;
  let contract =
    datingProgression.questContract ??
    fallbackContract({ ctx, gentleMode });
  if (ctx.questRole === "enjoy") {
    contract = buildDatingEnjoyContract({ contract });
  }
  const shape = (contract.repShape ?? preferredShape(ctx)) as DatingRepShape;
  const directAllowed =
    contract.directGoalTouch &&
    shape === "send_specific_invite" &&
    datingProgression.allowDirectDatingRep;

  brief.datingStage = stage;
  brief.datingRepShape = shape;
  brief.allowDirectDatingRep = directAllowed;
  brief.preferredDatingRepShapes = datingProgression.preferredRepShapes;
  brief.questContract = contract;
  brief.capacityTrack = contract.capacityTrack;
  brief.repIntent = contract.repIntent;
  brief.experienceType = contract.experienceType;
  brief.socialChallengeLevel = contract.socialChallengeLevel;
  brief.venueQualities =
    ctx.questRole === "enjoy"
      ? enjoyAdapterQualities()
      : stageQualities(stage, gentleMode, shape);
  // NOTE: Intentionally do NOT overwrite brief.suggestedCategories or
  // brief.searchQueries from contract — that hardcoded the dating ladder
  // into the same 4 categories every time. Qualities are now the
  // authoritative description; the Strategist LLM picks categories from
  // those, and the Scout's web research verifies the actual room.

  if (!ctx.lastRejection) {
    const [minDifficulty, maxDifficulty] = contract.difficultyRange;
    brief.difficultyRange = [
      Math.max(
        minDifficulty,
        Math.min(brief.difficultyRange[0], maxDifficulty),
      ),
      Math.max(
        minDifficulty,
        Math.min(maxDifficulty, brief.difficultyRange[1]),
      ),
    ];
  }
  if (ctx.questRole === "enjoy") {
    brief.difficultyRange = contract.difficultyRange;
  }
  if (
    ctx.lastRejection &&
    !directAllowed &&
    ["TOO_PUBLIC", "NEED_GENTLER", "TOO_SOCIAL"].includes(
      ctx.lastRejection.reason,
    )
  ) {
    brief.socialChallengeLevel = "none";
    brief.difficultyRange = [
      1,
      Math.min(3, brief.difficultyRange[1], contract.difficultyRange[1]),
    ];
    if (ctx.lastRejection.reason === "TOO_PUBLIC") {
      brief.experienceType =
        "quiet public room that preserves the dating capability at a lower exposure dose";
      // No category override — qualities express the "low-traffic, quiet"
      // intent and the Strategist + verification layer figure out the
      // specific venue.
      brief.venueQualities = {
        must: ["single-friendly", "low-social-pressure", "low-traffic"],
        prefer: ["quiet-contemplative", "ambient-presence", "indoor-public"],
        avoid: [
          "people-rich",
          "loud-lively",
          "couples-coded",
          "requires-membership",
          "high-friction-pricing",
          "scene-y-exclusive",
        ],
      };
    }
    if (!brief.rationale.toLowerCase().includes("fresh rejection")) {
      brief.rationale =
        `${brief.rationale} Fresh rejection adapter: preserve the dating capability, but lower the exposure dose instead of changing the assignment.`.trim();
    }
  }

  const rationaleLine = contract.rationale;
  if (!brief.rationale.includes(rationaleLine)) {
    brief.rationale = `${brief.rationale} ${rationaleLine}`.trim();
  }

  return {
    applied: true,
    logLine:
      `[multi-agent] Goal contract policy: stage=${stage}, shape=${shape}, direct=${directAllowed}, ` +
      `contract=${contract.capabilityId}/${contract.enactmentPatternId}, ` +
      `capacity ${before.capacityTrack}→${brief.capacityTrack}, social ${before.social}→${brief.socialChallengeLevel}, ` +
      `difficulty ${before.diffMin}-${before.diffMax}→${brief.difficultyRange[0]}-${brief.difficultyRange[1]}, ` +
      `categories ${before.categories || "none"}→${brief.suggestedCategories.join(", ")}`,
  };
}
