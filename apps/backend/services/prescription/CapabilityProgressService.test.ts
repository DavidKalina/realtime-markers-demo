import { describe, expect, test } from "bun:test";

import { CapabilityProgress } from "../../entities/CapabilityProgress";
import { CapabilityProgressService } from "./CapabilityProgressService";
import { DATING_GOAL_PROGRAM } from "./programs/DatingGoalProgram";
import type { CapabilityEvidence } from "./GoalProgram";

function emptyEvidence(
  overrides: Partial<CapabilityEvidence> = {},
): CapabilityEvidence {
  return {
    completedQuestCount: 0,
    avgRecentRating: 0,
    recentStructuredCount: 0,
    recentNonSoloCount: 0,
    recentDirectGoalTouchCount: 0,
    recentDirectDatingRepCount: 0,
    recentDraftDatingRepCount: 0,
    recentRelationshipEvidenceCount: 0,
    recentMilestoneQuestSeen: false,
    recentRepPatternIds: [],
    questsSinceDirectGoalTouch: null,
    questsSinceDirectDatingRep: null,
    ...overrides,
  };
}

/**
 * In-memory fake repo + a query stub for the journal-acceleration SQL.
 * `recentJournalTags` is the most-recent-first list of `reflection_tags` arrays
 * the acceleration query should return.
 */
function fakeDataSource(opts: {
  recentJournalTags?: (string[] | null)[];
} = {}) {
  const rows: CapabilityProgress[] = [];
  let idCounter = 1;

  const repo = {
    findOne: async (opts: any) => {
      const where = opts.where ?? {};
      return (
        rows.find((r) =>
          Object.entries(where).every(
            ([k, v]) => (r as any)[k] === v,
          ),
        ) ?? null
      );
    },
    create: (init: Partial<CapabilityProgress>) => {
      const row = {
        id: `row-${idCounter++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...init,
      } as CapabilityProgress;
      return row;
    },
    save: async (row: CapabilityProgress) => {
      const existing = rows.findIndex((r) => r.id === row.id);
      if (existing >= 0) rows[existing] = row;
      else rows.push(row);
      return row;
    },
  };

  return {
    rows,
    dataSource: {
      getRepository: () => repo,
      query: async (sql: string) => {
        if (sql.includes("o.reflection_tags")) {
          return (opts.recentJournalTags ?? []).map((tags) => ({
            reflection_tags: tags,
          }));
        }
        return [];
      },
    } as any,
  };
}

describe("CapabilityProgressService.getActive", () => {
  test("cold-starts a BFS row when none exists", async () => {
    const { dataSource, rows } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);

    const result = await service.getActive(
      "user-1",
      DATING_GOAL_PROGRAM,
      "activation",
      emptyEvidence(),
    );

    expect(result.progress.phase).toBe("bfs");
    expect(result.progress.capabilityId).toBe("activation");
    expect(result.capability.id).toBe("activation");
    expect(result.isLocked).toBe(false);
    expect(rows.length).toBe(1);
  });

  test("returns the locked pattern when the row is in DFS", async () => {
    const { dataSource, rows } = fakeDataSource();
    const capability = DATING_GOAL_PROGRAM.capabilities.find(
      (c) => c.id === "micro_conversation",
    )!;
    const lockedPattern = capability.enactmentPatterns[0]!;
    rows.push({
      id: "preset",
      userId: "user-1",
      programId: DATING_GOAL_PROGRAM.id,
      capabilityId: "micro_conversation",
      phase: "dfs",
      activePatternId: lockedPattern.id,
      patternsTried: [lockedPattern.id],
      patternStats: { [lockedPattern.id]: { reps: 3, avgResonance: 0.55 } },
      repsAtCurrentPattern: 3,
      avgResonance: 0.55,
      lastQuestId: null,
      wonAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new CapabilityProgressService(dataSource);

    const result = await service.getActive(
      "user-1",
      DATING_GOAL_PROGRAM,
      "activation",
      emptyEvidence(),
    );

    expect(result.progress.phase).toBe("dfs");
    expect(result.pattern.id).toBe(lockedPattern.id);
    expect(result.isLocked).toBe(true);
  });
});

describe("CapabilityProgressService.updateOnQuestComplete", () => {
  test("stays BFS when pattern reps haven't hit threshold", async () => {
    const { dataSource } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);
    const capability = DATING_GOAL_PROGRAM.capabilities.find(
      (c) => c.id === "activation",
    )!;
    const pattern = capability.enactmentPatterns[0]!;

    const progress = await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.7, // high enough on resonance, but only 1 rep
      sidequestId: "sq-1",
    });

    expect(progress.phase).toBe("bfs");
    expect(progress.patternStats[pattern.id].reps).toBe(1);
    expect(progress.activePatternId).toBeFalsy();
  });

  test("flips to DFS once a pattern hits 3 reps + 0.5 avg resonance", async () => {
    const { dataSource } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    for (let i = 0; i < 2; i += 1) {
      await service.updateOnQuestComplete({
        userId: "user-1",
        program: DATING_GOAL_PROGRAM,
        capabilityId: "activation",
        patternId: pattern.id,
        resonance: 0.6,
        sidequestId: `sq-${i}`,
      });
    }

    // Third rep crosses the threshold.
    const progress = await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.6,
      sidequestId: "sq-3",
    });

    expect(progress.phase).toBe("dfs");
    expect(progress.activePatternId).toBe(pattern.id);
    expect(progress.repsAtCurrentPattern).toBe(3);
  });

  test("does not flip to DFS when avg resonance is below 0.5", async () => {
    const { dataSource } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    let progress = null;
    for (let i = 0; i < 4; i += 1) {
      progress = await service.updateOnQuestComplete({
        userId: "user-1",
        program: DATING_GOAL_PROGRAM,
        capabilityId: "activation",
        patternId: pattern.id,
        resonance: 0.3, // chronically below 0.5
        sidequestId: `sq-${i}`,
      });
    }

    expect(progress!.phase).toBe("bfs");
    expect(progress!.activePatternId).toBeFalsy();
  });

  test("flips to won when locked pattern hits 5 reps + 0.6 avg resonance, then advances", async () => {
    const { dataSource } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    let progress = null;
    for (let i = 0; i < 5; i += 1) {
      progress = await service.updateOnQuestComplete({
        userId: "user-1",
        program: DATING_GOAL_PROGRAM,
        capabilityId: "activation",
        patternId: pattern.id,
        resonance: 0.7,
        sidequestId: `sq-${i}`,
      });
    }

    expect(progress!.phase).toBe("won");
    expect(progress!.wonAt).not.toBeNull();

    // After winning, getActive should return the next capability in BFS.
    const active = await service.getActive(
      "user-1",
      DATING_GOAL_PROGRAM,
      "activation",
      emptyEvidence(),
    );
    expect(active.progress.phase).toBe("bfs");
    expect(active.progress.capabilityId).not.toBe("activation");
    expect(active.progress.capabilityId).toBe(
      DATING_GOAL_PROGRAM.capabilities[1]!.id,
    );
  });

  test("re-rate of the same sidequest does not double-count reps", async () => {
    const { dataSource } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.2, // initial low score
      sidequestId: "sq-1",
    });

    // Re-rate fires with a higher score for the SAME quest.
    const final = await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.8, // updated score for the same quest
      sidequestId: "sq-1",
    });

    expect(final.patternStats[pattern.id].reps).toBe(1);
    expect(final.patternStats[pattern.id].avgResonance).toBe(0.8);
  });

  test("two journal complaints + good resonance fast-forward to won and advance", async () => {
    const { dataSource } = fakeDataSource({
      recentJournalTags: [
        ["coverage_complaint"],
        ["coverage_complaint"],
        ["growth_narrative"],
      ],
    });
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    // First two reps build resonance to clear the 0.5 acceleration gate.
    await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.6,
      sidequestId: "sq-1",
    });
    const second = await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.6,
      sidequestId: "sq-2",
    });

    expect(second.phase).toBe("won");
    expect(second.wonAt).not.toBeNull();

    const active = await service.getActive(
      "user-1",
      DATING_GOAL_PROGRAM,
      "activation",
      emptyEvidence(),
    );
    expect(active.progress.capabilityId).toBe(
      DATING_GOAL_PROGRAM.capabilities[1]!.id,
    );
  });

  test("two journal complaints + low resonance do NOT fast-forward", async () => {
    const { dataSource } = fakeDataSource({
      recentJournalTags: [
        ["coverage_complaint"],
        ["readiness_mismatch"],
      ],
    });
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    const result = await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.2, // below acceleration gate
      sidequestId: "sq-1",
    });

    // Failing AND complaining means "this is too hard", not "I'm ready" — should not advance.
    expect(result.phase).toBe("bfs");
    expect(result.wonAt).toBeFalsy();
  });

  test("one journal complaint alone does not fast-forward", async () => {
    const { dataSource } = fakeDataSource({
      recentJournalTags: [["coverage_complaint"]],
    });
    const service = new CapabilityProgressService(dataSource);
    const pattern = DATING_GOAL_PROGRAM.capabilities[0]!.enactmentPatterns[0]!;

    const result = await service.updateOnQuestComplete({
      userId: "user-1",
      program: DATING_GOAL_PROGRAM,
      capabilityId: "activation",
      patternId: pattern.id,
      resonance: 0.7,
      sidequestId: "sq-1",
    });

    expect(result.phase).toBe("bfs");
  });

  test("DFS reps on a non-locked pattern do not advance toward winning", async () => {
    const { dataSource } = fakeDataSource();
    const service = new CapabilityProgressService(dataSource);
    const cap = DATING_GOAL_PROGRAM.capabilities.find(
      (c) => c.enactmentPatterns.length >= 2,
    )!;
    const lockedPattern = cap.enactmentPatterns[0]!;
    const otherPattern = cap.enactmentPatterns[1]!;

    // Lock the first pattern
    for (let i = 0; i < 3; i += 1) {
      await service.updateOnQuestComplete({
        userId: "user-1",
        program: DATING_GOAL_PROGRAM,
        capabilityId: cap.id,
        patternId: lockedPattern.id,
        resonance: 0.7,
        sidequestId: `sq-lock-${i}`,
      });
    }

    // Now hammer reps on the OTHER pattern — should not graduate the capability.
    for (let i = 0; i < 5; i += 1) {
      await service.updateOnQuestComplete({
        userId: "user-1",
        program: DATING_GOAL_PROGRAM,
        capabilityId: cap.id,
        patternId: otherPattern.id,
        resonance: 0.9,
        sidequestId: `sq-other-${i}`,
      });
    }

    const final = await service.getActive(
      "user-1",
      DATING_GOAL_PROGRAM,
      cap.id,
      emptyEvidence(),
    );
    expect(final.progress.phase).toBe("dfs");
    expect(final.progress.capabilityId).toBe(cap.id);
    expect(final.progress.activePatternId).toBe(lockedPattern.id);
  });
});
