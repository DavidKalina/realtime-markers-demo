import { DataSource } from "typeorm";
import { Event } from "@realtime-markers/database";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";

export interface EventHypeResult {
  cached: boolean;
  text?: string;
}

export interface EventHypeService {
  getEventHype(eventId: string): Promise<EventHypeResult>;
}

interface EventHypeDependencies {
  dataSource: DataSource;
  openAIService: OpenAIService;
  redisService: RedisService;
}

class EventHypeServiceImpl implements EventHypeService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private redisService: RedisService;

  constructor(deps: EventHypeDependencies) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.redisService = deps.redisService;
  }

  async getEventHype(eventId: string): Promise<EventHypeResult> {
    const cacheKey = `event-hype:${eventId}`;

    // Check cache
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      return { cached: true, text: cached };
    }

    // Fetch event with categories
    const eventRepository = this.dataSource.getRepository(Event);
    const event = await eventRepository.findOne({
      where: { id: eventId },
      relations: ["categories"],
    });

    if (!event) {
      return { cached: false, text: "Event not found." };
    }

    const { systemPrompt, userPrompt } = this.buildHypePrompt(event);

    const responseText = await this.openAIService.executeResponse({
      model: OpenAIModel.GPT52,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 400,
      reasoning: { effort: "none" },
    });

    const text = responseText || "No hype available.";

    return { cached: false, text };
  }

  private buildHypePrompt(event: Event): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = `You are the user's hype friend — the one who's been to everything and always knows the move. When they tap on an event, give them 2-4 insider nuggets they won't find on the flyer: parking/transit tips, what to wear or bring, food & drink recs nearby, crowd vibe, hidden gems, or why this one's worth it. 60-90 words max. Punchy, specific, no filler — talk like a friend texting, not a tour guide. Never repeat info already shown to the user (marked below). Plain text only — no markdown, no asterisks, no bullet points, no formatting.`;

    const categoryNames = (event.categories || [])
      .map((c) => c.name)
      .join(", ");
    const description = event.description
      ? event.description.slice(0, 300)
      : "";
    const dateStr = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    const parts: string[] = [
      `Title: ${event.title}`,
      dateStr ? `Date: ${dateStr}` : "",
      categoryNames ? `Categories: ${categoryNames}` : "",
      event.address ? `Location: ${event.address}` : "",
      description ? `Description: ${description}` : "",
      event.isRecurring ? `Recurring event` : "",
      event.viewCount ? `${event.viewCount} views` : "",
      event.saveCount ? `${event.saveCount} saves` : "",
    ].filter(Boolean);

    // Include digest so the model knows what NOT to repeat
    if (event.eventDigest) {
      const digest = event.eventDigest;
      const digestParts: string[] = [
        "\n--- INFO ALREADY SHOWN TO USER (do NOT repeat) ---",
        digest.summary ? `Summary: ${digest.summary}` : "",
        digest.cost ? `Cost: ${digest.cost}` : "",
        digest.highlights?.length
          ? `Highlights: ${digest.highlights.join("; ")}`
          : "",
        digest.contact ? `Contact: ${digest.contact}` : "",
      ].filter(Boolean);
      parts.push(digestParts.join("\n"));
    }

    return { systemPrompt, userPrompt: parts.join("\n") };
  }
}

export function createEventHypeService(
  deps: EventHypeDependencies,
): EventHypeService {
  return new EventHypeServiceImpl(deps);
}
