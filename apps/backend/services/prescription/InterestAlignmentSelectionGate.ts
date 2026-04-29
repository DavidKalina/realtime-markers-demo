import type { ScoutCandidate } from "./PrescriptionStrategy";
import {
  scoreInterestAlignment,
  selectInterestAligned,
  type InterestSignals,
} from "./InterestAlignmentPolicy";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";

const FIRST_REPS_GATE = 5;
const SLATE_COUNT = 5;
const MIN_ALIGNED = 3;

export interface InterestAlignmentGateInput {
  candidates: ScoutCandidate[];
  signals: InterestSignals;
  completedQuestCount: number;
}

export type InterestAlignmentGateDecision =
  | { kind: "passthrough"; reason: "past_first_five" | "insufficient_aligned" }
  | { kind: "use_slate"; slate: ScoutCandidate[]; alignedCount: number };

export function applyInterestAlignmentGate(
  input: InterestAlignmentGateInput,
): InterestAlignmentGateDecision {
  if (input.completedQuestCount >= FIRST_REPS_GATE) {
    return { kind: "passthrough", reason: "past_first_five" };
  }

  const scored = input.candidates.map((candidate) => ({
    candidate,
    score: scoreInterestAlignment(candidate, input.signals),
  }));
  const result = selectInterestAligned(scored, {
    count: SLATE_COUNT,
    minAligned: MIN_ALIGNED,
  });
  if (result.status === "insufficient_aligned") {
    return { kind: "passthrough", reason: "insufficient_aligned" };
  }
  return {
    kind: "use_slate",
    slate: result.selected.map((s) => s.candidate),
    alignedCount: result.selected.filter((s) => s.score > 0).length,
  };
}

export function buildInterestSignals(
  user: PrescriptionPromptContext["user"],
): InterestSignals {
  return {
    activities: user.onboardingProfile?.activities ?? [],
    goalTags: user.comfortProfile?.goalTags ?? [],
    primaryGoal: user.comfortProfile?.primaryGoal ?? null,
  };
}
