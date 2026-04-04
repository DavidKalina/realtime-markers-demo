// ── Goal options ────────────────────────────────────────────

export const GOAL_OPTIONS = [
  { key: "explore", label: "\uD83D\uDDFA\uFE0F Explore my area" },
  { key: "socialize", label: "\uD83D\uDC4B Meet people" },
  { key: "discover_hobby", label: "\u2728 Discover a new hobby" },
  { key: "routine", label: "\uD83D\uDD01 Build a routine" },
  { key: "fitness", label: "\uD83D\uDCAA Get active" },
  { key: "new_skill", label: "\uD83C\uDFAF Pick up a new skill" },
  { key: "unwind", label: "\uD83E\uDDD8 Decompress" },
];

// ── Barrier options ─────────────────────────────────────────

export const BARRIER_OPTIONS = [
  { key: "anxiety", label: "\uD83D\uDE30 Anxiety / overwhelm", text: "Feels anxious or overwhelmed going out" },
  { key: "unknown", label: "\uD83E\uDD37 Not knowing where to go", text: "Doesn't know where to go or what to do" },
  { key: "time", label: "\u23F0 Hard to find time", text: "Struggles to find free time" },
  { key: "budget", label: "\uD83D\uDCB0 Budget concerns", text: "Worried about costs" },
  { key: "homebody", label: "\uD83C\uDFE0 Prefer staying home", text: "Prefers staying home over going out" },
  { key: "solo", label: "\uD83D\uDC64 Don't want to go alone", text: "Uncomfortable doing things alone" },
  { key: "stuck", label: "\uD83D\uDD04 Stuck in routines", text: "Stuck in the same routines" },
];

// ── Activity options ────────────────────────────────────────

export const ACTIVITY_OPTIONS = [
  "\u2615 Coffee", "\uD83E\uDD7E Hiking", "\uD83C\uDFA8 Art", "\uD83D\uDCDA Reading",
  "\uD83C\uDF7D\uFE0F Food", "\uD83C\uDFB5 Music", "\uD83C\uDFCB\uFE0F Fitness", "\uD83C\uDF33 Nature",
  "\uD83D\uDEF9 Skating", "\uD83D\uDCF8 Photography", "\uD83E\uDDD8 Wellness", "\uD83C\uDF7A Drinks",
  "\uD83C\uDFAD Theatre", "\uD83C\uDFCA Swimming", "\uD83D\uDC15 Dog walks", "\uD83C\uDFAE Gaming",
  "\uD83C\uDFD5\uFE0F Camping", "\uD83D\uDEB4 Cycling", "\uD83C\uDFA4 Karaoke", "\uD83E\uDDD7 Climbing",
  "\uD83C\uDFBF Skiing", "\uD83D\uDC86 Spa", "\uD83C\uDF7C Brunch", "\uD83C\uDFB2 Board games",
];

// ── Pace options ────────────────────────────────────────────

export const PACE_OPTIONS = [
  { key: "gentle", emoji: "\uD83D\uDC22", label: "Gentle", desc: "Ease me in, stay close" },
  { key: "steady", emoji: "\uD83D\uDEB6", label: "Steady", desc: "Balanced expansion" },
  { key: "push_me", emoji: "\uD83D\uDE80", label: "Push Me", desc: "Challenge me, stretch further" },
];

// ── Fear ladder scenarios ──────────────────────────────────
// Each scenario probes a specific comfort dimension.
// Users rate 1 (not scary) to 5 (terrifying).

export type FearDimension = "solo" | "social" | "novelty" | "physical" | "vulnerability";

export interface FearLadderScenario {
  id: string;
  text: string;
  dimension: FearDimension;
}

export const FEAR_LADDER_SCENARIOS: FearLadderScenario[] = [
  { id: "coffee_alone",     text: "Sit alone at a coffee shop for 30 minutes",          dimension: "solo" },
  { id: "talk_stranger",    text: "Strike up a conversation with a stranger",            dimension: "social" },
  { id: "fitness_class",    text: "Go to a fitness class where you don't know anyone",   dimension: "social" },
  { id: "new_neighborhood", text: "Explore a neighborhood you've never been to",         dimension: "novelty" },
  { id: "eat_alone",        text: "Eat at a restaurant by yourself",                     dimension: "solo" },
  { id: "group_event",      text: "Attend a meetup or group event solo",                 dimension: "vulnerability" },
  { id: "new_activity",     text: "Try an activity you've never done before",            dimension: "novelty" },
  { id: "ask_rec",          text: "Ask someone for a recommendation in person",          dimension: "social" },
  { id: "park_alone",       text: "Walk around a park or trail by yourself",             dimension: "physical" },
  { id: "live_show",        text: "Go to a live show or performance alone",              dimension: "vulnerability" },
];

export const FEAR_RATING_LABELS = ["Not scary", "A little", "Moderate", "Scary", "Terrifying"] as const;

// ── Fear ladder scoring ────────────────────────────────────

export interface FearLadderResult {
  /** 0-1 normalized overall score. 0 = very comfortable, 1 = very anxious */
  overallScore: number;
  /** Per-dimension averages, normalized 0-1 */
  dimensionScores: Record<string, number>;
  /** Raw responses keyed by scenario id */
  responses: Record<string, number>;
  /** Auto-derived pace preference */
  derivedPace: "gentle" | "steady" | "push_me";
}

/**
 * Score a fear ladder — works with both hardcoded and LLM-generated scenarios.
 * When dynamic scenarios/dimensions are provided, uses those instead of defaults.
 */
export function scoreFearLadder(
  responses: Record<string, number>,
  scenarios?: { id: string; text: string; dimension: string }[],
  dimensions?: string[],
): FearLadderResult {
  const scenarioList = scenarios ?? FEAR_LADDER_SCENARIOS;
  const dims = dimensions ?? (["solo", "social", "novelty", "physical", "vulnerability"] as string[]);

  const answered = scenarioList.filter((s) => responses[s.id] != null);
  if (answered.length === 0) {
    const defaultScores: Record<string, number> = {};
    for (const dim of dims) defaultScores[dim] = 0.5;
    return {
      overallScore: 0.5,
      dimensionScores: defaultScores,
      responses,
      derivedPace: "steady",
    };
  }

  // Per-dimension scores first (normalized 0-1)
  const dimMean = (answered.reduce((acc, s) => acc + responses[s.id], 0) / answered.length - 1) / 4;
  const dimensionScores: Record<string, number> = {};
  for (const dim of dims) {
    const dimScenarios = answered.filter((s) => s.dimension === dim);
    if (dimScenarios.length === 0) {
      dimensionScores[dim] = dimMean;
    } else {
      const dimSum = dimScenarios.reduce((acc, s) => acc + responses[s.id], 0);
      dimensionScores[dim] = (dimSum / dimScenarios.length - 1) / 4;
    }
  }

  // Overall score: blend mean (50%) with 75th percentile (50%).
  // This prevents high-anxiety dimensions from being averaged away
  // by low-anxiety ones.
  const sorted = answered.map((s) => responses[s.id]).sort((a, b) => a - b);
  const p75Index = Math.min(Math.ceil(sorted.length * 0.75) - 1, sorted.length - 1);
  const p75 = (sorted[p75Index] - 1) / 4;
  const overallScore = dimMean * 0.5 + p75 * 0.5;

  // Derive pace from blended score
  let derivedPace: "gentle" | "steady" | "push_me";
  if (overallScore >= 0.6) derivedPace = "gentle";
  else if (overallScore <= 0.3) derivedPace = "push_me";
  else derivedPace = "steady";

  return { overallScore, dimensionScores, responses, derivedPace };
}

// ── Derivation helpers ──────────────────────────────────────

export function deriveComfortZone(barrierKeys: string[], goalKeys: string[]): string {
  const parts: string[] = [];

  if (barrierKeys.includes("homebody")) parts.push("Mostly stays home");
  else if (barrierKeys.includes("stuck")) parts.push("Tends to stick to familiar places");
  else parts.push("Open to going out but needs direction");

  if (barrierKeys.includes("solo")) parts.push("prefers familiar company");
  if (barrierKeys.includes("anxiety")) parts.push("can feel overwhelmed in new settings");
  if (goalKeys.includes("explore")) parts.push("wants to explore but needs a push");
  if (goalKeys.includes("socialize")) parts.push("interested in meeting new people");
  if (goalKeys.includes("discover_hobby")) parts.push("wants to discover a new hobby or activity");

  return parts.join("; ");
}

export function deriveBarriersText(barrierKeys: string[]): string {
  return barrierKeys
    .map((key) => BARRIER_OPTIONS.find((b) => b.key === key)?.text)
    .filter(Boolean)
    .join("; ");
}

export function deriveGoalsText(goalKeys: string[]): string {
  return goalKeys
    .map((key) => GOAL_OPTIONS.find((g) => g.key === key)?.label.replace(/^[^\s]+\s/, ""))
    .filter(Boolean)
    .join(", ");
}
