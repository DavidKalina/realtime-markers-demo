/**
 * Venue qualities — the language the harness uses to describe what kind of
 * room serves a rep, instead of fencing the strategist into hardcoded
 * category lists.
 *
 * A category like "Brunch Spot" can be a great date-plausible room
 * (people-rich, single-friendly, low-social-pressure) or a terrible one
 * (couples-coded, intimate-hushed, high-friction-pricing). The qualities
 * vocabulary lets policies and the LLM reason about the *room*, not the
 * *category*.
 *
 * The vocabulary is intentionally finite. New terms must be added here so
 * the strategist + validator share the same dictionary.
 */

export type VenueQuality =
  // ── Density (how many people, what kind of mix) ──
  | "people-rich"
  | "low-traffic"
  | "regulars-heavy"
  | "tourist-heavy"
  | "single-friendly"
  | "couples-coded"
  | "family-saturated"
  | "solo-friendly"
  // ── Pressure (what does the room ask of you) ──
  | "drop-in-friendly"
  | "walk-in-only"
  | "requires-signup"
  | "requires-membership"
  | "requires-reservation"
  | "time-bounded"
  | "low-social-pressure"
  | "high-social-pressure"
  // ── Energy (the room's vibe) ──
  | "quiet-contemplative"
  | "bustling-neutral"
  | "loud-lively"
  | "intimate-hushed"
  | "scene-y-exclusive"
  // ── Format (what the rep looks like there) ──
  | "structured-activity"
  | "ambient-presence"
  | "transactional"
  | "conversation-friendly"
  | "parallel-play"
  | "outdoor-public"
  | "indoor-public"
  // ── Cost ──
  | "free"
  | "low-cost-drop-in"
  | "mid-tier-drop-in"
  | "high-friction-pricing"
  | "paid-only";

export const QUALITY_DEFINITIONS: Record<VenueQuality, string> = {
  "people-rich": "high foot traffic, multiple parties present, ambient social density",
  "low-traffic": "few people, quiet, easy to be alone there",
  "regulars-heavy": "you'll see the same faces if you return",
  "tourist-heavy": "transient crowd, no continuity between visits",
  "single-friendly": "solo people don't stand out, no social cost to being alone",
  "couples-coded": "the room is designed for pairs (date-night bistros, couples massage)",
  "family-saturated": "kids, strollers, family logistics dominate the space",
  "solo-friendly": "structurally welcoming to a single person (counter seats, communal tables)",
  "drop-in-friendly": "no booking, no signup, no membership — just walk in",
  "walk-in-only": "no online booking option; you have to physically show up",
  "requires-signup": "must register / RSVP / book a class slot in advance",
  "requires-membership": "monthly membership or annual fee; no drop-in pricing",
  "requires-reservation": "table or slot must be reserved ahead",
  "time-bounded": "an event or class with fixed start and end (vs. open-ended)",
  "low-social-pressure": "you can stay silent and not interact; no obligation to engage",
  "high-social-pressure": "interaction is expected (group introductions, partner activities)",
  "quiet-contemplative": "library-quiet, conducive to thinking or reading",
  "bustling-neutral": "active but not overwhelming, conversation possible",
  "loud-lively": "music or crowd loud enough that conversation is effortful",
  "intimate-hushed": "low-light, low-volume, romantic / serious tone",
  "scene-y-exclusive": "club / bottle service / dress code; gatekeeping element",
  "structured-activity": "an organized format (class, league, club, workshop)",
  "ambient-presence": "be in the room without doing anything specific (cafe, gallery, park)",
  "transactional": "primary purpose is buying/selling (shop, retail) — interaction is optional",
  "conversation-friendly": "people there are actively chatting; speaking is normal",
  "parallel-play": "people doing the same thing alongside each other (climbing, board games, knit night)",
  "outdoor-public": "outdoors, accessible without entering a building",
  "indoor-public": "indoors, in a public-access space",
  "free": "no cost to enter or participate",
  "low-cost-drop-in": "under ~$20 to participate / order something",
  "mid-tier-drop-in": "$20–$50",
  "high-friction-pricing": "expensive enough that the cost is a barrier",
  "paid-only": "must pay something to be present (covered by membership / signup tags also)",
};

export const ALL_QUALITIES = Object.keys(QUALITY_DEFINITIONS) as VenueQuality[];

export interface VenueQualityProfile {
  /** Hard requirements — venue should match all of these. */
  must: VenueQuality[];
  /** Soft preferences — venue scoring tilts toward these. */
  prefer: VenueQuality[];
  /** Hard violations — venue is rejected if it matches any of these. */
  avoid: VenueQuality[];
}

export const EMPTY_QUALITY_PROFILE: VenueQualityProfile = {
  must: [],
  prefer: [],
  avoid: [],
};

/**
 * Merge two profiles. `must` and `prefer` union; `avoid` unions too.
 * If a quality appears in `must`+`avoid` from different sources, `avoid` wins
 * (the safer signal — better to drop a candidate than force a bad fit).
 */
export function mergeQualityProfiles(
  ...profiles: (VenueQualityProfile | null | undefined)[]
): VenueQualityProfile {
  const must = new Set<VenueQuality>();
  const prefer = new Set<VenueQuality>();
  const avoid = new Set<VenueQuality>();

  for (const profile of profiles) {
    if (!profile) continue;
    for (const q of profile.must) must.add(q);
    for (const q of profile.prefer) prefer.add(q);
    for (const q of profile.avoid) avoid.add(q);
  }

  // avoid wins over must/prefer when they conflict.
  for (const q of avoid) {
    must.delete(q);
    prefer.delete(q);
  }

  return {
    must: [...must],
    prefer: [...prefer],
    avoid: [...avoid],
  };
}

/** Render a quality profile as a structured prompt block for an LLM. */
export function renderQualityProfileBlock(
  profile: VenueQualityProfile,
): string {
  if (
    profile.must.length === 0 &&
    profile.prefer.length === 0 &&
    profile.avoid.length === 0
  ) {
    return "";
  }
  const lines: string[] = ["VENUE QUALITY PROFILE FOR THIS REP:"];
  if (profile.must.length) {
    lines.push(`- MUST match (hard requirement): ${profile.must.join(", ")}`);
  }
  if (profile.prefer.length) {
    lines.push(`- PREFER (tilt toward): ${profile.prefer.join(", ")}`);
  }
  if (profile.avoid.length) {
    lines.push(`- AVOID (hard reject): ${profile.avoid.join(", ")}`);
  }
  return lines.join("\n");
}

export function isVenueQuality(value: unknown): value is VenueQuality {
  return typeof value === "string" && value in QUALITY_DEFINITIONS;
}

/** Sanitize an LLM-emitted qualities array — drop unknown terms, dedupe. */
export function sanitizeQualities(values: unknown): VenueQuality[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<VenueQuality>();
  for (const v of values) {
    if (isVenueQuality(v)) out.add(v);
  }
  return [...out];
}

/**
 * Derive a quality profile from the user's social situation (budget,
 * transportation, etc.). Currently maps `budget` → cost-related avoids.
 * Returns the empty profile when no signals are present.
 */
export function qualitiesFromSocialSituation(
  socialSituation:
    | { budget?: string; transportation?: string }
    | null
    | undefined,
): VenueQualityProfile {
  if (!socialSituation) return { ...EMPTY_QUALITY_PROFILE };
  const must: VenueQuality[] = [];
  const prefer: VenueQuality[] = [];
  const avoid: VenueQuality[] = [];

  const budgetText = (socialSituation.budget ?? "").toLowerCase();
  if (
    /\b(tight|low|broke|struggl|limited|under \$?20|free)\b/.test(budgetText)
  ) {
    avoid.push("paid-only", "high-friction-pricing", "requires-membership");
    prefer.push("free", "low-cost-drop-in");
  } else if (/\b(modest|moderate|mid)/.test(budgetText)) {
    avoid.push("high-friction-pricing", "requires-membership");
  }

  return { must, prefer, avoid };
}

/**
 * Coerce a stored user-level quality profile (jsonb) into a sanitized
 * VenueQualityProfile. Drops unknown terms.
 */
export function qualitiesFromUserPrefs(
  raw:
    | { must?: unknown; prefer?: unknown; avoid?: unknown }
    | null
    | undefined,
): VenueQualityProfile {
  if (!raw) return { ...EMPTY_QUALITY_PROFILE };
  return {
    must: sanitizeQualities(raw.must),
    prefer: sanitizeQualities(raw.prefer),
    avoid: sanitizeQualities(raw.avoid),
  };
}

/** Render the full vocabulary as guidance for an LLM prompt. */
export function renderQualityVocabularyBlock(): string {
  const lines: string[] = ["VENUE QUALITY VOCABULARY (use only these terms):"];
  const groups: Record<string, VenueQuality[]> = {
    Density: [
      "people-rich",
      "low-traffic",
      "regulars-heavy",
      "tourist-heavy",
      "single-friendly",
      "couples-coded",
      "family-saturated",
      "solo-friendly",
    ],
    Pressure: [
      "drop-in-friendly",
      "walk-in-only",
      "requires-signup",
      "requires-membership",
      "requires-reservation",
      "time-bounded",
      "low-social-pressure",
      "high-social-pressure",
    ],
    Energy: [
      "quiet-contemplative",
      "bustling-neutral",
      "loud-lively",
      "intimate-hushed",
      "scene-y-exclusive",
    ],
    Format: [
      "structured-activity",
      "ambient-presence",
      "transactional",
      "conversation-friendly",
      "parallel-play",
      "outdoor-public",
      "indoor-public",
    ],
    Cost: [
      "free",
      "low-cost-drop-in",
      "mid-tier-drop-in",
      "high-friction-pricing",
      "paid-only",
    ],
  };
  for (const [dimension, terms] of Object.entries(groups)) {
    lines.push(`\n${dimension}:`);
    for (const term of terms) {
      lines.push(`  - ${term}: ${QUALITY_DEFINITIONS[term]}`);
    }
  }
  return lines.join("\n");
}
