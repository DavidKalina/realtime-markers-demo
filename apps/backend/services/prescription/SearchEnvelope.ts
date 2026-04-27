import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { DistancePolicyDecision } from "./DistancePolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";

type ReachMode = "local_only" | "nearby_mix" | "best_opportunities";

export interface SearchEnvelopeZoneHint {
  city: string;
  distanceMiles: number;
  opportunityScore: number;
  tier: "home_base" | "nearby_growth_zone" | "regional_anchor";
  rationale: string[];
}

export interface SearchEnvelope {
  originLatLng: { lat: number; lng: number };
  maxRadiusMiles: number;
  queryFamilies: string[];
  preferredZoneHints: SearchEnvelopeZoneHint[];
  disallowedFamilies: string[];
  phase: string;
  reachMode: ReachMode | null;
  searchLabel: string;
  /**
   * Threaded through to the candidate scorer so it can bias against home-base
   * venues when the market is too sparse for the goal. Without this signal,
   * the scorer only sees per-mile distance penalties and the closest Frederick
   * cafe always beats the better Longmont opportunity.
   */
  homeBaseViability: "strong" | "limited" | "weak" | null;
  homeCity: string;
}

export function localSearchCeilingMiles(radius: number): number {
  return Math.max(radius + 0.25, 4);
}

function stripState(city: string): string {
  return city.split(",")[0]?.trim() ?? city.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQueryFamily(
  raw: string,
  knownCities: string[],
  searchLabel: string,
): string {
  let value = raw.trim();
  for (const city of knownCities) {
    const bare = stripState(city);
    value = value.replace(new RegExp(`\\b${escapeRegExp(city)}\\b`, "ig"), " ");
    value = value.replace(new RegExp(`\\b${escapeRegExp(bare)}\\b`, "ig"), " ");
  }
  value = value
    .replace(/\b(in|around)\b\s*$/i, "")
    .replace(/\bCO\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return "";
  if (/\b(near|in)\b/i.test(value)) return value;
  return `${value} ${searchLabel}`.replace(/\s+/g, " ").trim();
}

function stateSearchLabel(city: string): string {
  const stateCode = city.split(",")[1]?.trim().toUpperCase();
  switch (stateCode) {
    case "CO":
      return "in Colorado";
    default:
      return stateCode ? `in ${stateCode}` : "nearby";
  }
}

function goalDiscoveryModifier(goalTags: string[]): string {
  const normalized = goalTags.map((tag) => tag.toLowerCase());
  if (
    normalized.some((tag) =>
      /(dating|romance|relationship|meet-people|meet_people)/.test(tag),
    )
  ) {
    return "social";
  }
  if (
    normalized.some((tag) => /(friend|community|belonging|social)/.test(tag))
  ) {
    return "social";
  }
  return "";
}

const EVENT_CATEGORY_SET = new Set([
  "Board Game Venue",
  "Workshop / Class Venue",
  "College / Adult Education",
  "Art Studio / Workshop",
  "Music Venue / Concert Hall",
  "Theatre / Performing Arts",
  "Gym / Fitness Studio",
  "Yoga / Pilates Studio",
  "Climbing Gym",
  "Sports Club",
  "Maker Space",
]);

const EVENT_DISCOVERY_PATTERN =
  /\b(class|lesson|social|meetup|mixer|open mic|comedy|trivia|dance|salsa|swing|bachata|live music|concert|show|speed dating|singles|run club|volunteer|workshop|club|league|open play|book club|author event|language exchange|game night)\b/i;

function isEventDiscoveryCategory(category: string): boolean {
  return EVENT_CATEGORY_SET.has(category);
}

function isEventDiscoveryQuery(query: string): boolean {
  return EVENT_DISCOVERY_PATTERN.test(query);
}

function withModifier(query: string, modifier: string): string {
  if (!modifier) return query;
  if (new RegExp(`\\b${escapeRegExp(modifier)}\\b`, "i").test(query)) {
    return query;
  }
  return `${modifier} ${query}`.replace(/\s+/g, " ").trim();
}

function broadenEventDiscoveryQuery(
  query: string,
  knownCities: string[],
  regionalSearchLabel: string,
  modifier: string,
): string {
  let value = query.trim();
  for (const city of knownCities) {
    const bare = stripState(city);
    value = value.replace(new RegExp(`\\b${escapeRegExp(city)}\\b`, "ig"), " ");
    value = value.replace(new RegExp(`\\b${escapeRegExp(bare)}\\b`, "ig"), " ");
  }
  value = value
    .replace(/\bnear\b/gi, " ")
    .replace(/\bin\b\s+(colorado|co)\b/gi, " ")
    .replace(/\bCO\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  return `${withModifier(value, modifier)} ${regionalSearchLabel}`
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackQueryForCategory(
  category: string,
  searchLabel: string,
  regionalSearchLabel: string,
  goalModifier: string,
): string | null {
  switch (category) {
    case "Board Game Venue":
      return `board game night ${regionalSearchLabel}`;
    case "Workshop / Class Venue":
    case "College / Adult Education":
      return withModifier(
        `beginner class ${regionalSearchLabel}`,
        goalModifier,
      );
    case "Art Studio / Workshop":
      return `art workshop ${regionalSearchLabel}`;
    case "Music Venue / Concert Hall":
    case "Theatre / Performing Arts":
      return `live music ${regionalSearchLabel}`;
    case "Gym / Fitness Studio":
    case "Yoga / Pilates Studio":
      return withModifier(
        `group fitness class ${regionalSearchLabel}`,
        goalModifier,
      );
    case "Climbing Gym":
      return `climbing gym ${searchLabel}`;
    case "Sports Club":
      return withModifier(`adult sports ${regionalSearchLabel}`, goalModifier);
    case "Community Center":
      return `community center ${searchLabel}`;
    case "Recreation Center":
      return `recreation center ${searchLabel}`;
    case "Maker Space":
      return `maker space ${searchLabel}`;
    case "Coworking Space":
      return `coworking ${searchLabel}`;
    case "Brewery / Taproom":
      return `brewery ${searchLabel}`;
    case "Bar":
      return `bar ${searchLabel}`;
    case "Coffee Shop":
      return `coffee shop ${searchLabel}`;
    case "Brunch Spot":
      return `brunch ${searchLabel}`;
    case "Restaurant":
      return `restaurant ${searchLabel}`;
    case "Library":
      return `library ${searchLabel}`;
    case "Trail / Park":
      return `park ${searchLabel}`;
    default:
      return `${category} ${searchLabel}`.replace(/\s+/g, " ").trim();
  }
}

function buildQueryFamilies(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
  searchLabel: string;
}): string[] {
  const knownCities = [
    input.ctx.city,
    input.ctx.homeCity,
    input.brief.targetCity,
    ...(input.ctx.opportunityZones?.zones.map((zone) => zone.city) ?? []),
  ].filter((value): value is string => Boolean(value));

  const rawFamilies =
    input.brief.searchQueries.length > 0
      ? [...input.brief.searchQueries]
      : input.brief.suggestedCategories.map(
          (category) =>
            fallbackQueryForCategory(
              category,
              input.searchLabel,
              stateSearchLabel(input.ctx.homeCity ?? input.ctx.city),
              goalDiscoveryModifier(input.ctx.goalTags),
            ) ?? category,
        );

  const regionalSearchLabel = stateSearchLabel(
    input.ctx.homeCity ?? input.ctx.city,
  );
  const goalModifier = goalDiscoveryModifier(input.ctx.goalTags);

  const seen = new Set<string>();
  const normalized: string[] = [];
  const fallbackCategories = input.brief.searchQueries.length
    ? input.brief.suggestedCategories
    : [];
  for (const [index, family] of rawFamilies.entries()) {
    const category = fallbackCategories[index] ?? null;
    const shouldBroaden =
      (category ? isEventDiscoveryCategory(category) : false) ||
      isEventDiscoveryQuery(family);
    const next = shouldBroaden
      ? broadenEventDiscoveryQuery(
          family,
          knownCities,
          regionalSearchLabel,
          goalModifier,
        )
      : normalizeQueryFamily(family, knownCities, input.searchLabel);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(next);
    if (normalized.length >= 6) break;
  }

  return normalized;
}

type ReachModeSource =
  | "user_choice"
  | "auto_local"
  | "auto_promoted_weak_market"
  | "auto_promoted_observed_willingness";

interface EffectiveReachModeResolution {
  mode: ReachMode;
  source: ReachModeSource;
  /** True when the user has not explicitly chosen a reachMode. */
  isAuto: boolean;
}

/**
 * Resolve the reach mode to act on for this prescription.
 *
 * If the user has explicitly chosen a mode, honor it. Otherwise, read the
 * same signals the strategist sees — opportunity-zone viability and observed
 * willingness — and auto-promote past plain `local_only` when the data
 * supports it. The previous behavior treated null as `local_only`, which
 * silently overrode strategist proposals to expand even when the system had
 * already concluded the home base was too sparse.
 */
export function resolveEffectiveReachMode(
  ctx: PrescriptionPromptContext,
): EffectiveReachModeResolution {
  if (ctx.user.reachMode) {
    return {
      mode: ctx.user.reachMode,
      source: "user_choice",
      isAuto: false,
    };
  }

  const homeBaseViability = ctx.opportunityZones?.homeBaseViability ?? null;
  const recommendedCity = ctx.opportunityZones?.recommendedCity ?? null;
  const willingnessSignal = ctx.willingness?.willingnessSignal ?? "untested";
  const completedQuestCount = ctx.completedQuestCount ?? 0;

  if (
    homeBaseViability === "weak" &&
    recommendedCity &&
    completedQuestCount >= 5
  ) {
    return {
      mode: "nearby_mix",
      source: "auto_promoted_weak_market",
      isAuto: true,
    };
  }
  if (willingnessSignal === "regional_capable") {
    return {
      mode: "best_opportunities",
      source: "auto_promoted_observed_willingness",
      isAuto: true,
    };
  }
  if (willingnessSignal === "nearby_capable") {
    return {
      mode: "nearby_mix",
      source: "auto_promoted_observed_willingness",
      isAuto: true,
    };
  }
  return { mode: "local_only", source: "auto_local", isAuto: true };
}

function resolveReachModeRadius(input: {
  reachMode: ReachMode;
  radius: number;
  strategyMaxDistance: number;
  distancePolicy: DistancePolicyDecision;
}): number {
  const localCeiling = localSearchCeilingMiles(input.radius);
  const strategyCap = input.strategyMaxDistance;

  if (input.distancePolicy.wasClampedByRejection) {
    return strategyCap;
  }

  switch (input.reachMode) {
    case "best_opportunities":
      return strategyCap;
    case "nearby_mix":
      return Math.min(strategyCap, Math.max(localCeiling, 12));
    case "local_only":
    default:
      return Math.min(strategyCap, localCeiling);
  }
}

export function buildSearchEnvelope(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
  distancePolicy: DistancePolicyDecision;
}): SearchEnvelope {
  const homeCity = input.ctx.homeCity ?? input.ctx.city;
  // Use the active search city (which may have been redirected away from
  // home) for the query label. Without this, queries say "bookstore near
  // Frederick" while the search center is Longmont — Google then biases
  // back to Frederick and the redirect is half-defeated.
  const searchCity = input.ctx.city ?? homeCity;
  const searchLabel = `near ${searchCity}`;
  const effective = resolveEffectiveReachMode(input.ctx);
  const reachMode = effective.mode;
  const maxRadiusMiles = resolveReachModeRadius({
    reachMode,
    radius: input.ctx.radius,
    strategyMaxDistance: input.brief.maxDistanceMiles,
    distancePolicy: input.distancePolicy,
  });

  if (effective.isAuto && effective.mode !== "local_only") {
    console.log(
      `[multi-agent] SearchEnvelope: auto-promoted reach mode → ${effective.mode} (${effective.source})`,
    );
  }

  const preferredZoneHints =
    reachMode === "local_only"
      ? []
      : (input.ctx.opportunityZones?.zones ?? [])
          .filter((zone) => {
            if (zone.isHomeBase) return false;
            if (zone.distanceMiles > maxRadiusMiles + 0.5) return false;
            if (
              reachMode === "nearby_mix" &&
              zone.tier === "regional_anchor" &&
              zone.distanceMiles > 12.5
            ) {
              return false;
            }
            return true;
          })
          .slice(0, 3)
          .map((zone) => ({
            city: zone.city,
            distanceMiles: zone.distanceMiles,
            opportunityScore: zone.opportunityScore,
            tier: zone.tier,
            rationale: zone.rationale,
          }));

  // originLatLng follows the active search anchor, which may have been
  // redirected away from home when the home base is too sparse for the
  // user's goal. Scoring uses this so distance penalties are measured
  // against where we're actually searching, not the user's bedroom.
  return {
    originLatLng: { lat: input.ctx.searchLat, lng: input.ctx.searchLng },
    maxRadiusMiles,
    queryFamilies: buildQueryFamilies({
      brief: input.brief,
      ctx: input.ctx,
      searchLabel,
    }),
    preferredZoneHints,
    disallowedFamilies: [...input.brief.avoidCategories],
    phase: input.ctx.journeyPhase?.phase ?? "unknown",
    reachMode,
    searchLabel,
    homeBaseViability: input.ctx.opportunityZones?.homeBaseViability ?? null,
    homeCity: homeCity,
  };
}
