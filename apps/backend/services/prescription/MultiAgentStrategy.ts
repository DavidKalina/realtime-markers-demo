/**
 * Multi-agent prescription strategy.
 *
 * Splits the monolithic single-agent flow into 4 specialized agents:
 *   1. Strategist (5.4 full) — decides what type of experience to prescribe
 *   2. Scout (mini) — searches for candidate venues
 *   3. Validator (code) — checks candidates against rules
 *   4. Writer (5.4 full) — crafts the quest content
 */

import {
  VENUE_CATEGORIES,
} from "./PrescriptionStrategy";
import type {
  PrescriptionStrategyInput,
  PrescriptionStrategyResult,
  LLMResponseRaw,
  StrategyBrief,
  ScoutCandidate,
  ScoutResult,
} from "./PrescriptionStrategy";
import { CapacityTrack } from "../../entities/Sidequest";
import type { OpenAIResponsesAgent, AgentToolResult } from "../shared/OpenAIResponsesAgent";
import type { OpenAIService } from "../shared/OpenAIService";
import { OpenAIModel } from "../shared/OpenAIService";
import type { GoogleGeocodingService } from "../shared/GoogleGeocodingService";
import type { GooglePlacesService, VerifiedVenue } from "../shared/GooglePlacesService";
import type { OverpassService, Trail } from "../shared/OverpassService";
import type { PrescriptionPromptRegistry } from "../prompts/PrescriptionPromptRegistry";

// ── Small geo helper (Slice E validator) ────────────────────

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Category normalization ──────────────────────────────────

/** Keyword-first, token-overlap fallback for when the Scout returns a non-canonical category string. */
function normalizeVenueCategory(raw: string): string {
  const lower = raw.toLowerCase();

  // Fast-path keyword matches for common patterns (order matters — first match wins)
  const keywordMap: [string[], string][] = [
    [["board game", "game cafe", "game store", "game venue", "tabletop", "game night", "game meetup", "social club"], "Board Game Venue"],
    [["coffee"], "Coffee Shop"],
    [["brunch"], "Brunch Spot"],
    [["theatre", "theater", "performing arts", "comedy", "improv", "stand-up", "standup", "matinee"], "Theatre / Performing Arts"],
    [["library"], "Library"],
    [["brewery", "taproom"], "Brewery / Taproom"],
    [["bookstore", "book shop"], "Bookstore"],
    [["art gallery", "gallery"], "Art Gallery"],
    [["art studio", "art class", "arts workshop", "ceramics", "pottery", "craft"], "Art Studio / Workshop"],
    [["music venue", "concert", "live music"], "Music Venue / Concert Hall"],
    [["museum"], "Museum"],
    [["yoga", "pilates"], "Yoga / Pilates Studio"],
    [["gym", "fitness studio", "crossfit"], "Gym / Fitness Studio"],
    [["climbing"], "Climbing Gym"],
    [["trail", "park", "greenway", "trailhead", "nature area"], "Trail / Park"],
    [["recreation center", "rec center", "recreation department"], "Recreation Center"],
    [["community center", "community arts", "community event"], "Community Center"],
    [["maker space", "makerspace", "tinkermill"], "Maker Space"],
    [["coworking", "co-working"], "Coworking Space"],
    [["college", "adult education", "continuing education", "community college"], "College / Adult Education"],
    [["workshop", "class venue"], "Workshop / Class Venue"],
    [["restaurant", "dining", "eatery"], "Restaurant"],
    [["bar", "pub", "lounge"], "Bar"],
    [["farmers market", "market"], "Food Market / Farmers Market"],
    [["arcade", "entertainment", "go-kart", "bowling", "mini golf"], "Arcade / Entertainment"],
    [["karaoke"], "Karaoke Venue"],
    [["surf", "skate"], "Surf / Skate Shop"],
    [["disc golf", "frisbee"], "Disc Golf / Outdoor Activity"],
    [["sports club", "paddle", "run club", "running"], "Sports Club"],
    [["bakery", "dessert", "pastry"], "Bakery / Dessert Shop"],
    [["yarn", "fiber", "knitting", "specialty shop"], "Specialty Shop"],
  ];

  for (const [keywords, canonical] of keywordMap) {
    if (keywords.some(k => lower.includes(k))) return canonical;
  }

  return "Other";
}

// ── Dependencies ────────────────────────────────────────────

export interface MultiAgentStrategyDeps {
  openAIService: OpenAIService;
  agent: OpenAIResponsesAgent;
  geocodingService: GoogleGeocodingService;
  placesService: GooglePlacesService;
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

export class MultiAgentStrategy {
  private openAIService: OpenAIService;
  private agent: OpenAIResponsesAgent;
  private geocodingService: GoogleGeocodingService;
  private placesService: GooglePlacesService;
  private overpassService: OverpassService;
  private promptRegistry: PrescriptionPromptRegistry;
  private models: AgentModelConfig;

  constructor(deps: MultiAgentStrategyDeps, models?: Partial<AgentModelConfig>) {
    this.openAIService = deps.openAIService;
    this.agent = deps.agent;
    this.geocodingService = deps.geocodingService;
    this.placesService = deps.placesService;
    this.overpassService = deps.overpassService;
    this.promptRegistry = deps.promptRegistry;
    this.models = { ...DEFAULT_MODELS, ...models };
  }

  async execute(input: PrescriptionStrategyInput): Promise<PrescriptionStrategyResult> {
    const { promptContext, onProgress } = input;

    // ── 1. Strategist (or skip if concept was pre-selected) ──
    let brief: StrategyBrief;

    if (input.chosenConcept) {
      // User already picked a concept — construct brief directly.
      // Concept-picker is a deprecated path (slice I retirement), so we
      // default capacity to NOVELTY_TOLERANCE — the user chose something new.
      brief = {
        capacityTrack: CapacityTrack.NOVELTY_TOLERANCE,
        repIntent: `Try something you picked yourself: "${input.chosenConcept.title}".`,
        experienceType: input.chosenConcept.experienceType,
        suggestedCategories: input.chosenConcept.suggestedCategories,
        targetCity: input.chosenConcept.targetCity,
        maxDistanceMiles: input.radius * 1.5,
        difficultyRange: [
          Math.max(1, input.chosenConcept.difficulty - 1),
          Math.min(10, input.chosenConcept.difficulty + 1),
        ],
        socialChallengeLevel: "low",
        searchQueries: input.chosenConcept.searchQueries,
        avoidVenues: [],
        avoidCategories: [],
        suggestedTiming: "",
        rationale: `User chose: "${input.chosenConcept.title}"`,
      };
      if (onProgress) await onProgress(15, "Finding your chosen quest...");
      console.log(`[multi-agent] Concept pre-selected: "${input.chosenConcept.title}" (${brief.suggestedCategories.join(", ")})`);
    } else {
      if (onProgress) await onProgress(10, "Planning your quest strategy...");
      brief = await this.runStrategist(input);
      console.log(`[multi-agent] Strategist: capacity=${brief.capacityTrack} ("${brief.repIntent}"), ${brief.experienceType} (${brief.suggestedCategories.join(", ")}), target=${brief.targetCity}, difficulty ${brief.difficultyRange[0]}-${brief.difficultyRange[1]}, social=${brief.socialChallengeLevel}, timing=${brief.suggestedTiming}`);

      // Slice E — enforce early-calibration guardrails as code. The prompt
      // asks the LLM to obey these, but we hard-clamp the brief so a single
      // rogue token can't push a new user to a crowded meetup on quest 2.
      if (promptContext.isEarlyCalibration) {
        const before = {
          maxDistance: brief.maxDistanceMiles,
          social: brief.socialChallengeLevel,
          diffMax: brief.difficultyRange[1],
        };
        if (brief.maxDistanceMiles > input.radius) {
          brief.maxDistanceMiles = input.radius;
        }
        if (brief.socialChallengeLevel === "medium" || brief.socialChallengeLevel === "high") {
          brief.socialChallengeLevel = "low";
        }
        if (brief.difficultyRange[1] > 5) {
          brief.difficultyRange = [Math.min(brief.difficultyRange[0], 5), 5];
        }
        const changed =
          before.maxDistance !== brief.maxDistanceMiles ||
          before.social !== brief.socialChallengeLevel ||
          before.diffMax !== brief.difficultyRange[1];
        if (changed) {
          console.log(`[multi-agent] Early-calibration clamp: distance ${before.maxDistance}→${brief.maxDistanceMiles}, social ${before.social}→${brief.socialChallengeLevel}, diffMax ${before.diffMax}→${brief.difficultyRange[1]}`);
        }
      }

      // Slice F — recurring-rejection pattern clamps. Hard guarantee the
      // dimension gets dampened even if the strategist fails to obey the
      // prompt guidance above.
      const pattern = promptContext.rejectionPattern;
      if (pattern) {
        const before = {
          maxDistance: brief.maxDistanceMiles,
          social: brief.socialChallengeLevel,
          diffMax: brief.difficultyRange[1],
          avoidCats: brief.avoidCategories.length,
        };
        switch (pattern.reason) {
          case "TOO_SOCIAL":
            brief.socialChallengeLevel = "none";
            break;
          case "TOO_FAR":
            brief.maxDistanceMiles = Math.min(brief.maxDistanceMiles, input.radius * 0.5);
            break;
          case "TOO_MUCH_EFFORT":
          case "NEED_GENTLER":
            brief.difficultyRange = [1, Math.min(3, brief.difficultyRange[1])];
            if (pattern.reason === "NEED_GENTLER") {
              brief.socialChallengeLevel = "none";
            }
            break;
          case "NOT_MY_VIBE":
            // Add the recurring-rejection categories to the avoid list so the
            // Scout skips them and the Validator hard-blocks any drift.
            for (const cat of pattern.categories) {
              if (cat && !brief.avoidCategories.includes(cat)) {
                brief.avoidCategories.push(cat);
              }
            }
            break;
          // TOO_PUBLIC + BAD_TIMING are prompt-only — no mechanical clamp.
        }
        const changed =
          before.maxDistance !== brief.maxDistanceMiles ||
          before.social !== brief.socialChallengeLevel ||
          before.diffMax !== brief.difficultyRange[1] ||
          before.avoidCats !== brief.avoidCategories.length;
        if (changed) {
          console.log(`[multi-agent] Rejection-pattern clamp (${pattern.reason} × ${pattern.count}): distance ${before.maxDistance}→${brief.maxDistanceMiles}, social ${before.social}→${brief.socialChallengeLevel}, diffMax ${before.diffMax}→${brief.difficultyRange[1]}, avoidCats ${before.avoidCats}→${brief.avoidCategories.length}`);
        }
      }
    }

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
      brief,
    };
  }

  // ── Strategist Agent ────────────────────────────────────────

  private async runStrategist(input: PrescriptionStrategyInput): Promise<StrategyBrief> {
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

` : "";

    const earlyCalibrationBlock = ctx.isEarlyCalibration
      ? `EARLY CALIBRATION MODE — READ FIRST:
This user has completed ${ctx.completedQuestCount ?? 0} of their first 5 quests. Trust is more important than growth right now — the first promise is "this app gets me enough that I can trust the next suggestion." Your job is to make this prescription almost impossible to fail.

HARD RULES (these are enforced by code — violating them means your brief gets overwritten):
- Stay INSIDE the user's comfort radius (${ctx.radius.toFixed(1)} mi). Do NOT push distance.
- socialChallengeLevel MUST be "none" or "low". No medium or high.
- difficultyRange upper bound MUST be 5 or less.
- Pick ONE gentle stretch dimension at most — if you're nudging category novelty, stay close; if you're nudging distance, stay in a familiar category. Never both.
- Favor capacity tracks that don't require interaction: ACTIVATION or PUBLIC_PRESENCE are strongly preferred. Reserve SOCIAL_EXTENSION, MICRO_INTERACTION, and SOCIAL_REACH for after quest 5.

` : "";

    const recalibrationBlock = ctx.lastRejection
      ? `RECALIBRATION — READ FIRST:
The user just rejected the previous prescription ${ctx.lastRejection.ageMinutes}m ago with reason: ${ctx.lastRejection.reason}${ctx.lastRejection.venueName ? ` (at "${ctx.lastRejection.venueName}")` : ""}.
Your new prescription MUST:
  (a) address that specific lever — TOO_SOCIAL → more solo / lower density; TOO_FAR → closer to home; TOO_PUBLIC → lower-traffic venue or off-peak timing; TOO_MUCH_EFFORT → lower activation cost, no gear/paid signup; NOT_MY_VIBE → different category; BAD_TIMING → different time-of-day; NEED_GENTLER → the gentlest version you can justify.
  (b) pick a DIFFERENT venue${ctx.lastRejection.venueName ? ` than "${ctx.lastRejection.venueName}"` : ""}.
  (c) explicitly acknowledge the adjustment in the "rationale" field, e.g. "Good signal — that was too social. Trying a solo-friendly version." Keep it warm and specific, not clinical.

` : "";

    const systemPrompt = `${rejectionPatternBlock}${earlyCalibrationBlock}${recalibrationBlock}You are a Social Life Strategist. Based on a user's profile, social situation, history, and growth phase, decide what TYPE of experience they need next AND where they should go to find it. You do NOT pick a specific venue — you create a strategy brief that a separate agent will use to search. Your job is to help someone build a real social life from scratch.

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

USER PROFILE:
- Home: ${ctx.city} (${ctx.homeLat.toFixed(4)}, ${ctx.homeLng.toFixed(4)})
- Comfort radius: ${ctx.radius.toFixed(1)} miles
- Pace: ${ctx.pace}
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
${ctx.user.onboardingProfile?.activities?.length ? `- Activities they enjoy: ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}
${ctx.socialSituationContext ? `
${ctx.socialSituationContext}

SOCIAL STRATEGY PRINCIPLES:
- Regularity beats novelty. Becoming a regular somewhere creates more connection than visiting 10 new places once.
- Co-ed group activities (classes, rec leagues, meetups) are the highest-leverage move for someone starting from zero — both for friends and dating.
- Venue timing matters: suggest evenings and weekends for social density, weekday mornings for low-pressure solo practice.
- Dating is a byproduct of having a social life, not a standalone goal. Build the social ecosystem first.
- Remote workers are starved for third places — coworking spaces, cafes with laptop culture, classes provide structure and faces.
- If they live alone, they need reasons to leave the house. Structure removes decision fatigue.
- Small towns require expanding the search radius. Push to nearby cities with more social infrastructure when the goal demands it.
` : ""}
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
GEOGRAPHIC & PRACTICAL INTELLIGENCE:
You must think about WHERE this person should go, not just WHAT they should do. Consider:
- Their home town's population, demographics, and what's realistically available there.
- Small towns (under 20K) have limited social infrastructure — coffee shops, a rec center, maybe a brewery. If their goal requires meeting new people, dating, or finding community, they WILL need to venture to larger nearby cities.
- Every quest doesn't need to push geographically, but the overall trajectory should expand their world over time. If they've done 5+ quests all in the same small town, it's time to push outward.
- Think about what cities within 30-40 miles have the density, scene, and demographics to support their goal. A 25-year-old looking for friends and dates in a retirement community won't find them no matter how many quests they do there.
- The user's comfort radius (${ctx.radius.toFixed(1)} mi) represents how far they've gone — not how far they SHOULD go. If they're ready, push past it. A quest in a new city is both a geographic AND a social stretch.
- Name a specific city or area to search in when relevant (e.g. "Search in Longmont" or "Search in Boulder's Pearl Street area").
- TRANSPORTATION: If they don't have a car, keep quests reachable by their transport mode. Don't send a transit rider 30 miles to a trailhead with no bus route.
- BUDGET: Respect their spending comfort. If they said "free only," don't prescribe a $40 pottery class. If budget is flexible, you can suggest paid experiences freely.
- SCHEDULE: Match quest timing to their availability. Shift workers need flexible-hour venues, not 9am weekday classes.

CURRENT TIME & DAY:
- It is currently ${ctx.hour}:00 on ${ctx.dayOfWeek}.
- The quest will be done TODAY or in the NEXT FEW DAYS. Factor in realistic timing:
  - If the user has a 9-to-5 schedule and it's a weekday, suggest EVENING activities (after 5:30pm) or plan for the upcoming weekend.
  - If it's a weekend, they have all day — mornings and afternoons are fair game.
  - Coffee shops are morning/afternoon venues (typically close by 5-6pm). Do NOT suggest coffee shops for evening quests.
  - Bars, breweries, restaurants, music venues, karaoke — these are evening-appropriate.
  - Classes, workshops, rec center activities — check if they're typically offered at the suggested time.
  - Trails/parks — consider daylight. Don't suggest a hike at 8pm in winter.
- Be SPECIFIC about timing in your suggestedTiming field: "weekday evening after 6pm", "this Saturday morning", "Sunday afternoon", etc.

Think holistically about this person:
- What would a thoughtful friend who knows the whole Front Range suggest?
- Is their current town limiting their progress? Be honest about this.
${ctx.blockerContext ? `- They have a RECURRING BLOCKER. Do NOT push the blocked action directly. What experience would build confidence AROUND the blocker without requiring them to do the thing they keep failing at?` : `- What specific type of social challenge would grow them right now?`}
- Are they stuck in a geographic or activity pattern that needs breaking?
- POTENTIAL REGULARS: If the history shows anchor venues (marked with ★), they're places the user enjoyed. You MAY suggest a return visit — but frame it as an invitation, not a pattern. The user hasn't said they want to be a regular anywhere yet. Use anchor venues when the strategy genuinely calls for deepening or when a return visit with a new angle (different time, social challenge, event) would be more valuable than a novel venue. Don't force it — mix return visits with exploration naturally.

${ctx.siblingInstructions ? `${ctx.siblingInstructions}\n` : ""}Respond with JSON:
{
  "capacityTrack": "ACTIVATION" | "PUBLIC_PRESENCE" | "NOVELTY_TOLERANCE" | "STAYING_POWER" | "RETURNABILITY" | "MICRO_INTERACTION" | "SOCIAL_EXTENSION" | "RECOVERY" | "IDENTITY_EVIDENCE",
  "repIntent": "<one-line rep description in capacity terms, under 20 words>",
  "experienceType": "<what kind of experience, e.g. 'hands-on creative workshop with strangers', 'casual trivia night at a brewery in a bigger city'>",
  "suggestedCategories": ["<2-3 specific venue categories to search for>"],
  "targetCity": "<specific city or area to search in, e.g. 'Longmont, CO' or 'Boulder Pearl Street area' — can be their home city if appropriate>",
  "maxDistanceMiles": <number — be willing to push this for growth>,
  "difficultyRange": [<min>, <max>],
  "socialChallengeLevel": "none" | "low" | "medium" | "high",
  "searchQueries": ["<2-3 specific search queries for finding venues — include the target city name>"],
  "preferredVenue": "<OPTIONAL — if returning to an anchor venue, put its exact name here so the Scout can verify it. Otherwise null>",
  "avoidVenues": ["<venue names to avoid from history>"],
  "avoidCategories": ["<categories that are overrepresented>"],
  "suggestedTiming": "<when to do this quest — be specific, e.g. 'weekday evening after 6pm', 'Saturday morning', 'Sunday afternoon'. Factor in user's schedule and venue hours>",
  "rationale": "<1-2 sentences explaining WHY this is the right next step, including why this capacity track + location>"
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

    // Slice C — normalize capacity track. Fall back to NOVELTY_TOLERANCE if the
    // strategist drops the field or emits an unknown value. That's a weak
    // default but keeps downstream persistence type-safe.
    const rawTrack = typeof parsed.capacityTrack === "string" ? parsed.capacityTrack.toUpperCase() : "";
    const capacityTrack = (Object.values(CapacityTrack) as string[]).includes(rawTrack)
      ? (rawTrack as CapacityTrack)
      : CapacityTrack.NOVELTY_TOLERANCE;
    const repIntent: string = typeof parsed.repIntent === "string" && parsed.repIntent.trim()
      ? parsed.repIntent.trim()
      : "Show up and see what happens.";

    return {
      capacityTrack,
      repIntent,
      experienceType: parsed.experienceType ?? "general exploration",
      suggestedCategories: parsed.suggestedCategories ?? [],
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
- Suggested timing: ${brief.suggestedTiming || "flexible"} — find venues that are OPEN and active at this time
- Rationale: ${brief.rationale}

USER HOME: ${input.city} (${input.searchLat.toFixed(4)}, ${input.searchLng.toFixed(4)})
TARGET SEARCH AREA: ${brief.targetCity} — search in this city/area specifically, NOT the user's home town (unless they're the same).

SEARCH QUERIES TO TRY: ${brief.searchQueries.join(", ")}

${brief.preferredVenue ? `SUGGESTED RETURN VENUE: "${brief.preferredVenue}" — The Strategist thinks this could be a good return visit. Use search_places to verify it exists and get its exact address. Include it as a candidate alongside new options.` : ""}
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
                  venueCategory: { type: "string", enum: VENUE_CATEGORIES as unknown as string[], description: "Pick the closest match from this list" },
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
          const venues = await this.placesService.searchPlacesByCategory(query, near, undefined, 5);
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

    const justRejectedVenue = ctx.lastRejection?.venueName?.toLowerCase() ?? null;

    for (const c of candidates) {
      const nameLower = c.venueName.toLowerCase();

      // Check for placeholder/fake venues
      if (!c.venueName || nameLower.includes("unknown") || nameLower.includes("tbd") || nameLower.includes("no verified")) {
        rejectionReasons.push(`"${c.venueName}" is not a real venue`);
        continue;
      }

      // Slice B: hard-block the venue the user just rejected on the prior prescription
      if (justRejectedVenue && nameLower === justRejectedVenue) {
        rejectionReasons.push(`"${c.venueName}" was just rejected by the user — pick a different venue`);
        continue;
      }

      // Slice F: for a recurring NOT_MY_VIBE pattern, hard-block the categories
      // the user has repeatedly rejected. The Scout is told to avoid them, but
      // sometimes drifts — this catches it.
      if (
        ctx.rejectionPattern?.reason === "NOT_MY_VIBE" &&
        ctx.rejectionPattern.categories.length > 0 &&
        c.venueCategory &&
        ctx.rejectionPattern.categories.some((cat) => cat.toLowerCase() === c.venueCategory.toLowerCase())
      ) {
        rejectionReasons.push(`"${c.venueName}" is in category "${c.venueCategory}" — user has a NOT_MY_VIBE pattern against this category (${ctx.rejectionPattern.count}× rejections)`);
        continue;
      }

      // Slice E — early calibration guard: candidate must be inside radius.
      // The Scout sometimes drifts outside the brief's maxDistance when it
      // finds a good match, so we enforce the constraint here too.
      if (ctx.isEarlyCalibration && typeof c.latitude === "number" && typeof c.longitude === "number") {
        const distMiles = haversineMiles(ctx.homeLat, ctx.homeLng, c.latitude, c.longitude);
        if (distMiles > ctx.radius) {
          rejectionReasons.push(`"${c.venueName}" is ${distMiles.toFixed(1)}mi away — outside the user's ${ctx.radius.toFixed(1)}mi radius (early-calibration phase)`);
          continue;
        }
      }

      // Hard-block venues the user said "would not return" to
      // These appear in the history context as "DO NOT PRESCRIBE THESE VENUES"
      if (historyLower.includes(`- "${nameLower}"`) && historyLower.includes("would not return")) {
        const inBlocklist = historyLower.includes(`- "${nameLower}" (`) &&
          historyLower.indexOf(`- "${nameLower}" (`) > historyLower.indexOf("would not return");
        if (inBlocklist) {
          rejectionReasons.push(`"${c.venueName}" — user said they would NOT return`);
          continue;
        }
      }

      // Normalize venue category to canonical taxonomy.
      // The Scout should return a canonical category, but LLMs don't always obey enums.
      // Fall back to best-match via token overlap.
      if (c.venueCategory && !VENUE_CATEGORIES.includes(c.venueCategory as any)) {
        c.venueCategory = normalizeVenueCategory(c.venueCategory);
      }

      // Check if venue appears too many times in history.
      // DFS anchor venues (marked with ✅ in the venue repeat block) get a much higher cap —
      // returning to a place where the user is making real progress is intentional, not lazy.
      const venueCount = (historyLower.match(new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      const isDfsAnchor = historyLower.includes(`✅ "${nameLower}"`);
      const repeatCap = isDfsAnchor ? 8 : 5;
      if (venueCount >= repeatCap) {
        rejectionReasons.push(`"${c.venueName}" appears ${venueCount} times in history — too many repeats${isDfsAnchor ? " (even for a DFS anchor)" : ""}`);
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

    const systemPrompt = `You are a Quest Writer for someone building a social life. You craft warm, encouraging quests that make showing up feel achievable — not clinical, not cringe. You receive a venue and a user profile — your job is to make this quest feel like something a thoughtful friend would suggest.

Write like that friend, not a therapist or a GPS app.

USER:
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
- Pace: ${ctx.pace}
${ctx.user.onboardingProfile?.activities?.length ? `- Interests: ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}

STRATEGY CONTEXT:
- Capacity rep (THE primary thing being trained): ${brief.capacityTrack} — "${brief.repIntent}"
- Experience type: ${brief.experienceType}
- Social challenge: ${brief.socialChallengeLevel}
- Suggested timing: ${brief.suggestedTiming || "flexible"}
- Rationale: ${brief.rationale}

The venue is the environment. The rep is the prescription. Your title, description, smaller/tiny versions, minimum viable win, and hook should all reinforce the capacity rep above — not just describe the venue.
${input.chosenConcept ? `
USER CHOSE THIS CONCEPT: "${input.chosenConcept.title}"
Honor their choice — your quest title and framing should align with what they picked. They chose this because it resonated, so lean into that direction.` : ""}
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

REP VARIANTS — IMPORTANT:
Every prescription MUST ship with three versions, a minimum viable win, and an exit ramp. This is how we make failure safe.

- "d" (full rep): the target version — what you'd ideally like them to do.
- "sr" (smaller rep): a reduced-intensity fallback. Same venue, same capacity direction, lower demand. Example if full is "attend the 45-minute class": smaller could be "walk in, stay for 10 minutes, leave when you want."
- "tr" (tiny rep): the minimum viable action. Still counts. Example: "walk to the entrance and decide whether to go in. Either answer is fine."
- "mvw" (minimum viable win): one short line describing what counts as "I did the thing." The bar for calling it done. Example: "You made it through the door." or "You stayed for one song."
- "er" (exit ramp): one short line describing how they can leave without failure. Example: "Leave anytime — no penalty, no explanation owed." or "If it feels off in the first 5 minutes, walk out."

The tiny rep should be almost impossible to fail. The full rep can stretch. Never prescribe multiple dimensions of stretch at once (not both distance AND social intensity — pick one).

Respond with JSON. The "items" array must contain EXACTLY 1 stop — no more:
{
  "t": "<title, 3-6 words, warm and encouraging>",
  "s": "<summary, 1-2 sentences framing why this quest matters for their growth>",
  "sn": "<strategy note: 1-2 sentences explaining WHY you chose this quest for this user right now. Write like a thoughtful friend explaining their reasoning. Reference specific things — their visit count, comfort progression, social tier, or growth phase. Examples: 'You've been here twice — a third visit is when staff start recognizing you.', 'This is a group class because you've proven you can go places solo. Time to be around people.'>",
  "items": [{
    "t": "<stop title>",
    "d": "<FULL REP. 2-3 sentences max. What to do — concrete and direct. No URLs or phone numbers here>",
    "sr": "<SMALLER REP. 1-2 sentences. Reduced intensity, same direction of growth. Required.>",
    "tr": "<TINY REP. 1-2 sentences. The minimum viable action — should feel almost impossible to fail. Required.>",
    "mvw": "<MINIMUM VIABLE WIN. One short line. What counts as 'done'. Required.>",
    "er": "<EXIT RAMP. One short line. How to leave without failure. Required.>",
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
    "df": <difficulty 1-10 — judge based on THIS venue for THIS person. Use the FULL range from the difficulty guidance, not just the bottom. If guidance says 4-7, don't default to 4>,
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
      // Fallback: build a minimal quest with graceful-degradation variants.
      return {
        t: `Visit ${venue.venueName}`,
        s: brief.rationale,
        sn: brief.rationale,
        items: [{
          t: venue.venueName,
          d: `Head to ${venue.venueName} and explore what catches your eye.`,
          sr: `Walk to ${venue.venueName}, step inside, stay for five minutes. Leave when you're ready.`,
          tr: `Walk to the entrance and decide whether to go in. Either answer counts.`,
          mvw: "You made it to the door.",
          er: "Leave anytime — no penalty, no explanation owed.",
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

      // Slice A: backfill rep variants if the Writer dropped any field.
      // A bad prescription is a trust break — never ship one without a graceful
      // downgrade path and a minimum viable win.
      const item = (parsed as any).items[0];
      const fullText: string = item.d ?? `Visit ${venue.venueName}.`;
      if (!item.sr || typeof item.sr !== "string" || !item.sr.trim()) {
        item.sr = `Go to ${venue.venueName}, stay about ten minutes, leave when you want.`;
      }
      if (!item.tr || typeof item.tr !== "string" || !item.tr.trim()) {
        item.tr = `Walk to the entrance of ${venue.venueName} and decide whether to go in. Either answer counts.`;
      }
      if (!item.mvw || typeof item.mvw !== "string" || !item.mvw.trim()) {
        item.mvw = "You made it to the door.";
      }
      if (!item.er || typeof item.er !== "string" || !item.er.trim()) {
        item.er = "Leave anytime — no penalty, no explanation owed.";
      }
      // Keep d (full rep) honest: if the writer emitted something shorter than the
      // smaller version, the variants are inverted. Don't try to repair — just log.
      if (item.sr && fullText && fullText.length < item.sr.length) {
        console.warn(`[multi-agent] Writer variants may be inverted — full (${fullText.length} chars) shorter than smaller (${item.sr.length} chars)`);
      }
    }

    return parsed as unknown as LLMResponseRaw;
  }
}
