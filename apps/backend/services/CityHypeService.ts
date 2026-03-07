import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";

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
}

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

class CityHypeServiceImpl implements CityHypeService {
  private openAIService: OpenAIService;
  private redisService: RedisService;

  constructor(deps: CityHypeDependencies) {
    this.openAIService = deps.openAIService;
    this.redisService = deps.redisService;
  }

  async getCityHype(city: string): Promise<CityHypeResult> {
    const cacheKey = `city-hype:${city}`;

    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      return { cached: true, text: cached };
    }

    const { systemPrompt, userPrompt } = this.buildPrompt(city);

    const responseText = await this.openAIService.executeResponse({
      model: OpenAIModel.GPT52,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 500,
      reasoning: { effort: "none" },
    });

    const text = responseText || "No city insight available.";

    await this.redisService.set(cacheKey, text, CACHE_TTL_SECONDS);

    return { cached: false, text };
  }

  private buildPrompt(city: string): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = `You are a local scene expert and community hype person. When someone opens a city page, give them a quick, energizing snapshot of what makes this city's social and cultural identity unique — its neighborhoods, creative energy, and the kinds of things that happen there. Write exactly 3-5 nuggets, one per line, separated by a single newline. Each line MUST be between 95 and 110 characters — this is a hard UI constraint. Shorter lines waste space, longer lines get cut off. Each line should be one complete, standalone thought. Cover these angles: the city's overall character and vibe, standout neighborhoods or cultural hubs, what kinds of events and scenes thrive there, what makes the local community distinctive, and a nudge to explore and contribute by scanning flyers. Focus on enduring traits, not current events or trending moments. Punchy, specific, no filler — talk like a friend who lives there, not a tourism board. Plain text only — no markdown, no asterisks, no bullet points, no formatting.`;

    return { systemPrompt, userPrompt: `City: ${city}` };
  }
}

export function createCityHypeService(
  deps: CityHypeDependencies,
): CityHypeService {
  return new CityHypeServiceImpl(deps);
}
