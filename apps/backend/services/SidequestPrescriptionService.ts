import { type DataSource } from "typeorm";
import {
  Sidequest,
  Objective,
  SidequestStatus,
  User,
  normalizeCity,
} from "@realtime-markers/database";
import { haversineDistance } from "@realtime-markers/shared";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type {
  GoogleGeocodingService,
  VerifiedVenue,
} from "./shared/GoogleGeocodingService";
import type { OverpassService, Trail } from "./shared/OverpassService";
import type { IEmbeddingService } from "./shared/EmbeddingService";
import type { RedisService } from "./shared/RedisService";
import type { AgentCandidate } from "./shared/JobPipeline";
import { OpenAIResponsesAgent } from "./shared/OpenAIResponsesAgent";
import type { AgentToolResult } from "./shared/OpenAIResponsesAgent";
import type { ComfortZoneService } from "./ComfortZoneService";
import type { CoverageService } from "./CoverageService";
import type { ResonanceService } from "./ResonanceService";
import type { PathwayService } from "./PathwayService";
import type { PacingService } from "./PacingService";
import {
  createPrescriptionPromptRegistry,
  type PrescriptionPromptRegistry,
  type PrescriptionPromptContext,
} from "./prompts/PrescriptionPromptRegistry";
import { MultiAgentStrategy } from "./prescription/MultiAgentStrategy";
import type { PrescriptionStrategyInput } from "./prescription/PrescriptionStrategy";

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
  /** Override the strategy for this specific prescription */
  strategy?: "monolithic" | "multi-agent";
}

export interface SiblingContext {
  batchId: string;
  batchIndex: number;
  totalInBatch: number;
  questRole: "deepen" | "explore" | "discover" | "stretch";
  targetPathway?: { id: string; theme: string; label: string; phase: string };
  previousSiblings: { title: string; venueCategory: string; venueName: string }[];
}

export interface WeekPackResult {
  batchId: string;
  quests: Sidequest[];
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
}

interface LLMResponseRaw {
  t: string;
  s: string;
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
}

interface LLMResponse {
  title: string;
  summary: string;
  items: LLMItem[];
}

function expandLLMResponse(raw: LLMResponseRaw): LLMResponse {
  return {
    title: raw.t,
    summary: raw.s,
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
      actionability: (["actionable", "suggestive", "milestone"].includes(i.act ?? "") ? i.act : "suggestive") as LLMItem["actionability"],
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

// ─── Interface ──────────────────────────────────────────────────────

export interface SidequestPrescriptionService {
  prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
    siblingContext?: SiblingContext,
  ): Promise<Sidequest>;

  prescribeWeekPack(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
  ): Promise<WeekPackResult>;
}

// ─── Dependencies ───────────────────────────────────────────────────

interface SidequestPrescriptionServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  geocodingService: GoogleGeocodingService;
  overpassService: OverpassService;
  embeddingService?: IEmbeddingService;
  redisService?: RedisService;
  comfortZoneService: ComfortZoneService;
  coverageService?: CoverageService;
  resonanceService?: ResonanceService;
  pathwayService?: PathwayService;
  pacingService?: PacingService;
  promptRegistry?: PrescriptionPromptRegistry;
  promptVersion?: string;
  /** Model to use for quest prescription. Defaults to GPT54Mini. */
  prescriptionModel?: string;
  /** Strategy: "monolithic" (single agent) or "multi-agent" (4-agent pipeline) */
  prescriptionStrategy?: "monolithic" | "multi-agent";
}

// ─── Fear Ladder Readiness ──────────────────────────────────────────

interface FearLadderReadiness {
  /** 0-3 phase index. Derived from demonstrated comfort, not quest count. */
  phase: number;
  /** Completed quest count (used as minimum floor only) */
  completedQuests: number;
  /** Average resonance across all completed quests */
  avgResonance: number;
  /** Average resonance over last 5 quests (recency signal) */
  recentResonance: number;
  /** Average rating (1-5) across all quests */
  avgRating: number;
  /** Whether user has shown growth signals in reflections */
  hasGrowthSignals: boolean;
  /** Number of quests with positive sentiment (> 0.2) */
  positiveQuestCount: number;
  /** Average difficulty of recent quests */
  recentAvgDifficulty: number;
  /** Whether user has a DFS pathway (found something they love) */
  hasDfsPathway: boolean;
  /** Human-readable reason for the phase */
  phaseReason: string;
}

// ─── Implementation ─────────────────────────────────────────────────

class SidequestPrescriptionServiceImpl implements SidequestPrescriptionService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;
  private overpassService: OverpassService;
  private embeddingService?: IEmbeddingService;
  private redisService?: RedisService;
  private comfortZoneService: ComfortZoneService;
  private coverageService?: CoverageService;
  private resonanceService?: ResonanceService;
  private pathwayService?: PathwayService;
  private pacingService?: PacingService;
  private agent: OpenAIResponsesAgent;
  private promptRegistry: PrescriptionPromptRegistry;
  private promptVersion: string;
  private prescriptionModel?: string;
  private multiAgentStrategy?: MultiAgentStrategy;
  private defaultStrategy: "monolithic" | "multi-agent";

  constructor(deps: SidequestPrescriptionServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
    this.overpassService = deps.overpassService;
    this.embeddingService = deps.embeddingService;
    this.redisService = deps.redisService;
    this.comfortZoneService = deps.comfortZoneService;
    this.coverageService = deps.coverageService;
    this.resonanceService = deps.resonanceService;
    this.pathwayService = deps.pathwayService;
    this.pacingService = deps.pacingService;
    this.agent = new OpenAIResponsesAgent(deps.openAIService);
    this.promptRegistry = deps.promptRegistry ?? createPrescriptionPromptRegistry();
    this.promptVersion = deps.promptVersion ?? "v1-default";
    this.prescriptionModel = deps.prescriptionModel;
    this.defaultStrategy = deps.prescriptionStrategy ?? "multi-agent";

    if (this.defaultStrategy === "multi-agent" || true) {
      // Always instantiate so per-request switching works
      this.multiAgentStrategy = new MultiAgentStrategy({
        openAIService: deps.openAIService,
        agent: this.agent,
        geocodingService: deps.geocodingService,
        overpassService: deps.overpassService,
        promptRegistry: this.promptRegistry,
      });
    }
  }

  // ─── Public Method ──────────────────────────────────────────────

  async prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
    siblingContext?: SiblingContext,
  ): Promise<Sidequest> {
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
        "behavioralProfile",
        "fearLadder",
        "expectancyCalibration",
      ],
    });

    if (!user) throw new Error("User not found");

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

    // Reverse geocode for city name early — coverage expansion may override searchLat/searchLng and re-geocode
    let city = "Unknown";
    try {
      city = await this.geocodingService.reverseGeocodeCityState(searchLat, searchLng);
    } catch {
      // Fall through with Unknown
    }

    // 2. Build behavioral context from history
    const historyContext = await this.buildPrescriptionContext(
      userId,
      user.behavioralProfile ?? null,
      user.comfortProfile?.goalTags ?? [],
    );

    // 2b. Compute fear ladder readiness from actual user feedback
    const fearLadderReadiness = await this.computeFearLadderReadiness(userId);

    // 2b2. Detect recurring blockers from quest history
    const blockerContext = await this.buildBlockerContext(userId);

    // 2c. Build coverage context (Voronoi directional gaps + exploration profile)
    let coverageContext = "";
    let explorationProfileLabel = "";
    let expansionTarget = "";
    if (this.coverageService) {
      try {
        const coverage = await this.coverageService.buildLLMCoverageContext(userId);
        coverageContext = coverage.context;
        explorationProfileLabel = coverage.profile.label;

        // If there's a significant directional gap AND the user has grown enough,
        // compute a search target in that direction and shift the search location.
        // Force a fresh snapshot to avoid stale cache from early quests.
        const snapshot = await this.coverageService.recomputeSnapshot(userId);
        const completedCount = await this.countCompletedQuests(userId);
        const snapshotGaps = (snapshot.directionalGaps ?? []) as { direction: string; angleDeg: number; gapWidthDeg: number }[];
        console.log(`[prescribeQuest] Expansion check: ${completedCount} quests, radius ${radius.toFixed(1)}mi, ${snapshotGaps.length} gaps, clusters ${snapshot.clusterCount}`);
        if (snapshotGaps.length > 0) {
          console.log(`[prescribeQuest] Gaps: ${snapshotGaps.map(g => `${g.direction}(${g.gapWidthDeg.toFixed(0)}deg)`).join(", ")}`);
        }
        if (snapshotGaps.length > 0 && completedCount >= 5 && radius >= 2.5) {
          const biggestGap = [...snapshotGaps].sort((a, b) => b.gapWidthDeg - a.gapWidthDeg)[0];
          if (biggestGap.gapWidthDeg >= 45) {
            // Project a point at the edge of comfort radius in the gap direction
            const targetDistMiles = Math.max(4, radius * 0.85);
            const targetPoint = this.projectPoint(homeLat, homeLng, biggestGap.angleDeg, targetDistMiles);

            // Shift search location to the projected point
            searchLat = targetPoint.lat;
            searchLng = targetPoint.lng;

            // Re-geocode the new search location for the city name
            try {
              const targetCity = await this.geocodingService.reverseGeocodeCityState(
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

            expansionTarget = `\nEXPANSION TARGET: The user has a ${biggestGap.gapWidthDeg.toFixed(0)}-degree unexplored gap to the ${biggestGap.direction.toUpperCase()}. ` +
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
    if (this.pathwayService) {
      try {
        const phase = await this.pathwayService.getUserPhaseContext(userId);
        phaseContext = phase.recommendation;
      } catch (err) {
        console.error("[prescribeQuest] Phase context failed:", err);
      }
    }

    // 2d. Build timeline context (progressive — only injected at milestones)
    let timelineContext = "";
    if (this.pacingService) {
      try {
        timelineContext = await this.pacingService.getTimelineContext(userId) ?? "";
      } catch (err) {
        console.error("[prescribeQuest] Timeline context failed:", err);
      }
    }

    // 3. Re-geocode city if search location was shifted by expansion target
    // (city was already set above; this catches the case where it wasn't overridden in the expansion block)

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
        questRole: siblingContext.questRole,
        ...(siblingContext.targetPathway && {
          pathwayId: siblingContext.targetPathway.id,
          pathwayTheme: siblingContext.targetPathway.theme,
          pathwayLabel: siblingContext.targetPathway.label,
          pathwayPhase: siblingContext.targetPathway.phase,
        }),
      }),
    });
    await repo.save(sidequest);

    try {
      // 5. Generate via agent
      const seenVenueIds = new Set<string>();
      const seenTrailIds = new Set<number>();

      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

      const pace = user.pacePreference ?? "steady";
      const isStretch = siblingContext?.questRole === "stretch";

      // Build prompt via registry
      const promptCtx: PrescriptionPromptContext = {
        user: {
          comfortProfile: user.comfortProfile ?? null,
          onboardingProfile: user.onboardingProfile ?? null,
          pacePreference: user.pacePreference ?? null,
          fearLadder: user.fearLadder ?? null,
          expectancyCalibration: user.expectancyCalibration ?? null,
        },
        homeLat, homeLng, searchLat, searchLng, city,
        isAwayFromHome, distFromHome, radius, pace, hour, dayOfWeek,
        historyContext,
        coverageContext,
        explorationProfileLabel,
        expansionTarget,
        phaseContext,
        timelineContext,
        fearLadderContext: user.fearLadder
          ? this.buildFearLadderContext(user.fearLadder, fearLadderReadiness) : "",
        expectancyContext: user.expectancyCalibration
          ? this.buildExpectancyContext(user.expectancyCalibration) : "",
        difficultyGuidance: this.buildDifficultyGuidance(pace, fearLadderReadiness, isStretch),
        siblingInstructions: siblingContext
          ? this.buildSiblingInstructions(siblingContext) : "",
        blockerContext,
        isStretch,
        siblingContext: siblingContext ?? null,
      };

      // ── Strategy selection ──────────────────────────────────
      const useStrategy = input.strategy ?? this.defaultStrategy;

      let agentRaw: LLMResponseRaw;
      let allVenues: VerifiedVenue[];
      let allTrails: Trail[];

      if (useStrategy === "multi-agent" && this.multiAgentStrategy) {
        // Multi-agent pipeline
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

        const strategyResult = await this.multiAgentStrategy.execute(strategyInput);
        agentRaw = strategyResult.raw as unknown as LLMResponseRaw;
        allVenues = strategyResult.allVenues;
        allTrails = strategyResult.allTrails;
      } else {
      // ── Monolithic strategy (existing single-agent flow) ──
      allVenues = [];
      allTrails = [];
      const promptOutput = this.promptRegistry.build(this.promptVersion, promptCtx);
      const instructions = promptOutput.instructions;

      type Tool = import("openai/resources/responses/responses").Tool;
      const tools: Tool[] = [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            city,
            country: "US",
          },
          search_context_size: "medium",
        },
        {
          type: "function",
          name: "search_places",
          description:
            "Search Google Places for verified venues near a location. Returns name, address, coordinates, rating.",
          parameters: {
            type: "object" as const,
            properties: {
              query: {
                type: "string",
                description: "Search query (e.g. 'coffee shop', 'park', 'bookstore')",
              },
              near: {
                type: "string",
                description: "City/town to search near",
              },
            },
            required: ["query", "near"],
          },
          strict: false,
        },
        {
          type: "function",
          name: "search_trails",
          description:
            "Search for trails/paths near coordinates. Returns name, surface type, length, lighting.",
          parameters: {
            type: "object" as const,
            properties: {
              type: {
                type: "string",
                enum: ["paved", "hiking"],
                description: "Trail type",
              },
              lat: { type: "number", description: "Latitude" },
              lng: { type: "number", description: "Longitude" },
              radius_miles: {
                type: "number",
                description: "Search radius in miles (default 10)",
              },
            },
            required: ["type", "lat", "lng"],
          },
          strict: false,
        },
        {
          type: "function",
          name: "submit_quest",
          description: "Submit the final prescribed quest with exactly 1 stop.",
          parameters: {
            type: "object" as const,
            properties: {
              t: { type: "string", description: "Quest title (3-6 words)" },
              s: {
                type: "string",
                description: "Quest summary (1-2 sentences, frame why this matters)",
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    t: { type: "string", description: "Stop title" },
                    d: { type: "string", description: "2-3 sentences max. What to do at this stop — concrete and direct. Do NOT embed URLs or phone numbers here — those go in 'ai' (action items)." },
                    e: { type: "string", description: "Emoji" },
                    ec: {
                      type: ["number", "null"],
                      description: "Estimated cost",
                    },
                    vn: { type: "string", description: "Venue name (exact)" },
                    va: { type: "string", description: "Venue address (exact)" },
                    vc: {
                      type: "string",
                      description:
                        "Venue category — use a specific, descriptive label (e.g. coffee_shop, hiking_trail, brewery, dance_studio, game_cafe, makerspace, climbing_gym, cooking_class, book_club, open_mic, farmers_market, coworking_space, dog_park, pottery_studio, etc). Be specific — 'dance_studio' not 'venue', 'game_cafe' not 'other'.",
                    },
                    hook: {
                      type: "string",
                      description: "Why this spot expands their world",
                    },
                    sa: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "2-3 emoji-prefixed activity ideas — what people typically do here. General suggestions, NO URLs or phone numbers. Examples: '🚶 Walk the loop', '📸 Snap a photo of the view'.",
                    },
                    ai: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "1-3 concrete next steps with links, phone numbers, or specific instructions. Examples: '🔗 longmontcolorado.gov/rec-services — sign up', '📞 (303) 774-4800 — ask about beginner classes'. Empty array if no actionable info exists.",
                    },
                    jp: {
                      type: "string",
                      description:
                        "Journal prompt — reflective question for after the visit",
                    },
                    df: {
                      type: "number",
                      description:
                        "Difficulty 1-10. 1=trivially easy, 3=comfortable, 5=moderate stretch, 7=significant challenge, 10=maximum push",
                    },
                    act: {
                      type: "string",
                      enum: ["actionable", "suggestive", "milestone"],
                      description:
                        "actionable = concrete next steps with signup links/times/instructions, suggestive = go explore this place, milestone = reflection checkpoint on progress",
                    },
                  },
                  required: ["t", "d", "e", "ec", "vn", "va", "vc", "hook", "sa", "ai", "jp", "df", "act"],
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

      // Tool handlers (reuse same patterns as generateSingleOption)
      const toolHandlers: Record<
        string,
        (args: Record<string, unknown>) => Promise<AgentToolResult>
      > = {
        search_places: async (args) => {
          const query = args.query as string;
          const near = args.near as string;
          try {
            const venues =
              await this.geocodingService.searchPlacesByCategory(
                query,
                near,
                undefined,
                5,
              );

            for (const v of venues) {
              if (!seenVenueIds.has(v.placeId)) {
                seenVenueIds.add(v.placeId);
                allVenues.push(v);
              }
            }

            const resultText =
              venues.length > 0
                ? venues
                    .map((v) => {
                      const [lng, lat] = v.coordinates;
                      return `- ${v.name} (${v.address}) [${lat.toFixed(4)},${lng.toFixed(4)}]${v.rating ? ` ★${v.rating}` : ""}`;
                    })
                    .join("\n")
                : "No results found for this search.";

            if (onProgress && venues.length > 0) {
              await onProgress(
                40,
                `Found ${venues.length} spots for "${query}"`,
                venues.map((v) => ({
                  name: v.name,
                  coordinates: v.coordinates,
                  type: "venue" as const,
                  rating: v.rating,
                  query,
                })),
              );
            }

            return { output: resultText };
          } catch (err) {
            return {
              output: `Search failed: ${err instanceof Error ? err.message : "unknown error"}`,
            };
          }
        },

        search_trails: async (args) => {
          const trailType = (args.type as string) || "paved";
          const trailSearchLat = args.lat as number;
          const trailSearchLng = args.lng as number;
          const searchRadiusMiles = (args.radius_miles as number) || 10;
          const searchRadiusMeters = searchRadiusMiles * 1609.34;

          try {
            const foundTrails =
              trailType === "hiking"
                ? await this.overpassService.fetchHikingTrails(
                    trailSearchLat,
                    trailSearchLng,
                    searchRadiusMeters,
                    10,
                  )
                : await this.overpassService.fetchPavedTrails(
                    trailSearchLat,
                    trailSearchLng,
                    searchRadiusMeters,
                    10,
                  );

            for (const t of foundTrails) {
              if (!seenTrailIds.has(t.id)) {
                seenTrailIds.add(t.id);
                allTrails.push(t);
              }
            }

            const resultText =
              foundTrails.length > 0
                ? foundTrails
                    .map((t) => {
                      const [tLng, tLat] = t.center;
                      const dist = this.haversineDistanceMiles(
                        trailSearchLat,
                        trailSearchLng,
                        tLat,
                        tLng,
                      );
                      return `- ${t.name} (${t.surface}, ${(t.lengthMeters / 1000).toFixed(1)}km${t.lit ? ", lit" : ""}) [${tLat.toFixed(4)},${tLng.toFixed(4)}] ~${dist.toFixed(1)}mi away`;
                    })
                    .join("\n")
                : `No ${trailType} trails found in this area.`;

            if (onProgress && foundTrails.length > 0) {
              await onProgress(
                40,
                `Discovered ${foundTrails.length} ${trailType} trails nearby`,
                foundTrails.map((t) => {
                  const [tLng, tLat] = t.center;
                  return {
                    name: t.name,
                    coordinates: t.center as [number, number],
                    type: "trail" as const,
                    distanceMiles: this.haversineDistanceMiles(
                      trailSearchLat,
                      trailSearchLng,
                      tLat,
                      tLng,
                    ),
                    query: `${trailType} trails`,
                  };
                }),
              );
            }

            return { output: resultText };
          } catch (err) {
            return {
              output: `Trail search failed: ${err instanceof Error ? err.message : "unknown error"}`,
            };
          }
        },

        submit_quest: async (args) => {
          const questData = args as unknown as LLMResponseRaw;

          // Enforce single stop
          if (questData.items && questData.items.length > 1) {
            questData.items = questData.items.slice(0, 1);
          }

          // Validate trail stops
          const trailItems = (questData.items || []).filter(
            (item) => item.vc && /trail|hike|hiking/i.test(item.vc),
          );
          for (const item of trailItems) {
            const itemName = (item.vn || "").toLowerCase().trim();
            const matched = allTrails.some((t) => {
              const trailName = t.name.toLowerCase().trim();
              return (
                trailName === itemName ||
                trailName.includes(itemName) ||
                itemName.includes(trailName)
              );
            });

            if (!matched && allTrails.length > 0) {
              const availableTrails = allTrails
                .slice(0, 5)
                .map((t) => t.name)
                .join(", ");
              return {
                output: "",
                rejection: `REJECTED: Trail "${item.vn}" was not found in your search_trails results. Available trails: ${availableTrails}. Call submit_quest again with a trail from that list.`,
              };
            }
          }

          return { output: "Quest accepted", terminal: true };
        },
      };

      const initialMessage = promptOutput.initialMessage;

      if (onProgress) {
        await onProgress(10, "Analyzing your comfort zone...");
      }

      const agentResult = await this.agent.run<LLMResponseRaw>(
        {
          instructions,
          tools,
          toolHandlers,
          maxRounds: 8,
          temperature: 0.8,
          maxOutputTokens: 2500,
          caller: "prescribe_quest",
          ...((input.model || this.prescriptionModel) && { model: (input.model || this.prescriptionModel) as OpenAIModel }),
        },
        initialMessage,
      );

      if (onProgress) {
        await onProgress(80, "Building your quest...");
      }

      agentRaw = agentResult.result;
      } // end monolithic else

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
      if (
        distanceFromHome != null &&
        primaryItem?.item.venueCategory
      ) {
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
        }),
      );
      await objectiveRepo.save(objectives);

      // Update sidequest with results
      sidequest.title = llmResult.title;
      sidequest.summary = llmResult.summary;
      sidequest.status = SidequestStatus.READY;
      // Rarity stays null until "Seal Memory" (promote) — computed from resonance + reflection tags
      sidequest.distanceFromHome = distanceFromHome;

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
      console.error("[SidequestPrescriptionService] Prescription failed:", error);
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
          if (item.venueCategory && /trail|hike|hiking/i.test(item.venueCategory) && item.venueName) {
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
                if (venueName.includes(itemNameLower) || itemNameLower.includes(venueName)) {
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
            const placeResult =
              await this.geocodingService.searchPlaceForFrontend(
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

        const embeddingSql =
          await this.embeddingService.getEmbeddingSql(parts.join(". "));
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
    const entryPointPattern = /trail|park|hike|hiking|nature|scenic|outdoor|attraction/i;
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
            const entryPoint =
              await this.geocodingService.searchEntryPoint(
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
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
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

  /**
   * Build context string for the prescription agent based on user's quest history.
   * Uses cached behavioral profile when available, falls back to raw queries.
   */
  private async buildPrescriptionContext(
    userId: string,
    behavioralProfile: { summary: string; generatedAt: string; questCount: number } | null,
    goalTags: string[] = [],
  ): Promise<string> {
    // Always fetch last 3 quests for recency (avoids immediate repeats)
    const recentQuests: {
      title: string;
      venue_category: string;
      distance_from_home: number;
    }[] = await this.dataSource.query(
      `
      SELECT
        s.title,
        o.venue_category,
        s.distance_from_home
      FROM sidequests s
      LEFT JOIN objectives o ON o.sidequest_id = s.id
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
      LIMIT 3
      `,
      [userId],
    );

    // Always fetch category breakdown for diversity enforcement
    const categories: { venue_category: string; count: number }[] =
      await this.dataSource.query(
        `
      SELECT o.venue_category, COUNT(*)::int as count
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND o.checked_in_at IS NOT NULL
        AND o.venue_category IS NOT NULL
      GROUP BY o.venue_category
      ORDER BY count DESC
      `,
        [userId],
      );

    const categoryDiversityBlock = this.buildCategoryDiversityBlock(categories);

    // Pending/prescribed-but-not-completed venues — hard blocklist to prevent back-to-back repeats
    const pendingVenues: { venue_name: string; venue_category: string }[] =
      await this.dataSource.query(
        `SELECT DISTINCT o.venue_name, o.venue_category
         FROM sidequests s
         JOIN objectives o ON o.sidequest_id = s.id
         WHERE s.user_id = $1
           AND s.deleted_at IS NULL
           AND s.completed_at IS NULL
           AND o.venue_name IS NOT NULL
         ORDER BY o.venue_name
         LIMIT 15`,
        [userId],
      );

    // Count completed quests for milestone detection
    const completedCountResult: { count: number }[] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
      [userId],
    );
    const completedQuestCount = completedCountResult[0]?.count ?? 0;

    // Venue-level repeat intelligence
    const venueRepeats: { venue_name: string; visit_count: number; avg_rating: number; venue_category: string }[] =
      await this.dataSource.query(
        `SELECT
           o.venue_name,
           COUNT(*)::int AS visit_count,
           ROUND(AVG(s.rating)::numeric, 1)::float AS avg_rating,
           o.venue_category
         FROM objectives o
         JOIN sidequests s ON s.id = o.sidequest_id
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND o.venue_name IS NOT NULL
         GROUP BY o.venue_name, o.venue_category
         HAVING COUNT(*) >= 2
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [userId],
      );
    const venueBlock = this.buildVenueRepeatBlock(venueRepeats);

    // City visit counts for diminishing returns
    const cityVisits: { city: string; count: number }[] =
      await this.dataSource.query(
        `SELECT s.city, COUNT(*)::int as count
         FROM sidequests s
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND s.city IS NOT NULL
         GROUP BY s.city
         ORDER BY count DESC`,
        [userId],
      );
    const cityBlock = this.buildCityDiminishingBlock(cityVisits);

    // Quest arc narrative
    const arcNarrative = await this.buildArcNarrative(userId);

    // Pending venues blocklist
    const pendingBlock = pendingVenues.length > 0
      ? `\nDO NOT PRESCRIBE THESE VENUES (already in the user's queue — not yet visited):\n${pendingVenues.map((v) => `- "${v.venue_name}" (${v.venue_category})`).join("\n")}\n`
      : "";

    // Milestone injection
    const milestoneQuests = [5, 10, 15, 20, 25, 30, 40, 50];
    const isMilestone = milestoneQuests.includes(completedQuestCount);
    const milestoneBlock = isMilestone
      ? `\n🎯 MILESTONE CHECK: The user has completed ${completedQuestCount} quests. This quest SHOULD be a "milestone" — a reflection checkpoint. Pick a comfortable, familiar-category venue and frame the quest around reflecting on their journey so far. The journal prompt should ask them to look back on what's changed since they started. Set actionability to "milestone".\n`
      : "";

    // If we have a cached behavioral profile, use it
    if (behavioralProfile && behavioralProfile.questCount > 0) {
      const recentList = recentQuests
        .map(
          (q) =>
            `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
        )
        .join("\n");

      return `BEHAVIORAL PROFILE (based on ${behavioralProfile.questCount} quests, updated ${behavioralProfile.generatedAt}):
${behavioralProfile.summary}
${arcNarrative ? `\nJOURNEY ARC: ${arcNarrative}` : ""}

MOST RECENT QUESTS (avoid repeating these):
${recentList || "(none)"}
${pendingBlock}
${categoryDiversityBlock}
${venueBlock}
${cityBlock}
${milestoneBlock}
${await this.buildSocialContext(userId, goalTags)}`;
    }

    // Fallback for new users or pre-migration users: raw query approach
    if (recentQuests.length === 0) {
      return `HISTORY: This is a new user — no completed quests yet. Start gentle and close to home.${pendingBlock}`;
    }

    const recentList = recentQuests
      .map(
        (q) =>
          `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
      )
      .join("\n");

    return `HISTORY (last ${recentQuests.length} quests):
${recentList}
${arcNarrative ? `\nJOURNEY ARC: ${arcNarrative}` : ""}
${pendingBlock}
${categoryDiversityBlock}
${venueBlock}
${cityBlock}
${milestoneBlock}
PRESCRIPTION STRATEGY: Look at their history and prescribe something that meaningfully expands — a new category, a further distance, or an area of town they haven't explored.

${await this.buildSocialContext(userId, goalTags)}`;
  }

  private async buildSocialContext(userId: string, goalTags: string[] = []): Promise<string> {
    const wantsSocial = goalTags.includes("socialize");
    const wantsSkill = goalTags.includes("new_skill");
    const wantsFitness = goalTags.includes("fitness");

    const socialCounts: { social_context: string; count: number }[] =
      await this.dataSource.query(
        `
        SELECT o.social_context, COUNT(*)::int as count
        FROM objectives o
        JOIN sidequests s ON s.id = o.sidequest_id
        WHERE s.user_id = $1
          AND o.checked_in_at IS NOT NULL
          AND o.social_context IS NOT NULL
        GROUP BY o.social_context
        ORDER BY count DESC
        `,
        [userId],
      );

    // No social data yet — only give goal-based guidance
    if (socialCounts.length === 0) {
      if (!wantsSocial && !wantsSkill && !wantsFitness) return "";
      const lines: string[] = [];
      if (wantsSocial) lines.push("SOCIAL GOAL: This user wants to meet people. As they build consistency, start weaving in venues with natural social opportunities (busy cafes, farmer's markets, community events). Don't push group activities until they have a few completions under their belt.");
      if (wantsSkill) lines.push("SKILL GOAL: This user wants to pick up a new skill. When they're ready, consider workshops, classes, or maker spaces — but start with low-commitment options (drop-in, free, no signup).");
      if (wantsFitness) lines.push("FITNESS GOAL: This user wants to get active. Trails and parks are a natural start. As they build the habit, consider group fitness (run clubs, outdoor yoga, climbing gyms).");
      return lines.join("\n");
    }

    const total = socialCounts.reduce((sum, c) => sum + c.count, 0);
    const breakdown = socialCounts
      .map((c) => `${c.social_context}: ${c.count}`)
      .join(", ");

    const soloCount = socialCounts.find((c) => c.social_context === "solo")?.count ?? 0;
    const groupCount = socialCounts.find((c) => c.social_context === "group_activity")?.count ?? 0;
    const metNewCount = socialCounts.find((c) => c.social_context === "met_someone_new")?.count ?? 0;
    const withSomeoneCount = socialCounts.find((c) => c.social_context === "with_someone")?.count ?? 0;
    const socialCount = groupCount + metNewCount + withSomeoneCount;

    const lines: string[] = [`SOCIAL PATTERN (${total} check-ins with social data): ${breakdown}`];

    if (total >= 3 && socialCount === 0 && wantsSocial) {
      lines.push("This user wants to meet people but goes solo every time. Prescribe venues with natural social opportunities (busy cafes, farmer's markets, group fitness classes, community events). Don't force it — just create the conditions.");
    } else if (total >= 5 && groupCount === 0 && soloCount > socialCount && (wantsSocial || wantsSkill || wantsFitness)) {
      lines.push("This user mostly goes solo with occasional company. They haven't tried a group activity yet. If they seem ready (consistent habit, comfortable with the area), a low-pressure group option could be a meaningful stretch — a free outdoor yoga class, a run club, trivia night as a spectator.");
    } else if (groupCount >= 2 || metNewCount >= 2) {
      lines.push("This user is socially active — they've done group activities or met new people. They're comfortable in social settings. Consider prescribing experiences that deepen community connection: recurring events, classes, or spots where they'd become a regular.");
    }

    return lines.join("\n");
  }

  /**
   * Detect recurring blockers by analyzing recent quest history.
   * Looks at action items vs completed activity + journal entries
   * to find patterns where the user consistently avoids or struggles
   * with a specific type of action.
   */
  private async buildBlockerContext(userId: string): Promise<string> {
    const completedCount = await this.countCompletedQuests(userId);
    if (completedCount < 5) return "";

    // Fetch recent completed quests with objective details
    const recentObjectives: {
      quest_title: string;
      action_items: string[];
      suggested_activities: string[];
      completed_activity: string | null;
      journal_entry: string | null;
      rating: number | null;
      rating_comment: string | null;
      difficulty: number | null;
      venue_category: string | null;
    }[] = await this.dataSource.query(
      `SELECT
         s.title AS quest_title,
         o.action_items,
         o.suggested_activities,
         o.completed_activity,
         o.journal_entry,
         s.rating,
         s.rating_comment,
         o.difficulty,
         o.venue_category
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
       ORDER BY s.completed_at DESC
       LIMIT 15`,
      [userId],
    );

    // Need at least a few quests with journal or activity data to analyze
    const withSignal = recentObjectives.filter(
      (o) => o.journal_entry || o.completed_activity || o.rating_comment,
    );
    if (withSignal.length < 3) return "";

    // Build compact summaries for LLM analysis
    const questSummaries = recentObjectives
      .map((obj, i) => {
        const parts: string[] = [`Quest ${i + 1}: "${obj.quest_title}" (${obj.venue_category ?? "unknown"})`];
        if (obj.action_items?.length)
          parts.push(`  Prescribed actions: ${obj.action_items.join("; ")}`);
        if (obj.suggested_activities?.length)
          parts.push(`  Suggested activities: ${obj.suggested_activities.join("; ")}`);
        parts.push(`  What they did: ${obj.completed_activity ? `"${obj.completed_activity}"` : "(nothing reported)"}`);
        if (obj.journal_entry)
          parts.push(`  Journal: "${obj.journal_entry}"`);
        if (obj.rating_comment)
          parts.push(`  Rating comment: "${obj.rating_comment}"`);
        if (obj.rating != null)
          parts.push(`  Rating: ${obj.rating}/5`);
        return parts.join("\n");
      })
      .join("\n\n");

    try {
      const response = await this.openAIService.executeChatCompletion(
        {
          model: OpenAIModel.GPT54Mini,
          messages: [
            {
              role: "system",
              content: `You analyze a user's quest history to detect recurring blockers and assess their current recovery phase.

STEP 1 — DETECT BLOCKER:
Look for a specific action the user consistently avoids, fails at, or expresses anxiety about across 2-3+ quests. Look at:
- Actions prescribed but not completed
- Journal entries mentioning the same fear/avoidance repeatedly
- Low ratings on quests requiring a specific action type
A single bad experience is NOT a blocker — the pattern must repeat.

STEP 2 — ASSESS PHASE (if blocker detected):
Look at the MOST RECENT 3-4 quests (listed first) and determine the user's current state:
- "avoid": The last 2-3 quests still show blocker failures (low ratings, avoidance journals). The user needs a full break from the blocked action.
- "building": The last 2-3 quests show improvement — better ratings, positive journals, successful completions on NON-blocker quests. The user is rebuilding confidence but isn't ready for the blocked action yet.
- "reintroduce": The user has had 3+ recent successful quests with good ratings (3+). They're showing confidence and readiness. It's time to GENTLY reintroduce the blocked action as OPTIONAL, not required.

Respond with JSON:
If blocker found: {"detected":true,"blockerType":"<short label>","evidence":"<2-3 sentences>","severity":"mild|moderate|strong","phase":"avoid|building|reintroduce","phaseReason":"<1 sentence explaining why this phase>","suggestedProgression":"<3-4 step micro-progression>"}
If no blocker: {"detected":false}`,
            },
            {
              role: "user",
              content: `Here are this user's recent completed quests (most recent first). Is there a recurring blocker, and if so, what phase are they in?\n\n${questSummaries}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_completion_tokens: 500,
        },
        "blocker_detection",
      );

      const text = response.choices[0]?.message?.content?.trim() ?? "{}";
      const result = JSON.parse(text);
      if (!result.detected) return "";

      const phase: string = result.phase ?? "avoid";

      console.log(
        `[prescribeQuest] Blocker detected: "${result.blockerType}" (${result.severity}, phase=${phase}) — ${result.evidence}`,
      );

      if (phase === "reintroduce") {
        return `\nRECURRING BLOCKER — READY TO REINTRODUCE: ${result.blockerType.toUpperCase()}
${result.evidence}
Phase: REINTRODUCE — ${result.phaseReason ?? "User has shown consistent recent improvement."}

The user previously struggled with "${result.blockerType}" but has been building confidence through recent successes. They're ready for a gentle reintroduction.

REINTRODUCTION RULES:
- Prescribe a quest where "${result.blockerType}" is OPTIONAL and NATURAL, not the primary objective.
- Frame the quest around an enjoyable activity. The blocked action should be a "nice to have" bonus, not the goal.
- Use soft language: "if it feels right", "you might", "no pressure to" — NOT "introduce yourself" or "talk to someone."
- Difficulty should stay moderate (3-5). Don't spike it.
- If the user succeeds, great. If not, it's still a good quest without the blocked action.\n`;
      }

      if (phase === "building") {
        return `\nRECURRING BLOCKER — BUILDING CONFIDENCE: ${result.blockerType.toUpperCase()}
${result.evidence}
Phase: BUILDING — ${result.phaseReason ?? "User is showing improvement on recent quests."}

The user has a blocker around "${result.blockerType}" but is showing recent progress. Keep prescribing experiences where they can succeed WITHOUT the blocked action. Don't reintroduce it yet — let the momentum build for 1-2 more quests.

PRESCRIPTION RULES:
- Focus on activities where the user can participate fully without "${result.blockerType}".
- Solo activities, structured classes, hands-on workshops, and observation-based quests are ideal.
- Social interaction may happen naturally — that's fine — but it must NOT be prescribed as an objective.
- Keep difficulty low-moderate (2-4). The goal is continued easy wins.\n`;
      }

      // Default: "avoid" phase
      return `\nRECURRING BLOCKER — ACTIVE AVOIDANCE: ${result.blockerType.toUpperCase()}
${result.evidence}
Phase: AVOID — ${result.phaseReason ?? "User is still in active failure mode."}

THIS USER KEEPS FAILING AT "${result.blockerType}". Prescribing it again will produce another 1-star failure.

PRESCRIPTION RULES:
1. DO NOT make "${result.blockerType}" a quest objective, action item, or suggested activity.
2. Prescribe experiences where the user can succeed WITHOUT the blocked action — solo activities, observation, skill-building, or structured environments.
3. Keep difficulty low (1-3). The goal is EASY WINS to rebuild confidence.

MICRO-PROGRESSION (follow this arc over the next several quests):
${result.suggestedProgression}\n`;
    } catch (err) {
      console.error("[prescribeQuest] Blocker detection failed:", err);
      return "";
    }
  }

  private async buildArcNarrative(userId: string): Promise<string> {
    // Get journey milestones
    const milestones: {
      total: number;
      first_category: string | null;
      first_city: string | null;
      latest_category: string | null;
      latest_city: string | null;
      unique_cities: number;
      unique_categories: number;
      first_social: string | null;
      latest_social: string | null;
    }[] = await this.dataSource.query(
      `WITH ordered AS (
        SELECT
          o.venue_category,
          s.city,
          o.social_context,
          s.completed_at,
          ROW_NUMBER() OVER (ORDER BY s.completed_at ASC) as rn_asc,
          ROW_NUMBER() OVER (ORDER BY s.completed_at DESC) as rn_desc
        FROM sidequests s
        JOIN objectives o ON o.sidequest_id = s.id
        WHERE s.user_id = $1 AND s.completed_at IS NOT NULL AND s.deleted_at IS NULL
      )
      SELECT
        (SELECT COUNT(*) FROM ordered) as total,
        (SELECT venue_category FROM ordered WHERE rn_asc = 1) as first_category,
        (SELECT city FROM ordered WHERE rn_asc = 1) as first_city,
        (SELECT venue_category FROM ordered WHERE rn_desc = 1) as latest_category,
        (SELECT city FROM ordered WHERE rn_desc = 1) as latest_city,
        (SELECT COUNT(DISTINCT city) FROM ordered) as unique_cities,
        (SELECT COUNT(DISTINCT venue_category) FROM ordered WHERE venue_category IS NOT NULL) as unique_categories,
        (SELECT social_context FROM ordered WHERE social_context IS NOT NULL ORDER BY rn_asc LIMIT 1) as first_social,
        (SELECT social_context FROM ordered WHERE social_context IS NOT NULL ORDER BY rn_desc LIMIT 1) as latest_social`,
      [userId],
    );

    const m = milestones[0];
    if (!m || m.total < 3) return "";

    const parts: string[] = [];

    // Opening: where they started
    parts.push(`This user started with ${m.first_category ?? "a"} quest in ${m.first_city ?? "their hometown"}`);

    // Social arc
    if (m.first_social && m.latest_social && m.first_social !== m.latest_social) {
      const socialLabels: Record<string, string> = {
        solo: "going solo",
        with_someone: "bringing someone along",
        met_someone_new: "meeting new people",
        group_activity: "doing group activities",
      };
      parts.push(
        `went from ${socialLabels[m.first_social] ?? m.first_social} to ${socialLabels[m.latest_social] ?? m.latest_social}`,
      );
    }

    // Expansion
    if (Number(m.unique_cities) > 1) {
      parts.push(`has explored ${m.unique_cities} cities and ${m.unique_categories} categories`);
    } else {
      parts.push(`has tried ${m.unique_categories} different categories`);
    }

    // Current
    parts.push(`and most recently visited a ${m.latest_category ?? "venue"} in ${m.latest_city ?? "their area"}`);

    // North star
    const userRow = await this.dataSource.query(
      `SELECT comfort_profile FROM users WHERE id = $1`,
      [userId],
    );
    const northStar = userRow[0]?.comfort_profile?.northStar;
    if (northStar) {
      parts.push(`Their north star: "${northStar}"`);
    }

    return parts.join(", ") + ". Frame this quest as the next chapter in their story.";
  }

  private buildCategoryDiversityBlock(
    categories: { venue_category: string; count: number }[],
  ): string {
    if (categories.length === 0) return "";

    const total = categories.reduce((sum, c) => sum + c.count, 0);
    const categoryList = categories
      .map((c) => `${c.venue_category}: ${c.count}`)
      .join(", ");

    const lines: string[] = [`CATEGORY BREAKDOWN (${total} completed): ${categoryList}`];

    const top = categories[0];
    const topPct = Math.round((top.count / total) * 100);

    // Hard block if one category dominates — kicks in early
    if (top.count >= 2 && topPct >= 40) {
      lines.push(
        `⚠️ CATEGORY OVERLOAD: "${top.venue_category}" accounts for ${topPct}% of all quests (${top.count}/${total}). ` +
        `DO NOT prescribe "${top.venue_category}" this time. Choose a DIFFERENT category. ` +
        `Search for: trail, park, museum, gallery, market, venue, fitness, restaurant, bar — anything they haven't tried or have tried less.`,
      );
    } else if (top.count >= 2 && topPct >= 30) {
      lines.push(
        `NOTE: "${top.venue_category}" is becoming dominant (${top.count}/${total}). Strongly prefer a different category this time.`,
      );
    }

    // Suggest untried categories
    const tried = new Set(categories.map((c) => c.venue_category));
    if (tried.size < 6) {
      lines.push(`Only ${tried.size} category types explored so far. Prioritize trying a completely new type of venue or activity they haven't done before.`);
    }

    return lines.join("\n");
  }

  private buildCityDiminishingBlock(
    cities: { city: string; count: number }[],
  ): string {
    if (cities.length === 0) return "";

    const total = cities.reduce((sum, c) => sum + c.count, 0);
    if (total < 5) return ""; // Too early to enforce

    const lines: string[] = [];
    const topCity = cities[0];
    const topPct = Math.round((topCity.count / total) * 100);

    const cityList = cities.map((c) => `${c.city}: ${c.count}`).join(", ");
    lines.push(`CITY VISITS (${total} total): ${cityList}`);

    if (topCity.count >= 5 && topPct >= 40) {
      const underexplored = cities.filter((c) => c.count <= 2).map((c) => c.city);
      lines.push(
        `"${topCity.city}" has ${topPct}% of all quests (${topCity.count}/${total}). ` +
        `Prioritize venues in other cities to spread exploration.` +
        (underexplored.length > 0 ? ` Underexplored: ${underexplored.join(", ")}.` : ""),
      );
    }

    return lines.join("\n");
  }

  private buildVenueRepeatBlock(
    venues: { venue_name: string; visit_count: number; avg_rating: number; venue_category: string }[],
  ): string {
    if (venues.length === 0) return "";

    const lines: string[] = ["VENUE REPEATS:"];

    for (const v of venues) {
      const isHighResonance = v.avg_rating >= 4;
      const isLowResonance = v.avg_rating < 3;

      if (v.visit_count >= 3 && isLowResonance) {
        // Lazy repeat — hard block
        lines.push(
          `⚠️ "${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `DO NOT send them here again. Find somewhere new.`,
        );
      } else if (v.visit_count >= 4) {
        // Too many visits regardless of rating — hard block to force exploration
        lines.push(
          `⚠️ "${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits. ` +
          `DO NOT prescribe this venue — they need to explore new places, not revisit the same ones. Find a different venue.`,
        );
      } else if (v.visit_count >= 2 && !isHighResonance) {
        // Mediocre repeat — discourage
        lines.push(
          `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `Becoming repetitive. Prefer a different venue this time.`,
        );
      } else if (v.visit_count >= 3 && isHighResonance) {
        // Genuine anchor — allow but throttle
        lines.push(
          `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `This is a valued spot, but alternate with new venues to keep expanding.`,
        );
      }
    }

    return lines.length > 1 ? lines.join("\n") : "";
  }

  // ─── Fear Ladder Readiness (resonance-driven) ──────────────────

  private async computeFearLadderReadiness(userId: string): Promise<FearLadderReadiness> {
    // Single query: get completed quests with their objective data
    const rows: {
      rating: number | null;
      difficulty: number | null;
      reflection_sentiment: number | null;
      reflection_tags: string[] | null;
      completed_at: Date;
    }[] = await this.dataSource.query(`
      SELECT
        s.rating,
        o.difficulty,
        o.reflection_sentiment,
        o.reflection_tags,
        s.completed_at
      FROM sidequests s
      JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
    `, [userId]);

    const completedQuests = rows.length;

    if (completedQuests === 0) {
      return {
        phase: 0, completedQuests: 0, avgResonance: 0, recentResonance: 0,
        avgRating: 0, hasGrowthSignals: false, positiveQuestCount: 0,
        recentAvgDifficulty: 0, hasDfsPathway: false,
        phaseReason: "No quests completed yet — starting gentle",
      };
    }

    // Compute signals
    const ratings = rows.filter(r => r.rating != null).map(r => r.rating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    const difficulties = rows.filter(r => r.difficulty != null).map(r => r.difficulty!);
    const recentDifficulties = difficulties.slice(0, 5);
    const recentAvgDifficulty = recentDifficulties.length > 0
      ? recentDifficulties.reduce((a, b) => a + b, 0) / recentDifficulties.length : 1;

    const positiveQuestCount = rows.filter(r =>
      r.reflection_sentiment != null && r.reflection_sentiment > 0.2
    ).length;

    const growthTags = new Set(["growth_narrative", "discomfort_processed", "social_connection", "self_awareness"]);
    const hasGrowthSignals = rows.some(r =>
      r.reflection_tags?.some(tag => growthTags.has(tag))
    );

    // Check for DFS pathways
    const dfsCount: { count: number }[] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM pathways WHERE user_id = $1 AND phase = 'dfs'`,
      [userId],
    );
    const hasDfsPathway = (dfsCount[0]?.count ?? 0) > 0;

    // Get resonance scores from pathways
    const pathwayRows: { resonance_scores: { score: number }[] }[] = await this.dataSource.query(
      `SELECT resonance_scores FROM pathways WHERE user_id = $1 AND resonance_scores IS NOT NULL`,
      [userId],
    );
    const allResonanceScores = pathwayRows.flatMap(p => (p.resonance_scores ?? []).map(r => r.score));
    const avgResonance = allResonanceScores.length > 0
      ? allResonanceScores.reduce((a, b) => a + b, 0) / allResonanceScores.length : 0;
    const recentScores = allResonanceScores.slice(0, 5);
    const recentResonance = recentScores.length > 0
      ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;

    // ── Phase determination (resonance-driven with persistence as a signal) ──
    //
    // Three paths to phase advancement — user can advance via ANY of these:
    //   A) Strong feedback: high ratings + resonance (they love it)
    //   B) Growth signals: reflection tags show self-awareness, growth narratives
    //   C) Persistence: they keep showing up consistently, even at moderate ratings
    //      Showing up 8+ times at 3 stars IS progress — they're building the habit.
    //
    // Phase 0 → 1: ≥3 quests AND (avg rating ≥ 3 OR avg resonance ≥ 0.4)
    //              Signal: "they're going out and not hating it"
    //
    // Phase 1 → 2: ANY of:
    //   - Growth signals in reflections (any quest)
    //   - Avg rating ≥ 3.5 with ≥5 quests
    //   - Persistence: ≥8 quests with avg rating ≥ 2.5 (kept showing up)
    //   Signal: "they're either growing, thriving, or building the habit"
    //
    // Phase 2 → 3: ANY of:
    //   - Has DFS pathway (found something they deeply resonate with)
    //   - Recent resonance ≥ 0.55 AND avg rating ≥ 3.5
    //   - Persistence: ≥15 quests with avg rating ≥ 3 (long-term commitment)
    //   Signal: "they've earned the full menu"

    let phase = 0;
    let phaseReason = "Early days — building the habit of going out";

    // Phase 0 → 1: low bar — they're going out and it's OK
    if (completedQuests >= 3 && (avgRating >= 3 || avgResonance >= 0.4)) {
      phase = 1;
      phaseReason = `Going out and responding OK (${completedQuests} quests, avg rating ${avgRating.toFixed(1)}) — ready for gentle stretches`;
    }

    // Phase 1 → 2: growth OR persistence
    if (phase >= 1) {
      if (hasGrowthSignals) {
        phase = 2;
        phaseReason = `Showing growth signals in reflections — ready for real challenges`;
      } else if (completedQuests >= 5 && avgRating >= 3.5) {
        phase = 2;
        phaseReason = `Consistently positive (avg rating ${avgRating.toFixed(1)} across ${completedQuests} quests) — opening up`;
      } else if (completedQuests >= 8 && avgRating >= 2.5) {
        phase = 2;
        phaseReason = `Persistent — ${completedQuests} quests completed. Showing up consistently is growth. Time to stretch`;
      }
    }

    // Phase 2 → 3: deep engagement OR long-term commitment
    if (phase >= 2) {
      if (hasDfsPathway) {
        phase = 3;
        phaseReason = "Found a deep passion pathway — fully open to growth";
      } else if (recentResonance >= 0.55 && avgRating >= 3.5) {
        phase = 3;
        phaseReason = `Thriving (rating ${avgRating.toFixed(1)}, resonance ${recentResonance.toFixed(2)}) — no constraints needed`;
      } else if (completedQuests >= 15 && avgRating >= 3) {
        phase = 3;
        phaseReason = `Long-term commitment — ${completedQuests} quests at avg ${avgRating.toFixed(1)} stars. They've earned the full menu`;
      }
    }

    // Expectancy violation accelerator: if they consistently overestimate fear,
    // they're more capable than the standard signals suggest — bump up a phase.
    // Requires enough data (3+ violations) and strong overestimation (avg > 1.5).
    const cal = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "expectancyCalibration"],
    });
    if (cal?.expectancyCalibration && cal.expectancyCalibration.totalViolations >= 3) {
      const avgAnxDelta = cal.expectancyCalibration.avgAnxietyDelta;
      if (avgAnxDelta > 1.5 && phase < 3) {
        phase = Math.min(3, phase + 1);
        phaseReason = `Strong fear overestimator (avg Δ${avgAnxDelta.toFixed(1)}) — their predictions consistently overshoot reality. Accelerating.`;
      }
    }

    // Safety valve: if recent quests have LOW ratings, drop back a phase
    // This prevents escalation when the user is struggling
    const recentRatings = ratings.slice(0, 5);
    const recentAvgRating = recentRatings.length > 0
      ? recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length : avgRating;
    if (recentAvgRating < 2.5 && phase > 0) {
      phase = Math.max(0, phase - 1);
      phaseReason = `Recent quests aren't landing well (recent avg rating ${recentAvgRating.toFixed(1)}) — pulling back`;
    }

    return {
      phase, completedQuests, avgResonance, recentResonance,
      avgRating, hasGrowthSignals, positiveQuestCount,
      recentAvgDifficulty, hasDfsPathway, phaseReason,
    };
  }

  private buildFearLadderContext(fearLadder: {
    overallScore: number;
    dimensionScores: Record<string, number>;
    responses: Record<string, number>;
    scenarios?: { id: string; text: string; dimension: string }[];
    dimensions?: string[];
  }, readiness: FearLadderReadiness): string {
    const { dimensionScores, responses } = fearLadder;
    const { phase, completedQuests, phaseReason } = readiness;
    const lines: string[] = [];

    lines.push(`- FEAR LADDER ASSESSMENT (phase ${phase}/3): ${phaseReason}`);
    lines.push(`- Progress: ${completedQuests} quests, avg resonance ${readiness.avgResonance.toFixed(2)}, avg rating ${readiness.avgRating.toFixed(1)}${readiness.hasGrowthSignals ? ", showing growth signals in reflections" : ""}`);

    // If we have dynamic (LLM-generated) scenarios, use those for context
    if (fearLadder.scenarios && fearLadder.scenarios.length > 0) {
      return this.buildDynamicFearLadderContext(fearLadder as Required<Pick<typeof fearLadder, "scenarios">> & typeof fearLadder, readiness, lines);
    }

    // Legacy path: hardcoded scenario-specific guidance
    const scenarioGuidance: Record<string, { hard: string; soft: string; open: string; safe: string }> = {
      coffee_alone:     { hard: "even low-key solo venues feel hard — start with outdoor/walking quests instead", soft: "solo sit-down venues are a gentle stretch — try it if low-key", open: "solo venues should feel comfortable by now", safe: "coffee shops, cafes, and other solo-sit-down spots are great" },
      eat_alone:        { hard: "DO NOT send them to eat at a restaurant alone", soft: "solo dining is a stretch — only if the venue is casual and low-pressure", open: "solo dining could be a good challenge now", safe: "solo dining is fine" },
      park_alone:       { hard: "even solo outdoor spots feel intimidating", soft: "solo outdoor spots are a gentle stretch", open: "solo outdoor is comfortable", safe: "parks, trails, and solo outdoor walks are their comfort zone" },
      talk_stranger:    { hard: "DO NOT require talking to strangers or staff beyond ordering. No \"ask someone about...\" or \"strike up a conversation\" activities", soft: "very light social interaction is OK (e.g. ordering, brief chat) — but don't make it the main challenge", open: "light social interactions are fair game now — the user is building confidence. A suggested activity like \"ask the barista about their favorite\" is fine", safe: "light social interaction is fine" },
      fitness_class:    { hard: "DO NOT prescribe fitness classes, yoga studios, group exercise, or any class-format activity", soft: "group classes are still a big stretch — only consider very beginner-friendly, drop-in options", open: "fitness/yoga classes are now worth trying — the user has built enough confidence for structured group settings", safe: "group fitness classes are fine" },
      group_event:      { hard: "DO NOT prescribe meetups, group events, workshops, or any activity where they'd join a group of strangers", soft: "small, casual group settings (e.g. a workshop with 5 people) are worth considering — but nothing large or formal", open: "group events and meetups are on the table — the user has enough experience to handle them", safe: "group events and meetups are fine" },
      new_activity:     { hard: "stick to activities adjacent to what they already know — do NOT throw them into something completely unfamiliar", soft: "new activities are OK if they're adjacent to familiar ones — no total unknowns yet", open: "novel activities are welcome — the user is ready to explore", safe: "novel activities are welcome" },
      new_neighborhood: { hard: "stay in or near familiar areas — unfamiliar neighborhoods add too much stress", soft: "new neighborhoods are OK if there's a familiar anchor (e.g. a coffee shop in a new area)", open: "exploring new neighborhoods should feel natural now", safe: "exploring new neighborhoods is fine" },
      ask_rec:          { hard: "avoid activities that require asking strangers for help or recommendations", soft: "very light ask-for-help moments are OK — like asking a cashier, not a stranger on the street", open: "asking people for recs is a reasonable challenge now", safe: "asking people for recs is comfortable" },
      live_show:        { hard: "DO NOT send them to concerts, shows, or performances alone — too exposed", soft: "small intimate performances could work — nothing large or high-energy", open: "live shows and performances solo are a solid growth challenge now", safe: "live shows and performances solo are fine" },
    };

    const constraints: string[] = [];
    const safeBets: string[] = [];

    for (const [scenarioId, guidance] of Object.entries(scenarioGuidance)) {
      const rating = responses[scenarioId];
      if (rating == null) continue;

      if (rating >= 4) {
        if (phase === 0) constraints.push(guidance.hard);
        else if (phase === 1) constraints.push(guidance.soft);
        else if (phase === 2) constraints.push(guidance.open);
      } else if (rating === 3 && phase === 0) {
        constraints.push(guidance.soft);
      } else if (rating <= 2) {
        safeBets.push(guidance.safe);
      }
    }

    if (constraints.length > 0) {
      const header = phase === 0
        ? "HARD CONSTRAINTS (user rated these scenarios 4-5 out of 5 scary — respect these):"
        : phase === 1
        ? "SOFT CONSTRAINTS (user found these scary — they're responding well to quests but approach these with care):"
        : "GROWTH OPPORTUNITIES (user originally found these scary — their feedback shows they may be ready):";
      lines.push(`\n${header}`);
      for (const c of constraints) {
        lines.push(`  - ${c}`);
      }
    }

    if (safeBets.length > 0) {
      lines.push(`\nSAFE ZONES (user rated these 1-2 — reliable comfort options):`);
      for (const safe of safeBets) {
        lines.push(`  - ${safe}`);
      }
    }

    // Dimension summary
    const dimLabels: Record<string, string> = {
      solo: "Being alone in public",
      social: "Social interaction",
      novelty: "Trying new things",
      physical: "Physical/outdoor activities",
      vulnerability: "Feeling exposed",
    };

    const dimSummary = Object.entries(dimensionScores)
      .map(([dim, score]) => `${dimLabels[dim] ?? dim}: ${score <= 0.25 ? "comfortable" : score <= 0.5 ? "moderate" : score <= 0.75 ? "anxious" : "very anxious"}`)
      .join(", ");
    lines.push(`- Dimension summary: ${dimSummary}`);

    return lines.join("\n");
  }

  /**
   * Build fear ladder context from LLM-generated (dynamic) scenarios.
   * Uses the scenario text and dimension to generate guidance based on rating + phase.
   */
  private buildDynamicFearLadderContext(fearLadder: {
    overallScore: number;
    dimensionScores: Record<string, number>;
    responses: Record<string, number>;
    scenarios: { id: string; text: string; dimension: string }[];
    dimensions?: string[];
  }, readiness: FearLadderReadiness, lines: string[]): string {
    const { dimensionScores, responses, scenarios } = fearLadder;
    const { phase } = readiness;

    const highScary: string[] = [];
    const moderateScary: string[] = [];
    const comfortable: string[] = [];

    for (const scenario of scenarios) {
      const rating = responses[scenario.id];
      if (rating == null) continue;

      const label = `"${scenario.text}" (${scenario.dimension})`;

      if (rating >= 4) {
        if (phase === 0) {
          highScary.push(`AVOID quests similar to ${label} — user rated this ${rating}/5 scary and is still early in their journey`);
        } else if (phase === 1) {
          highScary.push(`Approach with care: ${label} rated ${rating}/5 — user is progressing but this is still a big stretch`);
        } else if (phase === 2) {
          moderateScary.push(`Growth opportunity: ${label} was rated ${rating}/5 but user's feedback suggests they may be ready`);
        }
        // Phase 3: no constraint
      } else if (rating === 3 && phase === 0) {
        moderateScary.push(`Gentle stretch: ${label} rated ${rating}/5 — approach carefully at this stage`);
      } else if (rating <= 2) {
        comfortable.push(`${label} — user is comfortable with this type of challenge`);
      }
    }

    if (highScary.length > 0) {
      const header = phase === 0
        ? "HARD CONSTRAINTS (user rated these scenarios highly scary — respect these):"
        : phase === 1
        ? "SOFT CONSTRAINTS (user found these scary — approaching with care):"
        : "GROWTH OPPORTUNITIES (user may be ready for these):";
      lines.push(`\n${header}`);
      for (const c of highScary) lines.push(`  - ${c}`);
    }

    if (moderateScary.length > 0 && phase <= 1) {
      lines.push(`\nMODERATE CHALLENGES:`);
      for (const c of moderateScary) lines.push(`  - ${c}`);
    }

    if (comfortable.length > 0) {
      lines.push(`\nSAFE ZONES (user rated these comfortable):`);
      for (const c of comfortable) lines.push(`  - ${c}`);
    }

    // Dimension summary using dynamic dimension names
    const dimSummary = Object.entries(dimensionScores)
      .map(([dim, score]) => {
        const label = dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return `${label}: ${score <= 0.25 ? "comfortable" : score <= 0.5 ? "moderate" : score <= 0.75 ? "anxious" : "very anxious"}`;
      })
      .join(", ");
    lines.push(`- Dimension summary: ${dimSummary}`);

    return lines.join("\n");
  }

  /**
   * Build LLM context from expectancy violation data.
   * Tells the agent how miscalibrated the user's fear predictions are,
   * so it can push harder when the user consistently overestimates threat.
   */
  private buildExpectancyContext(cal: NonNullable<import("@realtime-markers/database").User["expectancyCalibration"]>): string {
    if (cal.totalViolations < 2) return ""; // Not enough data yet

    const lines: string[] = [];
    lines.push(`\nEXPECTANCY VIOLATION DATA (${cal.totalViolations} quests with predictions):`);

    // Interpret the anxiety calibration
    const avgAnx = cal.avgAnxietyDelta;
    if (avgAnx > 1.5) {
      lines.push(`- STRONG OVERESTIMATOR: On average, this user predicts anxiety ${avgAnx.toFixed(1)} points higher than reality. Their fear model is significantly miscalibrated — they're consistently more capable than they think. You can push harder than their fear ladder suggests.`);
    } else if (avgAnx > 0.5) {
      lines.push(`- MILD OVERESTIMATOR: This user tends to predict ${avgAnx.toFixed(1)} points more anxiety than they actually experience. They're generally pleasantly surprised by their quests — gentle escalation is working.`);
    } else if (avgAnx < -0.5) {
      lines.push(`- UNDERESTIMATOR: This user actually feels MORE anxious than predicted (${Math.abs(avgAnx).toFixed(1)} points). Quests are landing harder than expected — ease up or stay at current level.`);
    } else {
      lines.push(`- WELL CALIBRATED: Predictions roughly match reality (Δ${avgAnx.toFixed(1)}). Their self-awareness is good — trust their comfort level signals.`);
    }

    // Difficulty calibration
    const avgDiff = cal.avgDifficultyDelta;
    if (avgDiff > 1.0) {
      lines.push(`- They also overestimate difficulty by ~${avgDiff.toFixed(1)} points — quests feel easier than expected. Consider bumping target difficulty.`);
    } else if (avgDiff < -0.5) {
      lines.push(`- They underestimate difficulty by ~${Math.abs(avgDiff).toFixed(1)} points — quests feel harder than expected. Keep difficulty conservative.`);
    }

    // Recent trend (are they getting better calibrated or worse?)
    if (cal.recentViolations.length >= 3) {
      const recent3 = cal.recentViolations.slice(0, 3);
      const recentAvgAnx = recent3.reduce((sum, v) => sum + v.anxietyDelta, 0) / recent3.length;
      if (Math.abs(recentAvgAnx - avgAnx) > 0.5) {
        if (recentAvgAnx > avgAnx) {
          lines.push(`- TREND: Recent quests show even larger overestimation — their confidence is growing faster than their predictions reflect.`);
        } else {
          lines.push(`- TREND: Recent quests show smaller overestimation — they're calibrating better. Their predictions are becoming more accurate.`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Build difficulty guidance for the LLM instead of dictating a specific number.
   * The LLM should judge difficulty based on the actual quest relative to the user's profile.
   */
  private buildDifficultyGuidance(pace: string, readiness: FearLadderReadiness, isStretch = false): string {
    if (isStretch) {
      return `- DIFFICULTY GUIDANCE: This is a STRETCH quest. Pick something that genuinely pushes them — aim for difficulty 6-9. They've earned this challenge.`;
    }

    if (readiness.phase === 0) {
      return `- DIFFICULTY GUIDANCE: They're just starting out. Keep it easy and approachable — aim for difficulty 1-3. Easy wins build momentum.`;
    }

    if (readiness.phase === 1) {
      return `- DIFFICULTY GUIDANCE: They're building confidence. Gentle stretches are landing well — aim for difficulty 2-4. Nudge them, don't push.`;
    }

    if (readiness.phase === 2) {
      return `- DIFFICULTY GUIDANCE: They're showing real growth. Push toward meaningful challenges — aim for difficulty 3-6. They can handle more than they think.`;
    }

    // Phase 3 — thriving
    const questCount = readiness.completedQuests;
    if (questCount >= 40) {
      return `- DIFFICULTY GUIDANCE: Veteran explorer — ${questCount} quests completed, thriving. The full 1-10 range is open. Match difficulty to the actual challenge of the quest for THIS person. Don't hold back if the quest warrants it.`;
    }

    return `- DIFFICULTY GUIDANCE: They're thriving. Lean into growth edges — aim for difficulty 4-8. Use your judgment based on the specific venue and activity.`;
  }

  // ─── Sibling Context for Weekly Packs ─────────────────────────��

  private buildSiblingInstructions(ctx: SiblingContext): string {
    const lines: string[] = [];

    lines.push(`\nWEEKLY PACK CONTEXT (quest ${ctx.batchIndex + 1} of ${ctx.totalInBatch}):`);

    if (ctx.questRole === "deepen" && ctx.targetPathway) {
      lines.push(
        `- ROLE: DEEPEN. This quest should deepen the user's "${ctx.targetPathway.label}" pathway.`,
        `  Pick a venue in the "${ctx.targetPathway.theme}" category. Escalate slightly — busier time, social element, or a new angle within this category.`,
      );
    } else if (ctx.questRole === "explore") {
      lines.push(
        `- ROLE: EXPLORE. This quest should push into NEW territory the user hasn't tried.`,
        `  Avoid categories already covered by active pathways. Prioritize novelty.`,
      );
    } else if (ctx.questRole === "stretch") {
      lines.push(
        `- ROLE: STRETCH GOAL. This quest is an optional accelerator — it should push BEYOND the user's current comfort zone.`,
        `  This card exists so the user always has a way to leap ahead if they're feeling brave.`,
        `  Push on MULTIPLE dimensions simultaneously: further distance AND unfamiliar category AND higher social/novelty challenge.`,
        `  Target difficulty should be significantly above their usual range — this is the card that pushes boundaries.`,
        `  Search further out — aim for 1.5-2x the user's current comfort radius.`,
        `  Pick venues or activities that would be a genuine stretch: a new neighborhood, a category they haven't tried, a social element they'd normally avoid.`,
        `  The quest should feel ambitious but NOT impossible — exciting, not terrifying.`,
        `  DO NOT soften this quest to match their current level. The other 2 cards in this batch already do that.`,
      );
    } else {
      lines.push(`- ROLE: DISCOVER. Explore freely — the user is just getting started.`);
    }

    if (ctx.previousSiblings.length > 0) {
      lines.push(`- Already prescribed in this batch (DO NOT duplicate venues or categories):`);
      for (const s of ctx.previousSiblings) {
        lines.push(`  • "${s.title}" at ${s.venueName} (${s.venueCategory})`);
      }
    }

    return lines.join("\n");
  }

  // ─── Weekly Pack Orchestrator ──────────────────────────────────

  async prescribeWeekPack(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
  ): Promise<WeekPackResult> {
    const batchId = crypto.randomUUID();
    const quests: Sidequest[] = [];

    // Determine pack composition from pathway phase context
    const slots = await this.determinePackSlots(userId);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      if (onProgress) {
        await onProgress(
          Math.round((i / slots.length) * 80),
          `Crafting quest ${i + 1} of ${slots.length}...`,
        );
      }

      const siblingContext: SiblingContext = {
        batchId,
        batchIndex: i,
        totalInBatch: slots.length,
        questRole: slot.role,
        targetPathway: slot.targetPathway,
        previousSiblings: quests.map((q) => ({
          title: q.title ?? "Untitled",
          venueCategory: q.objectives?.[0]?.venueCategory ?? "other",
          venueName: q.objectives?.[0]?.venueName ?? "Unknown",
        })),
      };

      const quest = await this.prescribeQuest(userId, input, undefined, siblingContext);
      quests.push(quest);
    }

    if (onProgress) {
      await onProgress(100, "Your quests are ready!");
    }

    console.log(
      `[SidequestPrescription] Prescribed week pack ${batchId} for user ${userId}: ` +
      `${quests.length} quests [${slots.map((s) => s.role).join(", ")}]`,
    );

    return { batchId, quests };
  }

  private async determinePackSlots(
    userId: string,
  ): Promise<{ role: "deepen" | "explore" | "discover" | "stretch"; targetPathway?: { id: string; theme: string; label: string; phase: string } }[]> {
    if (!this.pathwayService) {
      return [{ role: "discover" }, { role: "discover" }, { role: "stretch" }];
    }

    let phaseContext: import("./PathwayService").PhaseContext;
    let pathways: import("@realtime-markers/database").Pathway[];
    try {
      [phaseContext, pathways] = await Promise.all([
        this.pathwayService.getUserPhaseContext(userId),
        this.pathwayService.getPathways(userId),
      ]);
    } catch {
      return [{ role: "discover" }, { role: "discover" }, { role: "stretch" }];
    }

    const dfsPathways = pathways
      .filter((p) => p.phase === "dfs")
      .sort((a, b) => Number(b.avgResonance) - Number(a.avgResonance));

    const topDfs = dfsPathways[0];

    // Always 3 slots: 2 at-level + 1 stretch goal
    // The stretch card pushes beyond the user's current comfort zone,
    // giving them a way to accelerate progress if they choose to.
    switch (phaseContext.globalPhase) {
      case "bfs":
        return [{ role: "explore" }, { role: "explore" }, { role: "stretch" }];

      case "mixed":
      case "dfs":
        return [
          {
            role: "deepen",
            targetPathway: topDfs
              ? { id: topDfs.id, theme: topDfs.theme, label: topDfs.themeLabel ?? topDfs.theme, phase: topDfs.phase }
              : undefined,
          },
          { role: "explore" },
          { role: "stretch" },
        ];

      default:
        return [{ role: "discover" }, { role: "discover" }, { role: "stretch" }];
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────

export function createSidequestPrescriptionService(
  deps: SidequestPrescriptionServiceDeps,
): SidequestPrescriptionService {
  return new SidequestPrescriptionServiceImpl(deps);
}
