import { type DataSource, Not, IsNull, In, MoreThan, MoreThanOrEqual } from "typeorm";
import {
  Sidequest,
  Objective,
  SidequestStatus,
  SidequestTier,
  User,
  normalizeCity,
  isCityNormalized,
} from "@realtime-markers/database";
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

export type SidequestProgressCallback = (
  progress: number,
  label: string,
  candidates?: AgentCandidate[],
) => Promise<void>;

export interface CreateSidequestInput {
  prompt: string;
  radiusMiles: number;
  budgetMax: number;
  latitude: number;
  longitude: number;
  timezone?: string;
  activityTypes?: string[];
  intention?: string;
  city?: string;
  surpriseMe?: boolean;
  note?: string;
}

export interface PrescribeQuestInput {
  latitude: number;
  longitude: number;
  timezone?: string;
}

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
  jp: string | null;
  df: number | null;
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
  journalPrompt: string | null;
  difficulty: number | null;
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
      journalPrompt: i.jp ?? null,
      difficulty: i.df ?? null,
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

export interface PopularStop {
  venueName: string;
  venueCategory: string | null;
  emoji: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  frequency: number;
  completions: number;
  completionRate: number;
  score: number;
}

export type ListByUserSort = "newest" | "oldest" | "upcoming" | "top_rated";
export type ListByUserStatus = "completed" | "upcoming";

export interface ListByUserOptions {
  limit?: number;
  cursor?: string;
  sort?: ListByUserSort;
  intention?: string;
  status?: ListByUserStatus;
}

export interface SidequestService {
  createShell(userId: string, input: CreateSidequestInput): Promise<Sidequest>;
  create(
    userId: string,
    input: CreateSidequestInput & { sidequestId?: string },
    onProgress?: SidequestProgressCallback,
  ): Promise<Sidequest>;
  getOptions(parentId: string): Promise<Sidequest[]>;
  selectOption(childId: string, userId: string): Promise<Sidequest>;
  listByUser(
    userId: string,
    options?: ListByUserOptions,
  ): Promise<{ data: Sidequest[]; nextCursor: string | null }>;
  getById(id: string, userId?: string): Promise<Sidequest | null>;
  deleteById(id: string, userId: string): Promise<boolean>;
  deleteByIds(ids: string[], userId: string): Promise<number>;
  generateShareToken(id: string, userId: string): Promise<string | null>;
  getByShareToken(shareToken: string): Promise<Sidequest | null>;
  getPopularStops(city: string, limit?: number): Promise<PopularStop[]>;
  rate(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Sidequest | null>;
  countCreatedSince(userId: string, since: Date): Promise<number>;
  listCompleted(userId: string, limit?: number): Promise<Sidequest[]>;
  promote(id: string, userId: string): Promise<Sidequest>;
  getDeckStats(userId: string): Promise<DeckStats>;
  searchByUser(
    userId: string,
    query: string,
    limit?: number,
  ): Promise<Sidequest[]>;
  prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
  ): Promise<Sidequest>;
  browsePublished(options: BrowsePublishedOptions): Promise<BrowseSidequest[]>;
  listPublishedInternal(
    page: number,
    pageSize: number,
  ): Promise<{
    sidequests: InternalSidequest[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }>;
}

export interface InternalSidequest {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  categories: string[];
  embedding: string | null;
  entryLatitude: number | null;
  entryLongitude: number | null;
  rating: number | null;
  timesAdopted: number;
  items: {
    id: string;
    title: string;
    emoji: string | null;
    latitude: number | null;
    longitude: number | null;
    venueCategory: string | null;
    sortOrder: number;
  }[];
}

export interface BrowsePublishedOptions {
  city: string;
  intention?: string;
  sort?: "popular" | "recent" | "top_rated";
  limit?: number;
  cursor?: string;
  excludeUserId?: string;
}

export interface BrowseSidequest {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  rating: number | null;
  timesAdopted: number;
  itemCount: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
}

export interface DeckStats {
  totalCards: number;
  cardsPlayed: number;
  cardsActive: number;
  cardsInDeck: number;
  newThisWeek: number;
  byTier: { tier: string; label: string; count: number }[];
  byStatus: { status: string; label: string; count: number }[];
  recentCards: { name: string; tier: string; daysAgo: number }[];
}

interface SidequestServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  geocodingService: GoogleGeocodingService;
  overpassService: OverpassService;
  embeddingService?: IEmbeddingService;
  redisService?: RedisService;
  comfortZoneService?: ComfortZoneService;
}

class SidequestServiceImpl implements SidequestService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;
  private overpassService: OverpassService;
  private embeddingService?: IEmbeddingService;
  private redisService?: RedisService;
  private comfortZoneService?: ComfortZoneService;
  private agent: OpenAIResponsesAgent;

  constructor(deps: SidequestServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
    this.overpassService = deps.overpassService;
    this.embeddingService = deps.embeddingService;
    this.redisService = deps.redisService;
    this.comfortZoneService = deps.comfortZoneService;
    this.agent = new OpenAIResponsesAgent(deps.openAIService);
  }

  async createShell(
    userId: string,
    input: CreateSidequestInput,
  ): Promise<Sidequest> {
    const repo = this.dataSource.getRepository(Sidequest);

    let city = "Unknown";
    try {
      city = await this.geocodingService.reverseGeocodeCityState(
        input.latitude,
        input.longitude,
      );
    } catch (err) {
      console.warn("[SidequestService] City lookup failed:", err);
    }

    const shell = repo.create({
      userId,
      city: normalizeCity(input.city || city),
      prompt: input.prompt,
      radiusMiles: input.radiusMiles,
      status: SidequestStatus.GENERATING,
      budgetMax: input.budgetMax,
      activityTypes: input.activityTypes ?? [],
      intention: input.intention,
    });
    await repo.save(shell);
    return shell;
  }

  async create(
    userId: string,
    input: CreateSidequestInput & { sidequestId?: string },
    onProgress?: SidequestProgressCallback,
  ): Promise<Sidequest> {
    const repo = this.dataSource.getRepository(Sidequest);

    // Load or create parent shell
    let parent: Sidequest;
    if (input.sidequestId) {
      const existing = await repo.findOne({
        where: { id: input.sidequestId, userId },
      });
      if (!existing) throw new Error("Sidequest shell not found");
      parent = existing;
    } else {
      parent = await this.createShell(userId, input);
    }

    try {
      // Create 3 child option records — one per tier
      const tiers = [SidequestTier.QUICK, SidequestTier.SWEET_SPOT, SidequestTier.BEST];
      const children: Sidequest[] = [];
      for (let i = 0; i < 3; i++) {
        const child = repo.create({
          parentId: parent.id,
          userId,
          city: parent.city,
          status: SidequestStatus.GENERATING,
          prompt: parent.prompt,
          radiusMiles: parent.radiusMiles,
          budgetMax: parent.budgetMax,
          activityTypes: parent.activityTypes,
          intention: parent.intention,
          tier: tiers[i],
        });
        children.push(child);
      }
      await repo.save(children);

      // Generate all 3 options in parallel
      const results = await Promise.allSettled(
        children.map((child, idx) =>
          this.generateSingleOption(child, input, onProgress, idx),
        ),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "rejected") {
          const reason = (results[i] as PromiseRejectedResult).reason;
          const msg = reason instanceof Error ? reason.message : String(reason);
          const isSkip = msg.startsWith("TIER_SKIPPED:");
          console[isSkip ? "log" : "error"](
            `[SidequestService] Option ${i} ${isSkip ? "skipped" : "failed"}:`,
            msg,
          );
          // Remove skipped/failed options so only viable cards are shown
          await repo.softDelete({ id: children[i].id });
        }
      }

      if (succeeded === 0) {
        parent.status = SidequestStatus.FAILED;
        await repo.save(parent);
        throw new Error("All 3 sidequest options failed to generate");
      }

      // Set parent title/summary from the first successful child
      const readyChild = children.find((c) => c.status === SidequestStatus.READY);
      if (readyChild) {
        parent.title = readyChild.title;
        parent.summary = readyChild.summary;
      }
      parent.status = SidequestStatus.READY;
      await repo.save(parent);

      // Reload parent with children
      const loaded = await repo.findOne({
        where: { id: parent.id },
        relations: ["children", "children.objectives"],
      });
      return loaded ?? parent;
    } catch (error) {
      console.error("[SidequestService] Generation failed:", error);
      if (parent.status !== SidequestStatus.FAILED) {
        parent.status = SidequestStatus.FAILED;
        await repo.save(parent);
      }
      throw error;
    }
  }

  private async generateSingleOption(
    child: Sidequest,
    input: CreateSidequestInput,
    onProgress: SidequestProgressCallback | undefined,
    optionIndex: number,
  ): Promise<void> {
    const repo = this.dataSource.getRepository(Sidequest);
    const objectiveRepo = this.dataSource.getRepository(Objective);

    const city = child.city;
    const cityCenter = { lat: input.latitude, lng: input.longitude };

    const allVenues: VerifiedVenue[] = [];
    const seenVenueIds = new Set<string>();
    const allTrails: Trail[] = [];
    const seenTrailIds = new Set<number>();

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    const promptText = input.prompt
      ? `User wants: "${input.prompt}"`
      : "User wants a surprise — craft something unexpected and delightful based on what's nearby.";

    const vibesBlock = input.activityTypes?.length
      ? `\nACTIVITIES: ${input.activityTypes.join(", ")} — these are the LITERAL activities the user wants to do, not a vibe or aesthetic. Search for places where the user can actually DO these things. "disc golf" means find a disc golf course, "reading" means find a bookstore or library, "coffee" means find a café. At least one stop MUST directly enable one of these activities.`
      : "";

    const intentionMap: Record<string, string> = {
      recharge: "Recharge — solo-friendly, calm, restorative spots. Quiet cafes, nature, gentle pacing.",
      explore: "Explore — new neighborhoods, hidden gems, off-the-beaten-path discovery.",
      socialize: "Socialize — lively atmosphere, communal seating, bars/breweries, social energy.",
      move: "Move — trails, outdoor activities, physical movement, scenic routes.",
      learn: "Learn — museums, bookstores, galleries, cultural/historical venues.",
      treat_yourself: "Treat Yourself — premium food, scenic spots, indulgent experiences. Quality over quantity.",
      lock_in: "Lock In — productive focus spots, cozy cafes with WiFi, libraries, quiet corners for deep work.",
    };
    const intentionBlock = input.intention && intentionMap[input.intention]
      ? `\nINTENTION: ${intentionMap[input.intention]}`
      : "";

    const noteBlock = input.note
      ? `\nUSER NOTE: "${input.note}" — incorporate this context into venue selection and quest theming.`
      : "";

    const budgetMax = input.budgetMax;
    const tierConfig = [
      {
        name: "Quick & Easy",
        budgetCeiling: budgetMax === 0 ? 0 : Math.max(Math.round(budgetMax * 0.4), 5),
        radiusMultiplier: 0.5,
        philosophy: `You are the QUICK & EASY Sidequest Master. Your specialty is low-friction, nearby, budget-friendly quests the user can start almost immediately.
Prioritize: proximity to the user's location, affordability ($0–low cost), minimal planning needed, places that are easy to get to.
Tradeoff: you sacrifice "best in class" for convenience and speed. A solid neighborhood café beats a famous one across town.
Personality: practical, encouraging, "you can do this right now" energy.
IMPORTANT: Pick WALKABLE, casual, no-frills spots. Think dive bars, neighborhood joints, hole-in-the-wall gems — NOT the popular/well-known places everyone already goes to.`,
      },
      {
        name: "Sweet Spot",
        budgetCeiling: Math.round(budgetMax * 0.75),
        radiusMultiplier: 1.0,
        philosophy: `You are the SWEET SPOT Sidequest Master. Your specialty is balanced quests that trade a bit of convenience for noticeably better quality and excitement.
Prioritize: relevance to the user's request, interesting/unique venues, a step up in experience quality. Worth a short drive or slightly higher spend.
Tradeoff: you go a bit further out or spend a bit more, but only when it meaningfully upgrades the experience.
Personality: curated, confident, "this is worth the extra effort" energy.
IMPORTANT: Pick DIFFERENT venues from what a "quick & cheap" option would suggest. Go for mid-range quality spots in a different neighborhood or part of town.`,
      },
      {
        name: "Best Package",
        budgetCeiling: budgetMax,
        radiusMultiplier: 1.5,
        philosophy: `You are the BEST PACKAGE Sidequest Master. Your specialty is crafting the highest-quality overall experience — the quest someone would brag about.
Prioritize: the best combination of venue quality, atmosphere, uniqueness, and how well it matches the user's request. Top-rated spots, hidden gems with rave reviews, or genuinely special experiences.
Tradeoff: not necessarily the furthest or the most expensive — but the BEST overall package. A $5 hole-in-the-wall with 4.9 stars and legendary vibes beats a $50 tourist trap.
Personality: bold, opinionated, "trust me, this is THE one" energy.
IMPORTANT: Go for the PREMIUM experience — a different area of town, higher-rated venues, or a totally different angle on the user's request. Do NOT overlap with obvious/popular choices.`,
      },
    ];

    const tier = tierConfig[optionIndex] ?? tierConfig[1];

    const instructions = `${tier.philosophy}

You have web search for discovery, search_places for verified venue data, and search_trails for trail/path discovery.

APPROACH:
1. Break the user's request into distinct stop types mentally.
2. For venues (restaurants, cafes, shops, museums): use web_search to discover, then search_places to verify with exact coordinates.
3. For trails/paths (hiking, boarding, biking, scenic walks): use search_trails directly — it searches OpenStreetMap for real trails with surface type, length, and lighting info.
4. For multi-stop quests: search for later stops NEAR earlier ones. Pass the first stop's coordinates as lat/lng to search_trails or use the nearby city for search_places.
5. Focus on your tier's priorities — ${tier.name === "Quick & Easy" ? "stay close and keep it cheap" : tier.name === "Sweet Spot" ? "balance convenience with quality" : "find the best overall experience regardless of distance or cost"}.
6. Call submit_quest with 1-2 stops using ONLY venues confirmed by search_places or trails found by search_trails.
${vibesBlock}${intentionBlock}${noteBlock}
DIVERSITY RULE: You are one of 3 parallel agents generating options. To ensure the user gets MEANINGFULLY DIFFERENT choices:
- ${tier.name === "Quick & Easy" ? "Pick the CLOSEST, most casual spots. Prioritize walkability and low cost. Think neighborhood gems, not popular destinations." : tier.name === "Sweet Spot" ? "Pick a DIFFERENT neighborhood or area than the most obvious nearby spots. Look for interesting mid-range venues the user might not know about." : "Search FURTHER out or for a completely different angle. Find the highest-rated or most unique option, even if it requires more effort to get there."}
- Use DIFFERENT search queries than generic ones — be specific and creative with your search_places queries to find distinct venues.

CONSTRAINTS:
- 1-2 stops max. For 2-stop quests, stops MUST be within 10 miles of each other.
- Budget: $${tier.budgetCeiling} max for this tier (0 = free only).
- Use EXACT venue names and addresses from search_places — do not invent venues.
- For trail stops, you MUST use a trail returned by search_trails — do NOT use trails from web search or your own knowledge. Use the exact trail name from search_trails results as the venue name. The coordinates from search_trails results are the source of truth for trail locations.
- Current time: ${hour}:00, ${dayOfWeek} — don't pick closed venues.
- Title: 3-6 words, evocative. Summary: 1-2 sentences.
- hook: why this venue over alternatives (1 sentence).
- If 2+ searches return zero or irrelevant results, call skip_tier instead of forcing a weak quest. The user will still see cards from the other tiers.
${hour >= 22 || hour < 6 ? `\nLATE-NIGHT MODE: It's late — most venues are closed. Focus on: 24-hour diners, late-night food spots, convenience stores with character, night walks/viewpoints, stargazing spots, or "plan for tomorrow morning" quests (pick a great breakfast/brunch/coffee spot the user can hit first thing). If search_places returns nothing, try broader queries like "24 hour restaurant", "late night food", or "diner". If still nothing, build a quest around a scenic night walk, a viewpoint, or a park — no venue required.` : ""}`;

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
          "Search Google Places for verified venues matching a query near a city/town. Returns name, address, rating, and exact coordinates.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query, e.g. 'specialty coffee roaster'",
            },
            near: {
              type: "string",
              description: "City/town to search near, e.g. 'Fort Collins, CO'",
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
          "Search for trails near a location. Returns trail name, surface type, length, and distance.",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["paved", "hiking"],
              description: "paved = smooth surfaces. hiking = all surfaces.",
            },
            lat: { type: "number", description: "Search center latitude." },
            lng: { type: "number", description: "Search center longitude." },
            radius_miles: {
              type: "number",
              description: "Search radius in miles. Defaults to 10.",
            },
          },
          required: ["type", "lat", "lng"],
        },
        strict: false,
      },
      {
        type: "function",
        name: "skip_tier",
        description:
          "Call this if your searches consistently return no results or nothing worthwhile for this tier. Bow out early so the user still gets the other tiers without waiting.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Brief reason for skipping (e.g. 'no venues found within radius')",
            },
          },
          required: ["reason"],
          additionalProperties: false,
        },
        strict: false,
      },
      {
        type: "function",
        name: "submit_quest",
        description:
          "Submit the final sidequest with 1-2 stops. Call this once you've found and verified great venues.",
        parameters: {
          type: "object",
          properties: {
            t: { type: "string", description: "Quest title (3-6 words)" },
            s: { type: "string", description: "Quest summary (1-2 sentences)" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  t: { type: "string", description: "Waypoint title" },
                  d: { type: "string", description: "Description ≤10 words" },
                  e: { type: "string", description: "Single emoji" },
                  ec: { type: "number", description: "Estimated cost" },
                  vn: { type: "string", description: "Venue name (exact from search_places results)" },
                  va: { type: "string", description: "Venue address (exact from search_places results)" },
                  eid: { type: ["string", "null"] },
                  vc: { type: "string", description: "Category: cafe|trail|park|restaurant|bar|museum|gallery|market|venue|attraction|other" },
                  hook: { type: "string", description: "Why this stop was chosen" },
                },
                required: ["t", "d", "e", "ec", "vn", "va", "vc", "hook"],
                additionalProperties: false,
              },
            },
          },
          required: ["t", "s", "items"],
          additionalProperties: false,
        },
        strict: false,
      },
    ];

    const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<AgentToolResult>> = {
      search_places: async (args) => {
        const query = args.query as string;
        const near = args.near as string;
        try {
          const venues = await this.geocodingService.searchPlacesByCategory(
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
          const isLateNight = hour >= 22 || hour < 6;
          const resultText =
            venues.length > 0
              ? venues
                  .map((v) => {
                    const [lng, lat] = v.coordinates;
                    return `- ${v.name} (${v.address}) [${lat.toFixed(4)},${lng.toFixed(4)}]${v.rating ? ` ★${v.rating}` : ""}`;
                  })
                  .join("\n")
              : isLateNight
                ? `No results found — it's late (${hour}:00). Try searching for "24 hour restaurant", "late night food", or "diner" near ${near}. If nothing works, build a quest around a night walk, scenic viewpoint, or plan a "tomorrow morning" stop (breakfast/coffee spot).`
                : "No results found for this search.";
          if (onProgress && venues.length > 0) {
            await onProgress(
              Math.round(10 + optionIndex * 25),
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
          return { output: `Search failed: ${err instanceof Error ? err.message : "unknown error"}` };
        }
      },

      search_trails: async (args) => {
        const trailType = (args.type as string) || "paved";
        const searchLat = args.lat as number;
        const searchLng = args.lng as number;
        const searchRadiusMiles = (args.radius_miles as number) || 10;
        const searchRadiusMeters = searchRadiusMiles * 1609.34;
        try {
          const foundTrails =
            trailType === "hiking"
              ? await this.overpassService.fetchHikingTrails(
                  searchLat,
                  searchLng,
                  searchRadiusMeters,
                  10,
                )
              : await this.overpassService.fetchPavedTrails(
                  searchLat,
                  searchLng,
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
                    const dist = this.haversineDistanceMiles(searchLat, searchLng, tLat, tLng);
                    return `- ${t.name} (${t.surface}, ${(t.lengthMeters / 1000).toFixed(1)}km${t.lit ? ", lit" : ""}) [${tLat.toFixed(4)},${tLng.toFixed(4)}] ~${dist.toFixed(1)}mi away`;
                  })
                  .join("\n")
              : `No ${trailType} trails found in this area.`;
          if (onProgress && foundTrails.length > 0) {
            await onProgress(
              Math.round(10 + optionIndex * 25),
              `Discovered ${foundTrails.length} ${trailType} trails nearby`,
              foundTrails.map((t) => {
                const [tLng, tLat] = t.center;
                return {
                  name: t.name,
                  coordinates: t.center as [number, number],
                  type: "trail" as const,
                  distanceMiles: this.haversineDistanceMiles(searchLat, searchLng, tLat, tLng),
                  query: `${trailType} trails`,
                };
              }),
            );
          }
          return { output: resultText };
        } catch (err) {
          return { output: `Trail search failed: ${err instanceof Error ? err.message : "unknown error"}` };
        }
      },

      skip_tier: async () => {
        return { output: "Tier skipped", terminal: true };
      },

      submit_quest: async (args) => {
        const questData = args as unknown as LLMResponseRaw;
        if (questData.items && questData.items.length > 2) {
          questData.items = questData.items.slice(0, 2);
        }

        // Validate trail stops against actual search_trails results
        const trailItems = (questData.items || []).filter(
          (item) => item.vc === "trail",
        );
        const unmatchedTrails: string[] = [];
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
            unmatchedTrails.push(item.vn || "unknown");
          }
        }

        if (unmatchedTrails.length > 0) {
          const availableTrails = allTrails
            .slice(0, 5)
            .map((t) => t.name)
            .join(", ");
          return {
            output: "",
            rejection: `REJECTED: Trail "${unmatchedTrails.join(", ")}" was not found in your search_trails results. You MUST use a trail from your actual search results. Available trails: ${availableTrails}. Call submit_quest again with a trail from that list.`,
          };
        }

        return { output: "Quest accepted", terminal: true };
      },
    };

    const tierRadius = Math.round(input.radiusMiles * tier.radiusMultiplier);
    const initialMessage = `[${tier.name.toUpperCase()} TIER]\n${promptText}\nUser is near: ${city} (search this area AND surrounding cities/towns — do NOT limit to just this city)\nSearch radius: ~${tierRadius} miles from user\nBudget: $${tier.budgetCeiling} max${input.activityTypes?.length ? `\nVibes: ${input.activityTypes.join(", ")}` : ""}${input.intention ? `\nIntention: ${input.intention.replace("_", " ")}` : ""}`;

    const agentResult = await this.agent.run<LLMResponseRaw>({
      instructions,
      tools,
      toolHandlers,
      maxRounds: 12,
      temperature: 0.8,
      maxOutputTokens: 2500,
      caller: `sidequest_option_${optionIndex}`,
    }, initialMessage);

    if (agentResult.terminalTool === "skip_tier") {
      const reason = (agentResult.result as unknown as Record<string, string>).reason ?? "no results";
      console.log(`[SidequestService] Option ${optionIndex} (${tier.name}) skipped: ${reason}`);
      throw new Error(`TIER_SKIPPED: ${reason}`);
    }

    const llmResult = expandLLMResponse(agentResult.result);

    // Validate and enrich objectives
    const validatedItems = await this.validateAndEnrichObjectives(
      llmResult.items,
      allVenues,
      city,
      cityCenter,
      allTrails,
    );

    // Save objectives
    const objectives = validatedItems.map((vi, idx) =>
      objectiveRepo.create({
        sidequestId: child.id,
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
      }),
    );
    await objectiveRepo.save(objectives);

    // Mark child as READY
    child.title = llmResult.title;
    child.summary = llmResult.summary;
    child.status = SidequestStatus.READY;
    await repo.save(child);

    // Generate enhancements async
    this.generateEnhancements(child.id, objectives).catch((err) => {
      console.error(
        `[SidequestService] Failed to generate enhancements for option ${child.id}:`,
        err,
      );
    });
  }

  async getOptions(parentId: string): Promise<Sidequest[]> {
    return this.dataSource.getRepository(Sidequest).find({
      where: { parentId },
      relations: ["objectives"],
      order: { createdAt: "ASC", objectives: { sortOrder: "ASC" } },
    });
  }

  async selectOption(childId: string, userId: string): Promise<Sidequest> {
    const repo = this.dataSource.getRepository(Sidequest);
    const child = await repo.findOne({
      where: { id: childId, userId },
      relations: ["objectives"],
    });
    if (!child || !child.parentId) {
      throw new Error("Option not found or not a child sidequest");
    }

    const parentId = child.parentId;

    // Promote selected child to top-level
    // Use update() instead of save() — save() can skip nullable FK columns
    // when the associated @ManyToOne relation wasn't loaded, causing
    // parent_id to remain set and the child to be accidentally soft-deleted below.
    await repo.update(child.id, { parentId: null as unknown as string });
    child.parentId = undefined;

    // Soft-delete parent shell and rejected siblings
    await repo.softDelete({ parentId });
    await repo.softDelete({ id: parentId });

    return child;
  }

  async listByUser(
    userId: string,
    options: ListByUserOptions = {},
  ): Promise<{ data: Sidequest[]; nextCursor: string | null }> {
    const { limit = 20, cursor, sort = "newest", intention, status } = options;

    const qb = this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.objectives", "obj")
      .where("s.user_id = :userId", { userId })
      .andWhere("s.parent_id IS NULL");

    if (intention) {
      qb.andWhere("s.intention = :intention", { intention });
    }
    if (status === "completed") {
      qb.andWhere("s.completedAt IS NOT NULL");
    } else if (status === "upcoming") {
      qb.andWhere("s.completedAt IS NULL");
    }

    if (sort === "oldest") {
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(s.createdAt > :cursorDate OR (s.createdAt = :cursorDate AND s.id > :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("s.createdAt", "ASC").addOrderBy("s.id", "ASC");
    } else if (sort === "top_rated") {
      if (cursor) {
        const [cursorRating, cursorId] = cursor.split("|");
        const ratingVal =
          cursorRating === "null" ? null : Number(cursorRating);
        if (ratingVal === null) {
          qb.andWhere("(s.rating IS NULL AND s.id < :cursorId)", {
            cursorId,
          });
        } else {
          qb.andWhere(
            "(s.rating < :cursorRating OR (s.rating = :cursorRating AND s.id < :cursorId) OR s.rating IS NULL)",
            { cursorRating: ratingVal, cursorId },
          );
        }
      }
      qb.orderBy("s.rating", "DESC", "NULLS LAST").addOrderBy("s.id", "DESC");
    } else {
      // newest (default)
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(s.createdAt < :cursorDate OR (s.createdAt = :cursorDate AND s.id < :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("s.createdAt", "DESC").addOrderBy("s.id", "DESC");
    }

    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      if (sort === "oldest" || sort === "newest") {
        nextCursor = `${last.createdAt.toISOString()}|${last.id}`;
      } else if (sort === "top_rated") {
        nextCursor = `${last.rating ?? "null"}|${last.id}`;
      }
    }

    return { data, nextCursor };
  }

  async searchByUser(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<Sidequest[]> {
    if (!this.embeddingService) {
      // Fallback: simple ILIKE search on title/summary
      return this.dataSource
        .getRepository(Sidequest)
        .createQueryBuilder("s")
        .leftJoinAndSelect("s.objectives", "obj")
        .where("s.user_id = :userId", { userId })
        .andWhere("s.parent_id IS NULL")
        .andWhere("s.status = :status", { status: "READY" })
        .andWhere(
          "(s.title ILIKE :q OR s.summary ILIKE :q)",
          { q: `%${query}%` },
        )
        .orderBy("s.createdAt", "DESC")
        .take(limit)
        .getMany();
    }

    const queryEmbeddingSql = await this.embeddingService.getEmbeddingSql(query);

    // Use raw SQL for pgvector ordering — TypeORM's query builder
    // can't parse the ::vector cast in orderBy expressions.
    // Cosine distance threshold: 0 = identical, 2 = opposite. 0.55 keeps only
    // genuinely relevant matches.
    const MAX_DISTANCE = 0.55;
    const rawRows: { id: string }[] = await this.dataSource.query(
      `SELECT s.id
       FROM sidequests s
       WHERE s.user_id = $1
         AND s.parent_id IS NULL
         AND s.status = 'READY'
         AND s.embedding IS NOT NULL
         AND s.deleted_at IS NULL
         AND (s.embedding::vector <=> $2::vector) < $4
       ORDER BY s.embedding::vector <=> $2::vector ASC
       LIMIT $3`,
      [userId, queryEmbeddingSql, limit, MAX_DISTANCE],
    );

    if (rawRows.length === 0) return [];

    const ids = rawRows.map((r) => r.id);
    const rows = await this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.objectives", "obj")
      .whereInIds(ids)
      .getMany();

    // Preserve the similarity ordering from the raw query
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    return rows;
  }

  async getById(id: string, userId?: string): Promise<Sidequest | null> {
    const where: Record<string, string> = { id };
    if (userId) where.userId = userId;
    return this.dataSource.getRepository(Sidequest).findOne({
      where,
      relations: ["objectives"],
      order: { objectives: { sortOrder: "ASC" } },
    });
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const repo = this.dataSource.getRepository(Sidequest);

    const sidequest = await repo.findOne({
      where: { id, userId },
      select: ["id", "isPublished"],
    });

    const result = await repo.softDelete({ id, userId });
    const deleted = (result.affected ?? 0) > 0;

    if (deleted && sidequest?.isPublished) {
      this.publishChange({ id } as Sidequest, "DELETE").catch((err) => {
        console.error("[SidequestService] Failed to publish deletion:", err);
      });
    }

    return deleted;
  }

  async deleteByIds(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0;

    const repo = this.dataSource.getRepository(Sidequest);

    const sidequests = await repo.find({
      where: { id: In(ids), userId },
      select: ["id", "isPublished"],
    });

    const result = await repo.softDelete({ id: In(ids), userId });
    const deletedCount = result.affected ?? 0;

    for (const sq of sidequests) {
      if (sq.isPublished) {
        this.publishChange({ id: sq.id } as Sidequest, "DELETE").catch((err) => {
          console.error("[SidequestService] Failed to publish deletion:", err);
        });
      }
    }

    return deletedCount;
  }

  async generateShareToken(id: string, userId: string): Promise<string | null> {
    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({ where: { id, userId } });
    if (!sidequest) return null;

    if (sidequest.shareToken) return sidequest.shareToken;

    const shareToken = crypto.randomUUID();
    await repo.update({ id }, { shareToken });
    return shareToken;
  }

  async getByShareToken(shareToken: string): Promise<Sidequest | null> {
    return this.dataSource.getRepository(Sidequest).findOne({
      where: { shareToken, status: SidequestStatus.READY },
      relations: ["objectives"],
      order: { objectives: { sortOrder: "ASC" } },
    });
  }

  async rate(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Sidequest | null> {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return null;
    }

    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({ where: { id, userId } });

    if (!sidequest || !sidequest.completedAt) return null;

    const wasPublished = sidequest.isPublished;
    sidequest.rating = rating;
    if (comment) sidequest.ratingComment = comment;
    sidequest.isPublished = true;
    await repo.save(sidequest);

    if (!wasPublished) {
      this.publishChange(sidequest, "CREATE").catch((err) => {
        console.error("[SidequestService] Failed to publish change:", err);
      });
    }

    return sidequest;
  }

  async countCreatedSince(userId: string, since: Date): Promise<number> {
    return this.dataSource.getRepository(Sidequest).count({
      where: {
        userId,
        status: SidequestStatus.READY,
        createdAt: MoreThanOrEqual(since),
      },
    });
  }

  async listCompleted(userId: string, limit = 20): Promise<Sidequest[]> {
    return this.dataSource.getRepository(Sidequest).find({
      where: { userId, completedAt: Not(IsNull()) },
      relations: ["objectives"],
      order: { completedAt: "DESC" },
      take: limit,
    });
  }

  async promote(id: string, userId: string): Promise<Sidequest> {
    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({
      where: { id, userId },
      relations: ["objectives"],
    });

    if (!sidequest) {
      throw new Error("Sidequest not found");
    }
    if (!sidequest.completedAt) {
      throw new Error("Sidequest is not completed");
    }
    if (sidequest.promotedAt) {
      throw new Error("Sidequest is already promoted");
    }

    const tierOrder: SidequestTier[] = [
      SidequestTier.QUICK,
      SidequestTier.SWEET_SPOT,
      SidequestTier.BEST,
    ];
    const currentIdx = tierOrder.indexOf(
      sidequest.tier ?? SidequestTier.QUICK,
    );
    if (currentIdx >= tierOrder.length - 1) {
      throw new Error("Sidequest is already at the highest tier");
    }

    sidequest.tier = tierOrder[currentIdx + 1];
    sidequest.promotedAt = new Date();
    await repo.save(sidequest);

    return sidequest;
  }

  async browsePublished(
    options: BrowsePublishedOptions,
  ): Promise<BrowseSidequest[]> {
    const {
      city,
      intention,
      sort = "popular",
      limit = 20,
      cursor,
      excludeUserId,
    } = options;

    const qb = this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .innerJoin(User, "u", "u.id = s.user_id")
      .leftJoinAndSelect("s.objectives", "obj")
      .where("s.is_published = true")
      .andWhere("s.city = :city", { city })
      .andWhere("s.status = :status", { status: SidequestStatus.READY });

    if (excludeUserId) {
      qb.andWhere("s.user_id != :excludeUserId", { excludeUserId });
    }

    if (intention) {
      qb.andWhere("s.intention = :intention", { intention });
    }

    if (cursor) {
      const [cursorDate, cursorId] = cursor.split("|");
      qb.andWhere(
        "(s.completed_at < :cursorDate OR (s.completed_at = :cursorDate AND s.id < :cursorId))",
        { cursorDate, cursorId },
      );
    }

    qb.addSelect("u.first_name", "creatorFirstName");

    switch (sort) {
      case "recent":
        qb.orderBy("s.completed_at", "DESC").addOrderBy("s.id", "DESC");
        break;
      case "top_rated":
        qb.orderBy("s.rating", "DESC").addOrderBy("s.id", "DESC");
        break;
      case "popular":
      default:
        qb.addSelect(
          "s.times_adopted * 2 + COALESCE(s.rating, 0)",
          "popularity_score",
        );
        qb.orderBy("popularity_score", "DESC").addOrderBy("s.id", "DESC");
        break;
    }

    qb.take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const firstNameMap = new Map<string, string | null>();
    for (const row of raw) {
      firstNameMap.set(row.s_id, row.creatorFirstName || null);
    }

    return entities.map((sq) => {
      const objectives = (sq.objectives || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 3);
      return {
        id: sq.id,
        title: sq.title || null,
        summary: sq.summary || null,
        city: sq.city,
        intention: sq.intention || null,
        rating: sq.rating ?? null,
        timesAdopted: sq.timesAdopted,
        itemCount: (sq.objectives || []).length,
        creatorFirstName: firstNameMap.get(sq.id) ?? null,
        completedAt: sq.completedAt
          ? sq.completedAt.toISOString()
          : "",
        items: objectives.map((obj) => ({
          emoji: obj.emoji || null,
          title: obj.title,
          venueName: obj.venueName || null,
        })),
      };
    });
  }

  async getPopularStops(city: string, limit = 15): Promise<PopularStop[]> {
    const rows: {
      venue_name: string;
      venue_category: string | null;
      emoji: string | null;
      latitude: string | null;
      longitude: string | null;
      google_place_id: string | null;
      google_rating: string | null;
      frequency: string;
      completions: string;
    }[] = await this.dataSource.query(
      `
      SELECT
        o.venue_name,
        MODE() WITHIN GROUP (ORDER BY o.venue_category) AS venue_category,
        MODE() WITHIN GROUP (ORDER BY o.emoji) AS emoji,
        AVG(o.latitude)::numeric(10,7) AS latitude,
        AVG(o.longitude)::numeric(10,7) AS longitude,
        NULL AS google_place_id,
        NULL AS google_rating,
        COUNT(*)::int AS frequency,
        COUNT(o.checked_in_at)::int AS completions
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE LOWER(s.city) = LOWER($1)
        AND s.status = 'READY'
        AND o.venue_name IS NOT NULL
      GROUP BY LOWER(o.venue_name), o.venue_name
      HAVING COUNT(*) >= 2
      ORDER BY
        COUNT(*)::float
        * POWER(COUNT(o.checked_in_at)::float / GREATEST(COUNT(*), 1), 2)
        DESC
      LIMIT $2
      `,
      [city, limit],
    );

    return rows.map((r) => {
      const frequency = Number(r.frequency);
      const completions = Number(r.completions);
      const completionRate = frequency > 0 ? completions / frequency : 0;
      return {
        venueName: r.venue_name,
        venueCategory: r.venue_category,
        emoji: r.emoji,
        latitude: r.latitude ? Number(r.latitude) : null,
        longitude: r.longitude ? Number(r.longitude) : null,
        googlePlaceId: r.google_place_id,
        googleRating: r.google_rating ? Number(r.google_rating) : null,
        frequency,
        completions,
        completionRate: Math.round(completionRate * 100) / 100,
        score:
          Math.round(frequency * completionRate * completionRate * 100) / 100,
      };
    });
  }

  async listPublishedInternal(
    page: number,
    pageSize: number,
  ): Promise<{
    sidequests: InternalSidequest[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const offset = (page - 1) * pageSize;
    const repo = this.dataSource.getRepository(Sidequest);

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = [
      { isPublished: true, status: SidequestStatus.READY },
      {
        status: SidequestStatus.READY,
        entryLatitude: Not(IsNull()),
        createdAt: MoreThan(recentCutoff),
      },
    ];

    const [sidequests, total] = await Promise.all([
      repo.find({
        where,
        relations: ["objectives"],
        order: { updatedAt: "DESC", objectives: { sortOrder: "ASC" } },
        skip: offset,
        take: pageSize,
      }),
      repo.count({ where }),
    ]);

    const results: InternalSidequest[] = sidequests.map((sq) => ({
      id: sq.id,
      title: sq.title || null,
      summary: sq.summary || null,
      city: sq.city,
      categories: sq.categories || [],
      embedding: sq.embedding || null,
      entryLatitude: sq.entryLatitude != null ? Number(sq.entryLatitude) : null,
      entryLongitude:
        sq.entryLongitude != null ? Number(sq.entryLongitude) : null,
      rating: sq.rating ?? null,
      timesAdopted: sq.timesAdopted,
      items: (sq.objectives || []).map((obj) => ({
        id: obj.id,
        title: obj.title,
        emoji: obj.emoji || null,
        latitude: obj.latitude != null ? Number(obj.latitude) : null,
        longitude: obj.longitude != null ? Number(obj.longitude) : null,
        venueCategory: obj.venueCategory || null,
        sortOrder: obj.sortOrder,
      })),
    }));

    return {
      sidequests: results,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: offset + pageSize < total,
      },
    };
  }

  private async validateAndEnrichObjectives(
    items: LLMItem[],
    verifiedVenues: VerifiedVenue[],
    city: string,
    cityCenter?: { lat: number; lng: number },
    trails: Trail[] = [],
  ): Promise<{ item: LLMItem; geo: GeocodedData | null }[]> {
    const venueByName = new Map(
      verifiedVenues.map((v) => [v.name.toLowerCase(), v]),
    );
    const trailByName = new Map(trails.map((t) => [t.name.toLowerCase(), t]));

    const results: ({ item: LLMItem; geo: GeocodedData | null } | null)[] =
      await Promise.all(
        items.map(async (item) => {
          // Trail items: match against OSM trail data
          if (item.venueCategory === "trail" && item.venueName) {
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
            const matched = venueByName.get(item.venueName.toLowerCase());
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
              );

            if (placeResult.success && placeResult.place) {
              if (
                placeResult.place.businessStatus === "CLOSED_PERMANENTLY" ||
                placeResult.place.businessStatus === "CLOSED_TEMPORARILY"
              ) {
                console.log(
                  `[SidequestService] Dropping closed venue: "${item.venueName}" (${placeResult.place.businessStatus})`,
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
            `[SidequestService] Could not verify venue: "${item.venueName || item.venueAddress}" — keeping with no coordinates`,
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
          `[SidequestService] Error generating embedding for ${sidequestId}:`,
          error,
        );
      }
    }

    // 3. Generate category tags
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
              'You generate category tags for sidequests. Return a JSON array of 3-5 lowercase single-word tags that describe the sidequest\'s themes. Examples: ["outdoor", "food", "culture", "nightlife", "art", "music", "nature", "fitness", "shopping", "history"]. Respond with ONLY the JSON array.',
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
          if (Array.isArray(parsed)) {
            updates.categories = parsed
              .filter((t: unknown) => typeof t === "string")
              .slice(0, 5)
              .map((t: string) => t.toLowerCase());
          }
        } catch {
          console.warn(
            `[SidequestService] Failed to parse category tags: ${raw}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[SidequestService] Error generating categories for ${sidequestId}:`,
        error,
      );
    }

    // 4. Find entry points for trails, parks, and attractions
    const entryPointCategories = ["trail", "park", "attraction"];
    const objectivesNeedingEntryPoints = sortedObjectives.filter(
      (obj) =>
        obj.latitude != null &&
        obj.longitude != null &&
        obj.venueCategory &&
        entryPointCategories.includes(obj.venueCategory),
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
              `[SidequestService] Entry point search failed for "${obj.title}":`,
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

    // Publish to community map
    if (updates.entryLatitude != null && updates.entryLongitude != null) {
      const fresh = await repo.findOne({ where: { id: sidequestId } });
      if (fresh) {
        this.publishChange(fresh, "CREATE").catch((err) => {
          console.error(
            `[SidequestService] Failed to publish new sidequest ${sidequestId}:`,
            err,
          );
        });
      }
    }
  }

  private haversineDistanceMiles(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async publishChange(
    sidequest: Sidequest,
    operation: "CREATE" | "UPDATE" | "DELETE",
  ): Promise<void> {
    if (!this.redisService) return;

    try {
      if (operation === "DELETE") {
        await this.redisService.publishMessage("sidequest_changes", {
          operation,
          record: { id: sidequest.id },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const full = await this.dataSource.getRepository(Sidequest).findOne({
        where: { id: sidequest.id },
        relations: ["objectives"],
      });

      if (!full) return;

      const objectives = (full.objectives || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((obj) => ({
          id: obj.id,
          title: obj.title,
          emoji: obj.emoji ?? null,
          latitude: obj.latitude != null ? Number(obj.latitude) : null,
          longitude: obj.longitude != null ? Number(obj.longitude) : null,
          venueCategory: obj.venueCategory,
          sortOrder: obj.sortOrder,
        }));

      await this.redisService.publishMessage("sidequest_changes", {
        operation,
        record: {
          id: full.id,
          title: full.title,
          summary: full.summary,
          city: full.city,
          categories: full.categories,
          embedding: full.embedding,
          entryLatitude: full.entryLatitude != null ? Number(full.entryLatitude) : null,
          entryLongitude: full.entryLongitude != null ? Number(full.entryLongitude) : null,
          rating: full.rating != null ? Number(full.rating) : null,
          timesAdopted: full.timesAdopted,
          items: objectives,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[SidequestService] Error publishing change:", error);
    }
  }

  async getDeckStats(userId: string): Promise<DeckStats> {
    const repo = this.dataSource.getRepository(Sidequest);

    // All user's top-level READY sidequests (selected cards)
    const cards = await repo.find({
      where: {
        userId,
        status: SidequestStatus.READY,
        parentId: IsNull(),
      },
      relations: ["objectives"],
      order: { createdAt: "DESC" },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let completed = 0;
    let active = 0;
    let unplayed = 0;
    let newThisWeek = 0;
    const tierCounts: Record<string, number> = { QUICK: 0, SWEET_SPOT: 0, BEST: 0 };

    for (const card of cards) {
      // Tier
      if (card.tier && tierCounts[card.tier] !== undefined) {
        tierCounts[card.tier]++;
      }

      // Status
      if (card.completedAt) {
        completed++;
      } else if (card.objectives?.some((o) => o.checkedInAt)) {
        active++;
      } else {
        unplayed++;
      }

      // New this week
      if (card.createdAt >= weekAgo) {
        newThisWeek++;
      }
    }

    const totalCards = cards.length;

    // Recent cards (last 5 added)
    const recentCards = cards.slice(0, 5).map((card) => {
      const diffMs = now.getTime() - card.createdAt.getTime();
      const daysAgo = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
      return {
        name: card.title || "Untitled Quest",
        tier: card.tier || "QUICK",
        daysAgo,
      };
    });

    return {
      totalCards,
      cardsPlayed: completed,
      cardsActive: active,
      cardsInDeck: unplayed,
      newThisWeek,
      byTier: [
        { tier: "QUICK", label: "Quick & Easy", count: tierCounts.QUICK },
        { tier: "SWEET_SPOT", label: "Sweet Spot", count: tierCounts.SWEET_SPOT },
        { tier: "BEST", label: "Best Package", count: tierCounts.BEST },
      ],
      byStatus: [
        { status: "completed", label: "Completed", count: completed },
        { status: "active", label: "Active", count: active },
        { status: "unplayed", label: "Unplayed", count: unplayed },
      ],
      recentCards,
    };
  }
  // ─── Prescribed Quest (Wellness Pivot) ───────────────────────────

  async prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
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
      ],
    });

    if (!user) throw new Error("User not found");

    const homeLat = Number(user.homeLatitude ?? input.latitude);
    const homeLng = Number(user.homeLongitude ?? input.longitude);

    // 2. Build behavioral context from history
    const historyContext = await this.buildPrescriptionContext(userId);

    // 3. Reverse geocode for city
    let city = "Unknown";
    try {
      city = await this.geocodingService.reverseGeocodeCityState(
        homeLat,
        homeLng,
      );
    } catch {
      // Fall through with Unknown
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
      entryLatitude: homeLat,
      entryLongitude: homeLng,
    });
    await repo.save(sidequest);

    try {
      // 5. Generate via agent
      const allVenues: VerifiedVenue[] = [];
      const seenVenueIds = new Set<string>();
      const allTrails: Trail[] = [];
      const seenTrailIds = new Set<number>();

      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

      const pace = user.pacePreference ?? "steady";
      const comfortProfile = user.comfortProfile;

      const instructions = `You are a Comfort Zone Expansion Coach. You prescribe ONE location-based quest designed to gently expand this user's real world.

YOUR APPROACH:
- This is exposure therapy wrapped in adventure. The goal is to get the user slightly outside their comfort zone — not overwhelm them.
- Stretch on ONE dimension at a time: either further distance (familiar category) OR unfamiliar category (familiar distance). Never both.
- The user's current comfort radius is ${radius.toFixed(1)} miles from home. Prescribe something at or slightly beyond the edge.
- Keep it achievable. One stop. Low friction. The win is them going, not the venue being perfect.

USER PROFILE:
- Home: ${city} (${homeLat.toFixed(4)}, ${homeLng.toFixed(4)})
- Comfort radius: ${radius.toFixed(1)} miles
- Pace: ${pace === "gentle" ? "Gentle — ease them in, stay close, familiar categories" : pace === "push_me" ? "Push me — they want to be challenged, stretch further" : "Steady — balanced expansion, moderate stretches"}
${comfortProfile ? `- What keeps them from going out: "${comfortProfile.barriers}"` : ""}
${comfortProfile ? `- Their goals: "${comfortProfile.goals}"` : ""}
${user.onboardingProfile?.activities?.length ? `- Activities they enjoy: ${user.onboardingProfile.activities.join(", ")}` : ""}

${historyContext}

TOOLS:
- web_search: discover interesting spots
- search_places: verify venues with Google Places (exact name, address, coordinates)
- search_trails: find trails/paths from OpenStreetMap
- submit_quest: finalize the quest (TERMINAL)

CONSTRAINTS:
- EXACTLY 1 stop. This is a single-destination quest.
- Use EXACT venue names and addresses from search_places results.
- For trails, use ONLY trails returned by search_trails.
- Current time: ${hour}:00, ${dayOfWeek} — don't pick closed venues.
- Title: 3-6 words, encouraging and warm (not clinical).
- Summary: 1-2 sentences framing why this quest matters for their growth.
- hook: why THIS spot expands their world (1 sentence).
- sa (suggested activities): 3-4 things they could do at this spot. Each should start with an emoji. Keep it casual and short. Example: ["🚶 Walk the loop", "📖 Bring a book", "📸 Snap a photo", "☕ Grab a drink"]. Not assignments — just ideas.
- jp (journal prompt): a reflective question for after the visit. Short, open-ended. Examples: "How did it feel being somewhere new?", "Would you come back?", "What surprised you?"
- df (difficulty): 1-5 integer. 1 = very easy (familiar, close, low effort), 3 = moderate stretch, 5 = big push. Based on distance from home relative to their comfort radius, category familiarity, and social demands of the venue.
${hour >= 22 || hour < 6 ? `\nLATE-NIGHT MODE: It's late — focus on 24-hour spots, scenic night walks/viewpoints, or a "plan for tomorrow morning" quest.` : ""}`;

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
                    d: { type: "string", description: "Stop description" },
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
                        "Category: cafe|trail|park|restaurant|bar|museum|gallery|market|venue|attraction|other",
                    },
                    hook: {
                      type: "string",
                      description: "Why this spot expands their world",
                    },
                    sa: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "3-4 activity ideas, each starting with an emoji (e.g. '🚶 Walk the loop')",
                    },
                    jp: {
                      type: "string",
                      description:
                        "Journal prompt — reflective question for after the visit",
                    },
                    df: {
                      type: "number",
                      description:
                        "Difficulty 1-5. 1=very easy, 3=moderate stretch, 5=big push",
                    },
                  },
                  required: ["t", "d", "e", "ec", "vn", "va", "vc", "hook", "sa", "jp", "df"],
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
          const searchLat = args.lat as number;
          const searchLng = args.lng as number;
          const searchRadiusMiles = (args.radius_miles as number) || 10;
          const searchRadiusMeters = searchRadiusMiles * 1609.34;

          try {
            const foundTrails =
              trailType === "hiking"
                ? await this.overpassService.fetchHikingTrails(
                    searchLat,
                    searchLng,
                    searchRadiusMeters,
                    10,
                  )
                : await this.overpassService.fetchPavedTrails(
                    searchLat,
                    searchLng,
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
                        searchLat,
                        searchLng,
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
                      searchLat,
                      searchLng,
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
            (item) => item.vc === "trail",
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

      const initialMessage = `Prescribe a comfort-zone expansion quest for this user.
Their home is in ${city}. Search within ~${radius.toFixed(0)} miles of their home location.
${user.onboardingProfile?.activities?.length ? `They enjoy: ${user.onboardingProfile.activities.join(", ")}` : "Surprise them with something approachable."}`;

      if (onProgress) {
        await onProgress(10, "Analyzing your comfort zone...");
      }

      const agentResult = await this.agent.run<LLMResponseRaw>(
        {
          instructions,
          tools,
          toolHandlers,
          maxRounds: 12,
          temperature: 0.8,
          maxOutputTokens: 2500,
          caller: "prescribe_quest",
        },
        initialMessage,
      );

      if (onProgress) {
        await onProgress(80, "Building your quest...");
      }

      const llmResult = expandLLMResponse(agentResult.result);

      // Validate and enrich objectives
      const cityCenter = { lat: homeLat, lng: homeLng };
      const validatedItems = await this.validateAndEnrichObjectives(
        llmResult.items,
        allVenues,
        city,
        cityCenter,
        allTrails,
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

      // Assign rarity
      let rarity = "common";
      if (
        distanceFromHome != null &&
        primaryItem?.item.venueCategory
      ) {
        rarity = await this.comfortZoneService!.assignRarity(
          userId,
          distanceFromHome,
          primaryItem.item.venueCategory,
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
          journalPrompt: vi.item.journalPrompt ?? undefined,
          difficulty: vi.item.difficulty ?? undefined,
        }),
      );
      await objectiveRepo.save(objectives);

      // Update sidequest with results
      sidequest.title = llmResult.title;
      sidequest.summary = llmResult.summary;
      sidequest.status = SidequestStatus.READY;
      sidequest.rarity = rarity;
      sidequest.distanceFromHome = distanceFromHome;
      await repo.save(sidequest);

      // Generate enhancements async
      this.generateEnhancements(sidequest.id, objectives).catch((err) => {
        console.error(
          `[SidequestService] Failed to generate enhancements for prescribed quest ${sidequest.id}:`,
          err,
        );
      });

      console.log(
        `[SidequestService] Prescribed quest ${sidequest.id} for user ${userId}: "${llmResult.title}" (${rarity}, ${distanceFromHome?.toFixed(1) ?? "?"}mi from home)`,
      );

      // Reload with objectives
      const loaded = await repo.findOne({
        where: { id: sidequest.id },
        relations: ["objectives"],
        order: { objectives: { sortOrder: "ASC" } },
      });
      return loaded ?? sidequest;
    } catch (error) {
      console.error("[SidequestService] Prescription failed:", error);
      sidequest.status = SidequestStatus.FAILED;
      await repo.save(sidequest);
      throw error;
    }
  }

  /**
   * Build context string for the prescription agent based on user's quest history.
   */
  private async buildPrescriptionContext(userId: string): Promise<string> {
    // Recent completed quests (last 10)
    const recentQuests: {
      title: string;
      city: string;
      venue_category: string;
      distance_from_home: number;
      completed_at: string;
    }[] = await this.dataSource.query(
      `
      SELECT
        s.title,
        s.city,
        o.venue_category,
        s.distance_from_home,
        s.completed_at
      FROM sidequests s
      LEFT JOIN objectives o ON o.sidequest_id = s.id
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
      LIMIT 10
      `,
      [userId],
    );

    // Category breakdown
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

    if (recentQuests.length === 0) {
      return "HISTORY: This is a new user — no completed quests yet. Start gentle and close to home.";
    }

    const recentList = recentQuests
      .map(
        (q) =>
          `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
      )
      .join("\n");

    const categoryList = categories
      .map((c) => `${c.venue_category}: ${c.count}`)
      .join(", ");

    const mostVisitedCategory = categories[0]?.venue_category;
    const leastVisitedHint =
      categories.length > 2
        ? `Consider suggesting something in a DIFFERENT category than "${mostVisitedCategory}" to broaden their horizons.`
        : "";

    return `HISTORY (last ${recentQuests.length} quests):
${recentList}

CATEGORY BREAKDOWN: ${categoryList || "none yet"}
${leastVisitedHint}

PRESCRIPTION STRATEGY: Look at their history and prescribe something that meaningfully expands — a new category, a further distance, or an area of town they haven't explored.`;
  }
}

export function createSidequestService(
  deps: SidequestServiceDeps,
): SidequestService {
  return new SidequestServiceImpl(deps);
}
