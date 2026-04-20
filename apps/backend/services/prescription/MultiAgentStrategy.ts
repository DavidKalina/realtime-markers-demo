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
  ScoutResult,
} from "./PrescriptionStrategy";
import {
  classifyScope,
  opportunityScopeLabel,
  resolveDistancePolicy,
  type DistancePolicyDecision,
} from "./DistancePolicy";
import { validateCandidates } from "./CandidateValidator";
import {
  applyStrategyBriefPatch,
  resolveRecalibrationPolicy,
} from "./RecalibrationPolicy";
import { rankScoutCandidates } from "./ScoutCandidateGrounding";
import { applyGoalMilestonePolicy } from "./GoalMilestonePolicy";
import { VenueScoutAgent } from "./VenueScoutAgent";
import { QuestWriterAgent } from "./QuestWriterAgent";
import { CapacityTrack } from "../../entities/Sidequest";
import type { OpenAIResponsesAgent } from "../shared/OpenAIResponsesAgent";
import type { OpenAIService } from "../shared/OpenAIService";
import { OpenAIModel } from "../shared/OpenAIService";
import type { GoogleGeocodingService } from "../shared/GoogleGeocodingService";
import type { GooglePlacesService } from "../shared/GooglePlacesService";
import type { OverpassService } from "../shared/OverpassService";
import type { PrescriptionPromptRegistry } from "../prompts/PrescriptionPromptRegistry";
import { OFFLINE_SOCIAL_DOMAIN_DOCTRINE } from "../shared/QuestConfig";

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
  private models: AgentModelConfig;
  private scoutAgent: VenueScoutAgent;
  private writerAgent: QuestWriterAgent;

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
  }

  async execute(
    input: PrescriptionStrategyInput,
  ): Promise<PrescriptionStrategyResult> {
    const { promptContext, onProgress } = input;

    // ── 1. Strategist ──────────────────────────────────────
    if (onProgress) await onProgress(10, "Planning your quest strategy...");
    const brief: StrategyBrief = await this.runStrategist(input);
    console.log(
      `[multi-agent] Strategist: capacity=${brief.capacityTrack} ("${brief.repIntent}"), ${brief.experienceType} (${brief.suggestedCategories.join(", ")}), target=${brief.targetCity}, difficulty ${brief.difficultyRange[0]}-${brief.difficultyRange[1]}, social=${brief.socialChallengeLevel}, timing=${brief.suggestedTiming}`,
    );

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

    // ── 2. Scout + Validator loop ──────────────────────────
    let scoutResult: ScoutResult | null = null;
    let winner: ScoutCandidate | null = null;
    let extraConstraints = "";
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (onProgress)
        await onProgress(
          25 + attempt * 10,
          "Searching for the perfect spot...",
        );

      scoutResult = await this.scoutAgent.run(input, brief, extraConstraints);
      console.log(
        `[multi-agent] Scout: found ${scoutResult.candidates.length} candidates`,
      );

      const validation = validateCandidates({
        candidates: scoutResult.candidates,
        ctx: promptContext,
        brief,
      });

      if (validation.accepted && validation.winner) {
        winner = validation.winner;
        console.log(
          `[multi-agent] Validator: accepted "${winner.venueName}" (${winner.venueCategory})`,
        );
        break;
      }

      console.log(
        `[multi-agent] Validator: rejected (${validation.humanReasons.join(", ")})`,
      );
      extraConstraints = validation.retryConstraints ?? "";
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

      // On last attempt, just pick the best available
      if (attempt === maxRetries && scoutResult.candidates.length > 0) {
        const fallbackCandidates = rankScoutCandidates(
          scoutResult.candidates.filter(
            (candidate) =>
              (candidate.distanceFromHome ?? Infinity) <=
              brief.maxDistanceMiles + 0.25,
          ),
          brief,
        );
        if (fallbackCandidates[0]) {
          winner = fallbackCandidates[0];
          console.log(
            `[multi-agent] Validator: forced acceptance of "${winner.venueName}" after retries`,
          );
        }
      }
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

    // ── 3. Writer ──────────────────────────────────────────
    if (onProgress) await onProgress(65, "Crafting your quest...");

    const raw = await this.writerAgent.run(input, brief, winner);
    console.log(
      `[multi-agent] Writer: "${raw.t}" — difficulty ${raw.items[0]?.df}`,
    );

    if (onProgress) await onProgress(80, "Building your quest...");

    return {
      raw,
      allVenues: scoutResult.allVenues,
      allTrails: scoutResult.allTrails,
      brief,
    };
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
- Remote workers are starved for third places — coworking spaces, cafes with laptop culture, classes provide structure and faces.
- If they live alone, they need reasons to leave the house. Structure removes decision fatigue.
- Small towns require expanding the search radius. Push to nearby cities with more social infrastructure when the goal demands it.
- When you push beyond the home base, name it as an intentional opportunity zone. Travel can be part of the rep, but it must not be accidental.
- For goal-closure milestones, do not keep preparing forever. If the milestone context says closure is due, choose a strategy that directly touches the named goal.

GEOGRAPHIC & PRACTICAL INTELLIGENCE:
You must think about WHERE this person should go, not just WHAT they should do. Consider:
- Their home town's population, demographics, and what's realistically available there.
- Small towns (under 20K) have limited social infrastructure — coffee shops, a rec center, maybe a brewery. If their goal requires meeting new people, dating, or finding community, they WILL need to venture to larger nearby cities.
- Every quest doesn't need to push geographically, but the overall trajectory should expand their world over time. If they've done 5+ quests all in the same small town, it's time to push outward.
- Think about what cities within 30-40 miles have the density, scene, and demographics to support their goal. A 25-year-old looking for friends and dates in a retirement community won't find them no matter how many quests they do there.
- The user's comfort radius represents how far they've gone — not how far they SHOULD go. If they're ready, push past it. A quest in a new city is both a geographic AND a social stretch.
- Name a specific city or area to search in when relevant (e.g. "Search in Longmont" or "Search in Boulder's Pearl Street area").
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

Respond with JSON:
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
  "rationale": "<1-2 sentences explaining WHY this is the right next step, including why this capacity track + location>",
  "opportunityScope": "local_home_base" | "nearby_social_zone" | "regional_opportunity",
  "travelRationale": "<required if opportunityScope is not local_home_base — why the travel is worth it for this goal>"
}`;

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
    const milestoneBlock = ctx.goalMilestoneContext
      ? `${ctx.goalMilestoneContext}\n\n`
      : "";

    const userMessage = `${rejectionPatternBlock}${earlyCalibrationBlock}${recalibrationBlock}USER PROFILE:
- Home: ${ctx.city} (${ctx.homeLat.toFixed(4)}, ${ctx.homeLng.toFixed(4)})
- Comfort radius: ${ctx.radius.toFixed(1)} miles
- Pace: ${ctx.pace}
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
${ctx.user.onboardingProfile?.activities?.length ? `- Activities they enjoy: ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}

${socialSituationBlock}${ctx.fearLadderContext}
${ctx.expectancyContext}
${ctx.difficultyGuidance}

${frameworkBlock}${milestoneBlock}${ctx.historyContext}
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
