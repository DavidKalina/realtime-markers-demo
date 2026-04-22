import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { NearbyCity } from "../shared/OverpassService";
import type { JourneyPhase } from "./JourneyPhasePolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";

export type HomeBaseViability = "strong" | "limited" | "weak";
export type OpportunityTier =
  | "home_base"
  | "nearby_growth_zone"
  | "regional_anchor";

export interface RankedOpportunityZone {
  city: string;
  distanceMiles: number;
  population: number | null;
  opportunityScore: number;
  tier: OpportunityTier;
  rationale: string[];
  isHomeBase: boolean;
}

export interface OpportunityZoneAnalysis {
  homeBaseViability: HomeBaseViability;
  recommendedCity: string | null;
  fallbackCity: string | null;
  zones: RankedOpportunityZone[];
  promptBlock: string;
}

export interface OpportunityZonePolicyDecision {
  applied: boolean;
  logLine?: string;
}

const PEOPLE_RICH_GOAL_TAGS = new Set([
  "dating",
  "friendship",
  "socialize",
  "community",
  "third_place",
  "new_skill",
  "discover_hobby",
]);

const STRUCTURED_GOAL_TAGS = new Set([
  "dating",
  "friendship",
  "community",
  "third_place",
  "new_skill",
  "discover_hobby",
  "fitness",
]);

function normalizePopulation(population: number | null): number {
  return population ?? 18000;
}

function populationOpportunityScore(population: number): number {
  if (population < 15000) return 0.6;
  if (population < 30000) return 1.2;
  if (population < 60000) return 2.4;
  if (population < 120000) return 3.6;
  if (population < 300000) return 4.6;
  if (population < 700000) return 5.3;
  return 5.8;
}

function uniqueCities(cities: NearbyCity[], homeCity: string): NearbyCity[] {
  const seen = new Set<string>();
  const result: NearbyCity[] = [];
  for (const city of cities) {
    const key = city.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(city);
  }

  if (
    !result.some((city) => city.name.toLowerCase() === homeCity.toLowerCase())
  ) {
    result.unshift({
      name: homeCity,
      lat: 0,
      lng: 0,
      population: null,
      distanceMeters: 0,
    });
  }

  return result;
}

export function analyzeOpportunityZones(input: {
  homeCity: string;
  nearbyCities: NearbyCity[];
  goalTags: string[];
  completedQuestCount: number;
  isEarlyCalibration: boolean;
  journeyPhase: JourneyPhase;
}): OpportunityZoneAnalysis {
  const goalTags = new Set(input.goalTags);
  const peopleRichGoal = [...goalTags].some((tag) =>
    PEOPLE_RICH_GOAL_TAGS.has(tag),
  );
  const structuredGoal = [...goalTags].some((tag) =>
    STRUCTURED_GOAL_TAGS.has(tag),
  );

  const ranked = uniqueCities(input.nearbyCities, input.homeCity)
    .map((city): RankedOpportunityZone => {
      const population = normalizePopulation(city.population);
      const distanceMiles = city.distanceMeters / 1609.34;
      const isHomeBase =
        city.name.toLowerCase() === input.homeCity.toLowerCase();
      const rationale: string[] = [];
      let opportunityScore = populationOpportunityScore(population);

      if (peopleRichGoal) {
        if (population >= 50000) {
          opportunityScore += 1.3;
          rationale.push("larger people pool");
        } else if (population < 25000) {
          opportunityScore -= 1.6;
          rationale.push("sparse social pool");
        }
      }

      if (structuredGoal) {
        if (population >= 60000) {
          opportunityScore += 0.9;
          rationale.push("better odds of classes/clubs");
        } else if (population < 20000) {
          opportunityScore -= 0.8;
        }
      }

      if (
        [
          "goal_closure_due",
          "post_breakthrough_consolidation",
          "late_world_building",
        ].includes(input.journeyPhase)
      ) {
        if (population >= 80000) {
          opportunityScore += 0.9;
          rationale.push("supports late-stage social growth");
        } else if (!isHomeBase && population < 30000) {
          opportunityScore -= 0.9;
        }
      }

      if (isHomeBase) {
        if (input.isEarlyCalibration) {
          opportunityScore += 1.5;
          rationale.push("low-friction trust zone");
        } else {
          opportunityScore += 0.3;
        }

        if (
          peopleRichGoal &&
          input.completedQuestCount >= 5 &&
          population < 25000
        ) {
          opportunityScore -= 2.3;
          rationale.push("too sparse to be the whole map");
        }
      }

      if (distanceMiles <= 12) {
        opportunityScore += 0.5;
      }

      const travelPenaltyDivisor = input.isEarlyCalibration
        ? 4.5
        : peopleRichGoal
          ? 8.5
          : 10;
      opportunityScore -= distanceMiles / travelPenaltyDivisor;

      const tier: OpportunityTier = isHomeBase
        ? "home_base"
        : population >= 100000
          ? "regional_anchor"
          : "nearby_growth_zone";

      return {
        city: city.name,
        distanceMiles,
        population: city.population,
        opportunityScore: Number(opportunityScore.toFixed(2)),
        tier,
        rationale,
        isHomeBase,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  const homeZone =
    ranked.find(
      (zone) => zone.city.toLowerCase() === input.homeCity.toLowerCase(),
    ) ?? ranked[0];
  const homePopulation = normalizePopulation(homeZone?.population ?? null);
  const homeBaseViability: HomeBaseViability = !peopleRichGoal
    ? "strong"
    : homePopulation >= 60000
      ? "strong"
      : homePopulation >= 25000
        ? "limited"
        : input.completedQuestCount >= 5
          ? "weak"
          : "limited";

  const recommendedZone = input.isEarlyCalibration ? homeZone : ranked[0];
  const fallbackZone =
    ranked.find(
      (zone) =>
        zone.city !== recommendedZone?.city &&
        zone.opportunityScore >= (recommendedZone?.opportunityScore ?? 0) - 1.5,
    ) ?? null;

  const topLines = ranked.slice(0, 4).map((zone) => {
    const popText =
      zone.population != null
        ? `${zone.population.toLocaleString()} people`
        : "population unknown";
    return `- ${zone.city}: score ${zone.opportunityScore.toFixed(2)}; ${zone.distanceMiles.toFixed(1)} mi; ${popText}; ${zone.rationale.join(", ") || "general nearby option"}`;
  });

  const lines = [
    "\nOPPORTUNITY ZONES:",
    `- Home-base viability for this goal: ${homeBaseViability}.`,
    recommendedZone
      ? `- Recommended zone: ${recommendedZone.city}.`
      : "- Recommended zone: none.",
    fallbackZone ? `- Fallback zone: ${fallbackZone.city}.` : "",
    ...topLines,
    peopleRichGoal
      ? "- Geography rule: do not over-optimize sparse home-base towns when nearby cities offer much better odds of people-rich rooms."
      : "",
  ].filter(Boolean);

  return {
    homeBaseViability,
    recommendedCity: recommendedZone?.city ?? null,
    fallbackCity: fallbackZone?.city ?? null,
    zones: ranked,
    promptBlock: `${lines.join("\n")}\n`,
  };
}

export function applyOpportunityZonePolicy(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
}): OpportunityZonePolicyDecision {
  const analysis = input.ctx.opportunityZones;
  if (!analysis || !analysis.recommendedCity) {
    return { applied: false };
  }

  const recommended = analysis.zones.find(
    (zone) => zone.city === analysis.recommendedCity,
  );
  const homeZone = analysis.zones.find((zone) => zone.isHomeBase);
  if (!recommended) return { applied: false };

  const currentTarget = input.ctx.homeCity ?? input.ctx.city;
  const currentScore =
    analysis.zones.find((zone) => zone.city === currentTarget)
      ?.opportunityScore ??
    homeZone?.opportunityScore ??
    0;
  const scoreDelta = recommended.opportunityScore - currentScore;
  if (scoreDelta < 0.75) {
    return { applied: false };
  }

  if (
    analysis.homeBaseViability === "weak" &&
    !input.brief.rationale.toLowerCase().includes("opportunity")
  ) {
    input.brief.rationale =
      `${input.brief.rationale} ${recommended.city} offers a stronger opportunity zone for this goal than staying inside the sparse home-base corridor.`.trim();
  }

  return {
    applied: true,
    logLine:
      `[multi-agent] Opportunity zone advisory: ${recommended.city}` +
      ` (score +${scoreDelta.toFixed(2)}, ${recommended.distanceMiles.toFixed(1)}mi, homeBase=${analysis.homeBaseViability})`,
  };
}
