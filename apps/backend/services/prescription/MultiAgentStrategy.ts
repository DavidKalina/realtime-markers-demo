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
  PrescriptionStrategy,
  PrescriptionStrategyInput,
  PrescriptionStrategyResult,
  LLMResponseRaw,
  StrategyBrief,
  ScoutCandidate,
  ScoutResult,
} from "./PrescriptionStrategy";
import type { OpenAIResponsesAgent, AgentToolResult } from "../shared/OpenAIResponsesAgent";
import type { OpenAIService } from "../shared/OpenAIService";
import { OpenAIModel } from "../shared/OpenAIService";
import type { GoogleGeocodingService, VerifiedVenue } from "../shared/GoogleGeocodingService";
import type { OverpassService, Trail } from "../shared/OverpassService";
import type { PrescriptionPromptRegistry } from "../prompts/PrescriptionPromptRegistry";

// ── Dependencies ────────────────────────────────────────────

export interface MultiAgentStrategyDeps {
  openAIService: OpenAIService;
  agent: OpenAIResponsesAgent;
  geocodingService: GoogleGeocodingService;
  overpassService: OverpassService;
  promptRegistry: PrescriptionPromptRegistry;
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

export class MultiAgentStrategy implements PrescriptionStrategy {
  private openAIService: OpenAIService;
  private agent: OpenAIResponsesAgent;
  private geocodingService: GoogleGeocodingService;
  private overpassService: OverpassService;
  private promptRegistry: PrescriptionPromptRegistry;
  private models: AgentModelConfig;

  constructor(deps: MultiAgentStrategyDeps, models?: Partial<AgentModelConfig>) {
    this.openAIService = deps.openAIService;
    this.agent = deps.agent;
    this.geocodingService = deps.geocodingService;
    this.overpassService = deps.overpassService;
    this.promptRegistry = deps.promptRegistry;
    this.models = { ...DEFAULT_MODELS, ...models };
  }

  async execute(input: PrescriptionStrategyInput): Promise<PrescriptionStrategyResult> {
    const { promptContext, onProgress } = input;

    // ── 1. Strategist ──────────────────────────────────────
    if (onProgress) await onProgress(10, "Planning your quest strategy...");

    const brief = await this.runStrategist(input);
    console.log(`[multi-agent] Strategist: ${brief.experienceType} (${brief.suggestedCategories.join(", ")}), target=${brief.targetCity}, difficulty ${brief.difficultyRange[0]}-${brief.difficultyRange[1]}, social=${brief.socialChallengeLevel}`);

    // ── 2. Scout + Validator loop ──────────────────────────
    let scoutResult: ScoutResult | null = null;
    let winner: ScoutCandidate | null = null;
    let extraConstraints = "";
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (onProgress) await onProgress(25 + attempt * 10, "Searching for the perfect spot...");

      scoutResult = await this.runScout(input, brief, extraConstraints);
      console.log(`[multi-agent] Scout: found ${scoutResult.candidates.length} candidates`);

      // Validate
      const validation = this.validateCandidates(scoutResult.candidates, promptContext);

      if (validation.accepted && validation.winner) {
        winner = validation.winner;
        console.log(`[multi-agent] Validator: accepted "${winner.venueName}" (${winner.venueCategory})`);
        break;
      }

      console.log(`[multi-agent] Validator: rejected (${validation.rejectionReasons.join(", ")})`);
      extraConstraints = validation.constraintsForRetry ?? "";

      // On last attempt, just pick the best available
      if (attempt === maxRetries && scoutResult.candidates.length > 0) {
        winner = scoutResult.candidates[0];
        console.log(`[multi-agent] Validator: forced acceptance of "${winner.venueName}" after retries`);
      }
    }

    if (!winner || !scoutResult) {
      throw new Error("Multi-agent strategy failed to find a venue after all retries");
    }

    // ── 3. Writer ──────────────────────────────────────────
    if (onProgress) await onProgress(65, "Crafting your quest...");

    const raw = await this.runWriter(input, brief, winner);
    console.log(`[multi-agent] Writer: "${raw.t}" — difficulty ${raw.items[0]?.df}`);

    if (onProgress) await onProgress(80, "Building your quest...");

    return {
      raw,
      allVenues: scoutResult.allVenues,
      allTrails: scoutResult.allTrails,
    };
  }

  // ── Strategist Agent ────────────────────────────────────────

  private async runStrategist(input: PrescriptionStrategyInput): Promise<StrategyBrief> {
    const ctx = input.promptContext;

    const systemPrompt = `You are a Quest Strategist. Based on a user's profile, history, and growth phase, decide what TYPE of experience they need next AND where they should go to find it. You do NOT pick a specific venue — you create a strategy brief that a separate agent will use to search.

USER PROFILE:
- Home: ${ctx.city} (${ctx.homeLat.toFixed(4)}, ${ctx.homeLng.toFixed(4)})
- Comfort radius: ${ctx.radius.toFixed(1)} miles
- Pace: ${ctx.pace}
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
${ctx.user.comfortProfile?.northStar ? `- North star: "${ctx.user.comfortProfile.northStar}"` : ""}
${ctx.user.onboardingProfile?.activities?.length ? `- Activities they enjoy: ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}

${ctx.fearLadderContext}
${ctx.expectancyContext}
${ctx.difficultyGuidance}

${ctx.historyContext}
${ctx.timelineContext ? `
${ctx.timelineContext}
` : ""}${ctx.blockerContext ? `
CRITICAL — RECURRING BLOCKER OVERRIDE:
${ctx.blockerContext}
The blocker context above TAKES PRIORITY over normal progression. Do NOT prescribe experiences that require the blocked action as a primary objective. Instead, prescribe experiences that build toward it indirectly — the user needs wins, not more failures. Set socialChallengeLevel to "none" or "low" and focus on activities where the blocked action might happen naturally but is NOT required.
` : ""}
GEOGRAPHIC INTELLIGENCE:
You must think about WHERE this person should go, not just WHAT they should do. Consider:
- Their home town's population, demographics, and what's realistically available there.
- Small towns (under 20K) have limited social infrastructure — coffee shops, a rec center, maybe a brewery. If their goal requires meeting new people, dating, or finding community, they WILL need to venture to larger nearby cities.
- Every quest doesn't need to push geographically, but the overall trajectory should expand their world over time. If they've done 5+ quests all in the same small town, it's time to push outward.
- Think about what cities within 30-40 miles have the density, scene, and demographics to support their goal. A 25-year-old looking for friends and dates in a retirement community won't find them no matter how many quests they do there.
- The user's comfort radius (${ctx.radius.toFixed(1)} mi) represents how far they've gone — not how far they SHOULD go. If they're ready, push past it. A quest in a new city is both a geographic AND a social stretch.
- Name a specific city or area to search in when relevant (e.g. "Search in Longmont" or "Search in Boulder's Pearl Street area").

Think holistically about this person:
- What would a thoughtful friend who knows the whole Front Range suggest?
- Is their current town limiting their progress? Be honest about this.
${ctx.blockerContext ? `- They have a RECURRING BLOCKER. Do NOT push the blocked action directly. What experience would build confidence AROUND the blocker without requiring them to do the thing they keep failing at?` : `- What specific type of social challenge would grow them right now?`}
- Are they stuck in a geographic or activity pattern that needs breaking?

Respond with JSON:
{
  "experienceType": "<what kind of experience, e.g. 'hands-on creative workshop with strangers', 'casual trivia night at a brewery in a bigger city'>",
  "suggestedCategories": ["<2-3 specific venue categories to search for>"],
  "targetCity": "<specific city or area to search in, e.g. 'Longmont, CO' or 'Boulder Pearl Street area' — can be their home city if appropriate>",
  "maxDistanceMiles": <number — be willing to push this for growth>,
  "difficultyRange": [<min>, <max>],
  "socialChallengeLevel": "none" | "low" | "medium" | "high",
  "searchQueries": ["<2-3 specific search queries for finding venues — include the target city name>"],
  "avoidVenues": ["<venue names to avoid from history>"],
  "avoidCategories": ["<categories that are overrepresented>"],
  "rationale": "<1-2 sentences explaining WHY this is the right next step, including why this location>"
}`;

    const userMessage = `What experience should this user have next? Think about what would genuinely move them toward their goal.`;

    const response = await this.openAIService.executeChatCompletion({
      model: this.models.strategist as OpenAIModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_completion_tokens: 800,
    }, "strategist_agent");

    const text = response.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(text);

    return {
      experienceType: parsed.experienceType ?? "general exploration",
      suggestedCategories: parsed.suggestedCategories ?? [],
      targetCity: parsed.targetCity ?? input.city,
      maxDistanceMiles: parsed.maxDistanceMiles ?? input.radius * 1.5,
      difficultyRange: parsed.difficultyRange ?? [2, 5],
      socialChallengeLevel: parsed.socialChallengeLevel ?? "low",
      searchQueries: parsed.searchQueries ?? [],
      avoidVenues: parsed.avoidVenues ?? [],
      avoidCategories: parsed.avoidCategories ?? [],
      rationale: parsed.rationale ?? "",
    };
  }

  // ── Scout Agent ─────────────────────────────────────────────

  private async runScout(
    input: PrescriptionStrategyInput,
    brief: StrategyBrief,
    extraConstraints: string,
  ): Promise<ScoutResult> {
    const allVenues: VerifiedVenue[] = [];
    const seenVenueIds = new Set<string>();
    const allTrails: Trail[] = [];
    const seenTrailIds = new Set<number>();

    const instructions = `You are a Venue Scout. Find 3-5 real venues matching this strategy brief.

STRATEGY:
- Experience type: ${brief.experienceType}
- Categories to search: ${brief.suggestedCategories.join(", ")}
- Target city/area: ${brief.targetCity}
- Max distance: ${brief.maxDistanceMiles.toFixed(1)} miles from user's home
- Social challenge: ${brief.socialChallengeLevel}
- Rationale: ${brief.rationale}

USER HOME: ${input.city} (${input.searchLat.toFixed(4)}, ${input.searchLng.toFixed(4)})
TARGET SEARCH AREA: ${brief.targetCity} — search in this city/area specifically, NOT the user's home town (unless they're the same).

SEARCH QUERIES TO TRY: ${brief.searchQueries.join(", ")}

${brief.avoidVenues.length > 0 ? `AVOID THESE VENUES: ${brief.avoidVenues.join(", ")}` : ""}
${brief.avoidCategories.length > 0 ? `AVOID THESE CATEGORIES (overrepresented): ${brief.avoidCategories.join(", ")}` : ""}
${extraConstraints ? `\nADDITIONAL CONSTRAINTS (from previous failed attempt):\n${extraConstraints}` : ""}

TOOLS:
- web_search: find events, classes, meetups
- search_places: verify venues with Google Places
- search_trails: find trails from OpenStreetMap
- submit_candidates: finalize your venue list (TERMINAL)

Find REAL venues with verified addresses. Use search_places to confirm. Submit 3-5 candidates ranked by fit.`;

    type Tool = import("openai/resources/responses/responses").Tool;
    const tools: Tool[] = [
      {
        type: "web_search",
        user_location: {
          type: "approximate",
          city: input.city,
          country: "US",
        },
        search_context_size: "medium",
      },
      {
        type: "function",
        strict: false,
        name: "search_places",
        description: "Search Google Places for verified venues near a location.",
        parameters: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "Search query" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            radiusMiles: { type: "number", description: "Search radius in miles (default 5)" },
          },
          required: ["query", "latitude", "longitude"],
        },
      },
      {
        type: "function",
        strict: false,
        name: "search_trails",
        description: "Find trails/paths from OpenStreetMap.",
        parameters: {
          type: "object" as const,
          properties: {
            latitude: { type: "number" },
            longitude: { type: "number" },
            radiusMeters: { type: "number" },
            surfaceType: { type: "string", enum: ["paved", "unpaved", "any"] },
          },
          required: ["latitude", "longitude"],
        },
      },
      {
        type: "function",
        strict: false,
        name: "submit_candidates",
        description: "Submit your ranked venue candidates. This is the terminal action.",
        parameters: {
          type: "object" as const,
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  venueName: { type: "string" },
                  venueAddress: { type: "string" },
                  venueCategory: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  notes: { type: "string", description: "Why this venue fits the strategy" },
                },
                required: ["venueName", "venueAddress", "venueCategory", "latitude", "longitude"],
              },
              minItems: 1,
              maxItems: 5,
            },
          },
          required: ["candidates"],
        },
      },
    ];

    let candidates: ScoutCandidate[] = [];

    const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<AgentToolResult>> = {
      search_places: async (args) => {
        const query = args.query as string;
        const lat = args.latitude as number;
        const lng = args.longitude as number;
        const radiusMiles = (args.radiusMiles as number) ?? 5;
        const radiusMeters = Math.round(radiusMiles * 1609.34);

        try {
          const near = `${lat},${lng}`;
          const venues = await this.geocodingService.searchPlacesByCategory(query, near, undefined, 5);
          const newVenues = venues.filter((v: VerifiedVenue) => !seenVenueIds.has(v.placeId));
          for (const v of newVenues) {
            seenVenueIds.add(v.placeId);
            allVenues.push(v);
          }

          if (input.onProgress) {
            await input.onProgress(35, `Found ${newVenues.length} spots for "${query}"`);
          }

          return {
            output: JSON.stringify(
              newVenues.map((v: VerifiedVenue) => ({
                name: v.name,
                address: v.address,
                rating: v.rating,
                latitude: v.coordinates[1],
                longitude: v.coordinates[0],
              })),
            ),
          };
        } catch (err) {
          return { output: `Search failed: ${err}` };
        }
      },

      search_trails: async (args) => {
        const lat = args.latitude as number;
        const lng = args.longitude as number;
        const radiusMeters = (args.radiusMeters as number) ?? 5000;
        const surfaceType = (args.surfaceType as string) ?? "any";

        try {
          const foundTrails = surfaceType === "unpaved"
            ? await this.overpassService.fetchHikingTrails(lat, lng, radiusMeters, 10)
            : await this.overpassService.fetchPavedTrails(lat, lng, radiusMeters, 10);
          const newTrails = foundTrails.filter((t: Trail) => !seenTrailIds.has(t.id));
          for (const t of newTrails) {
            seenTrailIds.add(t.id);
            allTrails.push(t);
          }

          return {
            output: JSON.stringify(
              newTrails.slice(0, 5).map((t: Trail) => ({
                name: t.name ?? "Unnamed trail",
                surface: t.surface,
                latitude: t.center?.[1],
                longitude: t.center?.[0],
              })),
            ),
          };
        } catch (err) {
          return { output: `Trail search failed: ${err}` };
        }
      },

      submit_candidates: async (args) => {
        const rawCandidates = args.candidates as ScoutCandidate[];
        candidates = rawCandidates.map((c) => ({
          ...c,
          source: "search_places" as const,
        }));
        return { output: "Candidates accepted", terminal: true };
      },
    };

    await this.agent.run(
      {
        instructions,
        tools,
        toolHandlers,
        maxRounds: 6,
        temperature: 0.5,
        maxOutputTokens: 1500,
        caller: "scout_agent",
        model: this.models.scout as OpenAIModel,
      },
      "Find venues matching the strategy brief. Use search_places to verify each candidate.",
    );

    return { candidates, allVenues, allTrails };
  }

  // ── Validator (pure code) ───────────────────────────────────

  private validateCandidates(
    candidates: ScoutCandidate[],
    ctx: PrescriptionStrategyInput["promptContext"],
  ): { accepted: boolean; winner?: ScoutCandidate; rejectionReasons: string[]; constraintsForRetry?: string } {
    if (candidates.length === 0) {
      return {
        accepted: false,
        rejectionReasons: ["No candidates found"],
        constraintsForRetry: "No venues were found. Try broader search queries or a larger search radius.",
      };
    }

    // Extract known venues/categories from history context
    const historyLower = ctx.historyContext.toLowerCase();
    const rejectionReasons: string[] = [];
    const validCandidates: ScoutCandidate[] = [];

    for (const c of candidates) {
      const nameLower = c.venueName.toLowerCase();

      // Check for placeholder/fake venues
      if (!c.venueName || nameLower.includes("unknown") || nameLower.includes("tbd") || nameLower.includes("no verified")) {
        rejectionReasons.push(`"${c.venueName}" is not a real venue`);
        continue;
      }

      // Check if venue appears too many times in history
      const venueCount = (historyLower.match(new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      if (venueCount >= 3) {
        rejectionReasons.push(`"${c.venueName}" appears ${venueCount} times in history — too many repeats`);
        continue;
      }

      validCandidates.push(c);
    }

    if (validCandidates.length === 0) {
      return {
        accepted: false,
        rejectionReasons,
        constraintsForRetry: `Previous candidates were rejected: ${rejectionReasons.join("; ")}. Find different venues — no repeats, no placeholder names.`,
      };
    }

    return {
      accepted: true,
      winner: validCandidates[0],
      rejectionReasons: [],
    };
  }

  // ── Writer Agent ────────────────────────────────────────────

  private async runWriter(
    input: PrescriptionStrategyInput,
    brief: StrategyBrief,
    venue: ScoutCandidate,
  ): Promise<LLMResponseRaw> {
    const ctx = input.promptContext;

    const systemPrompt = `You are a Quest Writer. You craft compelling, warm, encouraging quests that help people grow. You receive a venue and a user profile — your job is to make this quest feel personal and exciting, not clinical.

Write like a thoughtful friend, not a therapist or a GPS app.

USER:
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
${ctx.user.comfortProfile?.northStar ? `- North star: "${ctx.user.comfortProfile.northStar}"` : ""}
- Pace: ${ctx.pace}
${ctx.user.onboardingProfile?.activities?.length ? `- Interests: ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}

STRATEGY CONTEXT:
- Experience type: ${brief.experienceType}
- Social challenge: ${brief.socialChallengeLevel}
- Rationale: ${brief.rationale}
${ctx.blockerContext ? `
BLOCKER CONTEXT — READ THIS CAREFULLY:
This user has a recurring blocker. They keep failing at a specific action and it's destroying their confidence.
${ctx.blockerContext}
DO NOT include the blocked action as an objective, action item, or suggested activity. Instead, frame the quest around the VENUE EXPERIENCE ITSELF — enjoying the space, building comfort, noticing details. If social interaction might happen naturally, that's fine, but it must NOT be a prescribed step. The user needs to rebuild confidence through easy wins, not face another failure.` : ""}

${ctx.difficultyGuidance}

VENUE:
- Name: ${venue.venueName}
- Address: ${venue.venueAddress}
- Category: ${venue.venueCategory}
${venue.notes ? `- Why chosen: ${venue.notes}` : ""}

Respond with JSON. The "items" array must contain EXACTLY 1 stop — no more:
{
  "t": "<title, 3-6 words, warm and encouraging>",
  "s": "<summary, 1-2 sentences framing why this quest matters for their growth>",
  "items": [{
    "t": "<stop title>",
    "d": "<2-3 sentences max. What to do — concrete and direct. No URLs or phone numbers here>",
    "e": "<emoji>",
    "ec": <estimated cost or null>,
    "vn": "${venue.venueName}",
    "va": "${venue.venueAddress}",
    "eid": null,
    "vc": "${venue.venueCategory}",
    "hook": "<why THIS spot expands their world — 1 sentence, make it feel personal>",
    "sa": ["<2-3 emoji-prefixed activity ideas — what people typically do here. Examples: '🚶 Walk the loop', '📸 Snap a photo'. NO URLs or phones here>"],
    "ai": ["<1-3 concrete next steps with links/phones/instructions. Examples: '🔗 example.com/signup — register for class', '📞 (555) 123-4567 — ask about open hours'. Only include if actionable info exists, otherwise empty array>"],
    "jp": "<reflective journal prompt — short, open-ended, personal>",
    "df": <difficulty 1-10, judge based on THIS venue for THIS person>,
    "act": "<actionable|suggestive|milestone>"
  }]
}`;

    const response = await this.openAIService.executeChatCompletion({
      model: this.models.writer as OpenAIModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Write this quest. Make it warm and personal." },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_completion_tokens: 2000,
    }, "writer_agent");

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      console.error(`[multi-agent] Writer returned empty response. Finish reason: ${response.choices[0]?.finish_reason}`);
      // Fallback: build a minimal quest
      return {
        t: `Visit ${venue.venueName}`,
        s: brief.rationale,
        items: [{
          t: venue.venueName,
          d: `Head to ${venue.venueName} and explore what catches your eye.`,
          e: "📍",
          ec: null,
          vn: venue.venueName,
          va: venue.venueAddress,
          eid: null,
          vc: venue.venueCategory,
          hook: brief.rationale,
          sa: ["🚶 Just show up and look around", "📸 Take a photo", "💬 Say hi to someone"],
          ai: [],
          jp: "How did it feel to go somewhere new?",
          df: brief.difficultyRange[0],
          act: "suggestive",
        }],
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error(`[multi-agent] Writer returned invalid JSON (${text.length} chars). Attempting repair...`);
      // Try to repair truncated JSON by closing brackets
      let repaired = text;
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
      try {
        parsed = JSON.parse(repaired);
        console.log(`[multi-agent] JSON repair succeeded`);
      } catch {
        throw new Error(`Writer produced unparseable JSON: ${text.slice(0, 200)}...`);
      }
    }

    // Enforce single stop (Writer LLM may return extras despite prompt constraint)
    if ((parsed as any).items?.length > 1) {
      (parsed as any).items = (parsed as any).items.slice(0, 1);
    }

    // Ensure the venue details are correct (Writer might drift)
    if ((parsed as any).items?.[0]) {
      (parsed as any).items[0].vn = venue.venueName;
      (parsed as any).items[0].va = venue.venueAddress;
      (parsed as any).items[0].vc = venue.venueCategory;
    }

    return parsed as unknown as LLMResponseRaw;
  }
}
