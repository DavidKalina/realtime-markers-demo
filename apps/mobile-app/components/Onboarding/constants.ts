// ── Goal options ────────────────────────────────────────────

export const GOAL_OPTIONS = [
  { key: "build_friends", label: "\uD83D\uDC4B Build a friend group" },
  { key: "start_dating", label: "\u2764\uFE0F Start dating" },
  { key: "stop_homebody", label: "\uD83C\uDFE0 Stop being a homebody" },
  { key: "find_people", label: "\u2728 Find my people" },
  { key: "from_scratch", label: "\uD83D\uDD04 Build a social life from scratch" },
];

// ── Barrier options ─────────────────────────────────────────

export const BARRIER_OPTIONS = [
  { key: "overthink", label: "\uD83E\uDDE0 I overthink every decision", text: "Overthinks social decisions into paralysis" },
  { key: "no_feedback", label: "\uD83E\uDD37 I can't tell if it's working", text: "Can't tell if social efforts are paying off" },
  { key: "feel_behind", label: "\uD83D\uDE14 I feel behind everyone else", text: "Feels behind peers socially" },
  { key: "small_town", label: "\uD83C\uDFD8\uFE0F My town feels too small", text: "Limited social options in their area" },
  { key: "conversations", label: "\uD83D\uDCAC I don't know what to say", text: "Struggles to initiate social interaction" },
  { key: "tried_failed", label: "\uD83D\uDE45 I've tried and nothing worked", text: "Previous attempts at socializing felt futile" },
  { key: "no_energy", label: "\uD83D\uDD0B I don't have the energy", text: "Social effort feels exhausting" },
  { key: "alone_awkward", label: "\uD83D\uDC64 Going alone feels weird", text: "Uncomfortable doing things alone" },
];

// ── Social situation options ────────────────────────────────

export const CURRENT_SOCIAL_OPTIONS = [
  { key: "isolated", label: "Pretty isolated" },
  { key: "few_acquaintances", label: "A few acquaintances" },
  { key: "casual_friends", label: "Some casual friends" },
  { key: "solid_group", label: "Solid friend group" },
];

// ── Quick details options (initial onboarding) ────────────

export const AGE_RANGE_OPTIONS = [
  { key: "18-24", label: "18\u201324" },
  { key: "25-30", label: "25\u201330" },
  { key: "31-40", label: "31\u201340" },
  { key: "41+", label: "41+" },
];

export const ROUTINE_OPTIONS = [
  { key: "nine_to_five", label: "9-to-5" },
  { key: "flexible", label: "Flexible hours" },
  { key: "shift_work", label: "Shift work" },
  { key: "nights_weekends", label: "Free nights & weekends" },
  { key: "unpredictable", label: "Unpredictable" },
];

export const TRANSPORT_OPTIONS = [
  { key: "car", label: "Car" },
  { key: "transit", label: "Transit" },
  { key: "bike", label: "Bike" },
  { key: "walk", label: "Walk" },
  { key: "rideshare", label: "Rideshare" },
];

export const BUDGET_OPTIONS = [
  { key: "free_only", label: "Free stuff only" },
  { key: "low", label: "Under $20" },
  { key: "moderate", label: "$20\u2013$50" },
  { key: "flexible", label: "Not worried about it" },
];

// ── Activity options ────────────────────────────────────────

export const ACTIVITY_OPTIONS = [
  // Going out
  "\u2615 Coffee", "\uD83C\uDF7D\uFE0F Food", "\uD83C\uDF7A Drinks", "\uD83E\uDD5E Brunch",
  // Active / outdoors
  "\uD83E\uDD7E Hiking", "\uD83C\uDFC3 Running", "\uD83D\uDEB4 Cycling", "\uD83C\uDFCA Swimming",
  "\uD83D\uDEF9 Skating", "\uD83C\uDFC2 Longboarding", "\uD83E\uDDD7 Climbing", "\uD83C\uDFCB\uFE0F Gym",
  "\uD83E\uDD4F Disc golf", "\uD83C\uDFD5\uFE0F Camping", "\uD83C\uDFBF Skiing", "\uD83E\uDDD8 Yoga",
  // Creative / cultural
  "\uD83C\uDFA8 Art", "\uD83C\uDFB5 Music", "\uD83D\uDCF8 Photography", "\uD83C\uDFAD Theatre",
  "\uD83C\uDFA4 Karaoke", "\u270D\uFE0F Writing", "\uD83C\uDFB8 Playing music",
  // Social / chill
  "\uD83C\uDFAE Gaming", "\uD83C\uDFB2 Board games", "\uD83D\uDCDA Reading", "\uD83C\uDF73 Cooking",
  "\uD83C\uDF31 Gardening", "\uD83D\uDC15 Dog walks", "\uD83C\uDF33 Nature", "\uD83D\uDC86 Spa",
];

// ── Quest reflection options ───────────────────────────────

export const QUEST_REFLECTION_OPTIONS = [
  { key: "too_easy", label: "Too easy \u2014 I barely noticed" },
  { key: "just_right", label: "Just right \u2014 felt good" },
  { key: "pushed_me", label: "Pushed me \u2014 that took effort" },
];

export function reflectionToPace(reflectionKey: string): string {
  switch (reflectionKey) {
    case "too_easy": return "push_me";
    case "pushed_me": return "gentle";
    default: return "steady";
  }
}

export function summarizeBarriers(barrierKeys: string[]): string {
  if (barrierKeys.length === 0) return "";
  const labels = barrierKeys
    .slice(0, 2)
    .map((key) => {
      const option = BARRIER_OPTIONS.find((b) => b.key === key);
      if (!option) return key;
      // Strip leading emoji and "I " prefix for concise summary
      return option.label
        .replace(/^[^\s]+\s/, "")
        .replace(/^I\s+/i, "")
        .toLowerCase();
    });
  if (labels.length === 1) return labels[0];
  return `${labels[0]} and ${labels[1]}`;
}

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

export function deriveBarriersText(
  barrierKeys: string[],
  dynamicBarriers?: { key: string; label: string; text: string }[],
): string {
  const options = dynamicBarriers ?? BARRIER_OPTIONS;
  return barrierKeys
    .map((key) => options.find((b) => b.key === key)?.text)
    .filter(Boolean)
    .join("; ");
}

