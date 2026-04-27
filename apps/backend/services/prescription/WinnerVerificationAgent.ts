/**
 * WinnerVerificationAgent — fact-checks the validator's chosen venue against
 * the brief's quality profile by hitting the live web.
 *
 * The qualities pipeline classifies a venue from its name + category. That's
 * inference. The verification agent answers the same questions from web
 * research — current pricing, drop-in policy, hours, ambiance, upcoming
 * events. Ground truth beats inference, especially for the gray-area cases
 * (boutique gyms, niche venues) the LLM gets wrong.
 *
 * Cached aggressively by placeId — same venue researched once, reused for
 * 30 days. Real-world cost amortizes to near-zero as users repeat venues.
 */
import type { OpenAIResponsesAgent } from "../shared/OpenAIResponsesAgent";
import { OpenAIModel } from "../shared/OpenAIService";
import type { RedisService } from "../shared/RedisService";
import type { ScoutCandidate } from "./PrescriptionStrategy";
import {
  type VenueQuality,
  type VenueQualityProfile,
  sanitizeQualities,
  renderQualityVocabularyBlock,
} from "./VenueQualities";

export type VerificationVerdict = "approve" | "reject" | "uncertain";

export interface VenueVerification {
  venueName: string;
  placeId: string | null;
  verifiedAt: string;
  cached: boolean;
  /** Is the venue currently operating as a business? false = permanently closed. */
  currentlyOperating: boolean;
  /** Can a single person walk in and participate without a membership / advance signup? */
  dropInFriendly: boolean;
  /** Cost floor in USD for a single visit. null = unknown or genuinely free. */
  priceFloor: number | null;
  /** 1-2 sentence read on the actual room (vs. category inference). */
  ambianceNotes: string;
  /** AVOID terms research determined the venue actually triggers. */
  qualityViolations: VenueQuality[];
  /** MUST/PREFER terms research confirmed. */
  qualityConfirmations: VenueQuality[];
  /** Operating hours summary if findable, else null. */
  currentHours: string | null;
  /** Upcoming events / classes / specials worth surfacing in the quest copy. */
  upcomingEvents: string[];
  /** Anything else the writer should know — parking, dress code, regulars, vibes. */
  factualNotes: string;
  verdict: VerificationVerdict;
  reasoning: string;
}

interface VenueVerificationRaw {
  currentlyOperating?: boolean;
  dropInFriendly?: boolean;
  priceFloor?: number | null;
  ambianceNotes?: string;
  qualityViolations?: unknown;
  qualityConfirmations?: unknown;
  currentHours?: string | null;
  upcomingEvents?: unknown;
  factualNotes?: string;
  verdict?: string;
  reasoning?: string;
}

interface WinnerVerificationAgentDeps {
  agent: OpenAIResponsesAgent;
  redisService?: RedisService;
  model?: string;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export class WinnerVerificationAgent {
  private agent: OpenAIResponsesAgent;
  private redisService?: RedisService;
  private model: string;

  constructor(deps: WinnerVerificationAgentDeps) {
    this.agent = deps.agent;
    this.redisService = deps.redisService;
    this.model = deps.model ?? OpenAIModel.GPT54Mini;
  }

  async verify(input: {
    candidate: ScoutCandidate;
    profile: VenueQualityProfile;
    city: string;
  }): Promise<VenueVerification> {
    const cacheKey = this.buildCacheKey(input.candidate);
    const cached = await this.readCache(cacheKey);
    if (cached) return { ...cached, cached: true };

    const verification = await this.runVerification(input);
    await this.writeCache(cacheKey, verification);
    return verification;
  }

  private async runVerification(input: {
    candidate: ScoutCandidate;
    profile: VenueQualityProfile;
    city: string;
  }): Promise<VenueVerification> {
    const { candidate, profile, city } = input;

    const instructions = `You are a venue verification agent. Your job is to research a specific venue using web_search and verify whether it matches the required quality profile. Ground truth from the live web beats inference from the venue's name.

${renderQualityVocabularyBlock()}

VENUE TO VERIFY:
- Name: ${candidate.venueName}
- Address: ${candidate.venueAddress}
- Category: ${candidate.venueCategory}
${candidate.googlePrimaryTypeDisplayName ? `- Google primary type: ${candidate.googlePrimaryTypeDisplayName}` : ""}
${candidate.notes ? `- Notes: ${candidate.notes}` : ""}

REQUIRED QUALITY PROFILE FOR THIS WEEK'S REP:
- MUST match (deal-breakers if missing): ${profile.must.join(", ") || "(none)"}
- PREFER (nice to have): ${profile.prefer.join(", ") || "(none)"}
- AVOID (rejection signals): ${profile.avoid.join(", ") || "(none)"}

YOUR RESEARCH PROCESS:
1. Use web_search to find the venue's current website, recent reviews, social media, or directory listings. Search like a thoughtful friend would: "[venue name] [city] drop-in pricing", "[venue name] hours", "[venue name] reviews", "[venue name] events".
2. Determine: is it currently operating? does it require membership / advance signup? what's the price floor for a single visit? what's the actual ambiance (busy vs quiet, conversation-friendly vs intimate, etc.)?
3. Check for upcoming events, classes, open mic nights, or specials worth mentioning to the user.
4. Compare what the web says against the required quality profile.
5. Call submit_verification with your findings — TERMINAL ACTION.

VERDICT RULES:
- approve: research confirms the venue matches the required profile (no AVOID violations, MUST satisfied)
- reject: research finds at least one clear AVOID violation (e.g. confirmed membership-required when AVOID includes "requires-membership")
- uncertain: the venue is either ambiguous (some signals match, some don't) OR you couldn't get enough web information to be sure

Be honest about uncertain. Don't approve when you can't actually confirm. Don't reject when you can't actually refute.

When in doubt about pricing, search for "[venue name] day pass" or "[venue name] drop in".

Search context city: ${city}.`;

    type Tool = import("openai/resources/responses/responses").Tool;
    const tools: Tool[] = [
      {
        type: "web_search",
        user_location: { type: "approximate", city, country: "US" },
        search_context_size: "medium",
      },
      {
        type: "function",
        strict: false,
        name: "submit_verification",
        description: "Submit your verification findings for this venue. TERMINAL.",
        parameters: {
          type: "object" as const,
          properties: {
            currentlyOperating: { type: "boolean" },
            dropInFriendly: { type: "boolean" },
            priceFloor: {
              type: ["number", "null"],
              description:
                "Cost floor in USD for a single visit (no membership). null if unknown or genuinely free.",
            },
            ambianceNotes: {
              type: "string",
              description: "1-2 sentences describing the actual room",
            },
            qualityViolations: {
              type: "array",
              items: { type: "string" },
              description: "Vocabulary terms from AVOID that this venue triggers",
            },
            qualityConfirmations: {
              type: "array",
              items: { type: "string" },
              description: "Vocabulary terms from MUST/PREFER this venue confirms",
            },
            currentHours: {
              type: ["string", "null"],
              description:
                "Operating hours summary if found, else null. Example: 'Mon-Fri 7am-9pm, Sat-Sun 8am-5pm'",
            },
            upcomingEvents: {
              type: "array",
              items: { type: "string" },
              description:
                "Concrete upcoming events / classes worth mentioning, e.g. 'Wednesday open mic at 7pm — $5 cover'. Empty array if none found.",
            },
            factualNotes: {
              type: "string",
              description:
                "Anything else the quest writer should know — parking, dress code, what to expect, regulars, current specials.",
            },
            verdict: {
              type: "string",
              enum: ["approve", "reject", "uncertain"],
            },
            reasoning: {
              type: "string",
              description: "1-2 sentences justifying the verdict",
            },
          },
          required: [
            "currentlyOperating",
            "dropInFriendly",
            "ambianceNotes",
            "qualityViolations",
            "qualityConfirmations",
            "verdict",
            "reasoning",
          ],
        },
      },
    ];

    const baseVerification: VenueVerification = {
      venueName: candidate.venueName,
      placeId: candidate.placeId ?? null,
      verifiedAt: new Date().toISOString(),
      cached: false,
      currentlyOperating: true,
      dropInFriendly: false,
      priceFloor: null,
      ambianceNotes: "",
      qualityViolations: [],
      qualityConfirmations: [],
      currentHours: null,
      upcomingEvents: [],
      factualNotes: "",
      verdict: "uncertain",
      reasoning: "",
    };

    try {
      const result = await this.agent.run<VenueVerificationRaw>(
        {
          instructions,
          tools,
          toolHandlers: {
            submit_verification: async (args) => ({
              output: JSON.stringify(args),
              terminal: true,
            }),
          },
          maxRounds: 4,
          temperature: 0.2,
          maxOutputTokens: 1200,
          caller: "winner_verification",
          model: this.model as OpenAIModel,
        },
        `Research and verify "${candidate.venueName}" at ${candidate.venueAddress}.`,
      );

      const raw = result.result;
      return {
        ...baseVerification,
        currentlyOperating: raw.currentlyOperating !== false,
        dropInFriendly: Boolean(raw.dropInFriendly),
        priceFloor:
          typeof raw.priceFloor === "number" && Number.isFinite(raw.priceFloor)
            ? raw.priceFloor
            : null,
        ambianceNotes:
          typeof raw.ambianceNotes === "string"
            ? raw.ambianceNotes.slice(0, 400)
            : "",
        qualityViolations: sanitizeQualities(raw.qualityViolations),
        qualityConfirmations: sanitizeQualities(raw.qualityConfirmations),
        currentHours:
          typeof raw.currentHours === "string"
            ? raw.currentHours.slice(0, 200)
            : null,
        upcomingEvents: Array.isArray(raw.upcomingEvents)
          ? raw.upcomingEvents
              .filter((e): e is string => typeof e === "string")
              .map((e) => e.slice(0, 200))
              .slice(0, 5)
          : [],
        factualNotes:
          typeof raw.factualNotes === "string"
            ? raw.factualNotes.slice(0, 600)
            : "",
        verdict:
          raw.verdict === "approve" ||
          raw.verdict === "reject" ||
          raw.verdict === "uncertain"
            ? raw.verdict
            : "uncertain",
        reasoning:
          typeof raw.reasoning === "string"
            ? raw.reasoning.slice(0, 400)
            : "",
      };
    } catch (err) {
      console.error(
        `[winner_verification] Failed for "${candidate.venueName}":`,
        err,
      );
      return {
        ...baseVerification,
        verdict: "uncertain",
        reasoning: `Verification failed: ${(err as Error).message}`,
      };
    }
  }

  private buildCacheKey(candidate: ScoutCandidate): string {
    if (candidate.placeId) {
      return `venue-verification:place:${candidate.placeId}`;
    }
    // Fallback: hash the name + address. Less precise but better than skipping cache.
    const slug = `${candidate.venueName}:${candidate.venueAddress}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 200);
    return `venue-verification:fallback:${slug}`;
  }

  private async readCache(key: string): Promise<VenueVerification | null> {
    if (!this.redisService) return null;
    try {
      return await this.redisService.get<VenueVerification>(key);
    } catch (err) {
      console.warn("[winner_verification] Cache read failed:", err);
      return null;
    }
  }

  private async writeCache(
    key: string,
    verification: VenueVerification,
  ): Promise<void> {
    if (!this.redisService) return;
    try {
      await this.redisService.set(key, verification, CACHE_TTL_SECONDS);
    } catch (err) {
      console.warn("[winner_verification] Cache write failed:", err);
    }
  }
}
