import { type DataSource } from "typeorm";
import {
  Sidequest,
  Objective,
  SidequestStatus,
  CapacityTrack,
  User,
} from "../entities";
import { normalizeCity } from "./shared/geo/cityUtils";
import { haversineDistance } from "@realtime-markers/shared";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import type {
  GooglePlacesService,
  VerifiedVenue,
} from "./shared/GooglePlacesService";
import type { OverpassService, Trail } from "./shared/OverpassService";
import type { EmbeddingService } from "./shared/EmbeddingService";
import type { RedisService } from "./shared/RedisService";
import type { AgentCandidate } from "./shared/JobPipeline";
import { OpenAIResponsesAgent } from "./shared/OpenAIResponsesAgent";
import type { ComfortZoneService } from "./ComfortZoneService";
import type { CoverageService } from "./CoverageService";
import type { ResonanceService } from "./ResonanceService";
import type { PathwayService, PhaseContext } from "./PathwayService";
import {
  createPrescriptionPromptRegistry,
  type PrescriptionPromptRegistry,
  type PrescriptionPromptContext,
} from "./prompts/PrescriptionPromptRegistry";
import { MultiAgentStrategy } from "./prescription/MultiAgentStrategy";
import type { PrescriptionStrategyInput } from "./prescription/PrescriptionStrategy";
import { resolveGoalTags } from "./shared/QuestConfig";
import { buildOfflineSocialFrameworkPlan } from "./prescription/OfflineSocialFramework";
import {
  buildGoalMilestoneContext,
  detectGoalActionType,
  isConcreteGoalActionType,
  normalizeGoalActionType,
} from "./prescription/GoalMilestoneContext";
import { buildJourneyDiversityContext } from "./prescription/JourneyDiversityContext";
import { resolveJourneyPhase } from "./prescription/JourneyPhasePolicy";
import { analyzeOpportunityZones } from "./prescription/OpportunityZonePolicy";

// ── Extracted modules ──────────────────────────────────────────────
import {
  buildPrescriptionContext,
  buildSocialMicroRepContext,
  buildBlockerContext,
  buildFearLadderContext,
  buildExpectancyContext,
  buildDifficultyGuidance,
  buildSiblingInstructions,
  buildIndividualRoleInstructions,
  buildSocialSituationContext,
  computeFearLadderReadiness,
  determineIndividualQuestRole,
  loadRecentRejections,
  detectRejectionPattern,
  type PrescriptionContextDeps,
  type FearLadderReadiness,
  type BlockerDetectionResult,
} from "./prescription/PrescriptionContextBuilder";

// ── Re-exports (keep public API stable) ────────────────────────────
export type {
  FearLadderReadiness,
  BlockerDetectionResult,
} from "./prescription/PrescriptionContextBuilder";

export type SidequestProgressCallback = (
  progress: number,
  label: string,
  candidates?: AgentCandidate[],
) => Promise<void>;

export interface PrescribeQuestInput {
  latitude: number;
  longitude: number;
  timezone?: string;
  /** Override the model for this specific prescription (e.g. "gpt-5.4", "gpt-5.4-mini") */
  model?: string;
  /** Quest type: "venue" (default, location-based) or "challenge" (social/vulnerability) */
  questType?: "venue" | "challenge";
  /** Challenge category — required when questType is "challenge" */
  challengeCategory?: string;
}

export interface SiblingContext {
  batchId: string;
  batchIndex: number;
  totalInBatch: number;
  questRole:
    | "deepen"
    | "explore"
    | "discover"
    | "stretch"
    | "enjoy"
    | "milestone";
  difficultyTier?: "easy" | "medium" | "stretch";
  targetPathway?: { id: string; theme: string; label: string; phase: string };
  previousSiblings: {
    title: string;
    venueCategory: string;
    venueName: string;
  }[];
}

// ─── LLM Types (only used by prescription) ──────────────────────────

interface LLMItemRaw {
  t: string;
  d: string;
  e: string;
  ec: number | null;
  vn: string | null;
  va: string | null;
  eid: string | null;
  vc: string | null;
  hook: string | null;
  sa: string[] | null;
  ai: string[] | null;
  jp: string | null;
  df: number | null;
  act: string | null;
  // Slice A — rep variants
  sr?: string | null;
  tr?: string | null;
  mvw?: string | null;
  er?: string | null;
  dgt?: boolean | null;
  gat?: string | null;
}

interface LLMResponseRaw {
  t: string;
  s: string;
  sn?: string;
  items: LLMItemRaw[];
}

interface LLMItem {
  title: string;
  description: string;
  emoji: string;
  estimatedCost: number | null;
  venueName: string | null;
  venueAddress: string | null;
  eventId: string | null;
  venueCategory: string | null;
  hook: string | null;
  suggestedActivities: string[] | null;
  actionItems: string[] | null;
  journalPrompt: string | null;
  difficulty: number | null;
  actionability: "actionable" | "suggestive" | "milestone" | null;
  // Slice A — rep variants
  smallerRep: string | null;
  tinyRep: string | null;
  minViableWin: string | null;
  exitRamp: string | null;
  directGoalTouch: boolean | null;
  goalActionType: string | null;
}

interface LLMResponse {
  title: string;
  summary: string;
  strategyNote?: string;
  items: LLMItem[];
}

function expandLLMResponse(raw: LLMResponseRaw): LLMResponse {
  return {
    title: raw.t,
    summary: raw.s,
    strategyNote: raw.sn ?? undefined,
    items: raw.items.map((i) => ({
      title: i.t,
      description: i.d,
      emoji: i.e,
      estimatedCost: i.ec,
      venueName: i.vn,
      venueAddress: i.va,
      eventId: i.eid,
      venueCategory: i.vc,
      hook: i.hook,
      suggestedActivities: i.sa ?? null,
      actionItems: i.ai ?? null,
      journalPrompt: i.jp ?? null,
      difficulty: i.df ?? null,
      actionability: (["actionable", "suggestive", "milestone"].includes(
        i.act ?? "",
      )
        ? i.act
        : "suggestive") as LLMItem["actionability"],
      smallerRep: i.sr ?? null,
      tinyRep: i.tr ?? null,
      minViableWin: i.mvw ?? null,
      exitRamp: i.er ?? null,
      directGoalTouch: i.dgt ?? null,
      goalActionType: i.gat ?? null,
    })),
  };
}

interface GeocodedData {
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  canonicalAddress: string | null;
}

// ─── Dependencies ───────────────────────────────────────────────────

interface SidequestPrescriptionServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  geocodingService: GoogleGeocodingService;
  placesService: GooglePlacesService;
  overpassService: OverpassService;
  embeddingService?: EmbeddingService;
  redisService?: RedisService;
  comfortZoneService: ComfortZoneService;
  coverageService?: CoverageService;
  resonanceService?: ResonanceService;
  pathwayService?: PathwayService;
  promptRegistry?: PrescriptionPromptRegistry;
  promptVersion?: string;
  /** Model to use for quest prescription. Defaults to GPT54Mini. */
  prescriptionModel?: string;
}

// ─── Implementation ─────────────────────────────────────────────────

export class SidequestPrescriptionService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;
  private placesService: GooglePlacesService;
  private overpassService: OverpassService;
  private embeddingService?: EmbeddingService;
  private redisService?: RedisService;
  private comfortZoneService: ComfortZoneService;
  private coverageService?: CoverageService;
  private resonanceService?: ResonanceService;
  private pathwayService?: PathwayService;
  private agent: OpenAIResponsesAgent;
  private promptRegistry: PrescriptionPromptRegistry;
  private promptVersion: string;
  private prescriptionModel?: string;
  private multiAgentStrategy: MultiAgentStrategy;
  private contextDeps: PrescriptionContextDeps;

  constructor(deps: SidequestPrescriptionServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
    this.placesService = deps.placesService;
    this.overpassService = deps.overpassService;
    this.embeddingService = deps.embeddingService;
    this.redisService = deps.redisService;
    this.comfortZoneService = deps.comfortZoneService;
    this.coverageService = deps.coverageService;
    this.resonanceService = deps.resonanceService;
    this.pathwayService = deps.pathwayService;
    this.agent = new OpenAIResponsesAgent(deps.openAIService);
    this.promptRegistry =
      deps.promptRegistry ?? createPrescriptionPromptRegistry();
    this.promptVersion = deps.promptVersion ?? "v1-default";
    this.prescriptionModel = deps.prescriptionModel;
    this.multiAgentStrategy = new MultiAgentStrategy({
      openAIService: deps.openAIService,
      agent: this.agent,
      geocodingService: deps.geocodingService,
      placesService: deps.placesService,
      overpassService: deps.overpassService,
      promptRegistry: this.promptRegistry,
    });
    this.contextDeps = {
      dataSource: deps.dataSource,
      openAIService: deps.openAIService,
      comfortZoneService: deps.comfortZoneService,
      coverageService: deps.coverageService,
      resonanceService: deps.resonanceService,
      pathwayService: deps.pathwayService,
    };
  }

  // ─── Public Method ──────────────────────────────────────────────

  async prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
    siblingContext?: SiblingContext,
  ): Promise<Sidequest> {
    // Branch for challenge quests (non-venue, social/vulnerability)
    if (input.questType === "challenge") {
      return this.prescribeChallengeQuest(userId, input, onProgress);
    }

    if (!this.comfortZoneService) {
      throw new Error("ComfortZoneService required for prescribeQuest");
    }

    const repo = this.dataSource.getRepository(Sidequest);
    const objectiveRepo = this.dataSource.getRepository(Objective);

    // 1. Get comfort zone + user profile
    const zone = await this.comfortZoneService.getComfortZone(userId);
    if (!zone.hasHomeAnchor) {
      // Set home from current location on first prescription
      await this.comfortZoneService.detectHomeAnchor(
        userId,
        input.latitude,
        input.longitude,
      );
    }

    // Recalculate radius based on history
    const radius = await this.comfortZoneService.recalculateRadius(userId);

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "homeLatitude",
        "homeLongitude",
        "comfortProfile",
        "onboardingProfile",
        "pacePreference",
        "reachMode",
        "behavioralProfile",
        "fearLadder",
        "expectancyCalibration",
        "socialSituation",
      ],
    });

    if (!user) throw new Error("User not found");

    const goalTags = resolveGoalTags(user.comfortProfile);
    const homeLat = Number(user.homeLatitude ?? input.latitude);
    const homeLng = Number(user.homeLongitude ?? input.longitude);

    // Detect if user is away from home (e.g. at work)
    const currentLat = input.latitude;
    const currentLng = input.longitude;
    const distFromHome = this.haversineDistanceMiles(
      homeLat,
      homeLng,
      currentLat,
      currentLng,
    );
    // If user is more than 2x their comfort radius from home, search near
    // their current location instead — they're clearly somewhere else
    const isAwayFromHome = distFromHome > radius * 2;
    let searchLat = isAwayFromHome ? currentLat : homeLat;
    let searchLng = isAwayFromHome ? currentLng : homeLng;

    // Keep the user's actual home city separate from the active search city.
    // Coverage expansion may later shift `city` toward a nearby opportunity
    // zone, but recalibration clamps must still know where home base is.
    let homeCity = "Unknown";
    try {
      homeCity = await this.geocodingService.reverseGeocodeCityState(
        homeLat,
        homeLng,
      );
    } catch {
      // Fall through with Unknown
    }

    // Reverse geocode for city name early — coverage expansion may override searchLat/searchLng and re-geocode
    let city = "Unknown";
    try {
      city = await this.geocodingService.reverseGeocodeCityState(
        searchLat,
        searchLng,
      );
    } catch {
      // Fall through with Unknown
    }

    // 2. Build behavioral context from history
    const historyContext = await buildPrescriptionContext(
      this.contextDeps,
      userId,
      user.behavioralProfile ?? null,
      goalTags,
      user.comfortProfile ?? null,
    );

    // 2a. Calibration feedback (Slice B) — if the user just rejected a prescription,
    // surface the most recent reason so the strategist and validator can recalibrate.
    // Anything older than 15 minutes is history, not an active lever.
    // Slice F — also pull up to 5 rejections to detect recurring patterns.
    const recentRejections = await loadRecentRejections(
      this.dataSource,
      userId,
      5,
    );
    const freshRejection =
      recentRejections.find((r) => r.ageMinutes <= 15) ?? null;
    const lastRejection = freshRejection
      ? {
          reason: freshRejection.reason,
          venueName: freshRejection.venueName,
          venueCategory: freshRejection.venueCategory,
          ageMinutes: freshRejection.ageMinutes,
        }
      : null;
    const rejectionPattern = detectRejectionPattern(recentRejections);
    if (rejectionPattern) {
      console.log(
        `[prescribeQuest] Rejection pattern detected: ${rejectionPattern.reason} × ${rejectionPattern.count}${rejectionPattern.categories.length ? ` (categories: ${rejectionPattern.categories.join(", ")})` : ""}`,
      );
    }

    // Slice E — early calibration mode. First 5 completed quests get tighter
    // guardrails: stay inside the user's radius, keep social load low, ensure
    // a tiny version and exit ramp exist. Trust is the product here, not growth.
    const completedQuestCount = await this.countCompletedQuests(userId);
    const isEarlyCalibration = completedQuestCount < 5;
    const offlineSocialFramework = buildOfflineSocialFrameworkPlan({
      comfortProfile: user.comfortProfile,
      goalTags,
      completedQuestCount,
    });

    // 2b. Compute fear ladder readiness from actual user feedback
    const fearLadderReadiness = await computeFearLadderReadiness(
      this.dataSource,
      userId,
    );

    // 2b2. Detect recurring blockers from quest history
    const { promptText: blockerContext, blocker: blockerMeta } =
      await buildBlockerContext(this.contextDeps, userId);

    // 2b3. Goal-closure milestones. This is intentionally prompt-derived for
    // v1: no migration, recomputed from profile/history each prescription.
    const goalMilestone = await buildGoalMilestoneContext({
      dataSource: this.dataSource,
      userId,
      comfortProfile: user.comfortProfile,
      goalTags,
      completedQuestCount,
      blockerMeta,
    });
    const journeyDiversity = await buildJourneyDiversityContext({
      dataSource: this.dataSource,
      userId,
      completedQuestCount,
    });
    const journeyPhase = resolveJourneyPhase({
      completedQuestCount,
      isEarlyCalibration,
      goalClosureDue: goalMilestone.goalClosureDue,
      directGoalTouched: goalMilestone.directGoalTouched,
      postGoalClosureWindow: journeyDiversity.postGoalClosureWindow,
      shouldCooldownMilestone: journeyDiversity.shouldCooldownMilestone,
      shouldForceStructuredNext: journeyDiversity.shouldForceStructuredNext,
      recentBaseRecoveryCount: journeyDiversity.recentBaseRecoveryCount,
      recentStructuredCount: journeyDiversity.recentStructuredCount,
      dominantRecentFamily: journeyDiversity.dominantRecentFamily,
    });
    let opportunityZones = null;
    try {
      const nearbyCities = await this.overpassService.fetchNearbyCities(
        homeLat,
        homeLng,
        100000,
        12,
      );
      opportunityZones = analyzeOpportunityZones({
        homeCity: homeCity ?? city,
        nearbyCities,
        goalTags,
        completedQuestCount,
        isEarlyCalibration,
        journeyPhase: journeyPhase.phase,
      });
    } catch (err) {
      console.error("[prescribeQuest] Opportunity zone analysis failed:", err);
    }

    // 2b3. Build social micro-rep context (contextual social scaffolding)
    const socialMicroRepContext = await buildSocialMicroRepContext(
      this.dataSource,
      userId,
      user.fearLadder ?? null,
      fearLadderReadiness,
      goalTags,
      blockerMeta,
    );

    // 2c. Build coverage context (Voronoi directional gaps + exploration profile)
    let coverageContext = "";
    let explorationProfileLabel = "";
    let expansionTarget = "";
    if (this.coverageService) {
      try {
        const coverage =
          await this.coverageService.buildLLMCoverageContext(userId);
        coverageContext = coverage.context;
        explorationProfileLabel = coverage.profile.label;

        // If there's a significant directional gap AND the user has grown enough,
        // compute a search target in that direction and shift the search location.
        // Force a fresh snapshot to avoid stale cache from early quests.
        const snapshot = await this.coverageService.recomputeSnapshot(userId);
        const completedCount = await this.countCompletedQuests(userId);
        const snapshotGaps = (snapshot.directionalGaps ?? []) as {
          direction: string;
          angleDeg: number;
          gapWidthDeg: number;
        }[];
        console.log(
          `[prescribeQuest] Expansion check: ${completedCount} quests, radius ${radius.toFixed(1)}mi, ${snapshotGaps.length} gaps, clusters ${snapshot.clusterCount}`,
        );
        if (snapshotGaps.length > 0) {
          console.log(
            `[prescribeQuest] Gaps: ${snapshotGaps.map((g) => `${g.direction}(${g.gapWidthDeg.toFixed(0)}deg)`).join(", ")}`,
          );
        }
        const needsViableStructuredContainers =
          offlineSocialFramework.phase === "container_bfs" &&
          offlineSocialFramework.containers.some((container) =>
            [
              "structured_class",
              "recurring_club",
              "movement_group",
              "creative_workshop",
              "volunteering",
              "singles_event",
            ].includes(container),
          );
        if (needsViableStructuredContainers) {
          expansionTarget =
            "\nFRAMEWORK SEARCH PRIORITY: The user has reached container BFS. Prioritize viable structured social containers (classes, clubs, meetups, workshops, movement groups, volunteering, dating-adjacent events) over geographic gap-filling. Do not drift into generic cafes, bakeries, tea houses, or dessert shops unless this is an explicit recovery recalibration.\n";
        }
        if (
          snapshotGaps.length > 0 &&
          completedCount >= 5 &&
          radius >= 2.5 &&
          !needsViableStructuredContainers
        ) {
          const biggestGap = [...snapshotGaps].sort(
            (a, b) => b.gapWidthDeg - a.gapWidthDeg,
          )[0];
          if (biggestGap.gapWidthDeg >= 45) {
            // Project a point at the edge of comfort radius in the gap direction
            const targetDistMiles = Math.max(4, radius * 0.85);
            const targetPoint = this.projectPoint(
              homeLat,
              homeLng,
              biggestGap.angleDeg,
              targetDistMiles,
            );

            // Shift search location to the projected point
            searchLat = targetPoint.lat;
            searchLng = targetPoint.lng;

            // Re-geocode the new search location for the city name
            try {
              const targetCity =
                await this.geocodingService.reverseGeocodeCityState(
                  targetPoint.lat,
                  targetPoint.lng,
                );
              if (targetCity && targetCity !== "Unknown") {
                city = targetCity;
              }
            } catch {
              // Keep existing city name if geocode fails
            }

            console.log(
              `[prescribeQuest] Expansion: shifting search ${targetDistMiles.toFixed(1)}mi ${biggestGap.direction} ` +
                `to (${searchLat.toFixed(4)}, ${searchLng.toFixed(4)}) = "${city}" (gap ${biggestGap.gapWidthDeg.toFixed(0)}deg)`,
            );

            expansionTarget =
              `\nEXPANSION TARGET: The user has a ${biggestGap.gapWidthDeg.toFixed(0)}-degree unexplored gap to the ${biggestGap.direction.toUpperCase()}. ` +
              `You are searching ${targetDistMiles.toFixed(1)} miles ${biggestGap.direction} of their home. ` +
              `Search for venues near (${searchLat.toFixed(4)}, ${searchLng.toFixed(4)}) in or around "${city}". ` +
              `Do NOT search in Frederick — explore this new area.`;
          }
        }
      } catch (err) {
        console.error("[prescribeQuest] Coverage context failed:", err);
      }
    }

    // 2c. Build phase context from pathways (BFS/DFS)
    let phaseContext = "";
    let phaseForRole: PhaseContext | undefined;
    if (this.pathwayService) {
      try {
        const phase = await this.pathwayService.getUserPhaseContext(userId);
        phaseContext = phase.recommendation;
        phaseForRole = phase;
      } catch (err) {
        console.error("[prescribeQuest] Phase context failed:", err);
      }
    }

    // 3. Determine quest role — from sibling context (pack) or auto-detected (individual)
    let questRole: string | undefined;
    let roleTargetPathway:
      | { id: string; theme: string; label: string; phase: string }
      | undefined;

    if (siblingContext) {
      questRole = siblingContext.questRole;
      roleTargetPathway = siblingContext.targetPathway;
    } else {
      // Auto-detect role for individual venue prescriptions
      const autoRole = determineIndividualQuestRole(
        fearLadderReadiness,
        phaseForRole?.pathways,
      );
      questRole = autoRole.role;
      roleTargetPathway = autoRole.targetPathway;
    }
    if (
      offlineSocialFramework.phase === "container_bfs" &&
      questRole === "deepen"
    ) {
      questRole = "explore";
      roleTargetPathway = undefined;
    }
    if (!siblingContext && journeyPhase.requireMilestoneQuest) {
      questRole = "milestone";
      roleTargetPathway = undefined;
      console.log(
        `[prescribeQuest] Journey phase ${journeyPhase.phase}: ${goalMilestone.activeMilestoneTitle ?? "milestone"} is due — overriding quest role to milestone`,
      );
    } else if (
      !siblingContext &&
      goalMilestone.goalClosureDue &&
      journeyDiversity.shouldCooldownMilestone
    ) {
      console.log(
        "[prescribeQuest] Goal-closure milestone is due, but a direct-goal rep just landed — cooling down milestone pressure for one beat.",
      );
    }
    if (
      !siblingContext &&
      journeyPhase.requireStructuredNonEnjoy &&
      questRole !== "enjoy" &&
      questRole !== "milestone"
    ) {
      if (questRole === "deepen") {
        questRole = "stretch";
      }
      console.log(
        "[prescribeQuest] Late-journey structured floor is due — biasing the next non-enjoy quest toward a real social container.",
      );
    }

    // 4. Create the sidequest record
    const sidequest = repo.create({
      userId,
      city: normalizeCity(city),
      status: SidequestStatus.GENERATING,
      radiusMiles: radius,
      budgetMax: 0,
      activityTypes: user.onboardingProfile?.activities ?? [],
      prescribed: true,
      entryLatitude: searchLat,
      entryLongitude: searchLng,
      // Batch + pathway context (set when part of a weekly pack)
      ...(siblingContext && {
        batchId: siblingContext.batchId,
        batchIndex: siblingContext.batchIndex,
      }),
      // Quest role — from pack context OR auto-detected for individual quests
      ...(questRole && { questRole }),
      ...(roleTargetPathway && {
        pathwayId: roleTargetPathway.id,
        pathwayTheme: roleTargetPathway.theme,
        pathwayLabel: roleTargetPathway.label,
        pathwayPhase: roleTargetPathway.phase,
      }),
    });
    await repo.save(sidequest);

    try {
      // 5. Generate via agent

      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

      const pace = user.pacePreference ?? "steady";

      // Build role instructions from the role determined in step 3
      let roleInstructions = "";
      if (siblingContext) {
        roleInstructions = buildSiblingInstructions(siblingContext);
      } else if (questRole && questRole !== "explore") {
        roleInstructions = buildIndividualRoleInstructions(
          questRole,
          roleTargetPathway,
          user.onboardingProfile?.activities,
        );
      }

      const isStretch = questRole === "stretch";
      const isEnjoy = questRole === "enjoy";
      const difficultyTier = siblingContext?.difficultyTier;

      // Build prompt via registry
      const promptCtx: PrescriptionPromptContext = {
        user: {
          comfortProfile: user.comfortProfile ?? null,
          onboardingProfile: user.onboardingProfile ?? null,
          pacePreference: user.pacePreference ?? null,
          reachMode: user.reachMode ?? null,
          fearLadder: user.fearLadder ?? null,
          expectancyCalibration: user.expectancyCalibration ?? null,
          socialSituation: user.socialSituation ?? null,
        },
        homeLat,
        homeLng,
        searchLat,
        searchLng,
        city,
        homeCity,
        isAwayFromHome,
        distFromHome,
        radius,
        pace,
        hour,
        dayOfWeek,
        historyContext,
        coverageContext,
        explorationProfileLabel,
        expansionTarget,
        phaseContext,
        timelineContext: "",
        fearLadderContext: user.fearLadder
          ? buildFearLadderContext(user.fearLadder, fearLadderReadiness)
          : "",
        expectancyContext: user.expectancyCalibration
          ? buildExpectancyContext(user.expectancyCalibration)
          : "",
        difficultyGuidance: buildDifficultyGuidance(
          pace,
          fearLadderReadiness,
          isStretch,
          isEnjoy,
          difficultyTier,
        ),
        siblingInstructions: roleInstructions,
        blockerContext,
        socialMicroRepContext,
        socialSituationContext: buildSocialSituationContext(
          user.socialSituation,
          city,
        ),
        offlineSocialFrameworkContext: offlineSocialFramework.promptBlock,
        offlineSocialFrameworkPlan: {
          phase: offlineSocialFramework.phase,
          primaryLens: offlineSocialFramework.primaryLens,
          containers: offlineSocialFramework.containers,
          searchSeeds: offlineSocialFramework.searchSeeds,
        },
        opportunityZoneContext: opportunityZones?.promptBlock ?? "",
        opportunityZones: opportunityZones
          ? {
              homeBaseViability: opportunityZones.homeBaseViability,
              recommendedCity: opportunityZones.recommendedCity,
              fallbackCity: opportunityZones.fallbackCity,
              zones: opportunityZones.zones,
            }
          : null,
        journeyPhaseContext: journeyPhase.promptBlock,
        journeyPhase: {
          phase: journeyPhase.phase,
          requireMilestoneQuest: journeyPhase.requireMilestoneQuest,
          requireStructuredNonEnjoy: journeyPhase.requireStructuredNonEnjoy,
          forbidParkForNonEnjoy: journeyPhase.forbidParkForNonEnjoy,
          fallbackLane: journeyPhase.fallbackLane,
        },
        journeyDiversityContext: journeyDiversity.promptBlock,
        journeyDiversity: {
          recentCategories: journeyDiversity.recentCategories,
          recentFamilies: journeyDiversity.recentFamilies,
          recentVenueNames: journeyDiversity.recentVenueNames,
          recentRoles: journeyDiversity.recentRoles,
          recentMilestoneCount: journeyDiversity.recentMilestoneCount,
          recentDirectGoalTouchCount:
            journeyDiversity.recentDirectGoalTouchCount,
          recentStructuredCount: journeyDiversity.recentStructuredCount,
          recentBaseRecoveryCount: journeyDiversity.recentBaseRecoveryCount,
          questsSinceDirectGoalTouch:
            journeyDiversity.questsSinceDirectGoalTouch,
          questsSinceMilestone: journeyDiversity.questsSinceMilestone,
          consecutiveSameCategoryCount:
            journeyDiversity.consecutiveSameCategoryCount,
          consecutiveSameFamilyCount:
            journeyDiversity.consecutiveSameFamilyCount,
          consecutiveSameVenueCount: journeyDiversity.consecutiveSameVenueCount,
          dominantRecentCategory: journeyDiversity.dominantRecentCategory,
          dominantRecentFamily: journeyDiversity.dominantRecentFamily,
          postGoalClosureWindow: journeyDiversity.postGoalClosureWindow,
          shouldCooldownMilestone: journeyDiversity.shouldCooldownMilestone,
          shouldForceStructuredNext: journeyDiversity.shouldForceStructuredNext,
        },
        goalMilestoneContext: goalMilestone.promptBlock,
        activeGoalMilestone: {
          key: goalMilestone.activeMilestoneKey,
          title: goalMilestone.activeMilestoneTitle,
          goalClosureDue: goalMilestone.goalClosureDue,
          directGoalTouched: goalMilestone.directGoalTouched,
          milestoneQuestSeen: goalMilestone.milestoneQuestSeen,
        },
        goalTags,
        questRole: questRole ?? null,
        isStretch,
        isEnjoy,
        siblingContext: siblingContext ?? null,
        lastRejection,
        isEarlyCalibration,
        completedQuestCount,
        rejectionPattern: rejectionPattern
          ? {
              reason: rejectionPattern.reason,
              count: rejectionPattern.count,
              categories: rejectionPattern.categories,
            }
          : null,
      };

      // ── Multi-agent pipeline ────────────────────────────────
      const strategyInput: PrescriptionStrategyInput = {
        promptContext: promptCtx,
        promptVersion: this.promptVersion,
        city,
        searchLat,
        searchLng,
        radius,
        prescriptionModel: this.prescriptionModel,
        inputModelOverride: input.model,
        onProgress,
      };

      const strategyResult =
        await this.multiAgentStrategy.execute(strategyInput);
      const agentRaw = strategyResult.raw as unknown as LLMResponseRaw;
      const allVenues = strategyResult.allVenues;
      const allTrails = strategyResult.allTrails;
      const strategyBrief = strategyResult.brief;

      const llmResult = expandLLMResponse(agentRaw);

      // Validate and enrich objectives
      const cityCenter = { lat: homeLat, lng: homeLng };
      const validatedItems = await this.validateAndEnrichObjectives(
        llmResult.items,
        allVenues,
        city,
        cityCenter,
        allTrails,
        city,
      );

      // Compute distance from home for the primary objective
      const primaryItem = validatedItems[0];
      let distanceFromHome: number | undefined;
      const objLat = primaryItem?.geo?.latitude;
      const objLng = primaryItem?.geo?.longitude;
      if (objLat != null && objLng != null) {
        distanceFromHome = this.haversineDistanceMiles(
          homeLat,
          homeLng,
          objLat,
          objLng,
        );
      }

      // Assign rarity (with coverage gap boost)
      let rarity = "common";
      if (distanceFromHome != null && primaryItem?.item.venueCategory) {
        let inCoverageGap = false;
        if (this.coverageService && objLat && objLng) {
          try {
            inCoverageGap = await this.coverageService.isInCoverageGap(
              userId,
              objLat,
              objLng,
            );
          } catch {
            // Non-critical, proceed without boost
          }
        }
        rarity = await this.comfortZoneService!.assignRarity(
          userId,
          distanceFromHome,
          primaryItem.item.venueCategory,
          inCoverageGap,
        );
      }

      // Save objectives with new wellness fields
      const objectives = validatedItems.map((vi, idx) =>
        objectiveRepo.create({
          sidequestId: sidequest.id,
          sortOrder: idx,
          title: vi.item.title,
          description: vi.item.description,
          emoji: vi.item.emoji,
          estimatedCost: vi.item.estimatedCost ?? undefined,
          venueName: vi.item.venueName ?? undefined,
          venueAddress:
            vi.geo?.canonicalAddress ?? vi.item.venueAddress ?? undefined,
          venueCategory: vi.item.venueCategory ?? undefined,
          hook: vi.item.hook ?? undefined,
          latitude: vi.geo?.latitude ?? undefined,
          longitude: vi.geo?.longitude ?? undefined,
          suggestedActivities: vi.item.suggestedActivities ?? [],
          actionItems: vi.item.actionItems ?? [],
          journalPrompt: vi.item.journalPrompt ?? undefined,
          difficulty: vi.item.difficulty ?? undefined,
          actionability: vi.item.actionability ?? undefined,
          smallerRep: vi.item.smallerRep ?? undefined,
          tinyRep: vi.item.tinyRep ?? undefined,
          minViableWin: vi.item.minViableWin ?? undefined,
          exitRamp: vi.item.exitRamp ?? undefined,
        }),
      );
      await objectiveRepo.save(objectives);

      // Update sidequest with results
      sidequest.title = llmResult.title;
      sidequest.summary = llmResult.summary;
      sidequest.strategyNote = llmResult.strategyNote ?? undefined;
      sidequest.status = SidequestStatus.READY;
      // Rarity stays null until "Seal Memory" (promote) — computed from resonance + reflection tags
      sidequest.distanceFromHome = distanceFromHome;
      // Slice C — capacity rep attribution
      sidequest.capacityTrack = strategyBrief.capacityTrack;
      sidequest.repIntent = strategyBrief.repIntent;
      sidequest.opportunityScope = strategyBrief.opportunityScope ?? undefined;
      sidequest.travelRationale = strategyBrief.travelRationale ?? undefined;
      sidequest.goalMilestoneKey =
        goalMilestone.activeMilestoneKey ?? undefined;
      sidequest.goalMilestoneTitle =
        goalMilestone.activeMilestoneTitle ?? undefined;
      const goalActionText = [
        primaryItem?.item.description,
        ...(primaryItem?.item.actionItems ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      const writerGoalActionType = normalizeGoalActionType(
        primaryItem?.item.goalActionType,
      );
      const detectedGoalActionType =
        writerGoalActionType !== "none"
          ? writerGoalActionType
          : detectGoalActionType(goalActionText);
      sidequest.goalActionType = detectedGoalActionType;
      sidequest.directGoalTouch = isConcreteGoalActionType(
        detectedGoalActionType,
      );

      // Generate category tags inline so the client always has them
      try {
        const stopsForCategories = objectives
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}${obj.description ? ` — ${obj.description}` : ""}`,
          )
          .join("; ");

        const catCompletion = await this.openAIService.executeChatCompletion({
          model: OpenAIModel.GPT54Nano,
          messages: [
            {
              role: "system",
              content:
                'You generate category tags for sidequests. Return a JSON object with a "tags" key containing an array of 3-5 lowercase single-word tags that describe the sidequest\'s themes. Examples: {"tags": ["outdoor", "food", "culture", "nightlife", "art"]}. Respond with ONLY the JSON object.',
            },
            {
              role: "user",
              content: `Title: ${sidequest.title || "Untitled"}\nSummary: ${sidequest.summary || "N/A"}\nStops: ${stopsForCategories}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const raw = catCompletion.choices[0].message.content?.trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : parsed.tags;
          if (Array.isArray(arr)) {
            sidequest.categories = arr
              .filter((t: unknown) => typeof t === "string")
              .slice(0, 5)
              .map((t: string) => t.toLowerCase());
          }
        }
      } catch (catErr) {
        console.error(
          `[SidequestPrescriptionService] Failed to generate categories inline for ${sidequest.id}:`,
          catErr,
        );
      }

      await repo.save(sidequest);

      // Generate remaining enhancements async (embedding, entry points)
      this.generateEnhancements(sidequest.id, objectives).catch((err) => {
        console.error(
          `[SidequestPrescriptionService] Failed to generate enhancements for prescribed quest ${sidequest.id}:`,
          err,
        );
      });

      console.log(
        `[SidequestPrescriptionService] Prescribed quest ${sidequest.id} for user ${userId}: "${llmResult.title}" (${rarity}, ${distanceFromHome?.toFixed(1) ?? "?"}mi from home)`,
      );

      // Reload with objectives
      const loaded = await repo.findOne({
        where: { id: sidequest.id },
        relations: ["objectives"],
        order: { objectives: { sortOrder: "ASC" } },
      });
      return loaded ?? sidequest;
    } catch (error) {
      console.error(
        "[SidequestPrescriptionService] Prescription failed:",
        error,
      );
      sidequest.status = SidequestStatus.FAILED;
      await repo.save(sidequest);
      throw error;
    }
  }

  // ─── Challenge Quest Prescription ──────────────────────────────

  private async prescribeChallengeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
  ): Promise<Sidequest> {
    const repo = this.dataSource.getRepository(Sidequest);
    const objectiveRepo = this.dataSource.getRepository(Objective);

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "homeLatitude",
        "homeLongitude",
        "comfortProfile",
        "onboardingProfile",
        "pacePreference",
        "reachMode",
        "behavioralProfile",
        "fearLadder",
        "expectancyCalibration",
        "socialSituation",
      ],
    });

    if (!user) throw new Error("User not found");

    const goalTags = resolveGoalTags(user.comfortProfile);
    const homeLat = Number(user.homeLatitude ?? input.latitude);
    const homeLng = Number(user.homeLongitude ?? input.longitude);

    // Reverse geocode for city (used in context, not for venue search)
    let city = "Unknown";
    try {
      city = await this.geocodingService.reverseGeocodeCityState(
        homeLat,
        homeLng,
      );
    } catch {
      // Fall through
    }

    // Build context — reuse existing helpers but skip coverage/expansion
    const historyContext = await buildPrescriptionContext(
      this.contextDeps,
      userId,
      user.behavioralProfile ?? null,
      goalTags,
      user.comfortProfile ?? null,
    );

    const fearLadderReadiness = await computeFearLadderReadiness(
      this.dataSource,
      userId,
    );
    const { promptText: blockerContext } = await buildBlockerContext(
      this.contextDeps,
      userId,
    );

    let phaseContext = "";
    if (this.pathwayService) {
      try {
        const phase = await this.pathwayService.getUserPhaseContext(userId);
        phaseContext = phase.recommendation;
      } catch (err) {
        console.error("[prescribeChallengeQuest] Phase context failed:", err);
      }
    }

    const pace = user.pacePreference ?? "steady";
    const radius = this.comfortZoneService
      ? await this.comfortZoneService.recalculateRadius(userId)
      : 3;

    // Create sidequest record
    const sidequest = repo.create({
      userId,
      city: normalizeCity(city),
      status: SidequestStatus.GENERATING,
      radiusMiles: radius,
      budgetMax: 0,
      activityTypes: [],
      prescribed: true,
      questType: "challenge",
      challengeCategory: input.challengeCategory ?? "social_reach",
    });
    await repo.save(sidequest);

    try {
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

      // Slice E — challenges share the same early-calibration signal as
      // venue quests. A new user picking a challenge shouldn't get "host
      // a dinner party" as quest 2.
      const completedChallengeCount = await this.countCompletedQuests(userId);
      const isEarlyCalibration = completedChallengeCount < 5;
      const offlineSocialFramework = buildOfflineSocialFrameworkPlan({
        comfortProfile: user.comfortProfile,
        goalTags,
        completedQuestCount: completedChallengeCount,
      });

      // Build prompt via registry (challenge version)
      const promptCtx: PrescriptionPromptContext = {
        user: {
          comfortProfile: user.comfortProfile ?? null,
          onboardingProfile: user.onboardingProfile ?? null,
          pacePreference: user.pacePreference ?? null,
          reachMode: user.reachMode ?? null,
          fearLadder: user.fearLadder ?? null,
          expectancyCalibration: user.expectancyCalibration ?? null,
          socialSituation: user.socialSituation ?? null,
        },
        homeLat,
        homeLng,
        searchLat: homeLat,
        searchLng: homeLng,
        city,
        isAwayFromHome: false,
        distFromHome: 0,
        radius,
        pace,
        hour,
        dayOfWeek,
        historyContext,
        coverageContext: "",
        explorationProfileLabel: "",
        expansionTarget: "",
        phaseContext,
        timelineContext: "",
        fearLadderContext: user.fearLadder
          ? buildFearLadderContext(user.fearLadder, fearLadderReadiness)
          : "",
        expectancyContext: user.expectancyCalibration
          ? buildExpectancyContext(user.expectancyCalibration)
          : "",
        difficultyGuidance: buildDifficultyGuidance(
          pace,
          fearLadderReadiness,
          false,
          false,
        ),
        siblingInstructions: "",
        blockerContext,
        socialMicroRepContext: "",
        socialSituationContext: buildSocialSituationContext(
          user.socialSituation,
          city,
        ),
        offlineSocialFrameworkContext: offlineSocialFramework.promptBlock,
        opportunityZoneContext: "",
        opportunityZones: null,
        goalMilestoneContext: "",
        activeGoalMilestone: null,
        goalTags,
        isStretch: false,
        isEnjoy: false,
        siblingContext: null,
        challengeCategory: input.challengeCategory ?? "social_reach",
        isEarlyCalibration,
        completedQuestCount: completedChallengeCount,
      };

      const promptOutput = this.promptRegistry.build("v1-challenge", promptCtx);
      const instructions = promptOutput.instructions;

      // Tools: web_search (optional) + submit_challenge (terminal)
      type Tool = import("openai/resources/responses/responses").Tool;
      const tools: Tool[] = [
        {
          type: "web_search",
          user_location: { type: "approximate", city, country: "US" },
          search_context_size: "medium",
        },
        {
          type: "function",
          name: "submit_challenge",
          description: "Submit the prescribed social/vulnerability challenge.",
          parameters: {
            type: "object" as const,
            properties: {
              t: { type: "string", description: "Challenge title (3-6 words)" },
              s: {
                type: "string",
                description: "Summary (1-2 sentences, why this matters)",
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    t: { type: "string", description: "Challenge title" },
                    d: {
                      type: "string",
                      description:
                        "Full rep — what to do, concrete and specific",
                    },
                    sr: {
                      type: "string",
                      description:
                        "Smaller rep — reduced-intensity fallback version",
                    },
                    tr: {
                      type: "string",
                      description:
                        "Tiny rep — minimum viable action, almost impossible to fail",
                    },
                    mvw: {
                      type: "string",
                      description:
                        "Minimum viable win — one short line describing what counts as done",
                    },
                    er: {
                      type: "string",
                      description:
                        "Exit ramp — one short line describing how to leave without failure",
                    },
                    e: { type: "string", description: "Emoji" },
                    vc: {
                      type: "string",
                      description:
                        "Challenge category (social_reach, vulnerability, hosting, reconnection)",
                    },
                    hook: {
                      type: "string",
                      description:
                        "Why this challenge matters for their growth",
                    },
                    sa: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "2-3 emoji-prefixed tips for how to approach this",
                    },
                    jp: {
                      type: "string",
                      description:
                        "Journal prompt — reflective question for after completing the challenge",
                    },
                    df: {
                      type: "number",
                      description:
                        "Difficulty 1-10 (social/emotional difficulty)",
                    },
                  },
                  required: [
                    "t",
                    "d",
                    "sr",
                    "tr",
                    "mvw",
                    "er",
                    "e",
                    "vc",
                    "hook",
                    "sa",
                    "jp",
                    "df",
                  ],
                },
                maxItems: 1,
                minItems: 1,
              },
            },
            required: ["t", "s", "items"],
          },
          strict: false,
        },
      ];

      const toolHandlers: Record<
        string,
        (
          args: Record<string, unknown>,
        ) => Promise<{ output: string; terminal?: boolean; rejection?: string }>
      > = {
        submit_challenge: async (args) => {
          const data = args as unknown as LLMResponseRaw;
          if (data.items && data.items.length > 1) {
            data.items = data.items.slice(0, 1);
          }
          return { output: "Challenge accepted", terminal: true };
        },
      };

      if (onProgress) {
        await onProgress(10, "Designing your challenge...");
      }

      const agentResult = await this.agent.run<LLMResponseRaw>(
        {
          instructions,
          tools,
          toolHandlers,
          maxRounds: 4,
          temperature: 0.8,
          maxOutputTokens: 1500,
          caller: "prescribe_challenge",
          ...((input.model || this.prescriptionModel) && {
            model: (input.model || this.prescriptionModel) as OpenAIModel,
          }),
        },
        promptOutput.initialMessage,
      );

      if (onProgress) {
        await onProgress(80, "Finalizing your challenge...");
      }

      const llmResult = expandLLMResponse(agentResult.result);

      // Slice A: backfill rep variants if the challenge writer dropped any field.
      // Mirrors the venue writer's safety net — every prescription must ship with
      // a graceful downgrade path.
      for (const item of llmResult.items) {
        if (!item.smallerRep?.trim()) {
          item.smallerRep =
            "A lighter version of the same action. Do less, not nothing.";
        }
        if (!item.tinyRep?.trim()) {
          item.tinyRep =
            "The smallest possible step in the same direction — opening the app, drafting without sending, reading back.";
        }
        if (!item.minViableWin?.trim()) {
          item.minViableWin = "You started.";
        }
        if (!item.exitRamp?.trim()) {
          item.exitRamp = "You can stop anytime. Starting counts.";
        }
      }

      // Save objectives (no venue validation needed)
      const objectives = llmResult.items.map((item, idx) =>
        objectiveRepo.create({
          sidequestId: sidequest.id,
          sortOrder: idx,
          title: item.title,
          description: item.description,
          emoji: item.emoji,
          venueCategory: item.venueCategory ?? undefined,
          hook: item.hook ?? undefined,
          suggestedActivities: item.suggestedActivities ?? [],
          actionItems: [],
          journalPrompt: item.journalPrompt ?? undefined,
          difficulty: item.difficulty ?? undefined,
          actionability: "suggestive",
          smallerRep: item.smallerRep ?? undefined,
          tinyRep: item.tinyRep ?? undefined,
          minViableWin: item.minViableWin ?? undefined,
          exitRamp: item.exitRamp ?? undefined,
        }),
      );
      await objectiveRepo.save(objectives);

      // Update sidequest
      sidequest.title = llmResult.title;
      sidequest.summary = llmResult.summary;
      sidequest.strategyNote = llmResult.strategyNote ?? undefined;
      sidequest.status = SidequestStatus.READY;
      // Slice C — map challenge category to a capacity track. Rough mapping;
      // can be LLM-chosen later if challenge prompts learn to emit it.
      const challengeCategoryToTrack: Record<string, CapacityTrack> = {
        social_reach: CapacityTrack.MICRO_INTERACTION,
        vulnerability: CapacityTrack.RECOVERY,
        hosting: CapacityTrack.SOCIAL_EXTENSION,
        reconnection: CapacityTrack.RETURNABILITY,
      };
      sidequest.capacityTrack =
        challengeCategoryToTrack[input.challengeCategory ?? "social_reach"] ??
        CapacityTrack.MICRO_INTERACTION;
      sidequest.repIntent =
        llmResult.strategyNote ?? llmResult.summary ?? undefined;

      // Generate category tags
      try {
        const stopsForCategories = objectives
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}${obj.description ? ` — ${obj.description}` : ""}`,
          )
          .join("; ");

        const catCompletion = await this.openAIService.executeChatCompletion({
          model: OpenAIModel.GPT54Nano,
          messages: [
            {
              role: "system",
              content:
                'You generate category tags for social challenges. Return a JSON object with a "tags" key containing an array of 3-5 lowercase single-word tags that describe the challenge\'s themes. Examples: {"tags": ["social", "vulnerability", "courage", "connection", "growth"]}. Respond with ONLY the JSON object.',
            },
            {
              role: "user",
              content: `Title: ${sidequest.title || "Untitled"}\nSummary: ${sidequest.summary || "N/A"}\nChallenge: ${stopsForCategories}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const raw = catCompletion.choices[0].message.content?.trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : parsed.tags;
          if (Array.isArray(arr)) {
            sidequest.categories = arr
              .filter((t: unknown) => typeof t === "string")
              .slice(0, 5)
              .map((t: string) => t.toLowerCase());
          }
        }
      } catch (catErr) {
        console.error(
          `[prescribeChallengeQuest] Failed to generate categories for ${sidequest.id}:`,
          catErr,
        );
      }

      await repo.save(sidequest);

      console.log(
        `[SidequestPrescriptionService] Prescribed challenge ${sidequest.id} for user ${userId}: "${llmResult.title}" (${input.challengeCategory})`,
      );

      const loaded = await repo.findOne({
        where: { id: sidequest.id },
        relations: ["objectives"],
        order: { objectives: { sortOrder: "ASC" } },
      });
      return loaded ?? sidequest;
    } catch (error) {
      console.error(
        "[SidequestPrescriptionService] Challenge prescription failed:",
        error,
      );
      sidequest.status = SidequestStatus.FAILED;
      await repo.save(sidequest);
      throw error;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private async validateAndEnrichObjectives(
    items: LLMItem[],
    verifiedVenues: VerifiedVenue[],
    city: string,
    cityCenter?: { lat: number; lng: number },
    trails: Trail[] = [],
    knownCityState?: string,
  ): Promise<{ item: LLMItem; geo: GeocodedData | null }[]> {
    const venueByName = new Map(
      verifiedVenues.map((v) => [v.name.toLowerCase(), v]),
    );
    const trailByName = new Map(trails.map((t) => [t.name.toLowerCase(), t]));

    const results: ({ item: LLMItem; geo: GeocodedData | null } | null)[] =
      await Promise.all(
        items.map(async (item) => {
          // Trail items: match against OSM trail data
          if (
            item.venueCategory &&
            /trail|hike|hiking/i.test(item.venueCategory) &&
            item.venueName
          ) {
            const matchedTrail = trailByName.get(item.venueName.toLowerCase());
            if (matchedTrail) {
              return {
                item,
                geo: {
                  latitude: matchedTrail.center[1],
                  longitude: matchedTrail.center[0],
                  googlePlaceId: null,
                  googleRating: null,
                  canonicalAddress: null,
                },
              };
            }
          }

          // Venue items: try fuzzy match against pre-fetched verified venues
          if (item.venueName) {
            const itemNameLower = item.venueName.toLowerCase().trim();
            // Exact match first
            let matched = venueByName.get(itemNameLower);
            // Fuzzy: check if any pre-fetched venue name contains or is contained by the item name
            if (!matched) {
              for (const [venueName, venue] of venueByName) {
                if (
                  venueName.includes(itemNameLower) ||
                  itemNameLower.includes(venueName)
                ) {
                  matched = venue;
                  break;
                }
              }
            }
            if (matched) {
              const [lng, lat] = matched.coordinates;
              return {
                item,
                geo: {
                  latitude: lat,
                  longitude: lng,
                  googlePlaceId: matched.placeId,
                  googleRating: matched.rating ?? null,
                  canonicalAddress: matched.address,
                },
              };
            }
          }

          // Not in pre-fetched list: verify via Google Places
          const searchQuery = item.venueName
            ? `${item.venueName} ${city}`
            : item.venueAddress
              ? `${item.venueAddress} ${city}`
              : null;

          if (!searchQuery) return { item, geo: null };

          try {
            const placeResult = await this.placesService.searchPlaceForFrontend(
              searchQuery,
              cityCenter,
              knownCityState,
            );

            if (placeResult.success && placeResult.place) {
              if (
                placeResult.place.businessStatus === "CLOSED_PERMANENTLY" ||
                placeResult.place.businessStatus === "CLOSED_TEMPORARILY"
              ) {
                console.log(
                  `[SidequestPrescriptionService] Dropping closed venue: "${item.venueName}" (${placeResult.place.businessStatus})`,
                );
                return null;
              }

              const [lng, lat] = placeResult.place.coordinates;
              return {
                item,
                geo: {
                  latitude: lat,
                  longitude: lng,
                  googlePlaceId: placeResult.place.placeId,
                  googleRating: placeResult.place.rating ?? null,
                  canonicalAddress: placeResult.place.address,
                },
              };
            }
          } catch {
            // Fall through to address geocoding
          }

          // Fallback: geocode the address directly
          if (item.venueAddress) {
            try {
              const [lng, lat] = await this.geocodingService.geocodeAddress(
                `${item.venueAddress}, ${city}`,
              );
              if (lat !== 0 || lng !== 0) {
                return {
                  item,
                  geo: {
                    latitude: lat,
                    longitude: lng,
                    googlePlaceId: null,
                    googleRating: null,
                    canonicalAddress: null,
                  },
                };
              }
            } catch {
              // Graceful failure
            }
          }

          console.log(
            `[SidequestPrescriptionService] Could not verify venue: "${item.venueName || item.venueAddress}" — keeping with no coordinates`,
          );
          return { item, geo: null };
        }),
      );

    return results.filter(
      (r): r is { item: LLMItem; geo: GeocodedData | null } => r !== null,
    );
  }

  private async generateEnhancements(
    sidequestId: string,
    objectives: Objective[],
  ): Promise<void> {
    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({ where: { id: sidequestId } });
    if (!sidequest) return;

    const updates: Partial<Sidequest> = {};

    // 1. Set entry point from first objective with coordinates
    const sortedObjectives = [...objectives].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const firstGeoObj = sortedObjectives.find(
      (obj) => obj.latitude != null && obj.longitude != null,
    );
    if (firstGeoObj) {
      updates.entryLatitude = firstGeoObj.latitude;
      updates.entryLongitude = firstGeoObj.longitude;
    }

    // 2. Generate embedding — weight categories and title heavily so
    //    searches like "coffee" or "longboarding" match well.
    if (this.embeddingService) {
      try {
        const categories = (sidequest.categories ?? []).join(", ");
        const title = sidequest.title || "";
        const stopsText = sortedObjectives
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}`,
          )
          .join(", ");
        const summary = sidequest.summary || "";

        // Repeat components to weight them: categories 6x, title 4x, stops 3x, summary 1x
        const parts: string[] = [];
        if (categories) parts.push(...Array(6).fill(categories));
        if (title) parts.push(...Array(4).fill(title));
        if (stopsText) parts.push(...Array(3).fill(stopsText));
        if (summary) parts.push(summary);

        const embeddingSql = await this.embeddingService.getEmbeddingSql(
          parts.join(". "),
        );
        updates.embedding = embeddingSql;
      } catch (error) {
        console.error(
          `[SidequestPrescriptionService] Error generating embedding for ${sidequestId}:`,
          error,
        );
      }
    }

    // 3. Generate category tags (skip if already populated inline)
    if (!sidequest.categories || sidequest.categories.length === 0) {
      try {
        const stopsForCategories = sortedObjectives
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}${obj.description ? ` — ${obj.description}` : ""}`,
          )
          .join("; ");

        const completion = await this.openAIService.executeChatCompletion({
          model: OpenAIModel.GPT54Nano,
          messages: [
            {
              role: "system",
              content:
                'You generate category tags for sidequests. Return a JSON object with a "tags" key containing an array of 3-5 lowercase single-word tags that describe the sidequest\'s themes. Examples: {"tags": ["outdoor", "food", "culture", "nightlife", "art"]}. Respond with ONLY the JSON object.',
            },
            {
              role: "user",
              content: `Title: ${sidequest.title || "Untitled"}\nSummary: ${sidequest.summary || "N/A"}\nStops: ${stopsForCategories}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0].message.content?.trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : parsed.tags;
            if (Array.isArray(arr)) {
              updates.categories = arr
                .filter((t: unknown) => typeof t === "string")
                .slice(0, 5)
                .map((t: string) => t.toLowerCase());
            }
          } catch {
            console.warn(
              `[SidequestPrescriptionService] Failed to parse category tags: ${raw}`,
            );
          }
        }
      } catch (error) {
        console.error(
          `[SidequestPrescriptionService] Error generating categories for ${sidequestId}:`,
          error,
        );
      }
    }

    // 4. Find entry points for trails, parks, and attractions
    const entryPointPattern =
      /trail|park|hike|hiking|nature|scenic|outdoor|attraction/i;
    const objectivesNeedingEntryPoints = sortedObjectives.filter(
      (obj) =>
        obj.latitude != null &&
        obj.longitude != null &&
        obj.venueCategory &&
        entryPointPattern.test(obj.venueCategory),
    );

    if (objectivesNeedingEntryPoints.length > 0) {
      const objectiveRepo = this.dataSource.getRepository(Objective);
      const entryPointResults = await Promise.all(
        objectivesNeedingEntryPoints.map(async (obj) => {
          try {
            const entryPoint = await this.placesService.searchEntryPoint(
              Number(obj.latitude),
              Number(obj.longitude),
              obj.venueCategory!,
            );
            return { objId: obj.id, entryPoint };
          } catch (error) {
            console.warn(
              `[SidequestPrescriptionService] Entry point search failed for "${obj.title}":`,
              error,
            );
            return { objId: obj.id, entryPoint: null };
          }
        }),
      );

      for (const { objId, entryPoint } of entryPointResults) {
        if (entryPoint) {
          await objectiveRepo.update(objId, {
            entryLatitude: entryPoint.latitude,
            entryLongitude: entryPoint.longitude,
            entryPointName: entryPoint.name,
          });
        }
      }
    }

    // Save updates
    if (Object.keys(updates).length > 0) {
      await repo.update(sidequestId, updates as Record<string, unknown>);
    }
  }

  private async countCompletedQuests(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
      [userId],
    );
    return result[0]?.count ?? 0;
  }

  private projectPoint(
    lat: number,
    lng: number,
    bearingDeg: number,
    distanceMiles: number,
  ): { lat: number; lng: number } {
    const R = 3958.8; // Earth radius in miles
    const d = distanceMiles / R;
    const brng = (bearingDeg * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );

    return {
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI,
    };
  }

  private haversineDistanceMiles(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    return haversineDistance(lat1, lon1, lat2, lon2, "miles");
  }
}
