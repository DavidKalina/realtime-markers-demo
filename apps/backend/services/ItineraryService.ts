import { type DataSource, Not, IsNull, LessThan } from "typeorm";
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
import type { OverpassService, Trail } from "./shared/OverpassService";
import type { WeatherService, DayForecast } from "./shared/WeatherService";
import type { GamificationService } from "./GamificationService";

export interface AnchorStopInput {
  coordinates: [number, number]; // [lng, lat]
  label?: string;
  address?: string;
  placeId?: string;
  primaryType?: string;
  rating?: number;
}

export interface CreateItineraryInput {
  city: string;
  plannedDate: string; // YYYY-MM-DD
  budgetMin: number;
  budgetMax: number;
  durationHours: number;
  activityTypes: string[];
  stopCount: number; // 0 = let LLM decide
  startTime?: string; // HH:MM (24h) — optional fixed start
  endTime?: string; // HH:MM (24h) — optional fixed end
  intention?: string; // recharge | explore | socialize | move | learn | treat_yourself
  anchorStops?: AnchorStopInput[];
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

export interface ItineraryService {
  create(userId: string, input: CreateItineraryInput): Promise<Itinerary>;
  listByUser(
    userId: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ data: Itinerary[]; nextCursor: string | null }>;
  getById(id: string, userId: string): Promise<Itinerary | null>;
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
}

interface ItineraryServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  geocodingService: GoogleGeocodingService;
  overpassService: OverpassService;
  weatherService: WeatherService;
  gamificationService?: GamificationService;
}

class ItineraryServiceImpl implements ItineraryService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;
  private overpassService: OverpassService;
  private weatherService: WeatherService;
  private gamificationService?: GamificationService;

  constructor(deps: ItineraryServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
    this.overpassService = deps.overpassService;
    this.weatherService = deps.weatherService;
    this.gamificationService = deps.gamificationService;
  }

  async create(
    userId: string,
    input: CreateItineraryInput,
  ): Promise<Itinerary> {
    const itineraryRepo = this.dataSource.getRepository(Itinerary);
    const itemRepo = this.dataSource.getRepository(ItineraryItem);

    // Infer city from anchor stops if not provided
    let city = input.city;
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

    // Create the itinerary record in GENERATING status
    const itinerary = itineraryRepo.create({
      userId,
      city,
      plannedDate: input.plannedDate,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      durationHours: input.durationHours,
      activityTypes: input.activityTypes,
      intention: input.intention,
      status: ItineraryStatus.GENERATING,
    });
    await itineraryRepo.save(itinerary);

    try {
      // Fetch events in the city for that date
      const events = await this.fetchCityEvents(city, input.plannedDate);

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

      let trails: Trail[] = [];
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
              input.plannedDate,
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

  async listByUser(
    userId: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ data: Itinerary[]; nextCursor: string | null }> {
    const where: Record<string, unknown> = { userId };
    if (cursor) {
      where.createdAt = LessThan(new Date(cursor));
    }

    const rows = await this.dataSource.getRepository(Itinerary).find({
      where,
      order: { createdAt: "DESC" },
      take: limit + 1,
      relations: ["items"],
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? data[data.length - 1].createdAt.toISOString()
      : null;

    return { data, nextCursor };
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

    itinerary.rating = rating;
    if (comment) itinerary.ratingComment = comment;
    await repo.save(itinerary);

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
      boarding: ["cafes", "parks", "juice bars"],
      skating: ["cafes", "parks", "juice bars"],
      hiking: ["parks", "nature reserves", "trailheads"],
      walking: ["parks", "cafes", "gardens"],
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
                  input.plannedDate + "T12:00:00",
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
              return `- Anchor ${i + 1}: ${label}${addr} (${lat.toFixed(5)}, ${lng.toFixed(5)})${type}${rating}`;
            })
            .join(
              "\n",
            )}\nThere are ${anchorStops.length} anchor stops — the output MUST contain at least ${anchorStops.length} items corresponding to these anchors. Build the rest of the itinerary around them, filling complementary stops between them.${anchorStops.some((a) => a.label) ? " Anchors with names are verified real places — use their exact name and address." : " The anchor stops are user-selected map locations — find the nearest real venue or point of interest at each coordinate and use that as the stop."}\n`
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
${trailInstructions}${boardingGarageInstructions}${anchorBlock}${intentionBlock}${weatherSummary ? `\nWEATHER AWARENESS:\n${weatherSummary}\n- Adapt the itinerary to the forecast. Rain or storms → prefer indoor stops during those hours. Extreme heat → outdoor activities in morning/evening, shade and AC midday. Cold/wind → suggest layering in proTip. Perfect weather → maximize outdoor time.\n- Include weather-relevant proTips (e.g., "Bring sunscreen — UV index peaks at 9", "Rain likely after 3pm, grab a window seat and enjoy it").\n` : ""}${exclusionList ? `\nFRESHNESS RULE:\n- The user has visited these venues in previous itineraries: ${exclusionList}\n- Do NOT repeat any of them. Dig deeper — find hidden gems, newer spots, or lesser-known alternatives. The whole point is discovering something new each time.\n` : ""}
PLANNING RULES:
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

    const timeConstraint =
      input.startTime && input.endTime
        ? `\nTime window: ${input.startTime} – ${input.endTime} (schedule all stops within this window)`
        : input.startTime
          ? `\nStart time: ${input.startTime} (begin the itinerary at this time)`
          : "";

    const userPrompt = `City: ${cityName}
Date: ${input.plannedDate}
Duration: ${input.durationHours} hours
Budget: ${budgetRange}
Activity preferences: ${input.activityTypes.join(", ") || "anything fun"}${intention ? `\nIntention: ${intention.replace("_", " ")}` : ""}${input.stopCount > 0 ? `\nNumber of stops: exactly ${input.stopCount}` : ""}${timeConstraint}

EVENTS (use ONLY these for event-type stops):
${eventList}

VERIFIED VENUES in ${cityName} (prefer these for non-event stops):
${venueList}${trailList ? `\n\nPAVED TRAILS near ${cityName} (real OpenStreetMap data — use exact names):\n${trailList}` : ""}${forecast ? `\n\nWEATHER FORECAST for ${input.plannedDate}:\n${this.formatHourlyForPrompt(forecast)}` : ""}`;

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
}

export function createItineraryService(
  deps: ItineraryServiceDeps,
): ItineraryService {
  return new ItineraryServiceImpl(deps);
}
