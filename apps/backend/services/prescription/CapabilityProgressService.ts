import type { DataSource } from "typeorm";

import {
  CapabilityProgress,
  type CapabilityPhase,
} from "../../entities/CapabilityProgress";
import {
  type CapabilityEvidence,
  type CapabilityNode,
  type EnactmentPattern,
  type GoalProgram,
  findCapability,
  nextCapability,
  rotatePatternsAwayFromRecent,
} from "./GoalProgram";

const BFS_TO_DFS_MIN_REPS = 3;
const BFS_TO_DFS_MIN_RESONANCE = 0.5;
const DFS_TO_WON_MIN_REPS = 5;
const DFS_TO_WON_MIN_RESONANCE = 0.6;

/**
 * Journal-driven acceleration: when the user explicitly says (via journal tags)
 * that the rep was below their level or isn't moving them toward their goal,
 * AND they're succeeding at the rep, fast-forward the capability to "won".
 * The asymmetry justifies aggression — false positives get auto-corrected by
 * the user rejecting the next prescription.
 */
const ACCELERATION_MIN_SIGNALS = 2;
const ACCELERATION_MIN_RESONANCE = 0.5;
const ACCELERATION_TAGS = ["coverage_complaint", "readiness_mismatch"] as const;

interface PatternStat {
  reps: number;
  avgResonance: number;
  /**
   * Per-quest resonance scores. Keyed by sidequestId so re-rates / multi-event
   * triggers (check-in + rate) replace rather than double-count.
   */
  scoresByQuest?: Record<string, number>;
}

export interface CapabilityProgressActiveResult {
  progress: CapabilityProgress;
  capability: CapabilityNode;
  /** The pattern to use for the next quest. In DFS, this equals the locked pattern. In BFS, it rotates away from recent reps. */
  pattern: EnactmentPattern;
  /** True when phase=dfs and the locked pattern is the one we're returning. */
  isLocked: boolean;
}

export class CapabilityProgressService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Return the user's active capability + the enactment pattern to use next.
   * Cold-starts from quest evidence (via the program's coldStart hook) when no row exists.
   */
  async getActive(
    userId: string,
    program: GoalProgram,
    coldStartCapabilityId: string,
    evidence: CapabilityEvidence,
  ): Promise<CapabilityProgressActiveResult> {
    const repo = this.dataSource.getRepository(CapabilityProgress);

    let progress = await repo.findOne({
      where: { userId, programId: program.id },
      order: { createdAt: "DESC" },
    });

    if (!progress || progress.phase === "won") {
      const seedCapabilityId = progress?.phase === "won"
        ? this.advanceFrom(program, progress.capabilityId)
        : coldStartCapabilityId;
      progress = repo.create({
        userId,
        programId: program.id,
        capabilityId: seedCapabilityId,
        phase: "bfs",
        activePatternId: null,
        patternsTried: [],
        patternStats: {},
        repsAtCurrentPattern: 0,
        avgResonance: 0,
        lastQuestId: null,
        wonAt: null,
      });
      await repo.save(progress);
    }

    const capability = findCapability(program, progress.capabilityId);
    const pattern = this.pickPattern(progress, capability, evidence);
    const isLocked =
      progress.phase === "dfs" && pattern.id === progress.activePatternId;

    return { progress, capability, pattern, isLocked };
  }

  /**
   * Update progress on quest completion. Applies BFS→DFS and DFS→won transitions.
   */
  async updateOnQuestComplete(input: {
    userId: string;
    program: GoalProgram;
    capabilityId: string;
    patternId: string;
    resonance: number;
    sidequestId: string;
  }): Promise<CapabilityProgress> {
    const repo = this.dataSource.getRepository(CapabilityProgress);
    let progress = await repo.findOne({
      where: { userId: input.userId, capabilityId: input.capabilityId },
    });

    if (!progress) {
      progress = repo.create({
        userId: input.userId,
        programId: input.program.id,
        capabilityId: input.capabilityId,
        phase: "bfs",
        activePatternId: null,
        patternsTried: [],
        patternStats: {},
        repsAtCurrentPattern: 0,
        avgResonance: 0,
      });
    }

    // Update pattern ledger. Idempotent per (patternId, sidequestId): re-rates
    // and multi-event triggers (check-in + rate) replace the prior score
    // rather than appending a new rep.
    const stats: Record<string, PatternStat> = { ...progress.patternStats };
    const prev = stats[input.patternId] ?? {
      reps: 0,
      avgResonance: 0,
      scoresByQuest: {},
    };
    const scoresByQuest = { ...(prev.scoresByQuest ?? {}) };
    scoresByQuest[input.sidequestId] = input.resonance;
    const allScores = Object.values(scoresByQuest);
    const reps = allScores.length;
    const avgResonance =
      reps === 0 ? 0 : allScores.reduce((s, v) => s + v, 0) / reps;
    stats[input.patternId] = { reps, avgResonance, scoresByQuest };
    progress.patternStats = stats;

    if (!progress.patternsTried.includes(input.patternId)) {
      progress.patternsTried = [...progress.patternsTried, input.patternId];
    }

    // Recompute capability-level avg resonance across all patterns tried.
    const totalReps = Object.values(stats).reduce((s, p) => s + p.reps, 0);
    const totalResSum = Object.values(stats).reduce(
      (s, p) => s + p.avgResonance * p.reps,
      0,
    );
    progress.avgResonance = totalReps > 0 ? totalResSum / totalReps : 0;
    progress.lastQuestId = input.sidequestId;

    let acceleratedByJournal = false;
    if (progress.phase !== "won") {
      const recentSignals = await this.countRecentJournalSignals(
        input.userId,
        input.capabilityId,
      );
      if (
        recentSignals >= ACCELERATION_MIN_SIGNALS &&
        progress.avgResonance >= ACCELERATION_MIN_RESONANCE
      ) {
        progress.phase = "won";
        progress.wonAt = new Date();
        acceleratedByJournal = true;
      }
    }

    if (!acceleratedByJournal && progress.phase === "bfs") {
      const patternStat = stats[input.patternId];
      if (
        patternStat.reps >= BFS_TO_DFS_MIN_REPS &&
        patternStat.avgResonance >= BFS_TO_DFS_MIN_RESONANCE
      ) {
        progress.phase = "dfs";
        progress.activePatternId = input.patternId;
        progress.repsAtCurrentPattern = patternStat.reps;
      }
    } else if (!acceleratedByJournal && progress.phase === "dfs") {
      if (input.patternId === progress.activePatternId) {
        progress.repsAtCurrentPattern = stats[input.patternId].reps;
        if (
          progress.repsAtCurrentPattern >= DFS_TO_WON_MIN_REPS &&
          stats[input.patternId].avgResonance >= DFS_TO_WON_MIN_RESONANCE
        ) {
          progress.phase = "won";
          progress.wonAt = new Date();
        }
      }
    }

    if (acceleratedByJournal) {
      console.log(
        `[CapabilityProgress] user ${input.userId} accelerated "${progress.capabilityId}" → won via journal signal (${ACCELERATION_MIN_SIGNALS}+ complaints, avgRes=${progress.avgResonance.toFixed(2)})`,
      );
    }

    await repo.save(progress);

    if (progress.phase === "won") {
      await this.ensureNextCapabilityRow(
        input.userId,
        input.program,
        progress.capabilityId,
      );
    }

    return progress;
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private pickPattern(
    progress: CapabilityProgress,
    capability: CapabilityNode,
    evidence: CapabilityEvidence,
  ): EnactmentPattern {
    if (progress.phase === "dfs" && progress.activePatternId) {
      const locked = capability.enactmentPatterns.find(
        (p) => p.id === progress.activePatternId,
      );
      if (locked) return locked;
    }
    // BFS: rotate away from the most recent rep, and prefer patterns the user
    // hasn't yet tried at this capability.
    const rotated = rotatePatternsAwayFromRecent(
      capability.enactmentPatterns,
      evidence.recentRepPatternIds,
    );
    const untried = rotated.filter(
      (p) => !progress.patternsTried.includes(p.id),
    );
    return untried[0] ?? rotated[0] ?? capability.enactmentPatterns[0]!;
  }

  /**
   * Count quests on this capability whose journals expressed a coverage or
   * readiness complaint. We look at the most recent N completed quests for
   * the capability and count how many carry an acceleration tag — the user
   * succeeding while explicitly saying "I want more" is the trigger.
   */
  private async countRecentJournalSignals(
    userId: string,
    capabilityId: string,
  ): Promise<number> {
    const rows: { reflection_tags: string[] | null }[] =
      await this.dataSource.query(
        `SELECT o.reflection_tags
         FROM sidequests s
         JOIN objectives o ON o.sidequest_id = s.id
         WHERE s.user_id = $1
           AND s.capability_id = $2
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
         ORDER BY s.completed_at DESC
         LIMIT $3`,
        [userId, capabilityId, ACCELERATION_MIN_SIGNALS + 2],
      );
    let count = 0;
    for (const row of rows) {
      const tags = row.reflection_tags ?? [];
      if (tags.some((t) => (ACCELERATION_TAGS as readonly string[]).includes(t))) {
        count += 1;
      }
    }
    return count;
  }

  private advanceFrom(program: GoalProgram, capabilityId: string): string {
    const next = nextCapability(program, capabilityId);
    return next.id;
  }

  private async ensureNextCapabilityRow(
    userId: string,
    program: GoalProgram,
    wonCapabilityId: string,
  ): Promise<void> {
    const next = nextCapability(program, wonCapabilityId);
    if (next.id === wonCapabilityId) return; // terminal — goal complete
    const repo = this.dataSource.getRepository(CapabilityProgress);
    const existing = await repo.findOne({
      where: { userId, capabilityId: next.id },
    });
    if (existing) return;
    await repo.save(
      repo.create({
        userId,
        programId: program.id,
        capabilityId: next.id,
        phase: "bfs" as CapabilityPhase,
        activePatternId: null,
        patternsTried: [],
        patternStats: {},
        repsAtCurrentPattern: 0,
        avgResonance: 0,
      }),
    );
  }
}
