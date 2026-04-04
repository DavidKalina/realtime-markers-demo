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
