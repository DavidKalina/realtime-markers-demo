import { describe, expect, test } from "bun:test";

import {
  BehavioralProfileService,
  renderLegacyProfile,
} from "./BehavioralProfileService";
import type {
  BehavioralProfileV1,
  BehavioralProfileV2,
} from "../../entities/User";

const FIXED_DATE = new Date("2026-04-24T12:00:00Z");

function fakeDataSource(handlers: {
  counts?: { completed_count: number; avg_rating: number | null };
  topCategories?: {
    category: string;
    count: number;
    avg_rating: number | null;
  }[];
  topVenues?: {
    venue_name: string;
    count: number;
    avg_rating: number | null;
    last_visited_at: Date;
  }[];
  rejected?: { venue_name: string; venue_category: string | null }[];
  travel?: {
    median_miles: number | null;
    max_miles: number | null;
    recent_max_miles: number | null;
  };
  anchors?: { venue_name: string }[];
  recentNarrative?: {
    title: string;
    venue_name: string | null;
    venue_category: string | null;
    rating: number | null;
    distance_from_home: number | null;
    completed_at: Date;
  }[];
  user?: {
    id: string;
    pacePreference: string | null;
    comfortProfile: { primaryGoal?: string } | null;
    behavioralProfile?: BehavioralProfileV1 | BehavioralProfileV2 | null;
  };
  updateImpl?: (patch: any) => void;
}) {
  return {
    query: async (sql: string) => {
      if (sql.includes("AVG(rating)::float AS avg_rating")) {
        return [handlers.counts ?? { completed_count: 0, avg_rating: null }];
      }
      if (sql.includes("o.venue_category AS category")) {
        return handlers.topCategories ?? [];
      }
      if (sql.includes("MAX(s.completed_at) AS last_visited_at")) {
        return handlers.topVenues ?? [];
      }
      if (sql.includes("o.would_return = false")) {
        return handlers.rejected ?? [];
      }
      if (sql.includes("PERCENTILE_CONT")) {
        return [
          handlers.travel ?? {
            median_miles: 0,
            max_miles: 0,
            recent_max_miles: 0,
          },
        ];
      }
      if (sql.includes("HAVING COUNT(*) >= $2 AND AVG(s.rating) >= $3")) {
        return handlers.anchors ?? [];
      }
      if (sql.includes("LEFT JOIN objectives o ON o.sidequest_id = s.id")) {
        return handlers.recentNarrative ?? [];
      }
      return [];
    },
    getRepository: () => ({
      findOne: async () => handlers.user ?? null,
      update: async (_where: any, patch: any) => {
        handlers.updateImpl?.(patch);
        return { affected: 1 };
      },
    }),
  } as any;
}

function fakeOpenAI(content: string | null) {
  return {
    executeChatCompletion: async () => ({
      choices: [{ message: { content } }],
    }),
  } as any;
}

describe("BehavioralProfileService.computeAggregates", () => {
  test("maps query rows into the BehavioralAggregates shape", async () => {
    const lastVisitedAt = FIXED_DATE;
    const ds = fakeDataSource({
      counts: { completed_count: 12, avg_rating: 4.1 },
      topCategories: [
        { category: "cafe", count: 5, avg_rating: 4.2 },
        { category: "park", count: 3, avg_rating: 3.8 },
      ],
      topVenues: [
        {
          venue_name: "Juniper Goods",
          count: 4,
          avg_rating: 4.5,
          last_visited_at: lastVisitedAt,
        },
      ],
      rejected: [
        { venue_name: "Bad Bar", venue_category: "Bar" },
        { venue_name: "Loud Spot", venue_category: "Bar" },
      ],
      travel: { median_miles: 4.2, max_miles: 22, recent_max_miles: 8 },
      anchors: [{ venue_name: "Juniper Goods" }],
    });
    const service = new BehavioralProfileService(ds, fakeOpenAI(null));

    const aggregates = await service.computeAggregates("user-1");

    expect(aggregates.completedCount).toBe(12);
    expect(aggregates.avgRating).toBe(4.1);
    expect(aggregates.topCategories).toEqual([
      { category: "cafe", count: 5, avgRating: 4.2 },
      { category: "park", count: 3, avgRating: 3.8 },
    ]);
    expect(aggregates.topVenues).toEqual([
      {
        venueName: "Juniper Goods",
        count: 4,
        avgRating: 4.5,
        lastVisitedAt: lastVisitedAt.toISOString(),
      },
    ]);
    expect(aggregates.rejectedVenues).toEqual([
      { name: "Bad Bar", category: "Bar" },
      { name: "Loud Spot", category: "Bar" },
    ]);
    expect(aggregates.travelRange).toEqual({
      medianMiles: 4.2,
      maxMiles: 22,
      recentMaxMiles: 8,
    });
    expect(aggregates.anchors).toEqual(["Juniper Goods"]);
  });

  test("returns zeroed shape for users with no history", async () => {
    const ds = fakeDataSource({});
    const service = new BehavioralProfileService(ds, fakeOpenAI(null));

    const aggregates = await service.computeAggregates("new-user");

    expect(aggregates.completedCount).toBe(0);
    expect(aggregates.avgRating).toBeNull();
    expect(aggregates.topCategories).toEqual([]);
    expect(aggregates.topVenues).toEqual([]);
    expect(aggregates.rejectedVenues).toEqual([]);
    expect(aggregates.anchors).toEqual([]);
    expect(aggregates.travelRange).toEqual({
      medianMiles: 0,
      maxMiles: 0,
      recentMaxMiles: 0,
    });
  });
});

describe("BehavioralProfileService.refresh", () => {
  test("returns null and skips LLM when user has fewer than 2 completed quests", async () => {
    let llmCalled = false;
    const ds = fakeDataSource({
      counts: { completed_count: 1, avg_rating: 4 },
    });
    const openAI = {
      executeChatCompletion: async () => {
        llmCalled = true;
        return { choices: [{ message: { content: "{}" } }] };
      },
    } as any;
    const service = new BehavioralProfileService(ds, openAI);

    const result = await service.refresh("user-1");

    expect(result).toBeNull();
    expect(llmCalled).toBe(false);
  });

  test("returns null when the LLM returns invalid JSON", async () => {
    const ds = fakeDataSource({
      counts: { completed_count: 5, avg_rating: 4 },
      user: { id: "user-1", pacePreference: null, comfortProfile: null },
    });
    const service = new BehavioralProfileService(
      ds,
      fakeOpenAI("not actually json"),
    );

    const result = await service.refresh("user-1");

    expect(result).toBeNull();
  });

  test("returns null when narrative slots are missing or empty", async () => {
    const ds = fakeDataSource({
      counts: { completed_count: 5, avg_rating: 4 },
      user: { id: "user-1", pacePreference: null, comfortProfile: null },
    });
    const service = new BehavioralProfileService(
      ds,
      fakeOpenAI(JSON.stringify({ capabilityArc: "x" })), // missing 4 slots
    );

    const result = await service.refresh("user-1");

    expect(result).toBeNull();
  });

  test("persists a valid v2 profile when all slots are present", async () => {
    let persisted: BehavioralProfileV2 | null = null;
    const ds = fakeDataSource({
      counts: { completed_count: 5, avg_rating: 4 },
      user: {
        id: "user-1",
        pacePreference: "steady",
        comfortProfile: { primaryGoal: "make friends" },
      },
      updateImpl: (patch) => {
        persisted = patch.behavioralProfile as BehavioralProfileV2;
      },
    });
    const service = new BehavioralProfileService(
      ds,
      fakeOpenAI(
        JSON.stringify({
          capabilityArc: "Practicing micro-conversations.",
          categoryAffinity: "Leans cafes; cooled on bars.",
          venueAffinity: "Anchors at Juniper Goods.",
          travelWillingness: "Comfortable to 5mi.",
          blockerPattern: "No recurring blocker pattern.",
        }),
      ),
    );

    const result = await service.refresh("user-1");

    expect(result).not.toBeNull();
    expect(result?.schemaVersion).toBe(2);
    expect(result?.questCount).toBe(5);
    expect(result?.capabilityArc).toBe("Practicing micro-conversations.");
    expect(result?.blockerPattern).toBe("No recurring blocker pattern.");
    expect(persisted).not.toBeNull();
    expect(persisted!.schemaVersion).toBe(2);
  });
});

describe("renderLegacyProfile", () => {
  test("returns null for null/undefined", () => {
    expect(renderLegacyProfile(null)).toBeNull();
    expect(renderLegacyProfile(undefined)).toBeNull();
  });

  test("passes v1 profiles through unchanged", () => {
    const v1: BehavioralProfileV1 = {
      summary: "raw summary",
      generatedAt: "2026-04-24T00:00:00Z",
      questCount: 5,
    };

    expect(renderLegacyProfile(v1)).toEqual({
      summary: "raw summary",
      generatedAt: "2026-04-24T00:00:00Z",
      questCount: 5,
    });
  });

  test("collapses v2 slots into a joined summary string", () => {
    const v2: BehavioralProfileV2 = {
      schemaVersion: 2,
      generatedAt: "2026-04-24T00:00:00Z",
      questCount: 8,
      capabilityArc: "Arc.",
      categoryAffinity: "Cats.",
      venueAffinity: "Vens.",
      travelWillingness: "Travel.",
      blockerPattern: "None.",
      aggregates: {
        completedCount: 8,
        avgRating: 4,
        topCategories: [],
        topVenues: [],
        rejectedVenues: [],
        travelRange: { medianMiles: 0, maxMiles: 0, recentMaxMiles: 0 },
        anchors: [],
      },
    };

    const rendered = renderLegacyProfile(v2);

    expect(rendered?.questCount).toBe(8);
    expect(rendered?.summary).toBe("Arc.\n\nCats.\n\nVens.\n\nTravel.\n\nNone.");
  });

  test("skips empty slots when collapsing v2", () => {
    const v2: BehavioralProfileV2 = {
      schemaVersion: 2,
      generatedAt: "2026-04-24T00:00:00Z",
      questCount: 3,
      capabilityArc: "Arc.",
      categoryAffinity: "",
      venueAffinity: "Vens.",
      travelWillingness: "",
      blockerPattern: "",
      aggregates: {
        completedCount: 3,
        avgRating: null,
        topCategories: [],
        topVenues: [],
        rejectedVenues: [],
        travelRange: { medianMiles: 0, maxMiles: 0, recentMaxMiles: 0 },
        anchors: [],
      },
    };

    const rendered = renderLegacyProfile(v2);

    expect(rendered?.summary).toBe("Arc.\n\nVens.");
  });
});
