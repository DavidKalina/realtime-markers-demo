import type { DataSource } from "typeorm";
import { Itinerary, ItineraryItem, ItineraryStatus } from "@realtime-markers/database";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { GoogleGeocodingService } from "./shared/GoogleGeocodingService";

export interface CreateItineraryInput {
  city: string;
  plannedDate: string; // YYYY-MM-DD
  budgetMin: number;
  budgetMax: number;
  durationHours: number;
  activityTypes: string[];
  stopCount: number; // 0 = let LLM decide
  categoryNames: string[]; // real DB category names for filtering
}

interface LLMItineraryItem {
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  emoji: string;
  estimatedCost: number | null;
  venueName: string | null;
  venueAddress: string | null;
  eventId: string | null;
  travelNote: string | null;
  venueCategory: string | null;
  whyThisStop: string | null;
  proTip: string | null;
}

interface LLMItineraryResponse {
  title: string;
  summary: string;
  items: LLMItineraryItem[];
}

interface CityEvent {
  id: string;
  title: string;
  emoji: string;
  eventDate: string;
  endDate: string | null;
  address: string | null;
  description: string | null;
  categories: string;
  latitude: number | null;
  longitude: number | null;
}

interface GeocodedData {
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  canonicalAddress: string | null;
}

export interface ItineraryService {
  create(userId: string, input: CreateItineraryInput): Promise<Itinerary>;
  listByUser(userId: string, limit?: number): Promise<Itinerary[]>;
  getById(id: string, userId: string): Promise<Itinerary | null>;
  deleteById(id: string, userId: string): Promise<boolean>;
  generateShareToken(id: string, userId: string): Promise<string | null>;
  getByShareToken(shareToken: string): Promise<Itinerary | null>;
}

interface ItineraryServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  geocodingService: GoogleGeocodingService;
}

class ItineraryServiceImpl implements ItineraryService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;

  constructor(deps: ItineraryServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
  }

  async create(userId: string, input: CreateItineraryInput): Promise<Itinerary> {
    const itineraryRepo = this.dataSource.getRepository(Itinerary);
    const itemRepo = this.dataSource.getRepository(ItineraryItem);

    // Create the itinerary record in GENERATING status
    const itinerary = itineraryRepo.create({
      userId,
      city: input.city,
      plannedDate: input.plannedDate,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      durationHours: input.durationHours,
      activityTypes: input.activityTypes,
      status: ItineraryStatus.GENERATING,
    });
    await itineraryRepo.save(itinerary);

    try {
      // Fetch events in the city for that date
      const events = await this.fetchCityEvents(input.city, input.plannedDate);

      // Build and call LLM
      const llmResult = await this.generateWithLLM(input, events);

      // Geocode non-event items
      const geocodedMap = await this.geocodeItems(llmResult.items, events, input.city);

      // Save items with geocoded data
      const items = llmResult.items.map((item, idx) => {
        const geo = geocodedMap.get(idx);
        return itemRepo.create({
          itineraryId: itinerary.id,
          sortOrder: idx,
          startTime: item.startTime,
          endTime: item.endTime,
          title: item.title,
          description: item.description,
          emoji: item.emoji,
          estimatedCost: item.estimatedCost ?? undefined,
          venueName: item.venueName ?? undefined,
          venueAddress: geo?.canonicalAddress ?? item.venueAddress ?? undefined,
          eventId: item.eventId ?? undefined,
          travelNote: item.travelNote ?? undefined,
          venueCategory: item.venueCategory ?? undefined,
          whyThisStop: item.whyThisStop ?? undefined,
          proTip: item.proTip ?? undefined,
          latitude: geo?.latitude ?? undefined,
          longitude: geo?.longitude ?? undefined,
          googlePlaceId: geo?.googlePlaceId ?? undefined,
          googleRating: geo?.googleRating ?? undefined,
        });
      });
      await itemRepo.save(items);

      // Update itinerary with title, summary, and READY status
      itinerary.title = llmResult.title;
      itinerary.summary = llmResult.summary;
      itinerary.status = ItineraryStatus.READY;
      await itineraryRepo.save(itinerary);

      itinerary.items = items;
      return itinerary;
    } catch (error) {
      console.error("[ItineraryService] Generation failed:", error);
      itinerary.status = ItineraryStatus.FAILED;
      await itineraryRepo.save(itinerary);
      throw error;
    }
  }

  async listByUser(userId: string, limit = 20): Promise<Itinerary[]> {
    return this.dataSource.getRepository(Itinerary).find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
      relations: ["items"],
    });
  }

  async getById(id: string, userId: string): Promise<Itinerary | null> {
    return this.dataSource.getRepository(Itinerary).findOne({
      where: { id, userId },
      relations: ["items"],
      order: { items: { sortOrder: "ASC" } },
    });
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(Itinerary)
      .delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  async generateShareToken(id: string, userId: string): Promise<string | null> {
    const repo = this.dataSource.getRepository(Itinerary);
    const itinerary = await repo.findOne({ where: { id, userId } });
    if (!itinerary) return null;

    // Return existing token if already shared
    if (itinerary.shareToken) return itinerary.shareToken;

    const shareToken = crypto.randomUUID();
    await repo.update({ id }, { shareToken });
    return shareToken;
  }

  async getByShareToken(shareToken: string): Promise<Itinerary | null> {
    return this.dataSource.getRepository(Itinerary).findOne({
      where: { shareToken, status: ItineraryStatus.READY },
      relations: ["items"],
      order: { items: { sortOrder: "ASC" } },
    });
  }

  private async fetchCityEvents(
    city: string,
    date: string,
  ): Promise<CityEvent[]> {
    return this.dataSource.query(
      `
      SELECT
        e.id,
        e.title,
        e.emoji,
        e.event_date AS "eventDate",
        e.end_date AS "endDate",
        e.address,
        e.description,
        ST_Y(e.location::geometry) AS "latitude",
        ST_X(e.location::geometry) AS "longitude",
        COALESCE(
          (SELECT string_agg(c.name, ', ')
           FROM event_categories ec
           JOIN categories c ON c.id = ec.category_id
           WHERE ec.event_id = e.id),
          ''
        ) AS categories
      FROM events e
      WHERE LOWER(e.city) = LOWER($1)
        AND e.status IN ('PENDING', 'VERIFIED')
        AND DATE(e.event_date) = $2
      ORDER BY e.event_date ASC
      LIMIT 50
      `,
      [city, date],
    );
  }

  private async geocodeItems(
    items: LLMItineraryItem[],
    events: CityEvent[],
    city: string,
  ): Promise<Map<number, GeocodedData>> {
    const result = new Map<number, GeocodedData>();
    const eventMap = new Map(events.map((e) => [e.id, e]));

    // Get city center coordinates for proximity bias
    let cityCenter: { lat: number; lng: number } | undefined;
    try {
      const [lng, lat] = await this.geocodingService.geocodeAddress(city);
      if (lat !== 0 || lng !== 0) {
        cityCenter = { lat, lng };
      }
    } catch {
      console.warn("[ItineraryService] Failed to geocode city center for:", city);
    }

    // Build geocoding promises
    const promises: Promise<void>[] = items.map(async (item, idx) => {
      // Event-linked items: use coordinates from DB
      if (item.eventId) {
        const event = eventMap.get(item.eventId);
        if (event?.latitude != null && event?.longitude != null) {
          result.set(idx, {
            latitude: Number(event.latitude),
            longitude: Number(event.longitude),
            googlePlaceId: null,
            googleRating: null,
            canonicalAddress: null,
          });
          return;
        }
      }

      // LLM-suggested venues: try Places search, then fallback to geocoding
      const searchQuery = item.venueName
        ? `${item.venueName} ${city}`
        : item.venueAddress
          ? `${item.venueAddress} ${city}`
          : null;

      if (!searchQuery) return;

      try {
        const placeResult = await this.geocodingService.searchPlaceForFrontend(
          searchQuery,
          cityCenter,
        );

        if (placeResult.success && placeResult.place) {
          const [lng, lat] = placeResult.place.coordinates;
          result.set(idx, {
            latitude: lat,
            longitude: lng,
            googlePlaceId: placeResult.place.placeId,
            googleRating: placeResult.place.rating ?? null,
            canonicalAddress: placeResult.place.address,
          });
          return;
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
            result.set(idx, {
              latitude: lat,
              longitude: lng,
              googlePlaceId: null,
              googleRating: null,
              canonicalAddress: null,
            });
          }
        } catch {
          // Graceful failure — item keeps null coordinates
        }
      }
    });

    await Promise.allSettled(promises);
    return result;
  }

  private async generateWithLLM(
    input: CreateItineraryInput,
    events: CityEvent[],
  ): Promise<LLMItineraryResponse> {
    const eventList =
      events.length > 0
        ? events
            .map(
              (e) =>
                `- [${e.id}] ${e.emoji || ""} "${e.title}" (${e.address || "N/A"}) | ${new Date(e.eventDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${e.endDate ? ` – ${new Date(e.endDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""} | Categories: ${e.categories || "General"}`,
            )
            .join("\n")
        : "No events found for this date. Create a suggested itinerary based on general knowledge of the city.";

    const budgetRange =
      input.budgetMax > 0
        ? `$${input.budgetMin}–$${input.budgetMax}`
        : "No budget constraint";

    const systemPrompt = `You are an expert local guide with insider knowledge of ${input.city}. Create a personalized, premium itinerary that feels like advice from a well-connected friend who knows all the best spots.

SOURCING RULES:
- Prioritize events from the provided list when they match the user's preferences
- Fill remaining slots with real, well-known venues — restaurants, cafes, parks, attractions, etc.
- NEVER invent fictional venues. Every suggestion must be a real, verifiable place.
- Use FULL street addresses including city and state (e.g., "123 Main St, Austin, TX")

PLANNING RULES:
- Stay within the time budget (${input.durationHours} hours)
- Stay within the spending budget (${budgetRange})
- Match the activity preferences: ${input.activityTypes.join(", ") || "any"}${input.categoryNames.length > 0 ? `\n- Focus on these categories: ${input.categoryNames.join(", ")}` : ""}
- ${input.stopCount > 0 ? `Include EXACTLY ${input.stopCount} stops` : "Choose the right number of stops for the duration"}
- Include travel/transition notes between stops
- Every stop MUST have a DIFFERENT venue — never repeat the same place
- If referencing a real event from the list, include its exact ID in eventId
- For non-event stops, set eventId to null
- Estimated costs should be realistic
- Times should be in 24h format (e.g., "14:00")

Respond ONLY with valid JSON matching this schema:
{
  "title": "A catchy 3-6 word title for the itinerary",
  "summary": "A 1-2 sentence exciting summary of the day plan",
  "items": [
    {
      "startTime": "14:00",
      "endTime": "15:30",
      "title": "Stop name",
      "description": "One concise sentence — what to do here",
      "emoji": "single emoji",
      "estimatedCost": 15.00,
      "venueName": "Venue Name",
      "venueAddress": "123 Main St, City, ST",
      "eventId": "uuid-or-null",
      "travelNote": "10 min walk from previous stop",
      "venueCategory": "cafe|restaurant|bar|park|museum|gallery|market|venue|attraction|other",
      "whyThisStop": "One sentence on why this stop is special or a hidden gem",
      "proTip": "Insider tip: best seat, what to order, timing trick, etc."
    }
  ]
}`;

    const userPrompt = `City: ${input.city}
Date: ${input.plannedDate}
Duration: ${input.durationHours} hours
Budget: ${budgetRange}
Activity preferences: ${input.activityTypes.join(", ") || "anything fun"}${input.categoryNames.length > 0 ? `\nFocus categories: ${input.categoryNames.join(", ")}` : ""}${input.stopCount > 0 ? `\nNumber of stops: exactly ${input.stopCount}` : ""}

Available events on this date:
${eventList}`;

    const responseText = await this.openAIService.executeResponse(
      {
        model: OpenAIModel.GPT52,
        instructions: systemPrompt,
        input: userPrompt,
        max_output_tokens: 6000,
        reasoning: { effort: "medium" },
      },
      "itinerary-generation",
    );

    // Parse JSON from response (handle markdown code blocks + truncation)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Extract JSON object if surrounded by other text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    // Try to repair truncated JSON by closing open structures
    let parsed: LLMItineraryResponse;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Attempt repair: close any unclosed strings, arrays, objects
      let repaired = jsonStr;
      // Remove trailing incomplete key-value or string
      repaired = repaired.replace(/,\s*"[^"]*$/, "");
      repaired = repaired.replace(/,\s*\{[^}]*$/, "");
      // Count and close open brackets
      const openBraces =
        (repaired.match(/\{/g) || []).length -
        (repaired.match(/\}/g) || []).length;
      const openBrackets =
        (repaired.match(/\[/g) || []).length -
        (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets; i++) repaired += "]";
      for (let i = 0; i < openBraces; i++) repaired += "}";
      parsed = JSON.parse(repaired);
    }

    // Validate eventIds — only keep IDs that exist in our events list
    const validEventIds = new Set(events.map((e) => e.id));
    for (const item of parsed.items) {
      if (item.eventId && !validEventIds.has(item.eventId)) {
        item.eventId = null;
      }
    }

    return parsed;
  }
}

export function createItineraryService(
  deps: ItineraryServiceDeps,
): ItineraryService {
  return new ItineraryServiceImpl(deps);
}
