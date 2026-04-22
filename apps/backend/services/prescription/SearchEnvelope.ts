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
  if (/\bnear\b/i.test(value)) return value;
  return `${value} ${searchLabel}`.replace(/\s+/g, " ").trim();
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

  const rawFamilies = [
    ...input.brief.searchQueries,
    ...input.brief.suggestedCategories.map((category) =>
      `${category} ${input.brief.experienceType}`.trim(),
    ),
    input.brief.experienceType,
  ];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const family of rawFamilies) {
    const next = normalizeQueryFamily(family, knownCities, input.searchLabel);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(next);
    if (normalized.length >= 6) break;
  }

  return normalized;
}

function resolveReachModeRadius(input: {
  reachMode: ReachMode | null;
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
  const searchLabel = `near ${homeCity}`;
  const reachMode = input.ctx.user.reachMode ?? null;
  const maxRadiusMiles = resolveReachModeRadius({
    reachMode,
    radius: input.ctx.radius,
    strategyMaxDistance: input.brief.maxDistanceMiles,
    distancePolicy: input.distancePolicy,
  });

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

  return {
    originLatLng: { lat: input.ctx.homeLat, lng: input.ctx.homeLng },
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
  };
}
