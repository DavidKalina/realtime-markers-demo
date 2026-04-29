import { describe, expect, test } from "bun:test";
import {
  scoreInterestAlignment,
  selectInterestAligned,
  type InterestSignals,
} from "./InterestAlignmentPolicy";
import type { ScoutCandidate } from "./PrescriptionStrategy";

function candidate(overrides: Partial<ScoutCandidate> = {}): ScoutCandidate {
  return {
    venueName: "Test Venue",
    venueAddress: "123 Test St",
    venueCategory: "Other",
    latitude: 0,
    longitude: 0,
    source: "search_places",
    ...overrides,
  };
}

function signals(overrides: Partial<InterestSignals> = {}): InterestSignals {
  return {
    activities: [],
    goalTags: [],
    primaryGoal: null,
    ...overrides,
  };
}

describe("scoreInterestAlignment — category overlap", () => {
  test("category that names a stated activity outranks an unrelated category", () => {
    const aligned = scoreInterestAlignment(
      candidate({ venueCategory: "Climbing Gym" }),
      signals({ activities: ["climbing"] }),
    );
    const unrelated = scoreInterestAlignment(
      candidate({ venueCategory: "Coffee Shop" }),
      signals({ activities: ["climbing"] }),
    );
    expect(aligned).toBeGreaterThan(unrelated);
  });

  test("zero stated interests yields zero — nothing to align against", () => {
    const score = scoreInterestAlignment(
      candidate({ venueCategory: "Climbing Gym" }),
      signals({ activities: [] }),
    );
    expect(score).toBe(0);
  });

  test("category with no overlap yields zero so the hard-filter can gate on it", () => {
    const score = scoreInterestAlignment(
      candidate({ venueCategory: "Coffee Shop" }),
      signals({ activities: ["climbing", "yoga"] }),
    );
    expect(score).toBe(0);
  });
});

describe("scoreInterestAlignment — Google type signals", () => {
  test("googleTypes can carry the interest signal when category is generic", () => {
    const score = scoreInterestAlignment(
      candidate({
        venueCategory: "Park",
        googleTypes: ["park", "climbing_gym"],
      }),
      signals({ activities: ["climbing"] }),
    );
    expect(score).toBeGreaterThan(0);
  });

  test("googlePrimaryType participates the same way", () => {
    const score = scoreInterestAlignment(
      candidate({
        venueCategory: "Other",
        googlePrimaryType: "yoga_studio",
      }),
      signals({ activities: ["yoga"] }),
    );
    expect(score).toBeGreaterThan(0);
  });
});

describe("scoreInterestAlignment — comfort-profile signals", () => {
  test("primaryGoal contributes when activities are silent", () => {
    const score = scoreInterestAlignment(
      candidate({ venueCategory: "Pottery Studio" }),
      signals({
        activities: [],
        primaryGoal: "find a pottery class",
      }),
    );
    expect(score).toBeGreaterThan(0);
  });

  test("goalTags lift hands-on venues for discover_hobby goal", () => {
    const score = scoreInterestAlignment(
      candidate({
        venueCategory: "Workshop / Class Venue",
        googleTypes: ["workshop"],
      }),
      signals({ goalTags: ["discover_hobby"] }),
    );
    expect(score).toBeGreaterThan(0);
  });

  test("goalTags do not lift venues unrelated to the goal vocabulary", () => {
    const score = scoreInterestAlignment(
      candidate({ venueCategory: "Bar" }),
      signals({ goalTags: ["discover_hobby"] }),
    );
    expect(score).toBe(0);
  });

  test("an activity-aligned candidate still outranks a goal-tag-only match", () => {
    const direct = scoreInterestAlignment(
      candidate({ venueCategory: "Climbing Gym" }),
      signals({
        activities: ["climbing"],
        goalTags: ["discover_hobby"],
      }),
    );
    const indirect = scoreInterestAlignment(
      candidate({ venueCategory: "Workshop / Class Venue" }),
      signals({
        activities: ["climbing"],
        goalTags: ["discover_hobby"],
      }),
    );
    expect(direct).toBeGreaterThan(indirect);
  });
});

describe("selectInterestAligned — hard-floor enforcement", () => {
  test("ok when at least minAligned candidates have non-zero score", () => {
    const result = selectInterestAligned(
      [
        { candidate: candidate({ venueName: "A" }), score: 1 },
        { candidate: candidate({ venueName: "B" }), score: 0.6 },
        { candidate: candidate({ venueName: "C" }), score: 0.4 },
        { candidate: candidate({ venueName: "D" }), score: 0 },
        { candidate: candidate({ venueName: "E" }), score: 0 },
      ],
      { count: 5, minAligned: 3 },
    );
    expect(result.status).toBe("ok");
  });

  test("insufficient_aligned when fewer than minAligned non-zero — signals envelope expansion", () => {
    const result = selectInterestAligned(
      [
        { candidate: candidate({ venueName: "A" }), score: 1 },
        { candidate: candidate({ venueName: "B" }), score: 0.6 },
        { candidate: candidate({ venueName: "C" }), score: 0 },
        { candidate: candidate({ venueName: "D" }), score: 0 },
        { candidate: candidate({ venueName: "E" }), score: 0 },
      ],
      { count: 5, minAligned: 3 },
    );
    expect(result.status).toBe("insufficient_aligned");
    if (result.status === "insufficient_aligned") {
      expect(result.alignedCount).toBe(2);
    }
  });

  test("selected slate front-loads aligned candidates by score, then fills with non-aligned", () => {
    const result = selectInterestAligned(
      [
        { candidate: candidate({ venueName: "weak-aligned" }), score: 0.4 },
        { candidate: candidate({ venueName: "filler-1" }), score: 0 },
        { candidate: candidate({ venueName: "strong-aligned" }), score: 1 },
        { candidate: candidate({ venueName: "mid-aligned" }), score: 0.6 },
        { candidate: candidate({ venueName: "filler-2" }), score: 0 },
        { candidate: candidate({ venueName: "filler-3" }), score: 0 },
      ],
      { count: 5, minAligned: 3 },
    );
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const names = result.selected.map((s) => s.candidate.venueName);
      expect(names.slice(0, 3)).toEqual([
        "strong-aligned",
        "mid-aligned",
        "weak-aligned",
      ]);
      expect(result.selected).toHaveLength(5);
      const alignedInSlate = result.selected.filter((s) => s.score > 0).length;
      expect(alignedInSlate).toBeGreaterThanOrEqual(3);
    }
  });

  test("preserves caller's tie-breaking order among non-aligned fillers", () => {
    const result = selectInterestAligned(
      [
        { candidate: candidate({ venueName: "aligned-1" }), score: 1 },
        { candidate: candidate({ venueName: "aligned-2" }), score: 1 },
        { candidate: candidate({ venueName: "aligned-3" }), score: 1 },
        { candidate: candidate({ venueName: "filler-A" }), score: 0 },
        { candidate: candidate({ venueName: "filler-B" }), score: 0 },
      ],
      { count: 5, minAligned: 3 },
    );
    if (result.status === "ok") {
      const fillerOrder = result.selected
        .filter((s) => s.score === 0)
        .map((s) => s.candidate.venueName);
      expect(fillerOrder).toEqual(["filler-A", "filler-B"]);
    }
  });
});
