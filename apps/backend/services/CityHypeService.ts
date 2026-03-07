import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";
import { ThirdSpaceScoreService } from "./ThirdSpaceScoreService";

export interface CityHypeResult {
  cached: boolean;
  text?: string;
}

export interface CityHypeService {
  getCityHype(city: string): Promise<CityHypeResult>;
}

interface CityHypeDependencies {
  openAIService: OpenAIService;
  redisService: RedisService;
  thirdSpaceScoreService: ThirdSpaceScoreService;
}

class CityHypeServiceImpl implements CityHypeService {
  private openAIService: OpenAIService;
  private redisService: RedisService;
  private thirdSpaceScoreService: ThirdSpaceScoreService;

  constructor(deps: CityHypeDependencies) {
    this.openAIService = deps.openAIService;
    this.redisService = deps.redisService;
    this.thirdSpaceScoreService = deps.thirdSpaceScoreService;
  }

  async getCityHype(city: string): Promise<CityHypeResult> {
    const cacheKey = `city-hype:${city}`;

    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      return { cached: true, text: cached };
    }

    // Fetch the Third Space Score for context
    let scoreData: Awaited<
      ReturnType<ThirdSpaceScoreService["getCityScore"]>
    > | null = null;
    try {
      scoreData = await this.thirdSpaceScoreService.getCityScore(city);
    } catch {
      // Score data is supplementary — proceed without it
    }

    const { systemPrompt, userPrompt } = this.buildPrompt(city, scoreData);

    const responseText = await this.openAIService.executeResponse({
      model: OpenAIModel.GPT52,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 500,
      reasoning: { effort: "none" },
    });

    const text = responseText || "No city insight available.";

    return { cached: false, text };
  }

  private buildPrompt(
    city: string,
    scoreData: {
      current: {
        score: number;
        vitalityScore: number;
        discoveryScore: number;
        diversityScore: number;
        engagementScore: number;
        rootednessScore: number;
      };
      momentum: string;
      delta24h: number;
      contributors: {
        rank: number;
        firstName: string | null;
        currentTier: string;
        scanCount: number;
        label: string;
      }[];
    } | null,
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a local scene expert and community hype person. When someone opens a city page, give them a quick, energizing snapshot of the social scene — what makes this city's Third Space special, where the action is, and why they should contribute by scanning flyers. Write exactly 3-5 nuggets, one per line, separated by a single newline. Each line MUST be between 95 and 110 characters — this is a hard UI constraint. Shorter lines waste space, longer lines get cut off. Each line should be one complete, standalone thought. Cover these angles: the vibe/energy right now, standout neighborhoods or venues, what categories are thriving, how contributors are shaping the scene, and a nudge to scan and climb the ranks. Punchy, specific, no filler — talk like a friend who lives there, not a tourism board. Plain text only — no markdown, no asterisks, no bullet points, no formatting.`;

    const parts: string[] = [`City: ${city}`];

    if (scoreData) {
      const c = scoreData.current;
      parts.push(`Third Space Score: ${c.score}/100`);
      parts.push(`Momentum: ${scoreData.momentum} (${scoreData.delta24h >= 0 ? "+" : ""}${scoreData.delta24h} in 24h)`);
      parts.push(`Sub-scores — Vitality: ${c.vitalityScore}, Discovery: ${c.discoveryScore}, Diversity: ${c.diversityScore}, Engagement: ${c.engagementScore}, Rootedness: ${c.rootednessScore}`);

      if (scoreData.contributors.length > 0) {
        const topContributors = scoreData.contributors
          .slice(0, 3)
          .map(
            (ct) =>
              `${ct.firstName || "Anonymous"} (${ct.currentTier}, ${ct.scanCount} scans)`,
          )
          .join("; ");
        parts.push(`Top contributors: ${topContributors}`);
      }
    }

    return { systemPrompt, userPrompt: parts.join("\n") };
  }
}

export function createCityHypeService(
  deps: CityHypeDependencies,
): CityHypeService {
  return new CityHypeServiceImpl(deps);
}
