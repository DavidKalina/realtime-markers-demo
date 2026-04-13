/**
 * WeekPackService — weekly pack orchestration extracted from SidequestPrescriptionService.
 *
 * Determines pack composition (slot roles) from pathway context and
 * generates quests sequentially to avoid intra-pack duplicates.
 */

import type { DataSource } from "typeorm";
import type { Sidequest } from "@realtime-markers/database";
import type { PathwayService, PhaseContext } from "../PathwayService";
import type { Pathway } from "@realtime-markers/database";
import type {
  PrescribeQuestInput,
  SiblingContext,
  SidequestProgressCallback,
  WeekPackResult,
} from "../SidequestPrescriptionService";
import type { FearLadderReadiness } from "./PrescriptionContextBuilder";

// ─── Types ─────────────────────────────────────────────────────────

export interface PackSlot {
  role: "deepen" | "explore" | "discover" | "stretch" | "enjoy";
  difficultyTier?: "easy" | "medium" | "stretch";
  targetPathway?: { id: string; theme: string; label: string; phase: string };
  questType?: "venue" | "challenge";
  challengeCategory?: string;
}

/** Callback that generates a single quest — provided by the main service. */
export type PrescribeQuestFn = (
  userId: string,
  input: PrescribeQuestInput,
  onProgress: SidequestProgressCallback | undefined,
  siblingContext: SiblingContext,
) => Promise<Sidequest>;

// ─── Public Functions ──────────────────────────────────────────────

export async function prescribeWeekPack(
  userId: string,
  input: PrescribeQuestInput,
  onProgress: SidequestProgressCallback | undefined,
  deps: {
    dataSource: DataSource;
    pathwayService?: PathwayService;
    prescribeQuest: PrescribeQuestFn;
  },
): Promise<WeekPackResult> {
  const batchId = crypto.randomUUID();

  // Determine pack composition from pathway phase context
  const slots = await determinePackSlots(deps.dataSource, deps.pathwayService, userId);

  if (onProgress) {
    await onProgress(5, `Crafting ${slots.length} quests...`);
  }

  // Generate quests sequentially so each one knows what's already been
  // prescribed. This prevents duplicate venues/categories within a pack.
  const quests: Sidequest[] = [];
  const previousSiblings: SiblingContext["previousSiblings"] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const siblingContext: SiblingContext = {
      batchId,
      batchIndex: i,
      totalInBatch: slots.length,
      questRole: slot.role,
      difficultyTier: slot.difficultyTier,
      targetPathway: slot.targetPathway,
      previousSiblings: [...previousSiblings],
    };

    const questInput = slot.questType
      ? { ...input, questType: slot.questType, challengeCategory: slot.challengeCategory }
      : input;

    try {
      const quest = await deps.prescribeQuest(userId, questInput, undefined, siblingContext);
      quests.push(quest);

      // Feed this quest's info to subsequent siblings for dedup
      const primaryItem = quest.objectives?.[0];
      previousSiblings.push({
        title: quest.title ?? "Untitled",
        venueName: primaryItem?.venueName ?? "Unknown",
        venueCategory: primaryItem?.venueCategory ?? "Unknown",
      });
    } catch (err) {
      console.error(
        `[SidequestPrescription] Quest ${i + 1} (${slot.role}) failed:`,
        err,
      );
    }
  }

  if (quests.length === 0) {
    throw new Error("All quests in week pack failed to generate");
  }

  if (onProgress) {
    await onProgress(100, "Your quests are ready!");
  }

  console.log(
    `[SidequestPrescription] Prescribed week pack ${batchId} for user ${userId}: ` +
    `${quests.length}/${slots.length} quests [${slots.map((s) => s.role).join(", ")}]`,
  );

  return { batchId, quests };
}

/**
 * Determine a quest role for individual (non-pack) prescriptions.
 *
 * Role distribution (deterministic cycle after enough data):
 *   - <5 quests: always "explore" (still onboarding)
 *   - 5+ quests: rotating pattern — explore, explore, enjoy, explore, stretch
 *   - Enjoy quests are "cheat meals" — pure fun based on interests, decoupled from pathways
 *   - Stretch quests push beyond comfort zone on multiple dimensions
 */
export function determineIndividualQuestRole(
  readiness: FearLadderReadiness,
): { role: "explore" | "enjoy" | "stretch"; targetPathway?: { id: string; theme: string; label: string; phase: string } } {
  // Early phase — always explore
  if (readiness.completedQuests < 5) {
    return { role: "explore" };
  }

  // Deterministic role rotation based on completed quest count.
  // Pattern: explore, explore, enjoy, explore, stretch (repeats)
  const cycle = readiness.completedQuests % 5;
  if (cycle === 2 && readiness.completedQuests >= 8) {
    // Every 5th quest (offset 2) is enjoy — a cheat meal, no pathway target needed
    return { role: "enjoy" };
  } else if (cycle === 4) {
    // Every 5th quest (offset 4) is stretch — push them
    return { role: "stretch" };
  }

  return { role: "explore" };
}

// ─── Private Helpers ───────────────────────────────────────────────

async function countCompletedQuests(dataSource: DataSource, userId: string): Promise<number> {
  const result = await dataSource.query(
    `SELECT COUNT(*)::int as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
    [userId],
  );
  return result[0]?.count ?? 0;
}

async function determinePackSlots(
  dataSource: DataSource,
  pathwayService: PathwayService | undefined,
  userId: string,
): Promise<PackSlot[]> {
  const completedCount = await countCompletedQuests(dataSource, userId);

  // Onboarding: 5 quests spanning different dimensions so something clicks
  if (completedCount === 0) {
    return [
      { role: "discover", difficultyTier: "easy" },
      { role: "discover", difficultyTier: "medium" },
      { role: "enjoy" },
      { role: "discover", questType: "challenge", challengeCategory: "social_reach" },
      { role: "stretch", difficultyTier: "stretch" },
    ];
  }

  if (!pathwayService) {
    return [{ role: "discover" }, { role: "discover" }, { role: "stretch" }];
  }

  let phaseContext: PhaseContext;
  let pathways: Pathway[];
  try {
    [phaseContext, pathways] = await Promise.all([
      pathwayService.getUserPhaseContext(userId),
      pathwayService.getPathways(userId),
    ]);
  } catch {
    return [{ role: "discover" }, { role: "discover" }, { role: "stretch" }];
  }

  const dfsPathways = pathways
    .filter((p) => p.phase === "dfs")
    .sort((a, b) => Number(b.avgResonance) - Number(a.avgResonance));

  const topDfs = dfsPathways[0];

  // Enjoy quests are "cheat meals" — decoupled from pathways entirely.
  // They use the user's onboarding interests, not DFS pathway categories.
  // Include one after 8+ quests so they've earned the reward.
  const shouldIncludeEnjoy = completedCount >= 8;

  switch (phaseContext.globalPhase) {
    case "bfs":
      // During BFS, include an enjoy quest if they've earned it
      if (shouldIncludeEnjoy) {
        return [{ role: "explore" }, { role: "enjoy" }, { role: "stretch" }];
      }
      return [{ role: "explore" }, { role: "explore" }, { role: "stretch" }];

    case "mixed":
    case "dfs": {
      const topDfsInfo = topDfs
        ? { id: topDfs.id, theme: topDfs.theme, label: topDfs.themeLabel ?? topDfs.theme, phase: topDfs.phase }
        : undefined;

      if (shouldIncludeEnjoy) {
        return [
          { role: "deepen", targetPathway: topDfsInfo },
          { role: "enjoy" },
          { role: "stretch" },
        ];
      }

      return [
        { role: "deepen", targetPathway: topDfsInfo },
        { role: "explore" },
        { role: "stretch" },
      ];
    }

    default:
      return [{ role: "discover" }, { role: "discover" }, { role: "stretch" }];
  }
}
