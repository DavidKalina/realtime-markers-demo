import type { ScoutCandidate } from "./PrescriptionStrategy";

export interface InterestSignals {
  activities: string[];
  goalTags: string[];
  primaryGoal: string | null;
}

const ACTIVITY_WEIGHT = 1.0;
const PRIMARY_GOAL_WEIGHT = 0.6;
const GOAL_TAG_WEIGHT = 0.4;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "with",
  "find",
  "get",
  "go",
  "make",
  "do",
  "i",
  "my",
  "me",
  "want",
  "need",
  "class",
  "place",
  "spot",
]);

const GOAL_TAG_KEYWORDS: Record<string, string[]> = {
  discover_hobby: ["workshop", "class", "studio", "lesson", "maker", "open"],
  dating: ["bar", "cafe", "social", "dance", "lounge"],
  community: ["community", "meetup", "club", "volunteer", "neighborhood"],
};

function candidateHaystack(candidate: ScoutCandidate): string {
  return [
    candidate.venueCategory,
    candidate.googlePrimaryType ?? "",
    candidate.googlePrimaryTypeDisplayName ?? "",
    ...(candidate.googleTypes ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length > 2 && !STOP_WORDS.has(tok));
}

function anyTokenMatches(haystack: string, tokens: string[]): boolean {
  return tokens.some((tok) => haystack.includes(tok));
}

export interface ScoredCandidate {
  candidate: ScoutCandidate;
  score: number;
}

export type SelectInterestAlignedResult =
  | { status: "ok"; selected: ScoredCandidate[] }
  | { status: "insufficient_aligned"; alignedCount: number };

export function selectInterestAligned(
  scored: ScoredCandidate[],
  opts: { count: number; minAligned: number },
): SelectInterestAlignedResult {
  const aligned = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (aligned.length < opts.minAligned) {
    return { status: "insufficient_aligned", alignedCount: aligned.length };
  }
  const fillers = scored.filter((s) => s.score === 0);
  return {
    status: "ok",
    selected: [...aligned, ...fillers].slice(0, opts.count),
  };
}

export function scoreInterestAlignment(
  candidate: ScoutCandidate,
  signals: InterestSignals,
): number {
  const haystack = candidateHaystack(candidate);
  let score = 0;

  for (const activity of signals.activities) {
    if (anyTokenMatches(haystack, tokenize(activity))) {
      score = Math.max(score, ACTIVITY_WEIGHT);
    }
  }

  if (signals.primaryGoal) {
    if (anyTokenMatches(haystack, tokenize(signals.primaryGoal))) {
      score = Math.max(score, PRIMARY_GOAL_WEIGHT);
    }
  }

  for (const tag of signals.goalTags) {
    const keywords = GOAL_TAG_KEYWORDS[tag];
    if (keywords && anyTokenMatches(haystack, keywords)) {
      score = Math.max(score, GOAL_TAG_WEIGHT);
    }
  }

  return score;
}
