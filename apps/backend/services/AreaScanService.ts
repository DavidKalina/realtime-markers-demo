import { DataSource } from "typeorm";
import { Event } from "@realtime-markers/database";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

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

export interface AreaScanResult {
  zoneStats: ZoneStats;
  events: ZoneEvent[];
  cached: boolean;
  stream?: Stream<ChatCompletionChunk>;
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

// --- Zone name mappings ---

const ZONE_NAME_MAP: Record<string, string[]> = {
  music: [
    "Melody Row",
    "The Sound District",
    "Rhythm Alley",
    "The Beat Quarter",
  ],
  "food & drink": [
    "The Flavor Quarter",
    "Feast Street",
    "The Spice Bazaar",
    "Grub Row",
  ],
  food: ["The Flavor Quarter", "Feast Street", "The Spice Bazaar", "Grub Row"],
  art: [
    "The Canvas District",
    "Fresco Lane",
    "The Gallery Quarter",
    "Pigment Row",
  ],
  sports: [
    "The Arena District",
    "Rally Field",
    "The Stadium Quarter",
    "Sprint Row",
  ],
  nightlife: [
    "Neon Row",
    "The After Dark District",
    "Midnight Alley",
    "The Glow Quarter",
  ],
  community: [
    "The Commons",
    "Gathering Square",
    "The Town Circle",
    "Unity Row",
  ],
  education: [
    "Scholar's Row",
    "The Academy Quarter",
    "Lecture Lane",
    "The Study",
  ],
  tech: ["The Silicon Quarter", "Byte Row", "The Code District", "Logic Lane"],
  health: [
    "The Wellness Quarter",
    "Vitality Row",
    "Remedy Lane",
    "The Healing District",
  ],
  fitness: [
    "The Training Grounds",
    "Iron Row",
    "The Gym District",
    "Stamina Lane",
  ],
  film: [
    "The Reel District",
    "Cinema Row",
    "Screenlight Lane",
    "The Projection Quarter",
  ],
  theater: [
    "Stage Row",
    "The Curtain District",
    "Spotlight Lane",
    "The Drama Quarter",
  ],
  comedy: [
    "The Laugh District",
    "Punchline Row",
    "Jest Lane",
    "The Comedy Quarter",
  ],
  fashion: [
    "Style Row",
    "The Runway District",
    "Couture Lane",
    "The Thread Quarter",
  ],
  nature: [
    "The Green Quarter",
    "Canopy Row",
    "Wildflower Lane",
    "The Grove District",
  ],
  outdoors: [
    "The Green Quarter",
    "Trailhead Row",
    "Summit Lane",
    "The Expedition District",
  ],
  charity: [
    "The Giving Quarter",
    "Kindness Row",
    "Goodwill Lane",
    "The Heart District",
  ],
  business: [
    "The Commerce Quarter",
    "Enterprise Row",
    "Deal Lane",
    "The Trade District",
  ],
  kids: [
    "The Playground Quarter",
    "Wonder Row",
    "Adventure Lane",
    "The Fun District",
  ],
  family: [
    "The Hearthstone Quarter",
    "Kinfolk Row",
    "Homestead Lane",
    "The Gathering District",
  ],
  science: [
    "The Discovery Quarter",
    "Eureka Row",
    "Lab Lane",
    "The Research District",
  ],
  spirituality: [
    "The Sanctuary Quarter",
    "Serenity Row",
    "Temple Lane",
    "The Shrine District",
  ],
  gaming: [
    "The Arcade Quarter",
    "Pixel Row",
    "Respawn Lane",
    "The Quest District",
  ],
  pets: [
    "The Pawprint Quarter",
    "Whisker Row",
    "Fetch Lane",
    "The Den District",
  ],
  travel: [
    "The Compass Quarter",
    "Wanderer Row",
    "Voyager Lane",
    "The Expedition District",
  ],
};

// --- Service ---

export interface AreaScanService {
  getAreaProfile(lat: number, lng: number, radius?: number): Promise<AreaScanResult>;
}

interface AreaScanDependencies {
  dataSource: DataSource;
  openAIService: OpenAIService;
  redisService: RedisService;
}

const RADIUS_METERS = 2000;
const MAX_EVENTS = 25;

class AreaScanServiceImpl implements AreaScanService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private redisService: RedisService;

  constructor(deps: AreaScanDependencies) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.redisService = deps.redisService;
  }

  async getAreaProfile(lat: number, lng: number, radius: number = RADIUS_METERS): Promise<AreaScanResult> {
    const geohash = encodeGeohash(lat, lng, 6);
    const hourBucket = Math.floor(Date.now() / (3600 * 1000));
    const cacheKey = `area-scan:${geohash}:${hourBucket}:${radius}`;

    // Check cache
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.zoneStats) {
          return {
            zoneStats: parsed.zoneStats,
            events: parsed.events || [],
            cached: true,
            text: parsed.text,
          };
        }
      } catch {
        // Invalid cache, continue to generate
      }
    }

    // Query nearby events
    const events = await this.queryNearbyEvents(lat, lng, radius);

    // Compute zone stats
    const zoneStats = this.computeZoneStats(events);

    // Map to lightweight wire format
    const zoneEvents: ZoneEvent[] = events.map((e) => ({
      id: e.id,
      emoji: e.emoji,
      title: e.title,
      eventDate: new Date(e.eventDate).toISOString(),
      distance: e.distance,
      categoryNames: e.categoryNames,
    }));

    // Build prompt
    const { systemPrompt, userPrompt } = this.buildPrompt(zoneStats, radius);

    // Stream from LLM
    const stream = await this.openAIService.streamChatCompletion({
      model: OpenAIModel.GPT4OMini,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 80,
    });

    return {
      zoneStats,
      events: zoneEvents,
      cached: false,
      stream,
    };
  }

  private async queryNearbyEvents(
    lat: number,
    lng: number,
    radius: number,
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
      })
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

    // Zone name
    const dominantCategory = categoryBreakdown[0]?.name.toLowerCase() || "";
    const zoneName = this.generateZoneName(dominantCategory, events.length);

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

  private generateZoneName(
    dominantCategory: string,
    eventCount: number,
  ): string {
    const variants = ZONE_NAME_MAP[dominantCategory];
    if (variants) {
      return variants[eventCount % variants.length];
    }
    if (dominantCategory && dominantCategory !== "uncategorized") {
      const capitalized =
        dominantCategory.charAt(0).toUpperCase() + dominantCategory.slice(1);
      return `The ${capitalized} District`;
    }
    return "The Discovery Quarter";
  }

  private buildPrompt(zoneStats: ZoneStats, radius: number): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt =
      "One punchy sentence about this zone's vibe. Max 25 words. No greetings, no lists.";

    const radiusLabel = radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;

    if (zoneStats.eventCount === 0) {
      return {
        systemPrompt,
        userPrompt: `No events within ${radiusLabel}. It's quiet here.`,
      };
    }

    const catSummary = zoneStats.categoryBreakdown
      .map((c) => `${c.name} (${c.count})`)
      .join(", ");

    return {
      systemPrompt,
      userPrompt: `${zoneStats.eventCount} events within ${radiusLabel}. Categories: ${catSummary}.`,
    };
  }
}

export function createAreaScanService(
  deps: AreaScanDependencies,
): AreaScanService {
  return new AreaScanServiceImpl(deps);
}
