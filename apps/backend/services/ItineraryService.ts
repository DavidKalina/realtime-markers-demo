import { type DataSource, Not, IsNull, LessThan } from "typeorm";
import {
  Itinerary,
  ItineraryItem,
  ItineraryStatus,
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
import type { WeatherService, DayForecast } from "./shared/WeatherService";
import type { GamificationService } from "./GamificationService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { RedisService } from "./shared/RedisService";
import { formatInTimeZone, toDate } from "date-fns-tz";

export interface AnchorStopInput {
  coordinates: [number, number]; // [lng, lat]
  label?: string;
  address?: string;
  placeId?: string;
  primaryType?: string;
  rating?: number;
  note?: string;
}

export interface CreateItineraryInput {
  itineraryId?: string; // Pre-created shell record ID
  title?: string; // Suggested title (e.g. from Get Away preview)
  city: string;
  plannedDate: Date; // ISO 8601 timestamptz
  budgetMin: number;
  budgetMax: number;
  durationHours: number;
  activityTypes: string[];
  stopCount: number; // 0 = let LLM decide
  startTime?: string; // HH:MM (24h) — optional fixed start
  endTime?: string; // HH:MM (24h) — optional fixed end
  intention?: string; // recharge | explore | socialize | move | learn | treat_yourself | lock_in
  anchorStops?: AnchorStopInput[];
  surpriseMe?: boolean;
  timezone?: string;
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

export interface ItinerarySuggestion {
  title: string;
  emoji: string;
  city: string;
  costTier: "$" | "$$" | "$$$";
  durationHours: number;
  stopCount: number;
  activityTypes: string[];
  intention: string;
  budgetMax: number;
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

export interface ItineraryService {
  createShell(
    userId: string,
    input: Omit<CreateItineraryInput, "stopCount">,
  ): Promise<Itinerary>;
  create(userId: string, input: CreateItineraryInput): Promise<Itinerary>;
  generateSuggestions(
    latitude: number,
    longitude: number,
  ): Promise<{ city: string; suggestions: ItinerarySuggestion[] }>;
  listByUser(
    userId: string,
    options?: ListByUserOptions,
  ): Promise<{ data: Itinerary[]; nextCursor: string | null }>;
  getById(id: string, userId?: string): Promise<Itinerary | null>;
  deleteById(id: string, userId: string): Promise<boolean>;
  generateShareToken(id: string, userId: string): Promise<string | null>;
  getByShareToken(shareToken: string): Promise<Itinerary | null>;
  getPopularStops(city: string, limit?: number): Promise<PopularStop[]>;
  rateItinerary(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Itinerary | null>;
  listCompleted(userId: string, limit?: number): Promise<Itinerary[]>;
  browsePublished(options: BrowsePublishedOptions): Promise<BrowseItinerary[]>;
  adoptItinerary(sourceId: string, userId: string): Promise<Itinerary>;
  listPublishedInternal(
    page: number,
    pageSize: number,
  ): Promise<{
    itineraries: InternalItinerary[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }>;
}

export interface InternalItinerary {
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

export interface BrowseItinerary {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  durationHours: number;
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

interface ItineraryServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  geocodingService: GoogleGeocodingService;
  overpassService: OverpassService;
  weatherService: WeatherService;
  gamificationService?: GamificationService;
  embeddingService?: IEmbeddingService;
  redisService?: RedisService;
}

class ItineraryServiceImpl implements ItineraryService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;
  private overpassService: OverpassService;
  private weatherService: WeatherService;
  private gamificationService?: GamificationService;
  private embeddingService?: IEmbeddingService;
  private redisService?: RedisService;

  constructor(deps: ItineraryServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
    this.overpassService = deps.overpassService;
    this.weatherService = deps.weatherService;
    this.gamificationService = deps.gamificationService;
    this.embeddingService = deps.embeddingService;
    this.redisService = deps.redisService;
  }

  async createShell(
    userId: string,
    input: Omit<CreateItineraryInput, "stopCount">,
  ): Promise<Itinerary> {
    const itineraryRepo = this.dataSource.getRepository(Itinerary);
    const city = input.city ? normalizeCity(input.city) : undefined;
    const shell = itineraryRepo.create({
      userId,
      city,
      title: input.title,
      plannedDate: input.plannedDate,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      durationHours: input.durationHours,
      activityTypes: input.activityTypes,
      intention: input.intention,
      status: ItineraryStatus.GENERATING,
      timezone: input.timezone,
    });
    await itineraryRepo.save(shell);
    return shell;
  }

  async create(
    userId: string,
    input: CreateItineraryInput,
  ): Promise<Itinerary> {
    const itineraryRepo = this.dataSource.getRepository(Itinerary);
    const itemRepo = this.dataSource.getRepository(ItineraryItem);

    // Infer city from anchor stops if not provided
    let city = input.city ? normalizeCity(input.city) : undefined;
    if (!city && input.anchorStops && input.anchorStops.length > 0) {
      const [lng, lat] = input.anchorStops[0].coordinates;
      try {
        city = await this.geocodingService.reverseGeocodeCityState(lat, lng);
        console.log(`[ItineraryService] Inferred city from anchor: ${city}`);
      } catch (err) {
        console.warn(
          "[ItineraryService] Failed to reverse-geocode city from anchor:",
          err,
        );
        city = "Unknown";
      }
    }

    // Use pre-created shell record if provided, otherwise create one
    let itinerary: Itinerary;
    if (input.itineraryId) {
      const existing = await itineraryRepo.findOne({
        where: { id: input.itineraryId, userId },
      });
      if (!existing) {
        throw new Error("Itinerary shell record not found");
      }
      itinerary = existing;
      // Update city if it was inferred from anchors
      if (city && !itinerary.city) {
        itinerary.city = city;
        await itineraryRepo.save(itinerary);
      }
    } else {
      itinerary = itineraryRepo.create({
        userId,
        city,
        plannedDate: input.plannedDate,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        durationHours: input.durationHours,
        activityTypes: input.activityTypes,
        intention: input.intention,
        status: ItineraryStatus.GENERATING,
        timezone: input.timezone,
      });
      await itineraryRepo.save(itinerary);
    }

    try {
      const tz = input.timezone ?? "UTC";
      const plannedDateStr = formatInTimeZone(
        input.plannedDate,
        tz,
        "yyyy-MM-dd",
      );

      // Fetch user's onboarding preferences (skip for "Surprise Me" — keep it fresh)
      let userPreferences: {
        activities: string[];
        vibes: string[];
        idealDay: string;
        pace: string;
      } | null = null;
      let preferenceEmbedding: string | null = null;
      if (!input.surpriseMe) {
        const userRepo = this.dataSource.getRepository(User);
        const userRecord = await userRepo.findOne({
          where: { id: userId },
          select: ["id", "onboardingProfile", "preferenceEmbedding"],
        });
        userPreferences = userRecord?.onboardingProfile ?? null;
        preferenceEmbedding = userRecord?.preferenceEmbedding ?? null;
      }

      // Fetch events in the city for that date (ranked by preference if available)
      const events = await this.fetchCityEvents(
        city,
        plannedDateStr,
        preferenceEmbedding,
      );

      // Geocode city center early — needed for venue search, weather, and trails
      // If anchor stops provided, use first anchor's coordinates as city center
      let cityCenter: { lat: number; lng: number } | undefined;
      if (input.anchorStops && input.anchorStops.length > 0) {
        const [lng, lat] = input.anchorStops[0].coordinates;
        cityCenter = { lat, lng };
        console.log(
          `[ItineraryService] Using first anchor stop as city center: ${lat}, ${lng}`,
        );
      } else {
        try {
          const [lng, lat] = await this.geocodingService.geocodeAddress(city);
          if (lat !== 0 || lng !== 0) {
            cityCenter = { lat, lng };
          } else {
            console.warn(
              "[ItineraryService] Google geocoding returned [0,0] for:",
              city,
            );
          }
        } catch (err) {
          console.warn(
            "[ItineraryService] Google geocoding threw for:",
            city,
            err,
          );
        }

        // Fallback: Open-Meteo free geocoding (no API key needed)
        if (!cityCenter) {
          cityCenter = await this.geocodeCityFallback(city);
        }
      }

      // Pre-fetch verified venues from Google Places
      const verifiedVenues = cityCenter
        ? await this.fetchVerifiedVenues(input, city, cityCenter)
        : [];

      // Fetch trails based on activity type
      const lowerActivities = input.activityTypes.map((a) => a.toLowerCase());
      const wantsPaved = lowerActivities.some((a) =>
        ["boarding", "skating", "outdoors"].includes(a),
      );
      const wantsHiking = lowerActivities.some((a) =>
        ["hiking", "walking", "outdoors"].includes(a),
      );

      const trails: Trail[] = [];
      if (cityCenter && (wantsPaved || wantsHiking)) {
        try {
          const [pavedResult, hikingResult] = await Promise.allSettled([
            wantsPaved
              ? this.overpassService.fetchPavedTrails(
                  cityCenter.lat,
                  cityCenter.lng,
                )
              : Promise.resolve([]),
            wantsHiking
              ? this.overpassService.fetchHikingTrails(
                  cityCenter.lat,
                  cityCenter.lng,
                )
              : Promise.resolve([]),
          ]);

          const pavedTrails =
            pavedResult.status === "fulfilled" ? pavedResult.value : [];
          const hikingTrails =
            hikingResult.status === "fulfilled" ? hikingResult.value : [];

          if (pavedResult.status === "rejected") {
            console.warn(
              "[ItineraryService] Paved trail fetch failed:",
              pavedResult.reason?.message ?? pavedResult.reason,
            );
          }
          if (hikingResult.status === "rejected") {
            console.warn(
              "[ItineraryService] Hiking trail fetch failed:",
              hikingResult.reason?.message ?? hikingResult.reason,
            );
          }

          // Merge and deduplicate by OSM ID
          const seen = new Set<number>();
          for (const t of [...pavedTrails, ...hikingTrails]) {
            if (!seen.has(t.id)) {
              seen.add(t.id);
              trails.push(t);
            }
          }
        } catch (err) {
          console.warn(
            "[ItineraryService] Trail fetch failed, continuing without trails:",
            err,
          );
        }
      }

      // Fetch weather forecast and past venues in parallel
      const [forecast, previousVenues] = await Promise.all([
        cityCenter
          ? this.weatherService.getForecast(
              cityCenter.lat,
              cityCenter.lng,
              plannedDateStr,
            )
          : Promise.resolve(null),
        this.fetchPreviousVenues(userId, city),
      ]);

      // Build and call LLM with events + verified venues + trails + context
      if (input.anchorStops) {
        console.log(
          `[ItineraryService] Anchor stops passed to LLM: ${input.anchorStops.length}`,
          JSON.stringify(
            input.anchorStops.map((a) => ({
              label: a.label,
              coords: a.coordinates,
            })),
          ),
        );
      }
      const llmResult = await this.generateWithLLM(
        input,
        events,
        verifiedVenues,
        trails,
        forecast,
        previousVenues,
        input.intention,
        input.anchorStops,
        city,
        userPreferences,
      );
      console.log(
        `[ItineraryService] LLM returned ${llmResult.items.length} items:`,
        llmResult.items.map((i) => i.venueName || i.title),
      );

      // Validate and enrich items — verify venues, drop hallucinations
      const validatedItems = await this.validateAndEnrichItems(
        llmResult.items,
        events,
        verifiedVenues,
        city,
        cityCenter,
        trails,
      );
      console.log(
        `[ItineraryService] After validation: ${validatedItems.length} items:`,
        validatedItems.map((v) => v.item.venueName || v.item.title),
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

      // Update itinerary with title, summary, forecast, and READY status
      itinerary.title = llmResult.title;
      itinerary.summary = llmResult.summary;
      itinerary.forecast = forecast as Record<string, unknown> | undefined;
      itinerary.status = ItineraryStatus.READY;

      // Set plannedDate to the first stop's start time on the planned day
      const firstItem = items
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (firstItem?.startTime) {
        itinerary.plannedDate = toDate(
          `${plannedDateStr}T${firstItem.startTime}:00`,
          { timeZone: tz },
        );
      }

      await itineraryRepo.save(itinerary);

      itinerary.items = items;

      // Generate embedding, categories, and entry point asynchronously (non-blocking)
      this.generateItineraryEnhancements(itinerary.id, items).catch((err) => {
        console.error(
          `[ItineraryService] Failed to generate enhancements for ${itinerary.id}:`,
          err,
        );
      });

      return itinerary;
    } catch (error) {
      console.error("[ItineraryService] Generation failed:", error);
      itinerary.status = ItineraryStatus.FAILED;
      await itineraryRepo.save(itinerary);
      throw error;
    }
  }

  async generateSuggestions(
    latitude: number,
    longitude: number,
  ): Promise<{ city: string; suggestions: ItinerarySuggestion[] }> {
    const city = await this.geocodingService.reverseGeocodeCityState(
      latitude,
      longitude,
    );

    const now = new Date();
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = now.toISOString().split("T")[0];
    const hour = now.getHours();
    const month = now.toLocaleDateString("en-US", { month: "long" });

    const completion = await this.openAIService.executeChatCompletion({
      model: OpenAIModel.GPT4OMini,
      messages: [
        {
          role: "system",
          content:
            "You are an adventure planner. Generate exactly 5 diverse itinerary suggestions for someone looking to get out and do something. Include options in the user's city AND nearby cities/towns within ~30 miles. Each should feel meaningfully different in vibe, cost, activity type, and location. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `User location: ${city}
Day: ${dayOfWeek}, ${dateStr}
Current hour: ${hour}:00
Month: ${month}

Generate 5 adventure suggestions as a JSON object: { "suggestions": [...] }

Include a mix of options in ${city} AND nearby cities/towns within ~30 miles. At least 2 suggestions should be in a different city/town than the user's.

Each suggestion must have:
- title (catchy, max 6 words — describe the VIBE or THEME, never reference specific venue names. Focus on the activity + mood, like combining an activity with food or a time of day)
- emoji (single emoji best representing the adventure)
- city (the city/town where this adventure takes place, e.g. "Tempe, AZ" — use "City, ST" format)
- costTier ("$" = free/under $20, "$$" = $20-60, "$$$" = $60+)
- durationHours (number, 2-8 range, appropriate for time of day)
- stopCount (number of stops, 1-3 — a quick single-stop outing, a two-stop combo, or a three-stop crawl)
- activityTypes (1-2 from: food, coffee, music, art, outdoors, hiking, walking, nightlife, sports, culture)
- intention (one of: recharge, explore, socialize, move, learn, treat_yourself, lock_in)
- budgetMax (number in dollars matching the costTier)

DIVERSITY IS CRITICAL — the 5 suggestions must feel like 5 completely different days, not variations of the same idea:
- Each title MUST use different words — no repeating "explore", "discover", "hidden", etc. across titles
- Mix categories: one food-focused, one outdoors/active, one arts/culture, one nightlife/social, one wildcard
- Vary cost: at least one "$" and one "$$$"
- Vary duration: range from 2h to 6h+
- Vary stop count: mix of 1-stop, 2-stop, and 3-stop suggestions
- Vary energy: one lazy/chill, one high-energy
- Consider the time of day and season`,
        },
      ],
      temperature: 1.0,
      max_tokens: 800,
    });

    let raw = completion.choices[0].message.content?.trim();
    if (!raw) {
      throw new Error("No response from LLM for suggestions");
    }

    // Strip markdown code fences if present
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    try {
      const parsed = JSON.parse(raw);
      const suggestions: ItinerarySuggestion[] = Array.isArray(parsed)
        ? parsed
        : parsed.suggestions;
      return { city, suggestions };
    } catch {
      console.error("Failed to parse suggestions LLM response:", raw);
      throw new Error("Failed to parse suggestions response");
    }
  }

  async listByUser(
    userId: string,
    options: ListByUserOptions = {},
  ): Promise<{ data: Itinerary[]; nextCursor: string | null }> {
    const { limit = 20, cursor, sort = "newest", intention, status } = options;

    const qb = this.dataSource
      .getRepository(Itinerary)
      .createQueryBuilder("i")
      .leftJoinAndSelect("i.items", "item")
      .where("i.user_id = :userId", { userId });

    // Filters
    if (intention) {
      qb.andWhere("i.intention = :intention", { intention });
    }
    if (status === "completed") {
      qb.andWhere("i.completedAt IS NOT NULL");
    } else if (status === "upcoming") {
      qb.andWhere("i.plannedDate > NOW()").andWhere("i.completedAt IS NULL");
    }

    // Cursor + sort
    if (sort === "oldest") {
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(i.createdAt > :cursorDate OR (i.createdAt = :cursorDate AND i.id > :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("i.createdAt", "ASC").addOrderBy("i.id", "ASC");
    } else if (sort === "upcoming") {
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(i.plannedDate > :cursorDate OR (i.plannedDate = :cursorDate AND i.id > :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("i.plannedDate", "ASC").addOrderBy("i.id", "ASC");
    } else if (sort === "top_rated") {
      if (cursor) {
        const [cursorRating, cursorId] = cursor.split("|");
        const ratingVal =
          cursorRating === "null" ? null : Number(cursorRating);
        if (ratingVal === null) {
          qb.andWhere("(i.rating IS NULL AND i.id < :cursorId)", {
            cursorId,
          });
        } else {
          qb.andWhere(
            "(i.rating < :cursorRating OR (i.rating = :cursorRating AND i.id < :cursorId) OR i.rating IS NULL)",
            { cursorRating: ratingVal, cursorId },
          );
        }
      }
      qb.orderBy("i.rating", "DESC", "NULLS LAST").addOrderBy(
        "i.id",
        "DESC",
      );
    } else {
      // newest (default)
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(i.createdAt < :cursorDate OR (i.createdAt = :cursorDate AND i.id < :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("i.createdAt", "DESC").addOrderBy("i.id", "DESC");
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
      } else if (sort === "upcoming") {
        nextCursor = `${last.plannedDate instanceof Date ? last.plannedDate.toISOString() : last.plannedDate}|${last.id}`;
      } else if (sort === "top_rated") {
        nextCursor = `${last.rating ?? "null"}|${last.id}`;
      }
    }

    return { data, nextCursor };
  }

  async getById(id: string, userId?: string): Promise<Itinerary | null> {
    const where: Record<string, string> = { id };
    if (userId) where.userId = userId;
    return this.dataSource.getRepository(Itinerary).findOne({
      where,
      relations: ["items"],
      order: { items: { sortOrder: "ASC" } },
    });
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const repo = this.dataSource.getRepository(Itinerary);

    // Check if published before deleting (for Redis notification)
    const itinerary = await repo.findOne({
      where: { id, userId },
      select: ["id", "isPublished"],
    });

    const result = await repo.softDelete({ id, userId });
    const deleted = (result.affected ?? 0) > 0;

    if (deleted && itinerary?.isPublished) {
      this.publishItineraryChange({ id } as Itinerary, "DELETE").catch(
        (err) => {
          console.error(
            "[ItineraryService] Failed to publish itinerary deletion:",
            err,
          );
        },
      );
    }

    return deleted;
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

  async rateItinerary(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Itinerary | null> {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return null;
    }

    const repo = this.dataSource.getRepository(Itinerary);
    const itinerary = await repo.findOne({
      where: { id, userId },
    });

    if (!itinerary || !itinerary.completedAt) return null;

    const wasPublished = itinerary.isPublished;
    itinerary.rating = rating;
    if (comment) itinerary.ratingComment = comment;
    itinerary.isPublished = true;
    await repo.save(itinerary);

    // Publish to Redis when transitioning to published
    if (!wasPublished) {
      this.publishItineraryChange(itinerary, "CREATE").catch((err) => {
        console.error(
          "[ItineraryService] Failed to publish itinerary change:",
          err,
        );
      });
    }

    // Award XP for rating
    if (this.gamificationService) {
      try {
        await this.gamificationService.awardXP(userId, 25, "rate_itinerary");
      } catch (err) {
        console.error("[ItineraryService] Failed to award XP for rating:", err);
      }
    }

    return itinerary;
  }

  async listCompleted(userId: string, limit = 20): Promise<Itinerary[]> {
    return this.dataSource.getRepository(Itinerary).find({
      where: { userId, completedAt: Not(IsNull()) },
      relations: ["items"],
      order: { completedAt: "DESC" },
      take: limit,
    });
  }

  async browsePublished(
    options: BrowsePublishedOptions,
  ): Promise<BrowseItinerary[]> {
    const {
      city,
      intention,
      sort = "popular",
      limit = 20,
      cursor,
      excludeUserId,
    } = options;

    const qb = this.dataSource
      .getRepository(Itinerary)
      .createQueryBuilder("i")
      .innerJoin(User, "u", "u.id = i.user_id")
      .leftJoinAndSelect("i.items", "item")
      .where("i.is_published = true")
      .andWhere("i.city = :city", { city })
      .andWhere("i.status = :status", { status: ItineraryStatus.READY });

    if (excludeUserId) {
      qb.andWhere("i.user_id != :excludeUserId", { excludeUserId });
    }

    if (intention) {
      qb.andWhere("i.intention = :intention", { intention });
    }

    if (cursor) {
      // cursor format: "completedAt|id"
      const [cursorDate, cursorId] = cursor.split("|");
      qb.andWhere(
        "(i.completed_at < :cursorDate OR (i.completed_at = :cursorDate AND i.id < :cursorId))",
        { cursorDate, cursorId },
      );
    }

    // Add firstName as a select
    qb.addSelect("u.first_name", "creatorFirstName");

    switch (sort) {
      case "recent":
        qb.orderBy("i.completed_at", "DESC").addOrderBy("i.id", "DESC");
        break;
      case "top_rated":
        qb.orderBy("i.rating", "DESC").addOrderBy("i.id", "DESC");
        break;
      case "popular":
      default:
        qb.addSelect(
          "i.times_adopted * 2 + COALESCE(i.rating, 0)",
          "popularity_score",
        );
        qb.orderBy("popularity_score", "DESC").addOrderBy("i.id", "DESC");
        break;
    }

    qb.take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    // Build a map from itinerary id to creatorFirstName
    const firstNameMap = new Map<string, string | null>();
    for (const row of raw) {
      firstNameMap.set(row.i_id, row.creatorFirstName || null);
    }

    return entities.map((itinerary) => {
      const items = (itinerary.items || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 3);
      return {
        id: itinerary.id,
        title: itinerary.title || null,
        summary: itinerary.summary || null,
        city: itinerary.city,
        intention: itinerary.intention || null,
        durationHours: itinerary.durationHours,
        rating: itinerary.rating ?? null,
        timesAdopted: itinerary.timesAdopted,
        itemCount: (itinerary.items || []).length,
        creatorFirstName: firstNameMap.get(itinerary.id) ?? null,
        completedAt: itinerary.completedAt
          ? itinerary.completedAt.toISOString()
          : "",
        items: items.map((item) => ({
          emoji: item.emoji || null,
          title: item.title,
          venueName: item.venueName || null,
        })),
      };
    });
  }

  async adoptItinerary(sourceId: string, userId: string): Promise<Itinerary> {
    const sourceRepo = this.dataSource.getRepository(Itinerary);
    const source = await sourceRepo.findOne({
      where: {
        id: sourceId,
        isPublished: true,
        status: ItineraryStatus.READY,
      },
      relations: ["items"],
    });

    if (!source) {
      throw new Error("Itinerary not found or not available for adoption");
    }

    return this.dataSource.transaction(async (manager) => {
      const itineraryRepo = manager.getRepository(Itinerary);
      const itemRepo = manager.getRepository(ItineraryItem);

      // Use first stop's start time on today's date
      const todayStr = new Date().toISOString().slice(0, 10);
      const firstSourceItem = (source.items || [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const adoptedPlannedDate = firstSourceItem?.startTime
        ? new Date(`${todayStr}T${firstSourceItem.startTime}:00`)
        : new Date();

      const newItinerary = itineraryRepo.create({
        userId,
        city: source.city,
        plannedDate: adoptedPlannedDate,
        budgetMin: source.budgetMin,
        budgetMax: source.budgetMax,
        durationHours: source.durationHours,
        activityTypes: source.activityTypes,
        title: source.title,
        summary: source.summary,
        intention: source.intention,
        status: ItineraryStatus.READY,
        sourceItineraryId: source.id,
      });
      const saved = await itineraryRepo.save(newItinerary);

      const newItems = (source.items || []).map((item) =>
        itemRepo.create({
          itineraryId: saved.id,
          sortOrder: item.sortOrder,
          startTime: item.startTime,
          endTime: item.endTime,
          title: item.title,
          description: item.description,
          emoji: item.emoji,
          estimatedCost: item.estimatedCost,
          venueName: item.venueName,
          venueAddress: item.venueAddress,
          eventId: item.eventId,
          travelNote: item.travelNote,
          latitude: item.latitude,
          longitude: item.longitude,
          googlePlaceId: item.googlePlaceId,
          googleRating: item.googleRating,
          venueCategory: item.venueCategory,
          whyThisStop: item.whyThisStop,
          proTip: item.proTip,
          entryLatitude: item.entryLatitude,
          entryLongitude: item.entryLongitude,
          entryPointName: item.entryPointName,
        }),
      );
      await itemRepo.save(newItems);

      // Increment times_adopted on source
      await itineraryRepo.increment({ id: source.id }, "timesAdopted", 1);

      saved.items = newItems;
      return saved;
    });
  }

  private async geocodeCityFallback(
    city: string,
  ): Promise<{ lat: number; lng: number } | undefined> {
    try {
      const params = new URLSearchParams({
        name: city,
        count: "1",
        language: "en",
        format: "json",
      });
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?${params}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) return undefined;

      const data = (await response.json()) as {
        results?: { latitude: number; longitude: number; name: string }[];
      };
      const result = data.results?.[0];
      if (result) {
        console.log(
          `[ItineraryService] Fallback geocoded "${city}" → ${result.name} (${result.latitude}, ${result.longitude})`,
        );
        return { lat: result.latitude, lng: result.longitude };
      }
    } catch (err) {
      console.error("[ItineraryService] Fallback geocoding failed:", err);
    }
    return undefined;
  }

  private async fetchCityEvents(
    city: string,
    date: string,
    preferenceEmbedding?: string | null,
  ): Promise<CityEvent[]> {
    // When user has a preference embedding, rank events by similarity
    // so the most relevant ones appear first in the LLM prompt
    if (preferenceEmbedding) {
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
        ORDER BY
          CASE WHEN e.embedding IS NOT NULL
            THEN e.embedding::vector <=> $3::vector
            ELSE 2
          END ASC,
          e.event_date ASC
        LIMIT 50
        `,
        [city, date, preferenceEmbedding],
      );
    }

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
      coffee: ["coffee shops", "cafes"],
      dining: ["restaurants", "cafes"],
      nightlife: ["bars", "nightlife"],
      culture: ["museums", "galleries"],
      outdoors: ["parks", "outdoor activities"],
      boarding: ["cafes", "parks", "juice bars"],
      skating: ["cafes", "parks", "juice bars"],
      hiking: ["parks", "nature reserves", "trailheads"],
      walking: ["parks", "cafes", "gardens"],
      art: ["galleries", "theaters"],
      arts: ["galleries", "theaters"],
      music: ["live music venues"],
      sports: ["sports venues", "recreation centers"],
      shopping: ["shopping"],
    };

    for (const activity of input.activityTypes) {
      const mapped = typeMap[activity.toLowerCase()];
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

  private async fetchPreviousVenues(
    userId: string,
    city: string,
  ): Promise<string[]> {
    try {
      const rows: { venue_name: string }[] = await this.dataSource.query(
        `
        SELECT DISTINCT ii.venue_name
        FROM itinerary_items ii
        JOIN itineraries i ON i.id = ii.itinerary_id
        WHERE i.user_id = $1
          AND LOWER(i.city) = LOWER($2)
          AND i.status = 'READY'
          AND ii.venue_name IS NOT NULL
        ORDER BY ii.venue_name
        LIMIT 100
        `,
        [userId, city],
      );
      const venues = rows.map((r) => r.venue_name);
      if (venues.length > 0) {
        console.log(
          `[ItineraryService] Found ${venues.length} previously used venues in ${city} for user`,
        );
      }
      return venues;
    } catch (err) {
      console.error("[ItineraryService] Failed to fetch previous venues:", err);
      return [];
    }
  }

  private async validateAndEnrichItems(
    items: LLMItineraryItem[],
    events: CityEvent[],
    verifiedVenues: VerifiedVenue[],
    city: string,
    cityCenter?: { lat: number; lng: number },
    trails: Trail[] = [],
  ): Promise<{ item: LLMItineraryItem; geo: GeocodedData | null }[]> {
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const venueByName = new Map(
      verifiedVenues.map((v) => [v.name.toLowerCase(), v]),
    );
    const trailByName = new Map(trails.map((t) => [t.name.toLowerCase(), t]));

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
    trails: Trail[] = [],
    forecast: DayForecast | null = null,
    previousVenues: string[] = [],
    intention?: string,
    anchorStops?: AnchorStopInput[],
    resolvedCity?: string,
    userPreferences?: {
      activities: string[];
      vibes: string[];
      idealDay: string;
      pace: string;
    } | null,
  ): Promise<LLMItineraryResponse> {
    const cityName = resolvedCity || input.city;
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
            .map((v) => {
              const parts = [
                `"${v.name}" (${v.address})`,
                `Rating: ${v.rating ?? "N/A"}`,
              ];
              if (v.priceLevel) {
                const priceLabelMap: Record<string, string> = {
                  PRICE_LEVEL_FREE: "Free",
                  PRICE_LEVEL_INEXPENSIVE: "$",
                  PRICE_LEVEL_MODERATE: "$$",
                  PRICE_LEVEL_EXPENSIVE: "$$$",
                  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
                };
                parts.push(
                  `Price: ${priceLabelMap[v.priceLevel] ?? v.priceLevel}`,
                );
              }
              if (v.primaryType) {
                parts.push(`Type: ${v.primaryType}`);
              } else {
                parts.push(`Type: ${v.types.slice(0, 3).join(", ")}`);
              }
              if (v.openingHours && v.openingHours.length > 0) {
                // Find the hours for the planned day
                const dayOfWeek = new Date(
                  input.plannedDate,
                ).toLocaleDateString("en-US", { weekday: "long" });
                const dayHours = v.openingHours.find((h) =>
                  h.startsWith(dayOfWeek),
                );
                if (dayHours) {
                  parts.push(`Hours: ${dayHours}`);
                }
              }
              return `- ${parts.join(" | ")}`;
            })
            .join("\n")
        : "No pre-verified venues available. Suggest well-known, permanent local favorites instead.";

    const trailList =
      trails.length > 0
        ? trails
            .map((t) => {
              const km = (t.lengthMeters / 1000).toFixed(1);
              const mi = (t.lengthMeters / 1609.34).toFixed(1);
              const extras = [
                t.smoothness ? `smoothness: ${t.smoothness}` : null,
                t.lit !== null ? (t.lit ? "lit at night" : "unlit") : null,
                t.incline ? `incline: ${t.incline}` : null,
              ]
                .filter(Boolean)
                .join(", ");
              return `- "${t.name}" | ${km}km (${mi}mi) | Surface: ${t.surface} | Type: ${t.highway}${extras ? ` | ${extras}` : ""} | Center: ${t.center[1].toFixed(5)},${t.center[0].toFixed(5)}`;
            })
            .join("\n")
        : null;

    // Build weather summary for the LLM
    const weatherSummary = forecast
      ? this.formatWeatherForPrompt(forecast)
      : null;

    // Build anti-repetition exclusion list
    const exclusionList =
      previousVenues.length > 0
        ? previousVenues.map((v) => `"${v}"`).join(", ")
        : null;

    const budgetRange =
      input.budgetMin === 0 && input.budgetMax === 0
        ? "Free only ($0 — no paid activities)"
        : `$${input.budgetMin}–$${input.budgetMax}`;

    // Build intention context for the LLM
    const intentionPromptMap: Record<string, string> = {
      recharge:
        "INTENTION: Recharge — solo-friendly, quiet cafes, nature spots, morning hours, gentle pacing. Prioritize calm, restorative venues. Avoid loud/crowded spots.",
      explore:
        "INTENTION: Explore — new neighborhoods, variety of venue types, hidden gems, discovery-weighted. Prioritize places off the beaten path the user hasn't tried.",
      socialize:
        "INTENTION: Socialize — lively spots, communal seating, evening-friendly, breweries/bars/social venues. Prioritize places with great atmosphere for meeting people.",
      move: "INTENTION: Move — trails, outdoor activities, physical movement, longer walking routes. Prioritize active venues and connect stops with scenic walks or trails.",
      learn:
        "INTENTION: Learn — museums, bookstores, galleries, cultural venues, historical landmarks. Prioritize educational and culturally enriching stops.",
      treat_yourself:
        "INTENTION: Treat Yourself — great food, scenic spots, nice coffee, premium experiences. Prioritize quality over quantity. Make it feel special and indulgent.",
      lock_in:
        "INTENTION: Lock In — productive focus spots, cozy cafes with good WiFi, libraries, co-working-friendly venues, quiet corners. Prioritize places conducive to deep work and concentration. Avoid noisy or overly social environments.",
    };
    const intentionBlock =
      intention && intentionPromptMap[intention]
        ? `\n${intentionPromptMap[intention]}\n`
        : "";

    // Build anchor stops instruction block
    const anchorBlock =
      anchorStops && anchorStops.length > 0
        ? `\nANCHOR STOPS (MANDATORY — you MUST include a stop for EVERY anchor listed below, no exceptions):\n${anchorStops
            .map((a, i) => {
              const [lng, lat] = a.coordinates;
              const label = a.label ? `"${a.label}"` : `Pin ${i + 1}`;
              const addr = a.address ? ` at ${a.address}` : "";
              const type = a.primaryType ? ` | Type: ${a.primaryType}` : "";
              const rating = a.rating ? ` | Rating: ${a.rating}` : "";
              const note = a.note ? ` | User note: "${a.note}"` : "";
              return `- Anchor ${i + 1}: ${label}${addr} (${lat.toFixed(5)}, ${lng.toFixed(5)})${type}${rating}${note}`;
            })
            .join(
              "\n",
            )}\nThere are ${anchorStops.length} anchor stops — the output MUST contain at least ${anchorStops.length} items corresponding to these anchors. Build the rest of the itinerary around them, filling complementary stops between them.${anchorStops.some((a) => a.label) ? " Anchors with names are verified real places — use their exact name and address." : " The anchor stops are user-selected map locations — find the nearest real venue or point of interest at each coordinate and use that as the stop."}${anchorStops.some((a) => a.note) ? " When an anchor has a user note, incorporate the user's intent into that stop's description, whyThisStop, and proTip — it tells you WHY they want to go there." : ""}\n`
        : "";

    const hasTrails = trailList !== null;
    const wantsBoarding = input.activityTypes.some((a) =>
      ["boarding", "skating"].includes(a.toLowerCase()),
    );
    const trailInstructions = hasTrails
      ? `
TRAIL RULES (for boarding/hiking/walking/outdoor itineraries):
- TRAILS listed below are real paths verified from OpenStreetMap — use their EXACT names.
- Incorporate trails as stops or as travel between stops. A trail can BE the destination (venueCategory: "trail").
- For trail stops: set venueName to the trail name, venueAddress to the nearest cross street or area, and include the trail's surface and distance in the description.
- For boarding between stops: mention the trail in travelNote (e.g., "15 min longboard via Ladybird Lake Trail").
- For hiking/walking: pick trails with appropriate surface and length for the duration. A 2-hour hike needs a longer trail than a 30-minute stroll. Mention the surface type (dirt, gravel, paved) so the user knows what footwear to expect.
- Suggest grabbing coffee/food near trail entry points — that's the vibe.
- If the user wants boarding, hiking, or walking, make trails a CORE part of the itinerary, not an afterthought.`
      : "";

    const boardingGarageInstructions = wantsBoarding
      ? `
PARKING GARAGE BOARDING (evening/night stops only):
- For boarding stops scheduled in the evening or at night (after ~18:00), consider multi-story parking garages — smooth concrete, ramps, shade, and usually empty upper levels after hours.
- Only suggest a garage for a boarding-focused stop, not for dining or other activities.
- Use the actual garage name (e.g., "2nd Street District Garage"), venueCategory: "attraction".
- In proTip, mention best levels (top floors = empty + views, mid floors = shade) and that garages are emptier after business hours.
- If a mall or shopping center is already in the itinerary, its parking garage is a natural late-session boarding spot.`
      : "";

    // Build user preference context for the LLM
    const paceDescriptions: Record<string, string> = {
      chill: "relaxed pacing with generous time at each stop — no rushing",
      balanced: "moderate pacing with breathing room between stops",
      send_it: "packed schedule, maximize stops and experiences",
    };
    const preferencesBlock = userPreferences
      ? `
USER PREFERENCES (from onboarding — use these to personalize the itinerary):
- Favorite activities: ${userPreferences.activities.join(", ")}
- Vibe: ${userPreferences.vibes.join(", ")}
- Their ideal day: "${userPreferences.idealDay}"
- Preferred pace: ${userPreferences.pace.replace("_", " ")}${paceDescriptions[userPreferences.pace] ? ` — ${paceDescriptions[userPreferences.pace]}` : ""}
- Use this profile to influence venue selection, stop ordering, and overall tone. Lean into what they love. The activity preferences from the request take priority, but use the profile to break ties and add personality.
`
      : "";

    const systemPrompt = `You are an expert local guide with insider knowledge of ${cityName}. Create a personalized, premium itinerary that feels like advice from a well-connected friend who knows all the best spots.

SOURCING RULES (STRICT):
- EVENTS (concerts, shows, games, markets, pop-ups, etc.): ONLY use events from the EVENTS list below. Do NOT invent or suggest any event not on this list.
- VENUES (restaurants, cafes, parks, museums, landmarks, etc.): You may suggest year-round, always-available venues. Pick from the VERIFIED VENUES list when possible, but you may suggest other well-known, permanent establishments too.
- NEVER invent one-off happenings, seasonal events, or time-specific activities that aren't on the EVENTS list.
- Use the EXACT name and address from the lists when referencing them.

HOURS & SCHEDULING (CRITICAL):
- Verified venues include their hours for the planned day. NEVER schedule a stop when the venue is CLOSED.
- If a venue shows "Closed" for the planned day, DO NOT include it at all (e.g., Chick-fil-A on Sunday).
- Match venue type to time of day: breakfast/brunch spots in the morning, lunch spots midday, dinner/bar spots in the evening. Don't suggest a breakfast diner at 8pm or a nightclub at 10am.
- If hours are provided, ensure the stop's startTime falls within the venue's open hours.
- Price levels are shown when available ($, $$, $$$, $$$$). Factor these into the budget — don't fill a $30 budget with $$$ restaurants.
- If there are no scanned events, build the itinerary entirely from town staples — beloved local restaurants, iconic landmarks, popular parks, and must-visit spots. This is a great itinerary, not a consolation prize.
- If not enough options exist, create FEWER stops — never pad with fake events.
- Use FULL street addresses including city and state (e.g., "123 Main St, Austin, TX")
${trailInstructions}${boardingGarageInstructions}${anchorBlock}${intentionBlock}${preferencesBlock}${weatherSummary ? `\nWEATHER AWARENESS:\n${weatherSummary}\n- Adapt the itinerary to the forecast. Rain or storms → prefer indoor stops during those hours. Extreme heat → outdoor activities in morning/evening, shade and AC midday. Cold/wind → suggest layering in proTip. Perfect weather → maximize outdoor time.\n- Include weather-relevant proTips (e.g., "Bring sunscreen — UV index peaks at 9", "Rain likely after 3pm, grab a window seat and enjoy it").\n` : ""}${exclusionList ? `\nFRESHNESS RULE:\n- The user has visited these venues in previous itineraries: ${exclusionList}\n- Do NOT repeat any of them. Dig deeper — find hidden gems, newer spots, or lesser-known alternatives. The whole point is discovering something new each time.\n` : ""}
${
  input.title
    ? `THEME & TITLE (CRITICAL):
- The itinerary title MUST be: "${input.title}"
- This title describes the THEME and VIBE of the itinerary — every stop MUST reinforce this theme.
- Parse the title for clues about activities, mood, and timing. Select venues and ordering that deliver on the promise of the title.
- Do NOT generate a generic itinerary and slap the title on it. The title IS the creative brief — let it drive venue selection, ordering, and overall feel.\n`
    : ""
}${input.activityTypes.length > 1 && input.stopCount > 0 && input.stopCount < input.activityTypes.length ? `VIBE FUSION (CRITICAL — fewer stops than activity preferences):
- The user selected ${input.activityTypes.length} vibes (${input.activityTypes.join(", ")}) but only ${input.stopCount} stop${input.stopCount > 1 ? "s" : ""}.
- You MUST find venues that naturally combine multiple vibes in one place. Do NOT just pick one vibe and ignore the others.
- Examples of fusion: "coffee + food" → a café known for excellent food AND coffee (not just a Starbucks). "outdoors + food" → a brewery with a great patio or a food truck park in a scenic area. "nightlife + food" → a restaurant with a lively bar scene.
- When describing the stop, highlight how it satisfies multiple vibes in "whyThisStop" (e.g., "Known for their house-roasted beans AND wood-fired brunch — the best of both worlds").
- Prefer venues with Google ratings ≥ 4.0 that genuinely excel at the combined vibes, not places that technically qualify but are mediocre at both.

` : input.activityTypes.length > 1 && input.stopCount > 0 && input.stopCount <= input.activityTypes.length ? `VIBE BLENDING (multiple activity preferences, limited stops):
- The user selected ${input.activityTypes.length} vibes (${input.activityTypes.join(", ")}) across ${input.stopCount} stop${input.stopCount > 1 ? "s" : ""}.
- Where possible, choose venues that satisfy multiple vibes at once rather than dedicating each stop to a single vibe.
- When a venue naturally blends vibes, highlight this in "whyThisStop" — the user chose these vibes together for a reason.

` : ""}PLANNING RULES:
- Stay within the time budget (${input.durationHours} hours)
- Stay within the spending budget (${budgetRange})
- Match the activity preferences: ${input.activityTypes.join(", ") || "any"}
- ${input.stopCount > 0 ? `Include EXACTLY ${Math.max(input.stopCount, anchorStops?.length ?? 0)} stops` : `Choose the right number of stops for the duration${anchorStops && anchorStops.length > 0 ? ` (minimum ${anchorStops.length} — one per anchor)` : ""}`}
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
      "venueCategory": "cafe|restaurant|bar|park|museum|gallery|market|venue|attraction|trail|other",
      "whyThisStop": "One sentence on why this stop is special or a hidden gem",
      "proTip": "Insider tip: best seat, what to order, timing trick, etc."
    }
  ]
}`;

    // When planned date is today and no explicit start time, pin to current time
    // so the LLM never schedules stops in the past.

    const tz = input.timezone ?? "America/Denver";

    const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");

    const currentHour = parseInt(formatInTimeZone(new Date(), tz, "HH"), 10);

    const currentTime = formatInTimeZone(new Date(), tz, "HH:mm");

    const plannedDateStr = formatInTimeZone(
      input.plannedDate,
      tz,
      "yyyy-MM-dd",
    );
    const isToday = plannedDateStr === today;

    const effectiveStartTime =
      input.startTime ??
      (isToday
        ? `${String(Math.min(currentHour + 1, 23)).padStart(2, "0")}:00`
        : undefined);

    const timeConstraint =
      effectiveStartTime && input.endTime
        ? `\nTime window: ${effectiveStartTime} – ${input.endTime} (schedule all stops within this window)`
        : effectiveStartTime
          ? `\nStart time: ${effectiveStartTime} (begin the itinerary at this time — do NOT schedule anything before this)`
          : "";

    const userPrompt = `City: ${cityName}
Date: ${plannedDateStr}${isToday ? ` (today — current time is ${currentTime})` : ""}
Duration: ${input.durationHours} hours
Budget: ${budgetRange}
Activity preferences: ${input.activityTypes.join(", ") || "anything fun"}${intention ? `\nIntention: ${intention.replace("_", " ")}` : ""}${input.stopCount > 0 ? `\nNumber of stops: exactly ${input.stopCount}` : ""}${timeConstraint}

EVENTS (use ONLY these for event-type stops):
${eventList}

VERIFIED VENUES in ${cityName} (prefer these for non-event stops):
${venueList}${trailList ? `\n\nPAVED TRAILS near ${cityName} (real OpenStreetMap data — use exact names):\n${trailList}` : ""}${forecast ? `\n\nWEATHER FORECAST for ${plannedDateStr}:\n${this.formatHourlyForPrompt(forecast)}` : ""}`;

    const parseLLMResponse = (responseText: string): LLMItineraryResponse => {
      let jsonStr = responseText.trim();

      if (!jsonStr || jsonStr.length < 10) {
        throw new Error(
          `LLM returned empty or too-short response (${jsonStr.length} chars)`,
        );
      }

      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      // Extract JSON object if surrounded by other text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        throw new Error("No JSON object found in LLM response");
      }

      // Try to repair truncated JSON by closing open structures
      try {
        return JSON.parse(jsonStr);
      } catch {
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

        if (openBraces < 0 || openBrackets < 0) {
          throw new Error("Malformed JSON: more closing than opening brackets");
        }

        for (let i = 0; i < openBrackets; i++) repaired += "]";
        for (let i = 0; i < openBraces; i++) repaired += "}";
        return JSON.parse(repaired);
      }
    };

    const callLLM = async (): Promise<string> => {
      return this.openAIService.executeResponse(
        {
          model: OpenAIModel.GPT54Mini,
          instructions: systemPrompt,
          input: userPrompt,
          max_output_tokens: 10000,
          reasoning: { effort: "low" },
        },
        "itinerary-generation",
      );
    };

    let parsed: LLMItineraryResponse;
    try {
      parsed = parseLLMResponse(await callLLM());
    } catch (firstError) {
      console.warn(
        `[ItineraryService] First LLM attempt failed, retrying: ${(firstError as Error).message}`,
      );
      parsed = parseLLMResponse(await callLLM());
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
        ii.venue_name,
        MODE() WITHIN GROUP (ORDER BY ii.venue_category) AS venue_category,
        MODE() WITHIN GROUP (ORDER BY ii.emoji) AS emoji,
        AVG(ii.latitude)::numeric(10,7) AS latitude,
        AVG(ii.longitude)::numeric(10,7) AS longitude,
        MODE() WITHIN GROUP (ORDER BY ii.google_place_id) AS google_place_id,
        MAX(ii.google_rating) AS google_rating,
        COUNT(*)::int AS frequency,
        COUNT(ii.checked_in_at)::int AS completions
      FROM itinerary_items ii
      JOIN itineraries i ON i.id = ii.itinerary_id
      WHERE LOWER(i.city) = LOWER($1)
        AND i.status = 'READY'
        AND ii.venue_name IS NOT NULL
      GROUP BY COALESCE(ii.google_place_id, LOWER(ii.venue_name))
        , ii.venue_name
      HAVING COUNT(*) >= 2
      ORDER BY
        COUNT(*)::float
        * POWER(COUNT(ii.checked_in_at)::float / GREATEST(COUNT(*), 1), 2)
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

  private formatWeatherForPrompt(forecast: DayForecast): string {
    const lines: string[] = [];
    lines.push(
      `- Overall: ${forecast.dominantCondition}, ${forecast.tempLowF}–${forecast.tempHighF}°F`,
    );
    lines.push(`- Sunrise: ${forecast.sunrise}, Sunset: ${forecast.sunset}`);

    if (forecast.precipProbabilityMax > 40) {
      lines.push(
        `- Rain probability: up to ${forecast.precipProbabilityMax}% — plan indoor alternatives for wet hours`,
      );
    }
    if (forecast.uvIndexMax >= 7) {
      lines.push(
        `- UV Index: ${forecast.uvIndexMax} (HIGH) — shade and sunscreen recommended`,
      );
    }
    if (forecast.tempHighF >= 95) {
      lines.push(
        "- Extreme heat — prioritize morning/evening outdoor activities, AC midday",
      );
    }
    if (forecast.tempLowF <= 35) {
      lines.push("- Cold conditions — suggest warm indoor venues, hot drinks");
    }

    // Check for high wind (bad for boarding)
    const maxWind = Math.max(
      ...forecast.hourly
        .filter((h) => h.hour >= 8 && h.hour <= 20)
        .map((h) => h.windGustsMph),
    );
    if (maxWind >= 25) {
      lines.push(
        `- Wind gusts up to ${maxWind} mph — not ideal for boarding/skating, suggest sheltered routes or indoor alternatives`,
      );
    }

    return lines.join("\n");
  }

  private formatHourlyForPrompt(forecast: DayForecast): string {
    // Only show hours 7am-11pm to keep prompt concise
    return forecast.hourly
      .filter((h) => h.hour >= 7 && h.hour <= 23)
      .map((h) => {
        const time = `${String(h.hour).padStart(2, "0")}:00`;
        const parts = [
          `${h.tempF}°F`,
          h.condition,
          h.precipProbability > 20 ? `${h.precipProbability}% rain` : null,
          h.windSpeedMph > 10 ? `wind ${h.windSpeedMph}mph` : null,
        ]
          .filter(Boolean)
          .join(", ");
        return `${time}: ${parts}`;
      })
      .join("\n");
  }

  async listPublishedInternal(
    page: number,
    pageSize: number,
  ): Promise<{
    itineraries: InternalItinerary[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const offset = (page - 1) * pageSize;
    const repo = this.dataSource.getRepository(Itinerary);

    const [itineraries, total] = await repo.findAndCount({
      where: {
        isPublished: true,
        status: ItineraryStatus.READY,
      },
      relations: ["items"],
      order: { updatedAt: "DESC", items: { sortOrder: "ASC" } },
      skip: offset,
      take: pageSize,
    });

    const results: InternalItinerary[] = itineraries.map((it) => ({
      id: it.id,
      title: it.title || null,
      summary: it.summary || null,
      city: it.city,
      categories: it.categories || [],
      embedding: it.embedding || null,
      entryLatitude: it.entryLatitude != null ? Number(it.entryLatitude) : null,
      entryLongitude:
        it.entryLongitude != null ? Number(it.entryLongitude) : null,
      rating: it.rating ?? null,
      timesAdopted: it.timesAdopted,
      items: (it.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        latitude: item.latitude != null ? Number(item.latitude) : null,
        longitude: item.longitude != null ? Number(item.longitude) : null,
        venueCategory: item.venueCategory || null,
        sortOrder: item.sortOrder,
      })),
    }));

    return {
      itineraries: results,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: offset + pageSize < total,
      },
    };
  }

  private async generateItineraryEnhancements(
    itineraryId: string,
    items: ItineraryItem[],
  ): Promise<void> {
    const repo = this.dataSource.getRepository(Itinerary);
    const itinerary = await repo.findOne({ where: { id: itineraryId } });
    if (!itinerary) return;

    const updates: Partial<Itinerary> = {};

    // 1. Set entry point from first stop with coordinates
    const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const firstGeoItem = sortedItems.find(
      (item) => item.latitude != null && item.longitude != null,
    );
    if (firstGeoItem) {
      updates.entryLatitude = firstGeoItem.latitude;
      updates.entryLongitude = firstGeoItem.longitude;
    }

    // 2. Generate embedding
    if (this.embeddingService) {
      try {
        const stopsText = sortedItems
          .map(
            (item) =>
              `${item.title}${item.venueCategory ? ` (${item.venueCategory})` : ""}`,
          )
          .join(", ");
        const textRepr = `${itinerary.title || ""}. ${itinerary.summary || ""}. Stops: ${stopsText}`;

        const embeddingSql =
          await this.embeddingService.getStructuredEmbeddingSql({
            text: textRepr,
            weights: { text: 5 },
          });
        updates.embedding = embeddingSql;
      } catch (error) {
        console.error(
          `[ItineraryService] Error generating embedding for ${itineraryId}:`,
          error,
        );
      }
    }

    // 3. Generate category tags via GPT-4o-mini
    try {
      const stopsForCategories = sortedItems
        .map(
          (item) =>
            `${item.title}${item.venueCategory ? ` (${item.venueCategory})` : ""}${item.description ? ` — ${item.description}` : ""}`,
        )
        .join("; ");

      const completion = await this.openAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content:
              'You generate category tags for itineraries. Return a JSON array of 3-5 lowercase single-word tags that describe the itinerary\'s themes. Examples: ["outdoor", "food", "culture", "nightlife", "art", "music", "nature", "fitness", "shopping", "history"]. Respond with ONLY the JSON array.',
          },
          {
            role: "user",
            content: `Title: ${itinerary.title || "Untitled"}\nSummary: ${itinerary.summary || "N/A"}\nStops: ${stopsForCategories}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
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
            `[ItineraryService] Failed to parse category tags: ${raw}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[ItineraryService] Error generating categories for ${itineraryId}:`,
        error,
      );
    }

    // 4. Find entry points for trails, parks, and attractions
    const entryPointCategories = ["trail", "park", "attraction"];
    const itemsNeedingEntryPoints = sortedItems.filter(
      (item) =>
        item.latitude != null &&
        item.longitude != null &&
        item.venueCategory &&
        entryPointCategories.includes(item.venueCategory),
    );

    if (itemsNeedingEntryPoints.length > 0) {
      const itemRepo = this.dataSource.getRepository(ItineraryItem);
      const entryPointResults = await Promise.all(
        itemsNeedingEntryPoints.map(async (item) => {
          try {
            const entryPoint =
              await this.geocodingService.searchEntryPoint(
                Number(item.latitude),
                Number(item.longitude),
                item.venueCategory!,
              );
            return { itemId: item.id, entryPoint };
          } catch (error) {
            console.warn(
              `[ItineraryService] Entry point search failed for "${item.title}":`,
              error,
            );
            return { itemId: item.id, entryPoint: null };
          }
        }),
      );

      for (const { itemId, entryPoint } of entryPointResults) {
        if (entryPoint) {
          await itemRepo.update(itemId, {
            entryLatitude: entryPoint.latitude,
            entryLongitude: entryPoint.longitude,
            entryPointName: entryPoint.name,
          });
          console.log(
            `[ItineraryService] Set entry point "${entryPoint.name}" for item ${itemId}`,
          );
        }
      }
    }

    // Save updates
    if (Object.keys(updates).length > 0) {
      await repo.update(itineraryId, updates);
      console.log(
        `[ItineraryService] Enhanced itinerary ${itineraryId}:`,
        Object.keys(updates),
      );
    }
  }

  private async publishItineraryChange(
    itinerary: Itinerary,
    operation: "CREATE" | "UPDATE" | "DELETE",
  ): Promise<void> {
    if (!this.redisService) return;

    try {
      if (operation === "DELETE") {
        await this.redisService.publishMessage("itinerary_changes", {
          operation,
          record: { id: itinerary.id },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Load full itinerary with items for CREATE/UPDATE
      const full = await this.dataSource.getRepository(Itinerary).findOne({
        where: { id: itinerary.id },
        relations: ["items"],
      });

      if (!full) return;

      const items = (full.items || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          title: item.title,
          latitude: item.latitude,
          longitude: item.longitude,
          venueCategory: item.venueCategory,
          sortOrder: item.sortOrder,
        }));

      await this.redisService.publishMessage("itinerary_changes", {
        operation,
        record: {
          id: full.id,
          title: full.title,
          summary: full.summary,
          city: full.city,
          categories: full.categories,
          embedding: full.embedding,
          entryLatitude: full.entryLatitude,
          entryLongitude: full.entryLongitude,
          rating: full.rating,
          timesAdopted: full.timesAdopted,
          items,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[ItineraryService] Error publishing itinerary change:`,
        error,
      );
    }
  }
}

export function createItineraryService(
  deps: ItineraryServiceDeps,
): ItineraryService {
  return new ItineraryServiceImpl(deps);
}
