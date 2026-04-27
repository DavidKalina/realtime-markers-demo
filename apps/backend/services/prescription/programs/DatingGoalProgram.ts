import { CapacityTrack } from "../../../entities/Sidequest";
import type {
  CapabilityEvidence,
  CapabilityNode,
  EnactmentPattern,
  GoalProgram,
  JourneyCapabilityState,
  QuestContract,
} from "../GoalProgram";
import {
  findCapability,
  previousCapability,
  rotatePatternsAwayFromRecent,
} from "../GoalProgram";

export type DatingCapabilityId =
  | "activation"
  | "dateable_life"
  | "public_comfort"
  | "micro_conversation"
  | "repeatable_social_context"
  | "attraction_awareness"
  | "interest_signal"
  | "specific_invitation"
  | "rejection_recovery"
  | "dating_rhythm";

export type DatingRepShape =
  | "venue_selection"
  | "draft_message"
  | "continue_conversation"
  | "send_specific_invite";

type BlockerMeta = { type: string; severity: string; phase: string } | null;
type RejectionPatternMeta = { reason: string; count: number } | null;

type DatingJourneyStateWithoutContract = Omit<
  JourneyCapabilityState,
  "questContract"
>;

function pattern(
  input: Omit<EnactmentPattern, "capabilityId"> & {
    capabilityId: DatingCapabilityId;
  },
): EnactmentPattern {
  return input;
}

const datingCapabilities: CapabilityNode[] = [
  {
    id: "activation",
    label: "Leave the dating avoidance loop",
    description:
      "The user can leave home for low-pressure, date-plausible outings.",
    prerequisites: [],
    successSignals: ["completed an outing", "rated it at least 3 stars"],
    regressionSignals: ["abandoned", "rated 1-2 stars", "reported dread"],
    enactmentPatterns: [
      pattern({
        id: "dating_activation_easy_room",
        capabilityId: "activation",
        label: "Easy date-plausible room",
        description:
          "Go somewhere that could become a simple date spot later, with no interaction pressure.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.ACTIVATION,
        repShape: "venue_selection",
        containerTypes: ["casual_third_place", "quiet_public_place"],
        exampleActions: [
          "Stay for 20-30 minutes.",
          "Notice whether you would ever suggest this place to someone.",
        ],
        difficultyRange: [1, 3],
        socialChallengeLevel: "none",
      }),
    ],
  },
  {
    id: "dateable_life",
    label: "Build an invite-able life",
    description:
      "The user collects real places and activities that make dating feel less theoretical.",
    prerequisites: ["activation"],
    successSignals: ["would return", "named a place they could suggest"],
    regressionSignals: ["generic errand", "no place worth repeating"],
    enactmentPatterns: [
      pattern({
        id: "dateable_life_scout_spot",
        capabilityId: "dateable_life",
        label: "Scout a date-worthy spot",
        description:
          "Try one concrete place and decide if it belongs on their personal low-pressure date menu.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.IDENTITY_EVIDENCE,
        repShape: "venue_selection",
        containerTypes: [
          "casual_third_place",
          "food_social",
          "performance_event",
        ],
        exampleActions: [
          "Pick one thing you liked about the room.",
          "Write one sentence you could honestly say about it later.",
        ],
        difficultyRange: [2, 4],
        socialChallengeLevel: "none",
      }),
    ],
  },
  {
    id: "public_comfort",
    label: "Be visible without performing",
    description:
      "The user can remain in people-rich rooms without hiding or fleeing.",
    prerequisites: ["dateable_life"],
    successSignals: ["stayed through a segment", "did not hide in corner"],
    regressionSignals: ["left quickly", "avoided shared space"],
    enactmentPatterns: [
      pattern({
        id: "public_comfort_people_room",
        capabilityId: "public_comfort",
        label: "Stay in a people room",
        description:
          "Enter a socially alive space and let the room carry the exposure.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
        repShape: "venue_selection",
        containerTypes: [
          "board_game_social",
          "movement_group",
          "performance_event",
          "casual_third_place",
        ],
        exampleActions: [
          "Stay through one round, set, or natural activity cycle.",
          "Choose a seat or area that keeps you part of the room.",
        ],
        difficultyRange: [2, 4],
        socialChallengeLevel: "low",
      }),
    ],
  },
  {
    id: "micro_conversation",
    label: "Start tiny conversations",
    description:
      "The user can create small, low-stakes exchanges without making it romantic.",
    prerequisites: ["public_comfort"],
    successSignals: ["asked a simple question", "followed up once"],
    regressionSignals: ["stayed silent despite clear openings"],
    enactmentPatterns: [
      pattern({
        id: "micro_conversation_context_question",
        capabilityId: "micro_conversation",
        label: "Ask a context question",
        description:
          "Use the room itself as the script for a two-exchange conversation.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.MICRO_INTERACTION,
        repShape: "continue_conversation",
        containerTypes: [
          "board_game_social",
          "structured_class",
          "creative_workshop",
          "movement_group",
        ],
        exampleActions: [
          "Ask one person an easy question about the shared activity.",
          "Follow up once on their answer.",
        ],
        difficultyRange: [3, 5],
        socialChallengeLevel: "low",
      }),
    ],
  },
  {
    id: "repeatable_social_context",
    label: "Find rooms with repeated faces",
    description:
      "The user identifies a container that can support return visits and familiarity.",
    prerequisites: ["micro_conversation"],
    successSignals: ["returned", "saw regulars", "would return"],
    regressionSignals: ["one-off novelty", "no repeated-room potential"],
    enactmentPatterns: [
      pattern({
        id: "repeatable_social_context_recurring_room",
        capabilityId: "repeatable_social_context",
        label: "Try a recurring container",
        description:
          "Sample a recurring event, class, club, or activity where repeated faces are plausible.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.RETURNABILITY,
        repShape: "continue_conversation",
        containerTypes: [
          "recurring_club",
          "structured_class",
          "board_game_social",
          "movement_group",
        ],
        exampleActions: [
          "Check when this room happens again.",
          "Notice whether there are regulars or a repeatable rhythm.",
        ],
        difficultyRange: [3, 5],
        socialChallengeLevel: "low",
      }),
    ],
  },
  {
    id: "attraction_awareness",
    label: "Notice attraction without freezing",
    description:
      "The user can notice romantic interest while staying regulated and respectful.",
    prerequisites: ["repeatable_social_context"],
    nearTarget: true,
    successSignals: ["noticed interest", "stayed present", "did not flee"],
    regressionSignals: [
      "panicked",
      "self-erased",
      "overthought into avoidance",
    ],
    enactmentPatterns: [
      pattern({
        id: "attraction_awareness_warm_read",
        capabilityId: "attraction_awareness",
        label: "Practice a warm read",
        description:
          "Notice one person they might enjoy talking to and stay grounded without acting yet.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
        repShape: "draft_message",
        containerTypes: [
          "recurring_club",
          "board_game_social",
          "partner_dance_social",
          "food_social",
        ],
        exampleActions: [
          "Notice one person you feel curious about without forcing action.",
          "Write one grounded sentence about what made the interaction feel warm.",
        ],
        difficultyRange: [3, 5],
        socialChallengeLevel: "low",
      }),
    ],
  },
  {
    id: "interest_signal",
    label: "Signal interest lightly",
    description:
      "The user can make a warm, respectful signal of interest without needing certainty.",
    prerequisites: ["attraction_awareness"],
    nearTarget: true,
    successSignals: [
      "gave a compliment",
      "named enjoyment",
      "made a warm signal",
    ],
    regressionSignals: ["kept it purely neutral when ready"],
    enactmentPatterns: [
      pattern({
        id: "interest_signal_warm_exit_line",
        capabilityId: "interest_signal",
        label: "Use a warm exit line",
        description:
          "End one interaction by lightly naming that it was enjoyable.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
        repShape: "continue_conversation",
        containerTypes: [
          "recurring_club",
          "board_game_social",
          "structured_class",
          "food_social",
        ],
        exampleActions: [
          "Say something like, 'I liked talking with you.'",
          "Leave without trying to force a full date ask.",
        ],
        difficultyRange: [4, 6],
        socialChallengeLevel: "medium",
      }),
    ],
  },
  {
    id: "specific_invitation",
    label: "Make a specific invitation",
    description:
      "The user can suggest a concrete, low-pressure plan through an app, message, or warm social context.",
    prerequisites: ["interest_signal"],
    nearTarget: true,
    successSignals: [
      "drafted a concrete invite",
      "suggested a time/place",
      "sent invite",
      "asked to continue conversation",
    ],
    regressionSignals: ["stayed vague", "waited for certainty"],
    enactmentPatterns: [
      pattern({
        id: "specific_invitation_draft_first",
        capabilityId: "specific_invitation",
        label: "Draft the specific invite",
        description:
          "Use a real place from the journey to draft one concrete, low-pressure invitation before sending pressure is introduced.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
        repShape: "draft_message",
        containerTypes: ["dating_app", "casual_third_place", "food_social"],
        exampleActions: [
          "Pick one real person and one specific place.",
          "Draft the invite with a place and one or two possible time windows, but do not send it yet.",
        ],
        difficultyRange: [3, 5],
        socialChallengeLevel: "low",
      }),
      pattern({
        id: "specific_invitation_message_first",
        capabilityId: "specific_invitation",
        label: "Message-first specific invite",
        description:
          "Use a real place from the journey to send one concrete, low-pressure invitation.",
        modeHint: "bfs",
        capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
        repShape: "send_specific_invite",
        containerTypes: ["dating_app", "casual_third_place", "food_social"],
        exampleActions: [
          "Send one invite with a specific place and two possible times.",
          "Keep the tone low-pressure and concrete.",
        ],
        difficultyRange: [5, 7],
        socialChallengeLevel: "medium",
        directGoalTouch: true,
        goalActionTypes: [
          "dating_app_invite",
          "suggest_coffee",
          "natural_invitation",
        ],
      }),
    ],
  },
  {
    id: "rejection_recovery",
    label: "Recover from ambiguity or rejection",
    description:
      "The user can stay in motion after a no, no reply, or awkward attempt.",
    prerequisites: ["specific_invitation"],
    nearTarget: true,
    successSignals: ["reflected without spiraling", "tried again gently"],
    regressionSignals: ["quit after rejection", "globalized one no"],
    enactmentPatterns: [
      pattern({
        id: "rejection_recovery_reset",
        capabilityId: "rejection_recovery",
        label: "Post-invite reset",
        description:
          "Do one grounded outing that keeps dating from becoming all-or-nothing.",
        modeHint: "dfs",
        capacityTrack: CapacityTrack.RECOVERY,
        repShape: "venue_selection",
        containerTypes: ["quiet_public_place", "casual_third_place"],
        exampleActions: [
          "Write one sentence separating this attempt from your identity.",
          "Choose one next small dating action you could still take.",
        ],
        difficultyRange: [1, 3],
        socialChallengeLevel: "none",
      }),
    ],
  },
  {
    id: "dating_rhythm",
    label: "Build a repeatable dating rhythm",
    description:
      "The user can keep a humane rhythm of meeting, inviting, recovering, and trying again.",
    prerequisites: ["specific_invitation", "rejection_recovery"],
    terminal: true,
    successSignals: ["sent multiple invites", "kept social rhythm alive"],
    regressionSignals: ["all-or-nothing bursts", "retreated fully home"],
    enactmentPatterns: [
      pattern({
        id: "dating_rhythm_weekly_loop",
        capabilityId: "dating_rhythm",
        label: "Weekly dating loop",
        description:
          "Maintain one weekly room, one message, and one recovery action without making dating the whole life.",
        modeHint: "dfs",
        capacityTrack: CapacityTrack.RETURNABILITY,
        repShape: "continue_conversation",
        containerTypes: ["recurring_club", "dating_app", "casual_third_place"],
        exampleActions: [
          "Return to one promising room.",
          "Send or continue one dating conversation.",
        ],
        difficultyRange: [4, 6],
        socialChallengeLevel: "medium",
      }),
    ],
  },
];

export const DATING_GOAL_PROGRAM: GoalProgram = {
  id: "dating",
  label: "Dating",
  targetIdentity:
    "I am someone who can meet people, signal interest, invite, recover, and keep a humane dating rhythm.",
  startStatePrompt:
    "I mostly avoid dating initiative, overthink attraction, and need an offline life that makes invitations feel real.",
  terminalCapabilityId: "dating_rhythm",
  goldenLane: [
    "repeatable_social_context",
    "attraction_awareness",
    "interest_signal",
    "specific_invitation",
    "rejection_recovery",
    "dating_rhythm",
  ],
  forbiddenStalls: [
    "endless_generic_outings",
    "dateable_life_without_initiative",
    "social_availability_without_romantic_risk",
  ],
  capabilities: datingCapabilities,
};

const DATING_REP_SHAPE_BY_PATTERN: Record<string, DatingRepShape> =
  Object.fromEntries(
    datingCapabilities.flatMap((capability) =>
      capability.enactmentPatterns.map((p) => [
        p.id,
        (p.repShape ?? "venue_selection") as DatingRepShape,
      ]),
    ),
  ) as Record<string, DatingRepShape>;

export function repShapeForPatternId(patternId: string): DatingRepShape | null {
  return DATING_REP_SHAPE_BY_PATTERN[patternId] ?? null;
}

export function patternForRepShape(
  repShape: DatingRepShape,
  capabilityId?: DatingCapabilityId,
): EnactmentPattern | null {
  if (capabilityId) {
    const capability = findCapability(DATING_GOAL_PROGRAM, capabilityId);
    const match = capability.enactmentPatterns.find(
      (p) => p.repShape === repShape,
    );
    if (match) return match;
  }
  for (const capability of DATING_GOAL_PROGRAM.capabilities) {
    const match = capability.enactmentPatterns.find(
      (p) => p.repShape === repShape,
    );
    if (match) return match;
  }
  return null;
}

export function downgradeDatingPattern(
  patternId: string | null | undefined,
): EnactmentPattern {
  const shape = patternId ? repShapeForPatternId(patternId) : null;
  if (shape === "send_specific_invite") {
    return (
      patternForRepShape("draft_message", "specific_invitation") ??
      patternForRepShape("draft_message") ??
      datingCapabilities[1]!.enactmentPatterns[0]!
    );
  }
  if (shape === "draft_message" || shape === "continue_conversation") {
    return (
      patternForRepShape("venue_selection") ??
      datingCapabilities[1]!.enactmentPatterns[0]!
    );
  }
  return datingCapabilities[1]!.enactmentPatterns[0]!;
}

function datingForbiddenActions(input: {
  repShape?: string;
  allowTerminalAction: boolean;
}) {
  if (input.allowTerminalAction) return [];
  if (input.repShape === "continue_conversation") {
    return [
      "Do not ask someone out yet.",
      "Do not ask for contact information yet.",
      "Do not turn the rep into a full dating invite.",
    ];
  }
  return [
    "Do not ask someone out yet.",
    "Do not ask for contact information yet.",
    "Do not make romantic closure the win.",
  ];
}

const DIRECT_INVITE_REQUIRED_ELEMENTS = [
  "Open one real dating-app match or existing romantic conversation.",
  "Name one specific venue from the quest.",
  "Offer one or two concrete time windows.",
  "Send or prepare a low-pressure invitation that clearly asks to meet.",
];

const DIRECT_INVITE_FORBIDDEN_SUBSTITUTIONS = [
  "Do not replace the invite with smiling, thanking staff, or being friendly to a server.",
  "Do not replace the invite with observing the room, people-watching, or noticing attraction.",
  "Do not replace the invite with generic confidence prep or future-date menu language.",
  "Do not replace the invite with a warm exit line that has no concrete plan.",
];

function datingFallback(input: {
  repShape?: string;
  allowTerminalAction: boolean;
}) {
  if (input.allowTerminalAction) {
    return "If sending feels too sharp, draft the specific invite first and save it before deciding whether to send.";
  }
  if (input.repShape === "continue_conversation") {
    return "If interaction feels too high, write or draft the follow-up without sending it yet.";
  }
  return "If the place feels off, leave after a short stay and count the venue read as useful information.";
}

export function buildDatingQuestContract(input: {
  state: DatingJourneyStateWithoutContract;
  gentleMode: boolean;
}): QuestContract {
  const { state, gentleMode } = input;
  const pattern = state.currentPattern;
  const maxDifficulty = gentleMode
    ? Math.min(pattern.difficultyRange[1], 3)
    : pattern.difficultyRange[1];
  const difficultyRange: [number, number] = [
    Math.min(pattern.difficultyRange[0], maxDifficulty),
    maxDifficulty,
  ];
  const directGoalTouch =
    pattern.directGoalTouch === true && state.allowTerminalAction;
  const isSpecificInviteDraft =
    state.currentCapability.id === "specific_invitation" &&
    pattern.repShape === "draft_message";

  return {
    programId: DATING_GOAL_PROGRAM.id,
    capabilityId: state.currentCapability.id,
    capabilityLabel: state.currentCapability.label,
    enactmentPatternId: pattern.id,
    enactmentPatternLabel: pattern.label,
    mode: state.mode,
    capacityTrack: pattern.capacityTrack,
    repShape: pattern.repShape,
    repIntent: pattern.description,
    experienceType: pattern.label,
    suggestedCategories: [],
    searchQueries: [],
    exampleActions: pattern.exampleActions,
    difficultyRange,
    socialChallengeLevel: directGoalTouch
      ? "low"
      : pattern.socialChallengeLevel,
    directGoalTouch,
    allowedGoalActionTypes: directGoalTouch
      ? (pattern.goalActionTypes ?? ["other_direct_goal_action"])
      : [],
    requiredAction: directGoalTouch
      ? "Send one message-first, low-pressure dating invite to a real person using a specific venue and time window."
      : isSpecificInviteDraft
        ? "Draft one message-first, low-pressure dating invite to a real person using a specific venue and time window. Do not send it yet."
        : undefined,
    requiredElements: directGoalTouch
      ? DIRECT_INVITE_REQUIRED_ELEMENTS
      : isSpecificInviteDraft
        ? [
            "Choose one real dating-app match or existing romantic conversation.",
            "Name one specific venue from the quest.",
            "Offer one or two concrete time windows.",
            "Write the complete invitation as a draft without sending it yet.",
          ]
        : undefined,
    forbiddenActions: datingForbiddenActions({
      repShape: pattern.repShape,
      allowTerminalAction: directGoalTouch,
    }),
    forbiddenSubstitutions:
      directGoalTouch || isSpecificInviteDraft
        ? DIRECT_INVITE_FORBIDDEN_SUBSTITUTIONS
        : undefined,
    successCriteria: state.currentCapability.successSignals,
    smallerRep:
      directGoalTouch || isSpecificInviteDraft
        ? "Draft the exact invite to one real person, including the venue and time windows, but do not send it yet."
        : undefined,
    tinyRep:
      directGoalTouch || isSpecificInviteDraft
        ? "Pick the person and the venue, then write the first sentence of the invite."
        : undefined,
    minimumViableWin:
      directGoalTouch || isSpecificInviteDraft
        ? "You created a specific dating invite for a real person."
        : undefined,
    exitRamp:
      directGoalTouch || isSpecificInviteDraft
        ? "If sending feels too sharp, save the complete draft and decide later."
        : undefined,
    fallback: datingFallback({
      repShape: pattern.repShape,
      allowTerminalAction: directGoalTouch,
    }),
    rationale: directGoalTouch
      ? "This quest is the current dating capability contract: a message-first, low-pressure specific invitation."
      : isSpecificInviteDraft
        ? "This quest is the current dating capability contract: draft the specific invitation before asking the user to send it."
      : `This quest is the current dating capability contract: ${state.currentCapability.label.toLowerCase()} without forcing romantic closure.`,
  };
}

export function capabilityFromEvidence(
  evidence: CapabilityEvidence,
): DatingCapabilityId {
  if (evidence.completedQuestCount < 2) return "activation";
  if (evidence.completedQuestCount < 4) return "dateable_life";
  if (evidence.completedQuestCount < 6 || evidence.avgRecentRating < 3) {
    return "public_comfort";
  }
  if (evidence.recentStructuredCount === 0) return "micro_conversation";
  if (
    evidence.completedQuestCount < 8 ||
    (evidence.recentNonSoloCount === 0 &&
      evidence.recentRelationshipEvidenceCount === 0 &&
      !evidence.recentMilestoneQuestSeen)
  ) {
    return "repeatable_social_context";
  }
  if (evidence.recentRelationshipEvidenceCount === 0) {
    return "attraction_awareness";
  }
  if (evidence.recentDirectDatingRepCount === 0) {
    return "interest_signal";
  }
  if (evidence.recentDirectDatingRepCount < 2) {
    return "rejection_recovery";
  }
  return "dating_rhythm";
}

function statusForCapability(
  capabilityId: DatingCapabilityId,
  evidence: CapabilityEvidence,
) {
  if (capabilityId === "activation" && evidence.completedQuestCount > 0) {
    return "repeatable" as const;
  }
  if (
    capabilityId === "specific_invitation" &&
    evidence.recentDirectDatingRepCount > 0
  ) {
    return "attempted" as const;
  }
  if (evidence.avgRecentRating >= 3.5) return "available" as const;
  return "attempted" as const;
}

export function resolveDatingJourneyState(input: {
  evidence: CapabilityEvidence;
  goalClosureDue: boolean;
  blockerMeta: BlockerMeta;
  rejectionPattern?: RejectionPatternMeta;
  city?: string;
  /**
   * Persisted progression state — when provided, overrides the heuristic
   * capability/mode/pattern computation. Blocker and golden-lane logic still
   * apply on top (they're prescription-time overrides, not state mutations).
   */
  persistedProgress?: {
    capabilityId: string;
    mode: "bfs" | "dfs";
    lockedPatternId: string | null;
  };
}): JourneyCapabilityState {
  const evidence = input.evidence;
  const heuristicCapabilityId = capabilityFromEvidence(evidence);
  const baseCapabilityId =
    input.persistedProgress?.capabilityId ?? heuristicCapabilityId;
  let capability = findCapability(
    DATING_GOAL_PROGRAM,
    baseCapabilityId,
  ) as CapabilityNode;
  let promotedByGoalClosure = false;
  let bridgedToDraftInvite = false;
  let loweredByBlocker = false;
  let loweredByRecentDirectRep = false;

  if (
    input.goalClosureDue &&
    evidence.completedQuestCount >= 6 &&
    DATING_GOAL_PROGRAM.goldenLane.includes(capability.id)
  ) {
    const promoted = findCapability(
      DATING_GOAL_PROGRAM,
      "specific_invitation",
    ) as CapabilityNode;
    if (promoted.id !== capability.id) {
      capability = promoted;
      promotedByGoalClosure = true;
    }
  }

  const blockerLooksHot =
    input.blockerMeta?.phase === "avoid" ||
    ["NEED_GENTLER", "TOO_SOCIAL", "TOO_PUBLIC"].includes(
      input.blockerMeta?.type ?? "",
    ) ||
    (["NEED_GENTLER", "TOO_SOCIAL", "TOO_PUBLIC"].includes(
      input.rejectionPattern?.reason ?? "",
    ) &&
      (input.rejectionPattern?.count ?? 0) >= 2);
  const shouldLowerForBlocker =
    blockerLooksHot &&
    !(
      input.goalClosureDue &&
      input.blockerMeta?.phase !== "avoid" &&
      capability.id === "specific_invitation"
    );
  if (
    shouldLowerForBlocker &&
    DATING_GOAL_PROGRAM.goldenLane.includes(capability.id)
  ) {
    const lowered = previousCapability(DATING_GOAL_PROGRAM, capability.id);
    if (lowered.id !== capability.id) {
      capability = lowered;
      loweredByBlocker = true;
    }
  }

  const cooldownActive =
    evidence.questsSinceDirectDatingRep !== null &&
    evidence.questsSinceDirectDatingRep < 2;
  if (cooldownActive && capability.id === "specific_invitation") {
    capability = previousCapability(DATING_GOAL_PROGRAM, capability.id);
    loweredByRecentDirectRep = true;
  }

  const allowTerminalAction =
    capability.id === "specific_invitation" &&
    !cooldownActive &&
    (!blockerLooksHot ||
      (input.goalClosureDue && input.blockerMeta?.phase !== "avoid"));
  let patterns = rotatePatternsAwayFromRecent(
    capability.enactmentPatterns,
    evidence.recentRepPatternIds,
  );
  if (
    capability.id === "specific_invitation" &&
    allowTerminalAction &&
    evidence.recentDirectDatingRepCount === 0 &&
    evidence.recentDraftDatingRepCount === 0
  ) {
    const draftPattern = patternForRepShape(
      "draft_message",
      "specific_invitation",
    );
    if (draftPattern) {
      patterns = [
        draftPattern,
        ...patterns.filter((pattern) => pattern.id !== draftPattern.id),
      ];
      bridgedToDraftInvite = true;
    }
  } else if (
    capability.id === "specific_invitation" &&
    allowTerminalAction &&
    evidence.recentDirectDatingRepCount === 0 &&
    evidence.recentDraftDatingRepCount > 0
  ) {
    const sendPattern = patternForRepShape(
      "send_specific_invite",
      "specific_invitation",
    );
    if (sendPattern) {
      patterns = [
        sendPattern,
        ...patterns.filter((pattern) => pattern.id !== sendPattern.id),
      ];
    }
  }

  const heuristicMode =
    evidence.recentStructuredCount > 0 &&
    evidence.recentRepPatternIds.includes(
      capability.enactmentPatterns[0]?.id ?? "",
    )
      ? "dfs"
      : "bfs";
  // Persisted progress is the source of truth for mode + locked pattern when
  // it points at the same capability we ended up with. If the prescription-time
  // overrides (blocker / golden-lane) shifted us to a different capability,
  // fall back to the heuristic for that capability.
  const persistedAppliesToCapability =
    input.persistedProgress?.capabilityId === capability.id;
  const mode = persistedAppliesToCapability
    ? input.persistedProgress!.mode
    : heuristicMode;
  const lockedPatternFromProgress =
    persistedAppliesToCapability && input.persistedProgress?.lockedPatternId
      ? capability.enactmentPatterns.find(
          (p) => p.id === input.persistedProgress!.lockedPatternId,
        )
      : undefined;
  const currentPattern =
    lockedPatternFromProgress ??
    patterns[0] ??
    capability.enactmentPatterns[0]!;
  const stateWithoutContract: DatingJourneyStateWithoutContract = {
    program: DATING_GOAL_PROGRAM,
    currentCapability: capability,
    currentPattern,
    mode,
    status: statusForCapability(capability.id as DatingCapabilityId, evidence),
    preferredPatterns: patterns,
    cooldownActive,
    allowTerminalAction,
    debug: {
      baseCapabilityId,
      finalCapabilityId: capability.id,
      promotedByGoalClosure,
      bridgedToDraftInvite,
      loweredByBlocker,
      loweredByRecentDirectRep,
    },
  };

  return {
    ...stateWithoutContract,
    questContract: buildDatingQuestContract({
      state: stateWithoutContract,
      gentleMode: blockerLooksHot,
    }),
  };
}
