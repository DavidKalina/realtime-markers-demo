/**
 * Multi-agent prescription strategy.
 *
 * Splits the monolithic single-agent flow into 4 specialized agents:
 *   1. Strategist (5.4 full) — decides what type of experience to prescribe
 *   2. Scout (mini) — searches for candidate venues
 *   3. Validator (code) — checks candidates against rules
 *   4. Writer (5.4 full) — crafts the quest content
 */

import type {
  PrescriptionStrategyInput,
  PrescriptionStrategyResult,
  StrategyBrief,
  ScoutCandidate,
  ScoutCandidateTrace,
  ScoutResult,
  VenueSelectionAttemptTrace,
} from "./PrescriptionStrategy";
import {
  classifyScope,
  opportunityScopeLabel,
  resolveDistancePolicy,
  type DistancePolicyDecision,
} from "./DistancePolicy";
import {
  isStructuredFloorEligibleCategory,
  validateCandidates,
} from "./CandidateValidator";
import {
  applyStrategyBriefPatch,
  resolveRecalibrationPolicy,
} from "./RecalibrationPolicy";
import { rankScoutCandidates } from "./ScoutCandidateGrounding";
import { applyGoalMilestonePolicy } from "./GoalMilestonePolicy";
import { applyContainerOpportunityPolicy } from "./ContainerOpportunityPolicy";
import { classifyJourneyCategoryFamily } from "./JourneyDiversityContext";
import { applyOpportunityZonePolicy } from "./OpportunityZonePolicy";
import { buildSearchEnvelope } from "./SearchEnvelope";
import { VenueScoutAgent } from "./VenueScoutAgent";
import { QuestWriterAgent } from "./QuestWriterAgent";
import { WinnerVerificationAgent } from "./WinnerVerificationAgent";
import { CapacityTrack } from "../../entities/Sidequest";
import type { OpenAIResponsesAgent } from "../shared/OpenAIResponsesAgent";
import type { OpenAIService } from "../shared/OpenAIService";
import { OpenAIModel } from "../shared/OpenAIService";
import type { GoogleGeocodingService } from "../shared/GoogleGeocodingService";
import type { GooglePlacesService } from "../shared/GooglePlacesService";
import type { OverpassService } from "../shared/OverpassService";
import type { PrescriptionPromptRegistry } from "../prompts/PrescriptionPromptRegistry";
import { OFFLINE_SOCIAL_DOMAIN_DOCTRINE } from "../shared/QuestConfig";
import {
  renderQualityVocabularyBlock,
  sanitizeQualities,
  mergeQualityProfiles,
  type VenueQualityProfile,
} from "./VenueQualities";

const REGIONAL_INFRASTRUCTURE_PATTERN =
  /dating|people-rich|structured|class|club|meetup|workshop|fitness|dance|game night|social container/i;

function isRegionalInfrastructureEligible(
  ctx: PrescriptionStrategyInput["promptContext"],
  brief: StrategyBrief,
): boolean {
  const text = [
    ctx.goalMilestoneContext,
    ctx.offlineSocialFrameworkContext,
    brief.rationale,
    brief.experienceType,
    brief.suggestedCategories.join(" "),
  ].join(" ");
  return REGIONAL_INFRASTRUCTURE_PATTERN.test(text);
}

/**
 * Reach-mode prompt line when the user hasn't explicitly chosen one.
 *
 * Old default: "stay conservative". That kept everyone anchored to home base
 * regardless of what the opportunity-zone analysis found. The new default
 * reads the same signals the SearchEnvelope reads — homeBaseViability and
 * observed willingness — and tells the strategist what mode the system is
 * effectively operating in, so the LLM's proposal lines up with the envelope.
 */
function buildAutoReachModeLine(
  ctx: PrescriptionStrategyInput["promptContext"],
): string {
  const homeBaseViability = ctx.opportunityZones?.homeBaseViability ?? null;
  const recommendedCity = ctx.opportunityZones?.recommendedCity ?? null;
  const willingnessSignal = ctx.willingness?.willingnessSignal ?? "untested";
  const completedQuestCount = ctx.completedQuestCount ?? 0;

  if (
    homeBaseViability === "weak" &&
    recommendedCity &&
    completedQuestCount >= 5
  ) {
    return `- Reach mode: not chosen yet, but home base is too sparse for this goal — system is auto-promoting to nearby_mix. Propose ${recommendedCity} or another stronger zone explicitly; name the travel as part of the rep.`;
  }
  if (willingnessSignal === "regional_capable") {
    return "- Reach mode: not chosen yet, but the user has voluntarily completed regional reps — treat their willingness as nearby_mix and stretch geography when the goal warrants it.";
  }
  if (willingnessSignal === "nearby_capable") {
    return "- Reach mode: not chosen yet, but the user has completed nearby reps voluntarily — treat as nearby_mix; small stretches outside home base are fair game.";
  }
  return "- Reach mode: not chosen yet; default to local. Stretch only if a clearly better nearby opportunity emerges and saturation signals support it.";
}

// ── Dependencies ────────────────────────────────────────────

export interface MultiAgentStrategyDeps {
  openAIService: OpenAIService;
  agent: OpenAIResponsesAgent;
  geocodingService: GoogleGeocodingService;
  placesService: GooglePlacesService;
  overpassService: OverpassService;
  promptRegistry: PrescriptionPromptRegistry;
  redisService?: import("../shared/RedisService").RedisService;
}

// ── Model configuration per agent ───────────────────────────

interface AgentModelConfig {
  strategist: string;
  scout: string;
  writer: string;
}

const DEFAULT_MODELS: AgentModelConfig = {
  strategist: OpenAIModel.GPT54,
  scout: OpenAIModel.GPT54Mini,
  writer: OpenAIModel.GPT54,
};

// ── Implementation ──────────────────────────────────────────

export class MultiAgentStrategy {
  private openAIService: OpenAIService;
  private models: AgentModelConfig;
  private scoutAgent: VenueScoutAgent;
  private writerAgent: QuestWriterAgent;
  private verificationAgent: WinnerVerificationAgent;

  constructor(
    deps: MultiAgentStrategyDeps,
    models?: Partial<AgentModelConfig>,
  ) {
    const mergedModels = { ...DEFAULT_MODELS, ...models };
    this.openAIService = deps.openAIService;
    this.models = mergedModels;
    this.scoutAgent = new VenueScoutAgent({
      agent: deps.agent,
      placesService: deps.placesService,
      overpassService: deps.overpassService,
      model: mergedModels.scout,
    });
    this.writerAgent = new QuestWriterAgent({
      openAIService: deps.openAIService,
      model: mergedModels.writer,
    });
    this.verificationAgent = new WinnerVerificationAgent({
      agent: deps.agent,
      redisService: deps.redisService,
      model: mergedModels.scout,
    });
  }

  async execute(
    input: PrescriptionStrategyInput,
  ): Promise<PrescriptionStrategyResult> {
    const { promptContext, onProgress } = input;
    const trace = input.trace;

    // ── 1. Strategist ──────────────────────────────────────
    if (onProgress) await onProgress(10, "Planning your quest strategy...");
    const strategistStartedAt = Date.now();
    const brief: StrategyBrief = await this.runStrategist(input);
    console.log(
      `[multi-agent] Strategist: capacity=${brief.capacityTrack} ("${brief.repIntent}"), ${brief.experienceType} (${brief.suggestedCategories.join(", ")}), target=${brief.targetCity}, difficulty ${brief.difficultyRange[0]}-${brief.difficultyRange[1]}, social=${brief.socialChallengeLevel}, timing=${brief.suggestedTiming}`,
    );
    if (trace) {
      await trace.emit("strategist", {
        durationMs: Date.now() - strategistStartedAt,
        input: {
          completedQuestCount: promptContext.completedQuestCount,
          radius: input.radius,
          city: input.city,
          isEarlyCalibration: promptContext.isEarlyCalibration,
          reachMode: promptContext.user.reachMode,
          opportunityZones: promptContext.opportunityZones,
          willingnessSignal: promptContext.willingness?.willingnessSignal,
          journeyDiversitySummary: {
            dominantRecentCategory:
              promptContext.journeyDiversity?.dominantRecentCategory ?? null,
            consecutiveSameVenueCount:
              promptContext.journeyDiversity?.consecutiveSameVenueCount ?? 0,
          },
        },
        output: {
          capacityTrack: brief.capacityTrack,
          repIntent: brief.repIntent,
          experienceType: brief.experienceType,
          suggestedCategories: brief.suggestedCategories,
          venueQualities: brief.venueQualities,
          targetCity: brief.targetCity,
          maxDistanceMiles: brief.maxDistanceMiles,
          difficultyRange: brief.difficultyRange,
          socialChallengeLevel: brief.socialChallengeLevel,
          rationale: brief.rationale,
        },
      });
    }

    // ── DistancePolicy ──────────────────────────────────────
    // One source of truth for maxDistance + scope + travel framing. The
    // per-block clamps below only touch non-distance dimensions.
    const policy: DistancePolicyDecision = resolveDistancePolicy({
      radius: input.radius,
      isEarlyCalibration: promptContext.isEarlyCalibration ?? false,
      completedQuestCount: promptContext.completedQuestCount ?? 0,
      lastRejectionReason: promptContext.lastRejection?.reason ?? null,
      rejectionPatternReason: promptContext.rejectionPattern?.reason ?? null,
      goalClosureDue:
        promptContext.activeGoalMilestone?.goalClosureDue ?? false,
      regionalInfrastructureEligible: isRegionalInfrastructureEligible(
        promptContext,
        brief,
      ),
      strategyMaxDistance: brief.maxDistanceMiles,
    });
    const strategistMaxDistance = brief.maxDistanceMiles;
    brief.maxDistanceMiles = policy.maxDistanceMiles;
    brief.opportunityScope = policy.scope;
    if (policy.shouldFrameTravel) {
      brief.travelRationale = policy.travelRationale ?? brief.travelRationale;
    } else {
      brief.travelRationale = undefined;
    }
    if (
      strategistMaxDistance !== brief.maxDistanceMiles ||
      policy.scope !== "local_home_base"
    ) {
      console.log(
        `[multi-agent] DistancePolicy: distance ${strategistMaxDistance}→${brief.maxDistanceMiles}, scope=${policy.scope}, clampedByRejection=${policy.wasClampedByRejection}`,
      );
    }
    if (trace) {
      await trace.emit("distance_policy", {
        input: {
          radius: input.radius,
          isEarlyCalibration: promptContext.isEarlyCalibration ?? false,
          completedQuestCount: promptContext.completedQuestCount ?? 0,
          lastRejectionReason: promptContext.lastRejection?.reason ?? null,
          rejectionPatternReason:
            promptContext.rejectionPattern?.reason ?? null,
          goalClosureDue:
            promptContext.activeGoalMilestone?.goalClosureDue ?? false,
          regionalInfrastructureEligible: isRegionalInfrastructureEligible(
            promptContext,
            brief,
          ),
          strategistMaxDistance,
        },
        output: {
          scope: policy.scope,
          maxDistanceMiles: policy.maxDistanceMiles,
          travelRationale: policy.travelRationale,
          wasClampedByRejection: policy.wasClampedByRejection,
          shouldFrameTravel: policy.shouldFrameTravel,
        },
      });
    }

    const recalibration = resolveRecalibrationPolicy({
      brief,
      ctx: promptContext,
      homeCity: promptContext.homeCity ?? input.city,
    });
    applyStrategyBriefPatch(brief, recalibration.patch);
    for (const line of recalibration.logLines) {
      console.log(line);
    }

    const milestonePolicy = applyGoalMilestonePolicy({
      brief,
      ctx: promptContext,
    });
    if (milestonePolicy.logLine) console.log(milestonePolicy.logLine);

    const containerOpportunity = applyContainerOpportunityPolicy({
      brief,
      ctx: promptContext,
    });
    if (containerOpportunity.logLine) console.log(containerOpportunity.logLine);

    const opportunityZonePolicy = applyOpportunityZonePolicy({
      brief,
      ctx: promptContext,
    });
    if (opportunityZonePolicy.logLine)
      console.log(opportunityZonePolicy.logLine);

    brief.searchEnvelope = buildSearchEnvelope({
      brief,
      ctx: promptContext,
      distancePolicy: policy,
    });
    if (brief.searchEnvelope.maxRadiusMiles !== brief.maxDistanceMiles) {
      console.log(
        `[multi-agent] SearchEnvelope: radius ${brief.maxDistanceMiles.toFixed(1)}→${brief.searchEnvelope.maxRadiusMiles.toFixed(1)}, reach=${brief.searchEnvelope.reachMode ?? "auto-local"}`,
      );
      brief.maxDistanceMiles = brief.searchEnvelope.maxRadiusMiles;
      brief.opportunityScope = classifyScope(
        brief.maxDistanceMiles,
        input.radius,
        policy.wasClampedByRejection,
      );
      brief.travelRationale =
        brief.opportunityScope === "local_home_base" ||
        brief.opportunityScope === "clamped_home"
          ? undefined
          : brief.travelRationale;
    }
    if (trace) {
      await trace.emit("search_envelope", {
        output: {
          maxRadiusMiles: brief.searchEnvelope.maxRadiusMiles,
          reachMode: brief.searchEnvelope.reachMode,
          homeBaseViability: brief.searchEnvelope.homeBaseViability,
          homeCity: brief.searchEnvelope.homeCity,
          searchLabel: brief.searchEnvelope.searchLabel,
          queryFamilies: brief.searchEnvelope.queryFamilies,
          preferredZoneHints: brief.searchEnvelope.preferredZoneHints,
          phase: brief.searchEnvelope.phase,
        },
      });
    }

    // Merge user-level qualities into the brief's profile so the validator
    // sees both stage-required and user-required qualities. User `avoid`
    // wins over policy `must`/`prefer` when they conflict.
    if (promptContext.userVenueQualities) {
      brief.venueQualities = mergeQualityProfiles(
        brief.venueQualities,
        promptContext.userVenueQualities,
      );
    }

    // ── 2. Scout + Validator loop ──────────────────────────
    let scoutResult: ScoutResult | null = null;
    let winner: ScoutCandidate | null = null;
    let extraConstraints = "";
    let qualityRetryHint: string | null = null;
    const maxRetries = 2;
    const selectionAttempts: VenueSelectionAttemptTrace[] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (onProgress)
        await onProgress(
          25 + attempt * 10,
          "Searching for the perfect spot...",
        );

      const scoutStartedAt = Date.now();
      scoutResult = await this.scoutAgent.run(input, brief, extraConstraints);
      console.log(
        `[multi-agent] Scout: found ${scoutResult.candidates.length} candidates`,
      );
      if (trace) {
        await trace.emit("scout.run", {
          durationMs: Date.now() - scoutStartedAt,
          input: {
            attempt,
            extraConstraints,
            briefSuggestedCategories: brief.suggestedCategories,
            maxDistanceMiles: brief.maxDistanceMiles,
            preferredZoneHints: brief.searchEnvelope?.preferredZoneHints ?? [],
          },
          output: {
            candidates: scoutResult.candidates.map((c) => ({
              venueName: c.venueName,
              venueCategory: c.venueCategory,
              distanceFromHome: c.distanceFromHome,
              venueAddress: c.venueAddress,
            })),
            searches: scoutResult.trace?.searches ?? [],
            submittedCandidates: scoutResult.trace?.submittedCandidates ?? [],
          },
        });
      }

      // Quality match — LLM classifies each candidate against the brief's
      // venueQualities profile and drops hard-avoid hits before the validator
      // runs. Skipped when no quality profile is set.
      if (
        scoutResult &&
        brief.venueQualities &&
        scoutResult.candidates.length > 0 &&
        (brief.venueQualities.must.length > 0 ||
          brief.venueQualities.avoid.length > 0)
      ) {
        const candidatesAtMatch = scoutResult.candidates;
        const qualityStart = Date.now();
        const matches = await this.classifyCandidateQualities(
          candidatesAtMatch,
          brief.venueQualities,
        );
        const droppedNames: string[] = [];
        const filtered: ScoutCandidate[] = [];
        for (let i = 0; i < candidatesAtMatch.length; i++) {
          const c = candidatesAtMatch[i];
          const m = matches[i];
          if (m && m.avoidHits.length > 0) {
            droppedNames.push(c.venueName);
            brief.avoidVenues = [
              ...new Set([...brief.avoidVenues, c.venueName]),
            ];
          } else {
            filtered.push(c);
          }
        }
        if (filtered.length > 0) {
          scoutResult.candidates = filtered;
          qualityRetryHint = null;
        } else if (droppedNames.length > 0 && attempt < maxRetries) {
          // All candidates violated avoid qualities. Force a retry — surfacing
          // the dominant avoid term as a strong constraint to the next scout
          // round. Without this, fallback would prescribe e.g. CrossFit even
          // though `requires-membership` was the explicit deal-breaker.
          scoutResult.candidates = [];
          const tally = new Map<string, number>();
          for (const m of matches) {
            for (const term of m.avoidHits) {
              tally.set(term, (tally.get(term) ?? 0) + 1);
            }
          }
          const dominant = [...tally.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([term]) => term);
          qualityRetryHint = `Quality reject: ALL ${droppedNames.length} previous candidates violated venue qualities — most common: ${dominant.join(", ")}. DO NOT return more venues with those qualities. ${dominant.includes("requires-membership") ? "For requires-membership specifically: avoid private gyms, CrossFit boxes, country clubs, paid-only studios. Try free public spaces, parks, libraries, drop-in community programs at recreation centers, or low-cost classes." : "Try meaningfully different categories."}`;
          console.warn(
            `[multi-agent] QualityMatch: forcing retry — all ${droppedNames.length} candidates had ${dominant.join(", ")}`,
          );
        } else if (droppedNames.length > 0) {
          // Out of retries — pick least-bad (fewest avoid hits) so the user
          // gets *something*. Better B-tier match than no quest.
          const ranked = candidatesAtMatch
            .map((c, i) => ({
              c,
              score: matches[i]?.avoidHits.length ?? 99,
            }))
            .sort((a, b) => a.score - b.score);
          scoutResult.candidates = [ranked[0].c];
          qualityRetryHint = null;
          console.warn(
            `[multi-agent] QualityMatch: out of retries — using least-bad: ${ranked[0].c.venueName} (${ranked[0].score} avoid hits)`,
          );
        }
        if (trace) {
          await trace.emit("quality_match", {
            durationMs: Date.now() - qualityStart,
            input: {
              profile: brief.venueQualities,
              candidateCount: matches.length,
            },
            output: {
              matches: matches.map((m, i) => ({
                venueName: candidatesAtMatch[i]?.venueName ?? "?",
                qualities: m.qualities,
                mustHits: m.mustHits,
                preferHits: m.preferHits,
                avoidHits: m.avoidHits,
                reasoning: m.reasoning,
              })),
              droppedForAvoid: droppedNames,
              fellBackToFullPool: filtered.length === 0,
            },
          });
        }
        if (droppedNames.length > 0) {
          console.log(
            `[multi-agent] QualityMatch: dropped ${droppedNames.length} candidate(s) for hard-avoid hits: ${droppedNames.join(", ")}`,
          );
        }
      }

      const validation = validateCandidates({
        candidates: scoutResult.candidates,
        ctx: promptContext,
        brief,
      });
      if (trace) {
        await trace.emit("validator.attempt", {
          input: {
            attempt,
            candidateCount: scoutResult.candidates.length,
            briefMaxDistance: brief.maxDistanceMiles,
            avoidVenues: brief.avoidVenues,
            avoidCategories: brief.avoidCategories,
          },
          output: {
            accepted: validation.accepted,
            winner: validation.winner
              ? {
                  venueName: validation.winner.venueName,
                  venueCategory: validation.winner.venueCategory,
                  distanceFromHome: validation.winner.distanceFromHome,
                }
              : null,
            rejectionCodes: validation.rejectionCodes,
            humanReasons: validation.humanReasons,
            retryConstraints: validation.retryConstraints,
          },
        });
      }
      const attemptTrace: VenueSelectionAttemptTrace = {
        attempt,
        searches: scoutResult.trace?.searches ?? [],
        submittedCandidates: scoutResult.trace?.submittedCandidates ?? [],
        accepted: false,
        rejectionCodes: validation.rejectionCodes,
        rejectionReasons: validation.humanReasons,
      };

      if (validation.accepted && validation.winner) {
        const candidateWinner = validation.winner;
        attemptTrace.accepted = true;
        attemptTrace.winner = traceScoutCandidate(candidateWinner);
        console.log(
          `[multi-agent] Validator: accepted "${candidateWinner.venueName}" (${candidateWinner.venueCategory})`,
        );

        // ── Venue verification (live web research) ───────
        const verifyStart = Date.now();
        const verification = await this.verificationAgent.verify({
          candidate: candidateWinner,
          profile: brief.venueQualities ?? { must: [], prefer: [], avoid: [] },
          city: input.city,
        });
        if (trace) {
          await trace.emit("venue_verification", {
            durationMs: Date.now() - verifyStart,
            input: {
              venueName: candidateWinner.venueName,
              venueAddress: candidateWinner.venueAddress,
              profile: brief.venueQualities,
            },
            output: verification,
            meta: { cached: verification.cached },
          });
        }
        console.log(
          `[multi-agent] Verification: "${candidateWinner.venueName}" → ${verification.verdict}${verification.qualityViolations.length ? ` (violations: ${verification.qualityViolations.join(", ")})` : ""}${verification.cached ? " [cached]" : ""}`,
        );

        // Reject path. The verification's verdict label is one signal, but
        // the harder rule is: if any qualityViolation directly overlaps the
        // brief's avoid set, treat as reject regardless of the LLM's verdict
        // (which often hedges to "uncertain" even with clear violations).
        const avoidSet = new Set(brief.venueQualities?.avoid ?? []);
        const confirmedAvoidHits = verification.qualityViolations.filter(
          (q) => avoidSet.has(q),
        );
        const shouldReject =
          verification.verdict === "reject" ||
          confirmedAvoidHits.length > 0 ||
          verification.currentlyOperating === false;

        if (shouldReject && attempt < maxRetries) {
          brief.avoidVenues = [
            ...new Set([...brief.avoidVenues, candidateWinner.venueName]),
          ];
          const reason = !verification.currentlyOperating
            ? "venue may not be currently operating"
            : confirmedAvoidHits.length > 0
              ? `confirmed violations of brief avoid set: ${confirmedAvoidHits.join(", ")}`
              : "research returned a reject verdict";

          // Empirical market signal: if verification rejected a venue inside
          // the local pool AND home-base viability is "weak", that's stronger
          // evidence than the static population proxy. Live web research is
          // saying "the local pool isn't producing what this rep needs" —
          // expand the envelope for the retry instead of looking for more
          // Frederick venues that will fail the same way.
          const envelope = brief.searchEnvelope;
          const homeBaseWeak = envelope?.homeBaseViability === "weak";
          const localCeiling = Math.max(input.radius + 0.25, 4);
          const wasLocal =
            (candidateWinner.distanceFromHome ?? Infinity) <= localCeiling;
          const recommendedAway = envelope?.preferredZoneHints?.[0];

          let geoExpansionNote = "";
          if (homeBaseWeak && wasLocal) {
            const newMax = Math.max(brief.maxDistanceMiles, 12);
            console.log(
              `[multi-agent] Verification + weak home base → expanding retry envelope from ${brief.maxDistanceMiles.toFixed(1)}mi to ${newMax.toFixed(1)}mi${recommendedAway ? ` (target: ${recommendedAway.city})` : ""}`,
            );
            brief.maxDistanceMiles = newMax;
            brief.opportunityScope = "nearby_social_zone";
            if (envelope) envelope.maxRadiusMiles = newMax;
            geoExpansionNote = `\n\nGEOGRAPHIC EXPANSION: Verification keeps rejecting Frederick venues — the home-base pool is too sparse for this quality profile. On this retry, search nearby zones (8-12mi from home)${recommendedAway ? ` like ${recommendedAway.city}` : ""} instead of looking for more local venues that will fail the same way. The trip is part of the rep this week.`;
          }

          extraConstraints = [
            extraConstraints,
            `Verification rejected "${candidateWinner.venueName}" — ${reason}. ${verification.reasoning} Pick a different venue.${geoExpansionNote}`,
          ]
            .filter(Boolean)
            .join("\n\n");
          console.log(
            `[multi-agent] Verification: rejecting "${candidateWinner.venueName}" — ${reason}, retrying`,
          );
          selectionAttempts.push(attemptTrace);
          continue;
        }

        winner = candidateWinner;
        brief.venueVerification = verification;
        selectionAttempts.push(attemptTrace);
        break;
      }

      console.log(
        `[multi-agent] Validator: rejected (${validation.humanReasons.join(", ")})`,
      );
      extraConstraints = [validation.retryConstraints, qualityRetryHint]
        .filter((s): s is string => Boolean(s))
        .join("\n\n");
      qualityRetryHint = null;
      if (validation.rejectionCodes.includes("too_far")) {
        for (const c of scoutResult.candidates) {
          if (
            (c.distanceFromHome ?? Infinity) >
            brief.maxDistanceMiles + 0.25
          ) {
            brief.avoidVenues.push(c.venueName);
          }
        }
      }

      if (attempt === maxRetries && validation.fallbackWinner) {
        winner = validation.fallbackWinner;
        attemptTrace.accepted = true;
        attemptTrace.fallbackWinner = traceScoutCandidate(winner);
        attemptTrace.fallbackReason = validation.fallbackReason;
        attemptTrace.forcedFallback = true;
        selectionAttempts.push(attemptTrace);
        softenBriefForWeakFallback(brief, validation.fallbackReason);
        console.log(
          `[multi-agent] Validator: weak-fit fallback accepted "${winner.venueName}" (${winner.venueCategory}) — ${validation.fallbackReason}`,
        );
        break;
      }

      // On last attempt, just pick the best available
      if (attempt === maxRetries && scoutResult.candidates.length > 0) {
        const fallbackCandidates = rankScoutCandidates(
          scoutResult.candidates.filter(
            (candidate) =>
              (candidate.distanceFromHome ?? Infinity) <=
                brief.maxDistanceMiles + 0.25 &&
              !(
                promptContext.questRole !== "enjoy" &&
                promptContext.journeyPhase?.forbidParkForNonEnjoy === true &&
                classifyJourneyCategoryFamily(candidate.venueCategory) ===
                  "park_outdoor"
              ) &&
              !(
                promptContext.questRole !== "enjoy" &&
                promptContext.journeyPhase?.requireStructuredNonEnjoy ===
                  true &&
                !isStructuredFloorEligibleCategory(candidate.venueCategory)
              ),
          ),
          brief,
        );
        if (fallbackCandidates[0]) {
          winner = fallbackCandidates[0];
          attemptTrace.accepted = true;
          attemptTrace.winner = traceScoutCandidate(winner);
          attemptTrace.forcedFallback = true;
          console.log(
            `[multi-agent] Validator: forced acceptance of "${winner.venueName}" after retries`,
          );
        } else {
          console.log(
            "[multi-agent] Validator: no fallback candidates survived hard journey-phase constraints",
          );
        }
      }
      selectionAttempts.push(attemptTrace);
    }

    if (!winner || !scoutResult) {
      throw new Error(
        "Multi-agent strategy failed to find a venue after all retries",
      );
    }

    const winnerDistance = winner.distanceFromHome ?? 0;
    brief.opportunityScope = classifyScope(
      winnerDistance,
      promptContext.radius,
      policy.wasClampedByRejection,
    );
    if (brief.opportunityScope === "clamped_home") {
      brief.travelRationale = undefined;
    }
    if (
      brief.opportunityScope !== "local_home_base" &&
      brief.opportunityScope !== "clamped_home" &&
      !brief.travelRationale
    ) {
      brief.travelRationale = `${opportunityScopeLabel(brief.opportunityScope)}: local options may be too thin for this goal, so the travel is part of the growth rep.`;
    }
    if (brief.opportunityScope !== "local_home_base") {
      console.log(
        `[multi-agent] Opportunity scope: ${brief.opportunityScope} (${winnerDistance.toFixed(1)}mi) — ${brief.travelRationale ?? "pulled back to home base"}`,
      );
    }
    brief.venueSelectionTrace = {
      attempts: selectionAttempts,
      finalWinner: traceScoutCandidate(winner),
    };

    // ── 3. Writer ──────────────────────────────────────────
    if (onProgress) await onProgress(65, "Crafting your quest...");

    const writerStartedAt = Date.now();
    const raw = await this.writerAgent.run(input, brief, winner);
    console.log(
      `[multi-agent] Writer: "${raw.t}" — difficulty ${raw.items[0]?.df}`,
    );
    if (trace) {
      await trace.emit("writer", {
        durationMs: Date.now() - writerStartedAt,
        input: {
          venueName: winner.venueName,
          venueCategory: winner.venueCategory,
          capacityTrack: brief.capacityTrack,
          repIntent: brief.repIntent,
          travelRationale: brief.travelRationale,
          opportunityScope: brief.opportunityScope,
        },
        output: {
          title: raw.t,
          summary: raw.s,
          strategyNote: raw.sn,
          marketReflection: raw.mr,
          item: raw.items[0]
            ? {
                title: raw.items[0].t,
                description: raw.items[0].d,
                hook: raw.items[0].hook,
                difficulty: raw.items[0].df,
                actionability: raw.items[0].act,
                directGoalTouch: raw.items[0].dgt,
                goalActionType: raw.items[0].gat,
              }
            : null,
        },
      });
    }

    if (onProgress) await onProgress(80, "Building your quest...");

    return {
      raw,
      allVenues: scoutResult.allVenues,
      allTrails: scoutResult.allTrails,
      brief,
    };
  }

  // ── Quality Match (LLM classifier over scout candidates) ──────────

  private async classifyCandidateQualities(
    candidates: ScoutCandidate[],
    profile: VenueQualityProfile,
  ): Promise<
    {
      qualities: string[];
      mustHits: string[];
      preferHits: string[];
      avoidHits: string[];
      reasoning: string;
    }[]
  > {
    const empty = candidates.map(() => ({
      qualities: [] as string[],
      mustHits: [] as string[],
      preferHits: [] as string[],
      avoidHits: [] as string[],
      reasoning: "",
    }));
    if (candidates.length === 0) return empty;

    const candidateList = candidates
      .map(
        (c, i) =>
          `${i + 1}. ${c.venueName} — ${c.venueCategory} — ${c.venueAddress}${c.notes ? ` — ${c.notes}` : ""}${c.googlePrimaryTypeDisplayName ? ` — google type: ${c.googlePrimaryTypeDisplayName}` : ""}`,
      )
      .join("\n");

    const prompt = `You are a venue quality classifier. For each candidate venue below, decide which qualities from the vocabulary best describe the *room as it actually exists* — based on the venue name, category, address, and any notes. Your judgment is what determines whether a venue is right for the user this week.

${renderQualityVocabularyBlock()}

REQUIRED PROFILE FOR THIS QUEST:
- MUST match (deal-breakers if missing): ${profile.must.join(", ") || "(none)"}
- PREFER (nice to have): ${profile.prefer.join(", ") || "(none)"}
- AVOID (rejection signals): ${profile.avoid.join(", ") || "(none)"}

CANDIDATES:
${candidateList}

For each candidate, return an entry with:
- "qualities": the full list of vocabulary terms that apply to this venue (be generous; pick 4-8 typical descriptors)
- "mustHits": which MUST terms it satisfies
- "preferHits": which PREFER terms it satisfies
- "avoidHits": which AVOID terms it triggers (be strict — these are deal-breakers)
- "reasoning": one short sentence justifying your read

CLASSIFICATION RULES — follow these strictly, do NOT soft-pedal:

PRIVATE FITNESS RULE: Any standalone gym, CrossFit box, fitness studio, climbing gym, yoga / pilates studio, barre studio, dance studio, or martial-arts dojo IS "requires-membership" + "paid-only" — UNLESS the venue is explicitly part of a Recreation Center, Community Center, YMCA, municipal facility, or public park. A name like "[Brand] Fitness" / "[Brand] Strength Gym" / "[Brand] CrossFit" / "Pure Barre" / "Club Pilates" / "Orangetheory" / "Anytime Fitness" / "F45" / "SoulCycle" / "Equinox" is essentially never drop-in-friendly. Do not be charitable to commercial fitness brands.

ROMANTIC-VENUE RULE: A candle-lit bistro, fine-dining restaurant, wine bar, or anywhere advertised as "date night" / "romantic" IS "couples-coded" + "intimate-hushed". Mark it.

NIGHTLIFE RULE: A nightclub, lounge with bottle service, or venue with a posted dress code IS "scene-y-exclusive". Mark it.

MUNICIPAL / PUBLIC RULE: A library, public park, trail, museum, farmers market, recreation center, or community center IS "free" + "drop-in-friendly" + "indoor-public" or "outdoor-public" as appropriate. These are NOT "requires-membership".

Respond with JSON: {"results": [{"index": 1, "qualities": [...], "mustHits": [...], "preferHits": [...], "avoidHits": [...], "reasoning": "..."}]}`;

    try {
      const response = await this.openAIService.executeChatCompletion(
        {
          model: this.models.scout as OpenAIModel,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_completion_tokens: 1500,
        },
        "quality_match",
      );

      const text = response.choices[0]?.message?.content?.trim() ?? "{}";
      const parsed = JSON.parse(text);
      const results = Array.isArray(parsed.results) ? parsed.results : [];

      // Map results back to candidate order. LLM returns 1-based index.
      const byIndex = new Map<number, (typeof results)[number]>();
      for (const r of results) {
        const idx = typeof r?.index === "number" ? r.index - 1 : -1;
        if (idx >= 0 && idx < candidates.length) byIndex.set(idx, r);
      }
      return candidates.map((_, i) => {
        const r = byIndex.get(i);
        if (!r) return empty[i];
        return {
          qualities: sanitizeQualities(r.qualities),
          mustHits: sanitizeQualities(r.mustHits),
          preferHits: sanitizeQualities(r.preferHits),
          avoidHits: sanitizeQualities(r.avoidHits),
          reasoning:
            typeof r.reasoning === "string" ? r.reasoning.slice(0, 280) : "",
        };
      });
    } catch (err) {
      console.error("[multi-agent] Quality match failed:", err);
      return empty;
    }
  }

  // ── Strategist Agent ────────────────────────────────────────

  private async runStrategist(
    input: PrescriptionStrategyInput,
  ): Promise<StrategyBrief> {
    const ctx = input.promptContext;

    const patternGuidance: Record<string, string> = {
      TOO_SOCIAL: `The user has rejected TOO_SOCIAL ${ctx.rejectionPattern?.count ?? 0} times. Social density is systematically miscalibrated. Force socialChallengeLevel="none". Pick a solo capacity track — ACTIVATION or PUBLIC_PRESENCE, never MICRO_INTERACTION or SOCIAL_EXTENSION. Acknowledge this shift in the rationale: "You've told me this a few times — let's go solo today."`,
      TOO_FAR: `The user has rejected TOO_FAR ${ctx.rejectionPattern?.count ?? 0} times. Distance is systematically miscalibrated. Halve your maxDistanceMiles — stay well inside their radius. Acknowledge in rationale.`,
      TOO_PUBLIC: `The user has rejected TOO_PUBLIC ${ctx.rejectionPattern?.count ?? 0} times. Pick a low-traffic venue, off-peak timing (weekday morning, early afternoon). Avoid bars, events, or anywhere dense.`,
      TOO_MUCH_EFFORT: `The user has rejected TOO_MUCH_EFFORT ${ctx.rejectionPattern?.count ?? 0} times. Activation cost is systematically miscalibrated. Cap difficultyRange at [1,3]. No paid signups, no gear, no planning ahead. Something they can walk into.`,
      NOT_MY_VIBE: `The user has rejected NOT_MY_VIBE ${ctx.rejectionPattern?.count ?? 0} times${ctx.rejectionPattern?.categories?.length ? ` across categories: ${ctx.rejectionPattern.categories.join(", ")}` : ""}. Pick a DIFFERENT category than any of those. Lean on their onboarding interests instead of inferring.`,
      BAD_TIMING: `The user has rejected BAD_TIMING ${ctx.rejectionPattern?.count ?? 0} times. Shift the suggestedTiming significantly — if you've been sending evenings, try a weekend morning, or vice versa.`,
      NEED_GENTLER: `The user has rejected NEED_GENTLER ${ctx.rejectionPattern?.count ?? 0} times. They are systematically overstretched. Cap difficultyRange at [1,3] and force socialChallengeLevel="none". Stay with ACTIVATION or PUBLIC_PRESENCE.`,
    };
    const rejectionPatternBlock = ctx.rejectionPattern
      ? `RECURRING REJECTION PATTERN — READ FIRST:
${patternGuidance[ctx.rejectionPattern.reason] ?? `The user has rejected ${ctx.rejectionPattern.reason} ${ctx.rejectionPattern.count} times. Treat this dimension as systematically miscalibrated and dampen it.`}

`
      : "";

    const earlyCalibrationBlock = ctx.isEarlyCalibration
      ? `EARLY CALIBRATION MODE — READ FIRST:
This user has completed ${ctx.completedQuestCount ?? 0} of their first 5 quests. Trust is more important than growth right now — the first promise is "this app gets me enough that I can trust the next suggestion." Your job is to make this prescription almost impossible to fail.

HARD RULES (these are enforced by code — violating them means your brief gets overwritten):
- Stay INSIDE the user's comfort radius (${ctx.radius.toFixed(1)} mi). Do NOT push distance.
- socialChallengeLevel MUST be "none" or "low". No medium or high.
- difficultyRange upper bound MUST be 5 or less.
- Pick ONE gentle stretch dimension at most — if you're nudging category novelty, stay close; if you're nudging distance, stay in a familiar category. Never both.
- Favor capacity tracks that don't require interaction: ACTIVATION or PUBLIC_PRESENCE are strongly preferred. Reserve SOCIAL_EXTENSION, MICRO_INTERACTION, and SOCIAL_REACH for after quest 5.

`
      : "";

    const recalibrationBlock = ctx.lastRejection
      ? `RECALIBRATION — READ FIRST:
The user just rejected the previous prescription ${ctx.lastRejection.ageMinutes}m ago with reason: ${ctx.lastRejection.reason}${ctx.lastRejection.venueName ? ` (at "${ctx.lastRejection.venueName}")` : ""}.
Your new prescription MUST:
  (a) address that specific lever — TOO_SOCIAL → more solo / lower density; TOO_FAR → closer to home; TOO_PUBLIC → lower-traffic venue or off-peak timing; TOO_MUCH_EFFORT → lower activation cost, no gear/paid signup; NOT_MY_VIBE → different category; BAD_TIMING → different time-of-day; NEED_GENTLER → the gentlest version you can justify.
  (b) pick a DIFFERENT venue${ctx.lastRejection.venueName ? ` than "${ctx.lastRejection.venueName}"` : ""}.
  (c) explicitly acknowledge the adjustment in the "rationale" field, e.g. "Good signal — that was too social. Trying a solo-friendly version." Keep it warm and specific, not clinical.

`
      : "";

    // Kept static so OpenAI's automatic prefix cache can hit — any
    // per-user content lives in the user message below.
    const systemPrompt = `You are a Social Life Strategist. Based on a user's profile, social situation, history, and growth phase, decide what TYPE of experience they need next AND where they should go to find it. You do NOT pick a specific venue — you create a strategy brief that a separate agent will use to search. Your job is to help someone build a real social life from scratch.

PRODUCT BOUNDARY:
${OFFLINE_SOCIAL_DOMAIN_DOCTRINE.map((line) => `- ${line}`).join("\n")}
- If a user asks for fitness, use movement classes, run clubs, climbing gyms, dance, and outdoor activity as social/public-comfort containers. Do not prescribe workout programming, nutrition, rep counting, or progressive overload.
- If a user asks for hobbies or skills, use beginner classes, workshops, clubs, and recurring rooms as identity/community containers. Do not become a curriculum planner.
- If a user asks for money, career, or productivity, only serve the offline/social-confidence part if one exists. Do not pretend this product has bank, job-search, or productivity integrations.

CAPACITY REP — DECIDE THIS FIRST:
Every prescription trains ONE capacity muscle. Pick the muscle BEFORE you pick a venue type — the venue is the environment; the rep is the prescription.

The nine capacity tracks:
- ACTIVATION — getting ready, leaving the house, starting despite inertia. For users who skip weeks or describe themselves as "stuck at home."
- PUBLIC_PRESENCE — being visible in public without fleeing. For users who feel exposed or rush to hide in corners.
- NOVELTY_TOLERANCE — entering unfamiliar places. For users stuck in the same 2–3 venues.
- STAYING_POWER — remaining long enough for anxiety to settle. For users who check in and leave in under 10 minutes.
- RETURNABILITY — going back until a place feels familiar. For users who have a spot they like but won't return.
- MICRO_INTERACTION — ordering, asking, thanking, eye contact, small talk. For users building from zero social contact.
- SOCIAL_EXTENSION — joining, chatting, flirting, following up. For users ready past solo presence.
- RECOVERY — reflecting, regulating, trying again after awkwardness. For users after a recent negative experience.
- IDENTITY_EVIDENCE — collecting proof that "I am someone who does this." For users at milestones or rebuilding identity.

Pick ONE track per prescription. Never stack multiple muscles. In the early quests (first 3–5) prefer ACTIVATION or PUBLIC_PRESENCE — low-social, trust-building. Save SOCIAL_EXTENSION and MICRO_INTERACTION for users who've demonstrated the foundational muscles.

"repIntent" is your one-line plain-English description of what specific rep they are training, e.g. "Stay in public for at least 10 minutes after arriving" or "Return to a place you've been before and linger." Keep it under 20 words.

SOCIAL STRATEGY PRINCIPLES:
- Regularity beats novelty. Becoming a regular somewhere creates more connection than visiting 10 new places once.
- Co-ed group activities (classes, rec leagues, meetups) are the highest-leverage move for someone starting from zero — both for friends and dating.
- Venue timing matters: suggest evenings and weekends for social density, weekday mornings for low-pressure solo practice.
- Dating is a byproduct of having a social life, not a standalone goal. Build the social ecosystem first.
- For dating goals, use a staged ladder: room exposure -> warm signal -> conversation continuation -> message-first closure. Do NOT skip straight to "send the invite" unless the current dating stage explicitly allows it.
- Remote workers are starved for third places — coworking spaces, cafes with laptop culture, classes provide structure and faces.
- If they live alone, they need reasons to leave the house. Structure removes decision fatigue.
- Small towns require expanding the search radius. Think in terms of the best opportunities NEAR the user's home, not loyalty to a single town name.
- When you push beyond the home base, name it as an intentional opportunity zone. Travel can be part of the rep, but it must not be accidental.
- For goal-closure milestones, do not keep preparing forever. If the milestone context says closure is due, choose a strategy that directly touches the named goal.

GEOGRAPHIC & PRACTICAL INTELLIGENCE:
You must think about WHERE this person should go, not just WHAT they should do. Consider:
- Their home town's population, demographics, and what's realistically available there.
- Small towns (under 20K) have limited social infrastructure — coffee shops, a rec center, maybe a brewery. If their goal requires meeting new people, dating, or finding community, they WILL need to venture to larger nearby cities.
- Every quest doesn't need to push geographically, but the overall trajectory should expand their world over time. If they've done 5+ quests all in the same small town, it's time to push outward.
- Think about what cities within 30-40 miles have the density, scene, and demographics to support their goal. A 25-year-old looking for friends and dates in a retirement community won't find them no matter how many quests they do there.
- The user's comfort radius represents how far they've gone — not how far they SHOULD go. If they're ready, push past it. A quest in a new city is both a geographic AND a social stretch.
- The downstream search is home-centered within a radius. Use "targetCity" only as a soft area hint or opportunity label, not as a hard lock. Prefer searchQueries phrased as "<thing> near <home city>".
- TRANSPORTATION: If they don't have a car, keep quests reachable by their transport mode. Don't send a transit rider 30 miles to a trailhead with no bus route.
- BUDGET: Respect their spending comfort. If they said "free only," don't prescribe a $40 pottery class. If budget is flexible, you can suggest paid experiences freely.
- SCHEDULE: Match quest timing to their availability. Shift workers need flexible-hour venues, not 9am weekday classes.

TIMING GUIDANCE:
The quest will be done TODAY or in the NEXT FEW DAYS. Factor in realistic timing:
  - If the user has a 9-to-5 schedule and it's a weekday, suggest EVENING activities (after 5:30pm) or plan for the upcoming weekend.
  - If it's a weekend, they have all day — mornings and afternoons are fair game.
  - Coffee shops are morning/afternoon venues (typically close by 5-6pm). Do NOT suggest coffee shops for evening quests.
  - Bars, breweries, restaurants, music venues, karaoke — these are evening-appropriate.
  - Classes, workshops, rec center activities — check if they're typically offered at the suggested time.
  - Trails/parks — consider daylight. Don't suggest a hike at 8pm in winter.
- Be SPECIFIC about timing in your suggestedTiming field: "weekday evening after 6pm", "this Saturday morning", "Sunday afternoon", etc.

Think holistically about this person:
- What would a thoughtful friend who knows the local area suggest?
- Is their current town limiting their progress? Be honest about this.
- If they have a RECURRING BLOCKER, do NOT push the blocked action directly — build confidence around it instead.
- Otherwise, what specific type of social challenge would grow them right now?
- Are they stuck in a geographic or activity pattern that needs breaking?
- POTENTIAL REGULARS: If the history shows anchor venues (marked with ★), they're places the user enjoyed. You MAY suggest a return visit — but frame it as an invitation, not a pattern. The user hasn't said they want to be a regular anywhere yet. Use anchor venues when the strategy genuinely calls for deepening or when a return visit with a new angle (different time, social challenge, event) would be more valuable than a novel venue. Don't force it — mix return visits with exploration naturally.
- User-stated activities are weak priors, not requirements. Use them as inspiration for adjacent experiences, but do not keep fulfilling the same stated preference if it creates repetition or fails the current capacity rep.

VENUE QUALITIES — describe the room, not the category:
A category like "Brunch Spot" can be a great date-plausible room or a terrible one — what matters is the *qualities* of the room. Use the vocabulary below to express what kind of room this rep needs. Downstream policies and the validator share this same vocabulary, so terms must come from this list.

${renderQualityVocabularyBlock()}

Respond with JSON:
{
  "capacityTrack": "ACTIVATION" | "PUBLIC_PRESENCE" | "NOVELTY_TOLERANCE" | "STAYING_POWER" | "RETURNABILITY" | "MICRO_INTERACTION" | "SOCIAL_EXTENSION" | "RECOVERY" | "IDENTITY_EVIDENCE",
  "repIntent": "<one-line rep description in capacity terms, under 20 words>",
  "experienceType": "<what kind of experience, e.g. 'hands-on creative workshop with strangers', 'casual trivia night at a brewery in a bigger city'>",
  "suggestedCategories": ["<2-3 specific venue categories to search for — pick from the canonical category list, no more than 3>"],
  "venueQualities": {
    "must": ["<hard requirements; venue must match all of these>"],
    "prefer": ["<soft preferences; tilt toward venues that have these>"],
    "avoid": ["<hard violations; venue is rejected if it matches any>"]
  },
  "targetCity": "<optional soft area hint, e.g. 'Longmont, CO' or 'Boulder Pearl Street area' — compatibility metadata only>",
  "maxDistanceMiles": <number — be willing to push this for growth>,
  "difficultyRange": [<min>, <max>],
  "socialChallengeLevel": "none" | "low" | "medium" | "high",
  "searchQueries": ["<4-6 specific search queries for finding venues — prefer 'X near <home city>' phrasing>"],
  "preferredVenue": "<OPTIONAL — if returning to an anchor venue, put its exact name here so the Scout can verify it. Otherwise null>",
  "avoidVenues": ["<venue names to avoid from history>"],
  "avoidCategories": ["<categories that are overrepresented>"],
  "suggestedTiming": "<when to do this quest — be specific, e.g. 'weekday evening after 6pm', 'Saturday morning', 'Sunday afternoon'. Factor in user's schedule and venue hours>",
  "rationale": "<1-2 sentences explaining WHY this is the right next step, including why this capacity track + location>",
  "opportunityScope": "local_home_base" | "nearby_social_zone" | "regional_opportunity",
  "travelRationale": "<required if opportunityScope is not local_home_base — why the travel is worth it for this goal>"
}

QUALITIES GUIDANCE:
- "must" should have 2-4 terms — the non-negotiables for this rep type.
- "avoid" should have 2-5 terms — qualities that would make this rep harmful (e.g. for a single user doing dating reps, "couples-coded" + "intimate-hushed" are reliable avoids).
- "prefer" can have 3-6 terms — softer tilts.
- Do NOT just default to all "people-rich" + "conversation-friendly" reps. Match the qualities to what the user actually needs at this stage. A recovery rep needs "low-social-pressure" + "ambient-presence", not maximum density.
- Outdoor venues (parks, trails) and active-rec venues (climbing gyms, bowling, disc golf) are first-class third places. Don't confine yourself to indoor seated rooms.`;

    // All per-user context lives here so the system prompt above can be
    // cached by OpenAI's automatic prefix cache. Dynamic blocks (rejection
    // pattern, early calibration, recalibration) go FIRST because they
    // are the most important framing for this specific call.
    const blockerOverride = ctx.blockerContext
      ? `CRITICAL — RECURRING BLOCKER OVERRIDE:
${ctx.blockerContext}
The blocker context above TAKES PRIORITY over normal progression. Do NOT prescribe experiences that require the blocked action as a primary objective. Instead, prescribe experiences that build toward it indirectly — the user needs wins, not more failures. Set socialChallengeLevel to "none" or "low" and focus on activities where the blocked action might happen naturally but is NOT required.

`
      : "";

    const timelineBlock = ctx.timelineContext
      ? `${ctx.timelineContext}\n\n`
      : "";
    const socialSituationBlock = ctx.socialSituationContext
      ? `${ctx.socialSituationContext}\n\n`
      : "";
    const siblingBlock = ctx.siblingInstructions
      ? `${ctx.siblingInstructions}\n\n`
      : "";

    const coverageBlock = ctx.coverageContext
      ? `${ctx.coverageContext}\n\n`
      : "";
    const expansionBlock = ctx.expansionTarget
      ? `${ctx.expansionTarget}\n\n`
      : "";
    const phaseBlock = ctx.phaseContext ? `${ctx.phaseContext}\n\n` : "";
    const socialMicroBlock = ctx.socialMicroRepContext
      ? `${ctx.socialMicroRepContext}\n\n`
      : "";
    const frameworkBlock = ctx.offlineSocialFrameworkContext
      ? `${ctx.offlineSocialFrameworkContext}\n\n`
      : "";
    const opportunityZoneBlock = ctx.opportunityZoneContext
      ? `${ctx.opportunityZoneContext}\n\n`
      : "";
    const journeyMixBlock = ctx.journeyDiversityContext
      ? `${ctx.journeyDiversityContext}\n\n`
      : "";
    const willingnessBlock = ctx.willingnessContext
      ? `${ctx.willingnessContext}\n\n`
      : "";
    const milestoneBlock = ctx.goalMilestoneContext
      ? `${ctx.goalMilestoneContext}\n\n`
      : "";
    const datingProgressionBlock = ctx.datingProgressionContext
      ? `${ctx.datingProgressionContext}\n\n`
      : "";

    const userMessage = `${rejectionPatternBlock}${earlyCalibrationBlock}${recalibrationBlock}USER PROFILE:
- Home: ${ctx.city} (${ctx.homeLat.toFixed(4)}, ${ctx.homeLng.toFixed(4)})
- Comfort radius: ${ctx.radius.toFixed(1)} miles
- Pace: ${ctx.pace}
${ctx.user.reachMode ? `- Reach mode: ${ctx.user.reachMode}` : buildAutoReachModeLine(ctx)}
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
${ctx.user.onboardingProfile?.activities?.length ? `- Activities they enjoy (weak priors, not requirements): ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}

${socialSituationBlock}${ctx.fearLadderContext}
${ctx.expectancyContext}
${ctx.difficultyGuidance}

${frameworkBlock}${opportunityZoneBlock}${willingnessBlock}${journeyMixBlock}${datingProgressionBlock}${milestoneBlock}${ctx.historyContext}
${coverageBlock}${expansionBlock}${phaseBlock}${timelineBlock}${socialMicroBlock}${blockerOverride}CURRENT TIME: ${ctx.hour}:00 on ${ctx.dayOfWeek}.

${siblingBlock}What experience should this user have next? Think about what would genuinely move them toward their goal.`;

    const response = await this.openAIService.executeChatCompletion(
      {
        model: this.models.strategist as OpenAIModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_completion_tokens: 800,
      },
      "strategist_agent",
    );

    const text = response.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(text);

    // Slice C — normalize capacity track. Fall back to NOVELTY_TOLERANCE if the
    // strategist drops the field or emits an unknown value. That's a weak
    // default but keeps downstream persistence type-safe.
    const rawTrack =
      typeof parsed.capacityTrack === "string"
        ? parsed.capacityTrack.toUpperCase()
        : "";
    const capacityTrack = (Object.values(CapacityTrack) as string[]).includes(
      rawTrack,
    )
      ? (rawTrack as CapacityTrack)
      : CapacityTrack.NOVELTY_TOLERANCE;
    const repIntent: string =
      typeof parsed.repIntent === "string" && parsed.repIntent.trim()
        ? parsed.repIntent.trim()
        : "Show up and see what happens.";

    const venueQualities: VenueQualityProfile | undefined =
      parsed.venueQualities && typeof parsed.venueQualities === "object"
        ? {
            must: sanitizeQualities(parsed.venueQualities.must),
            prefer: sanitizeQualities(parsed.venueQualities.prefer),
            avoid: sanitizeQualities(parsed.venueQualities.avoid),
          }
        : undefined;

    return {
      capacityTrack,
      repIntent,
      experienceType: parsed.experienceType ?? "general exploration",
      suggestedCategories: parsed.suggestedCategories ?? [],
      venueQualities,
      targetCity: parsed.targetCity ?? input.city,
      maxDistanceMiles: parsed.maxDistanceMiles ?? input.radius * 1.5,
      difficultyRange: parsed.difficultyRange ?? [2, 5],
      socialChallengeLevel: parsed.socialChallengeLevel ?? "low",
      searchQueries: parsed.searchQueries ?? [],
      preferredVenue: parsed.preferredVenue ?? undefined,
      avoidVenues: parsed.avoidVenues ?? [],
      avoidCategories: parsed.avoidCategories ?? [],
      suggestedTiming: parsed.suggestedTiming ?? "",
      rationale: parsed.rationale ?? "",
      opportunityScope: [
        "local_home_base",
        "nearby_social_zone",
        "regional_opportunity",
      ].includes(parsed.opportunityScope)
        ? parsed.opportunityScope
        : undefined,
      travelRationale:
        typeof parsed.travelRationale === "string"
          ? parsed.travelRationale
          : undefined,
    };
  }
}

function traceScoutCandidate(candidate: ScoutCandidate): ScoutCandidateTrace {
  return {
    name: candidate.venueName,
    category: candidate.venueCategory,
    distanceMiles:
      typeof candidate.distanceFromHome === "number"
        ? Number(candidate.distanceFromHome.toFixed(2))
        : undefined,
    rating: candidate.rating,
    source: candidate.source,
    primaryType:
      candidate.googlePrimaryTypeDisplayName ??
      candidate.googlePrimaryType ??
      candidate.googleTypes?.[0],
    notes: candidate.notes,
  };
}

function softenBriefForWeakFallback(
  brief: StrategyBrief,
  fallbackReason?: string,
): void {
  const upper = Math.min(brief.difficultyRange[1] ?? 3, 3);
  brief.difficultyRange = [
    Math.min(brief.difficultyRange[0] ?? 1, upper),
    upper,
  ];
  if (
    brief.socialChallengeLevel === "medium" ||
    brief.socialChallengeLevel === "high"
  ) {
    brief.socialChallengeLevel = "low";
  }

  const fallbackNote = fallbackReason
    ? ` Venue fit is imperfect (${fallbackReason}); preserve the same capability as the gentlest viable rep.`
    : " Venue fit is imperfect; preserve the same capability as the gentlest viable rep.";
  brief.rationale = `${brief.rationale}${fallbackNote}`;

  if (brief.questContract) {
    brief.questContract = {
      ...brief.questContract,
      difficultyRange: brief.difficultyRange,
      socialChallengeLevel: brief.socialChallengeLevel,
      fallback: `${brief.questContract.fallback} If the venue is only an approximate fit, complete the same capability as an observation, setup, or low-pressure presence rep.`,
      rationale: `${brief.questContract.rationale}${fallbackNote}`,
    };
  }
}
