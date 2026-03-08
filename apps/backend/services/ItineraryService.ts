import type { DataSource } from "typeorm";
import {
  Itinerary,
  ItineraryItem,
  ItineraryStatus,
} from "@realtime-markers/database";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type {
  GoogleGeocodingService,
  VerifiedVenue,
} from "./shared/GoogleGeocodingService";

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

  async create(
    userId: string,
    input: CreateItineraryInput,
  ): Promise<Itinerary> {
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

      // Geocode city center early — needed for venue search and proximity bias
      let cityCenter: { lat: number; lng: number } | undefined;
      try {
        const [lng, lat] = await this.geocodingService.geocodeAddress(
          input.city,
        );
        if (lat !== 0 || lng !== 0) {
          cityCenter = { lat, lng };
        }
      } catch {
        console.warn(
          "[ItineraryService] Failed to geocode city center for:",
          input.city,
        );
      }

      // Pre-fetch verified venues from Google Places
      const verifiedVenues = cityCenter
        ? await this.fetchVerifiedVenues(input, input.city, cityCenter)
        : [];

      // Build and call LLM with events + verified venues
      const llmResult = await this.generateWithLLM(
        input,
        events,
        verifiedVenues,
      );

      // Validate and enrich items — verify venues, drop hallucinations
      const validatedItems = await this.validateAndEnrichItems(
        llmResult.items,
        events,
        verifiedVenues,
        input.city,
        cityCenter,
      );

      // Save items with geocoded data
      const items = validatedItems.map((vi, idx) =>
        itemRepo.create({
          itineraryId: itinerary.id,
          sortOrder: idx,
          startTime: vi.item.startTime,
          endTime: vi.item.endTime,
          title: vi.item.title,
          description: vi.item.description,
          emoji: vi.item.emoji,
          estimatedCost: vi.item.estimatedCost ?? undefined,
          venueName: vi.item.venueName ?? undefined,
          venueAddress:
            vi.geo?.canonicalAddress ?? vi.item.venueAddress ?? undefined,
          eventId: vi.item.eventId ?? undefined,
          travelNote: vi.item.travelNote ?? undefined,
          venueCategory: vi.item.venueCategory ?? undefined,
          whyThisStop: vi.item.whyThisStop ?? undefined,
          proTip: vi.item.proTip ?? undefined,
          latitude: vi.geo?.latitude ?? undefined,
          longitude: vi.geo?.longitude ?? undefined,
          googlePlaceId: vi.geo?.googlePlaceId ?? undefined,
          googleRating: vi.geo?.googleRating ?? undefined,
        }),
      );
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

  private async fetchVerifiedVenues(
    input: CreateItineraryInput,
    city: string,
    cityCenter: { lat: number; lng: number },
  ): Promise<VerifiedVenue[]> {
    // Map activity types / categories to Google Places search terms
    const searchTerms = new Set<string>();
    const typeMap: Record<string, string[]> = {
      food: ["restaurants", "cafes"],
      dining: ["restaurants", "cafes"],
      nightlife: ["bars", "nightlife"],
      culture: ["museums", "galleries"],
      outdoors: ["parks", "outdoor activities"],
      arts: ["galleries", "theaters"],
      music: ["live music venues"],
      shopping: ["shopping"],
    };

    for (const activity of input.activityTypes) {
      const mapped = typeMap[activity.toLowerCase()];
      if (mapped) {
        mapped.forEach((t) => searchTerms.add(t));
      }
    }

    for (const cat of input.categoryNames) {
      const mapped = typeMap[cat.toLowerCase()];
      if (mapped) {
        mapped.forEach((t) => searchTerms.add(t));
      }
    }

    // Fallback if nothing mapped
    if (searchTerms.size === 0) {
      searchTerms.add("popular attractions");
      searchTerms.add("things to do");
    }

    // Limit to 4 parallel searches
    const terms = [...searchTerms].slice(0, 4);
    const results = await Promise.allSettled(
      terms.map((term) =>
        this.geocodingService.searchPlacesByCategory(term, city, cityCenter, 5),
      ),
    );

    // Flatten and deduplicate by placeId
    const seen = new Set<string>();
    const venues: VerifiedVenue[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const venue of r.value) {
        if (!seen.has(venue.placeId)) {
          seen.add(venue.placeId);
          venues.push(venue);
        }
      }
    }

    console.log(
      `[ItineraryService] Fetched ${venues.length} verified venues for ${city}`,
    );
    return venues;
  }

  private async validateAndEnrichItems(
    items: LLMItineraryItem[],
    events: CityEvent[],
    verifiedVenues: VerifiedVenue[],
    city: string,
    cityCenter?: { lat: number; lng: number },
  ): Promise<{ item: LLMItineraryItem; geo: GeocodedData | null }[]> {
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const venueByName = new Map(
      verifiedVenues.map((v) => [v.name.toLowerCase(), v]),
    );

    const results: ({
      item: LLMItineraryItem;
      geo: GeocodedData | null;
    } | null)[] = await Promise.all(
      items.map(async (item) => {
        // Event-linked items: use DB coordinates
        if (item.eventId) {
          const event = eventMap.get(item.eventId);
          if (event?.latitude != null && event?.longitude != null) {
            return {
              item,
              geo: {
                latitude: Number(event.latitude),
                longitude: Number(event.longitude),
                googlePlaceId: null,
                googleRating: null,
                canonicalAddress: event.address,
              },
            };
          }
          // eventId was validated earlier — if no coords, keep with null geo
          return { item, geo: null };
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
            // Check business status — drop closed venues
            if (
              placeResult.place.businessStatus === "CLOSED_PERMANENTLY" ||
              placeResult.place.businessStatus === "CLOSED_TEMPORARILY"
            ) {
              console.log(
                `[ItineraryService] Dropping closed venue: "${item.venueName}" (${placeResult.place.businessStatus})`,
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

        // Fallback: geocode the address directly — venue may be real but not found via text search
        if (item.venueAddress) {
          try {
            const [lng, lat] = await this.geocodingService.geocodeAddress(
              `${item.venueAddress}, ${city}`,
            );
            if (lat !== 0 || lng !== 0) {
              console.log(
                `[ItineraryService] Venue "${item.venueName}" not found via Places API, using geocoded address`,
              );
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

        // Keep the item even without coordinates rather than dropping it
        console.log(
          `[ItineraryService] Could not verify venue: "${item.venueName || item.venueAddress}" — keeping with no coordinates`,
        );
        return { item, geo: null };
      }),
    );

    // Filter out dropped items
    return results.filter(
      (r): r is { item: LLMItineraryItem; geo: GeocodedData | null } =>
        r !== null,
    );
  }

  private async generateWithLLM(
    input: CreateItineraryInput,
    events: CityEvent[],
    verifiedVenues: VerifiedVenue[] = [],
  ): Promise<LLMItineraryResponse> {
    const eventList =
      events.length > 0
        ? events
            .map(
              (e) =>
                `- [${e.id}] ${e.emoji || ""} "${e.title}" (${e.address || "N/A"}) | ${new Date(e.eventDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${e.endDate ? ` – ${new Date(e.endDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""} | Categories: ${e.categories || "General"}`,
            )
            .join("\n")
        : "No scanned events for this date. Focus the itinerary on town staples — beloved local restaurants, iconic landmarks, popular parks, and must-visit spots that locals swear by.";

    const venueList =
      verifiedVenues.length > 0
        ? verifiedVenues
            .map(
              (v) =>
                `- "${v.name}" (${v.address}) | Rating: ${v.rating ?? "N/A"} | Type: ${v.types.slice(0, 3).join(", ")}`,
            )
            .join("\n")
        : "No pre-verified venues available. Suggest well-known, permanent local favorites instead.";

    const budgetRange =
      input.budgetMax > 0
        ? `$${input.budgetMin}–$${input.budgetMax}`
        : "No budget constraint";

    const systemPrompt = `You are an expert local guide with insider knowledge of ${input.city}. Create a personalized, premium itinerary that feels like advice from a well-connected friend who knows all the best spots.

SOURCING RULES (STRICT):
- EVENTS (concerts, shows, games, markets, pop-ups, etc.): ONLY use events from the EVENTS list below. Do NOT invent or suggest any event not on this list.
- VENUES (restaurants, cafes, parks, museums, landmarks, etc.): You may suggest year-round, always-available venues. Pick from the VERIFIED VENUES list when possible, but you may suggest other well-known, permanent establishments too.
- NEVER invent one-off happenings, seasonal events, or time-specific activities that aren't on the EVENTS list.
- Use the EXACT name and address from the lists when referencing them.
- If there are no scanned events, build the itinerary entirely from town staples — beloved local restaurants, iconic landmarks, popular parks, and must-visit spots. This is a great itinerary, not a consolation prize.
- If not enough options exist, create FEWER stops — never pad with fake events.
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
- "description" MUST be a single short sentence (max 10 words). Do NOT write long descriptions — the detail goes in whyThisStop and proTip instead

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

EVENTS (use ONLY these for event-type stops):
${eventList}

VERIFIED VENUES in ${input.city} (prefer these for non-event stops):
${venueList}`;

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
