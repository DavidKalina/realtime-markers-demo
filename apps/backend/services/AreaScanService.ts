import { DataSource } from "typeorm";
import { Event } from "@realtime-markers/database";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";
import type { OverpassService } from "./shared/OverpassService";

// --- Geohash encoder (precision 6 ≈ 1.2 km cells) ---

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function encodeGeohash(lat: number, lng: number, precision = 6): string {
  let minLat = -90,
    maxLat = 90;
  let minLng = -180,
    maxLng = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

// --- Types ---

export interface ZoneStats {
  zoneName: string;
  eventCount: number;
  topEmoji: string;
  categoryBreakdown: { name: string; count: number; pct: number }[];
  timeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  totalSaves: number;
  totalViews: number;
  avgDistance: number;
  recurringCount: number;
}

export interface ZoneEvent {
  id: string;
  emoji: string;
  title: string;
  eventDate: string;
  distance: number;
  categoryNames: string;
}

export interface ZoneTrail {
  id: number;
  name: string;
  surface: string;
  lengthMeters: number;
  lit: boolean | null;
  geometry: [number, number][];
  center: [number, number];
}

export interface AreaScanResult {
  zoneStats: ZoneStats;
  events: ZoneEvent[];
  trails: ZoneTrail[];
  cached: boolean;
  text?: string;
}

interface NearbyEventRow {
  id: string;
  emoji: string;
  title: string;
  eventDate: Date;
  distance: number;
  categoryNames: string;
  categories: string[];
  saveCount: number;
  viewCount: number;
  isRecurring: boolean;
}

export interface AreaScanFilters {
  dateRange?: { start: string; end: string };
  categoryIds?: string[];
}

// --- Service ---

export interface AreaScanService {
  getAreaProfile(
    lat: number,
    lng: number,
    radius?: number,
    filters?: AreaScanFilters,
  ): Promise<AreaScanResult>;

  getClusterProfile(
    eventIds: string[],
    centerLat: number,
    centerLng: number,
  ): Promise<AreaScanResult>;
}

interface AreaScanDependencies {
  dataSource: DataSource;
  openAIService: OpenAIService;
  redisService: RedisService;
  overpassService: OverpassService;
}

const RADIUS_METERS = 16093;
const MAX_EVENTS = 25;

class AreaScanServiceImpl implements AreaScanService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private redisService: RedisService;
  private overpassService: OverpassService;

  constructor(deps: AreaScanDependencies) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.redisService = deps.redisService;
    this.overpassService = deps.overpassService;
  }

  async getAreaProfile(
    lat: number,
    lng: number,
    radius: number = RADIUS_METERS,
    filters?: AreaScanFilters,
  ): Promise<AreaScanResult> {
    const geohash = encodeGeohash(lat, lng, 6);
    const hourBucket = Math.floor(Date.now() / (3600 * 1000));
    const filterHash = filters
      ? Buffer.from(JSON.stringify(filters)).toString("base64url").slice(0, 12)
      : "";
    const cacheKey = filterHash
      ? `area-scan:${geohash}:${hourBucket}:${radius}:${filterHash}`
      : `area-scan:${geohash}:${hourBucket}:${radius}`;

    // Check cache
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.zoneStats) {
          return {
            zoneStats: parsed.zoneStats,
            events: parsed.events || [],
            trails: parsed.trails || [],
            cached: true,
            text: parsed.text,
          };
        }
      } catch {
        // Invalid cache, continue to generate
      }
    }

    // Query nearby events and trails in parallel
    const [events, rawTrails] = await Promise.all([
      this.queryNearbyEvents(lat, lng, radius, filters),
      this.overpassService.fetchPavedTrails(lat, lng, Math.max(radius, 3000), 5),
    ]);

    // Compute zone stats (without zone name — LLM will generate it)
    const zoneStats = this.computeZoneStats(events);

    // Map to lightweight wire formats
    const zoneEvents: ZoneEvent[] = events.map((e) => ({
      id: e.id,
      emoji: e.emoji,
      title: e.title,
      eventDate: new Date(e.eventDate).toISOString(),
      distance: e.distance,
      categoryNames: e.categoryNames,
    }));

    const zoneTrails: ZoneTrail[] = rawTrails.map((t) => ({
      id: t.id,
      name: t.name,
      surface: t.surface,
      lengthMeters: t.lengthMeters,
      lit: t.lit,
      geometry: t.geometry,
      center: t.center,
    }));

    // Build prompt and generate name + vibe via LLM
    const { systemPrompt, userPrompt } = this.buildPrompt(
      zoneStats,
      lat,
      lng,
      radius,
      filters,
      events,
      zoneTrails,
    );

    const completion = await this.openAIService.executeChatCompletion({
      model: OpenAIModel.GPT4OMini,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let name = zoneStats.zoneName;
    let vibe = "";
    try {
      const parsed = JSON.parse(raw);
      if (parsed.name) name = parsed.name;
      if (parsed.vibe) vibe = parsed.vibe;
    } catch {
      vibe = raw;
    }

    zoneStats.zoneName = name;

    return {
      zoneStats,
      events: zoneEvents,
      trails: zoneTrails,
      cached: false,
      text: vibe,
    };
  }

  async getClusterProfile(
    eventIds: string[],
    centerLat: number,
    centerLng: number,
  ): Promise<AreaScanResult> {
    const [events, rawTrails] = await Promise.all([
      this.queryEventsByIds(eventIds, centerLat, centerLng),
      this.overpassService.fetchPavedTrails(centerLat, centerLng, 3000, 5),
    ]);
    const zoneStats = this.computeZoneStats(events);

    const zoneEvents: ZoneEvent[] = events.slice(0, 20).map((e) => ({
      id: e.id,
      emoji: e.emoji,
      title: e.title,
      eventDate: new Date(e.eventDate).toISOString(),
      distance: e.distance,
      categoryNames: e.categoryNames,
    }));

    const zoneTrails: ZoneTrail[] = rawTrails.map((t) => ({
      id: t.id,
      name: t.name,
      surface: t.surface,
      lengthMeters: t.lengthMeters,
      lit: t.lit,
      geometry: t.geometry,
      center: t.center,
    }));

    const { systemPrompt, userPrompt } = this.buildPrompt(
      zoneStats,
      centerLat,
      centerLng,
      0,
      undefined,
      events,
      zoneTrails,
    );

    const completion = await this.openAIService.executeChatCompletion({
      model: OpenAIModel.GPT4OMini,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let name = zoneStats.zoneName;
    let vibe = "";
    try {
      const parsed = JSON.parse(raw);
      if (parsed.name) name = parsed.name;
      if (parsed.vibe) vibe = parsed.vibe;
    } catch {
      vibe = raw;
    }

    zoneStats.zoneName = name;

    return {
      zoneStats,
      events: zoneEvents,
      trails: zoneTrails,
      cached: false,
      text: vibe,
    };
  }

  private async queryEventsByIds(
    eventIds: string[],
    centerLat: number,
    centerLng: number,
  ): Promise<NearbyEventRow[]> {
    const eventRepository = this.dataSource.getRepository(Event);

    const rows: NearbyEventRow[] = await eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .addSelect(
        `ST_Distance(
          event.location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        "distance",
      )
      .where("event.id IN (:...eventIds)", { eventIds })
      .andWhere("event.status IN (:...statuses)", {
        statuses: ["VERIFIED", "PENDING"],
      })
      .setParameters({ lat: centerLat, lng: centerLng })
      .orderBy("distance", "ASC")
      .limit(MAX_EVENTS)
      .getRawAndEntities()
      .then(({ entities, raw }) =>
        entities.map((e, i) => ({
          id: e.id,
          emoji: e.emoji || "📍",
          title: e.title,
          eventDate: e.eventDate,
          distance: Math.round(parseFloat(raw[i]?.distance || "0")),
          categoryNames: (e.categories || []).map((c) => c.name).join(", "),
          categories: (e.categories || []).map((c) => c.name),
          saveCount: e.saveCount ?? 0,
          viewCount: e.viewCount ?? 0,
          isRecurring: e.isRecurring ?? false,
        })),
      );

    return rows;
  }

  private async queryNearbyEvents(
    lat: number,
    lng: number,
    radius: number,
    filters?: AreaScanFilters,
  ): Promise<NearbyEventRow[]> {
    const eventRepository = this.dataSource.getRepository(Event);

    const qb = eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .addSelect(
        `ST_Distance(
          event.location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        "distance",
      )
      .where(
        `ST_DWithin(
          event.location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
        { lat, lng, radius },
      )
      .andWhere("event.status IN (:...statuses)", {
        statuses: ["VERIFIED", "PENDING"],
      });

    if (filters?.dateRange?.start) {
      qb.andWhere("event.eventDate >= :startDate", {
        startDate: new Date(filters.dateRange.start + "T00:00:00.000Z"),
      });
    }
    if (filters?.dateRange?.end) {
      qb.andWhere("event.eventDate <= :endDate", {
        endDate: new Date(filters.dateRange.end + "T23:59:59.999Z"),
      });
    }
    if (filters?.categoryIds?.length) {
      qb.andWhere("category.id IN (:...categoryIds)", {
        categoryIds: filters.categoryIds,
      });
    }

    const rows: NearbyEventRow[] = await qb
      .orderBy("distance", "ASC")
      .limit(MAX_EVENTS)
      .getRawAndEntities()
      .then(({ entities, raw }) =>
        entities.map((e, i) => ({
          id: e.id,
          emoji: e.emoji || "📍",
          title: e.title,
          eventDate: e.eventDate,
          distance: Math.round(parseFloat(raw[i]?.distance || "0")),
          categoryNames: (e.categories || []).map((c) => c.name).join(", "),
          categories: (e.categories || []).map((c) => c.name),
          saveCount: e.saveCount ?? 0,
          viewCount: e.viewCount ?? 0,
          isRecurring: e.isRecurring ?? false,
        })),
      );

    return rows;
  }

  private computeZoneStats(events: NearbyEventRow[]): ZoneStats {
    if (events.length === 0) {
      return {
        zoneName: "The Quiet Zone",
        eventCount: 0,
        topEmoji: "🔇",
        categoryBreakdown: [],
        timeDistribution: { morning: 0, afternoon: 0, evening: 0, night: 0 },
        totalSaves: 0,
        totalViews: 0,
        avgDistance: 0,
        recurringCount: 0,
      };
    }

    // Category breakdown
    const catCounts = new Map<string, number>();
    for (const e of events) {
      for (const cat of e.categories) {
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
      }
      if (e.categories.length === 0) {
        catCounts.set(
          "Uncategorized",
          (catCounts.get("Uncategorized") || 0) + 1,
        );
      }
    }
    const totalCatEntries = Array.from(catCounts.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const categoryBreakdown = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.max(1, Math.round((count / totalCatEntries) * 100)),
      }));

    // Time distribution
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const e of events) {
      const hour = new Date(e.eventDate).getHours();
      if (hour >= 5 && hour <= 11) timeDistribution.morning++;
      else if (hour >= 12 && hour <= 16) timeDistribution.afternoon++;
      else if (hour >= 17 && hour <= 20) timeDistribution.evening++;
      else timeDistribution.night++;
    }

    // Engagement
    const totalSaves = events.reduce((sum, e) => sum + e.saveCount, 0);
    const totalViews = events.reduce((sum, e) => sum + e.viewCount, 0);

    // Distance
    const avgDistance = Math.round(
      events.reduce((sum, e) => sum + e.distance, 0) / events.length,
    );

    // Top emoji
    const emojiCounts = new Map<string, number>();
    for (const e of events) {
      emojiCounts.set(e.emoji, (emojiCounts.get(e.emoji) || 0) + 1);
    }
    const topEmoji = Array.from(emojiCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0][0];

    // Recurring count
    const recurringCount = events.filter((e) => e.isRecurring).length;

    // Zone name — placeholder, LLM will generate the real one
    const dominant = categoryBreakdown[0]?.name || "Discovery";
    const zoneName = `The ${dominant.charAt(0).toUpperCase() + dominant.slice(1)} Zone`;

    return {
      zoneName,
      eventCount: events.length,
      topEmoji,
      categoryBreakdown,
      timeDistribution,
      totalSaves,
      totalViews,
      avgDistance,
      recurringCount,
    };
  }

  private buildPrompt(
    zoneStats: ZoneStats,
    lat: number,
    lng: number,
    radius: number,
    filters?: AreaScanFilters,
    events?: NearbyEventRow[],
    trails?: ZoneTrail[],
  ): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = `You are a local area guide on a living event map. When a user scans a zone, you tell them what's happening nearby in a helpful, concise way. This includes both events and nearby paved trails suitable for walking, biking, or skating.

Return JSON: {"name": "...", "vibe": "..."}

name: A creative 2-4 word place name inspired by the dominant event types and nearby trails. Examples: "Live Music Row", "The Makers Corner", "Foodie Alley", "Gallery Loop", "Lakeside Trail Hub". Never use "District" or "Quarter".

vibe: Write exactly 2-3 nuggets, one per line, separated by a single newline. Each line MUST be between 95 and 110 characters — this is a hard UI constraint. Shorter lines waste space, longer lines get cut off. Each line should be one complete, standalone thought. Mention specific events by name when notable. If trails are nearby, mention the best one briefly. Tell the user what they can do here — what to check out, what's coming up soon, or what stands out. Be direct and useful, not poetic. No greetings, no "this area has". Plain text only — no markdown, no asterisks, no bullet points, no formatting.`;

    const isCluster = radius === 0;
    const radiusLabel = isCluster
      ? "cluster"
      : radius >= 1000
        ? `${radius / 1000} km`
        : `${radius} m`;

    if (zoneStats.eventCount === 0) {
      return {
        systemPrompt,
        userPrompt: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Scan radius: ${radiusLabel}. Nothing found nearby. Write a short encouraging note to check back later.`,
      };
    }

    const catSummary = zoneStats.categoryBreakdown
      .map((c) => `${c.name} ${c.pct}%`)
      .join(", ");

    const timeParts: string[] = [];
    const { morning, afternoon, evening, night } = zoneStats.timeDistribution;
    if (evening > 0 || night > 0) timeParts.push("leans evening/night");
    else if (morning > 0 || afternoon > 0) timeParts.push("daytime energy");
    const timeHint =
      timeParts.length > 0 ? ` Timing: ${timeParts.join(", ")}.` : "";

    let filterHint = "";
    if (filters?.dateRange) {
      filterHint += ` Filtered to: ${filters.dateRange.start} through ${filters.dateRange.end}.`;
    }
    if (filters?.categoryIds?.length) {
      filterHint += ` Category filter active (${filters.categoryIds.length} selected).`;
    }

    const scopeLabel = isCluster
      ? `Cluster of ${zoneStats.eventCount} events.`
      : `Radius: ${radiusLabel}. ${zoneStats.eventCount} events found.`;

    // Include up to 10 event titles so the LLM knows what's actually here
    const eventList = (events || [])
      .slice(0, 10)
      .map(
        (e) =>
          `- ${e.emoji} "${e.title}" (${e.categoryNames || "Uncategorized"}, ${e.distance}m away)`,
      )
      .join("\n");

    const eventSection = eventList ? `\n\nNearby events:\n${eventList}` : "";

    const trailList = (trails || [])
      .slice(0, 5)
      .map(
        (t) =>
          `- 🛤️ "${t.name}" (${t.surface}, ${t.lengthMeters}m${t.lit ? ", lit" : ""})`,
      )
      .join("\n");
    const trailSection = trailList ? `\n\nNearby trails:\n${trailList}` : "";

    return {
      systemPrompt,
      userPrompt: `${scopeLabel} Categories: ${catSummary}.${timeHint}${filterHint}${eventSection}${trailSection}`,
    };
  }
}

export function createAreaScanService(
  deps: AreaScanDependencies,
): AreaScanService {
  return new AreaScanServiceImpl(deps);
}
