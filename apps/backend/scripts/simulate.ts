/**
 * CLI simulation runner for testing BFS→DFS journey formation.
 *
 * Usage:
 *   npx tsx apps/backend/scripts/simulate.ts
 *   npx tsx apps/backend/scripts/simulate.ts --quests 30
 *   npx tsx apps/backend/scripts/simulate.ts --persona "shy-sarah"
 *   npx tsx apps/backend/scripts/simulate.ts --dfs-threshold 0.6 --min-quests-dfs 2
 */

import { SimulationService, type SimulationPersona, type SimulationResult } from "../services/SimulationService";
import { DEFAULT_QUEST_CONFIG, type QuestConfig } from "../services/shared/QuestConfig";

// ── Built-in personas ────────────────────────────────────────

const PERSONAS: Record<string, SimulationPersona> = {
  "shy-sarah": {
    name: "Shy Sarah",
    pace: "gentle",
    goals: ["socialize", "unwind"],
    barriers: "Social anxiety, gets overwhelmed in crowds, prefers quiet spaces",
    categoryWeights: { cafe: 0.35, park: 0.25, trail: 0.2, restaurant: 0.1, museum: 0.1 },
    ratingBias: 0.55,
    journalProbability: 0.7,
    journalEmotionProbability: 0.6,
    socialEscalationRate: 0.12,
    difficultyTolerance: 2,
    completionSpeedHours: 72,
    homeLatitude: 40.7128,
    homeLongitude: -74.006,
  },

  "adventurous-alex": {
    name: "Adventurous Alex",
    pace: "push_me",
    goals: ["fitness", "new_skill", "explore"],
    barriers: "Boredom, needs novelty to stay motivated",
    categoryWeights: { trail: 0.25, venue: 0.2, bar: 0.15, museum: 0.15, cafe: 0.1, market: 0.1, gallery: 0.05 },
    ratingBias: 0.72,
    journalProbability: 0.35,
    journalEmotionProbability: 0.4,
    socialEscalationRate: 0.35,
    difficultyTolerance: 5,
    completionSpeedHours: 8,
    homeLatitude: 40.7128,
    homeLongitude: -74.006,
  },

  "routine-rick": {
    name: "Routine Rick",
    pace: "steady",
    goals: ["routine", "fitness", "socialize"],
    barriers: "Creature of habit, hard to break patterns, winter makes it worse",
    categoryWeights: { cafe: 0.3, restaurant: 0.25, park: 0.2, trail: 0.15, bar: 0.1 },
    ratingBias: 0.6,
    journalProbability: 0.5,
    journalEmotionProbability: 0.5,
    socialEscalationRate: 0.2,
    difficultyTolerance: 3,
    completionSpeedHours: 36,
    homeLatitude: 40.7128,
    homeLongitude: -74.006,
  },

  "burned-out-ben": {
    name: "Burned-Out Ben",
    pace: "gentle",
    goals: ["unwind", "routine"],
    barriers: "Depression, exhaustion, everything feels like a chore, doesn't see the point",
    categoryWeights: { cafe: 0.4, park: 0.25, restaurant: 0.15, trail: 0.1, bar: 0.1 },
    ratingBias: 0.35,       // rates things low — nothing feels great
    journalProbability: 0.6, // writes often but without much feeling
    journalEmotionProbability: 0.2, // rarely writes emotionally
    socialEscalationRate: 0.05,     // almost never escalates socially
    difficultyTolerance: 1,         // very low tolerance — everything feels hard
    completionSpeedHours: 120,      // takes forever to actually go
    homeLatitude: 40.7128,
    homeLongitude: -74.006,
  },

  "breakthrough-bria": {
    name: "Breakthrough Bria",
    pace: "steady",
    goals: ["socialize", "new_skill", "explore"],
    barriers: "Social anxiety but actively working on it, therapist recommended getting out more",
    categoryWeights: { cafe: 0.2, museum: 0.2, market: 0.2, venue: 0.15, park: 0.15, bar: 0.1 },
    ratingBias: 0.5,          // mixed ratings — some things land, some don't
    journalProbability: 0.85, // journals almost everything — very reflective
    journalEmotionProbability: 0.75, // high emotional processing
    socialEscalationRate: 0.25,      // actively pushing social boundaries
    difficultyTolerance: 2,          // low comfort but pushes anyway
    completionSpeedHours: 24,        // goes fairly quickly once committed
    homeLatitude: 40.7128,
    homeLongitude: -74.006,
  },
};

// ── CLI arg parsing ──────────────────────────────────────────

function parseArgs(): { personaKey: string | null; questCount: number; seed: number; simulateReflection: boolean; configOverrides: Partial<QuestConfig> } {
  const args = process.argv.slice(2);
  let personaKey: string | null = null;
  let questCount = 20;
  let seed = 42;
  let simulateReflection = false;
  const configOverrides: Partial<QuestConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--persona":
        personaKey = args[++i];
        break;
      case "--quests":
        questCount = parseInt(args[++i], 10);
        break;
      case "--seed":
        seed = parseInt(args[++i], 10);
        break;
      case "--dfs-threshold":
        configOverrides.phaseDetection = {
          ...DEFAULT_QUEST_CONFIG.phaseDetection,
          ...configOverrides.phaseDetection,
          resonanceThresholdForDFS: parseFloat(args[++i]),
        };
        break;
      case "--min-quests-dfs":
        configOverrides.phaseDetection = {
          ...DEFAULT_QUEST_CONFIG.phaseDetection,
          ...configOverrides.phaseDetection,
          minQuestsInCategoryForDFS: parseInt(args[++i], 10),
        };
        break;
      case "--pace-multiplier": {
        const pace = args[++i];
        const mult = parseFloat(args[++i]);
        configOverrides.comfortZone = {
          ...DEFAULT_QUEST_CONFIG.comfortZone,
          ...configOverrides.comfortZone,
          paceMultipliers: {
            ...DEFAULT_QUEST_CONFIG.comfortZone.paceMultipliers,
            ...configOverrides.comfortZone?.paceMultipliers,
            [pace]: mult,
          },
        };
        break;
      }
      case "--simulate-reflection":
        simulateReflection = true;
        break;
      case "--help":
        console.log(`
Sidequest Journey Simulator

Usage: npx tsx apps/backend/scripts/simulate.ts [options]

Options:
  --persona <name>          Persona to simulate (shy-sarah, adventurous-alex, routine-rick)
                            Default: runs all personas
  --quests <n>              Number of quests to simulate (default: 20)
  --seed <n>                Random seed for reproducibility (default: 42)
  --simulate-reflection     Simulate LLM reflection analysis (depth, sentiment, tags)
  --dfs-threshold <0-1>     Resonance threshold to trigger DFS (default: 0.7)
  --min-quests-dfs <n>      Min quests in category before DFS (default: 3)
  --pace-multiplier <pace> <n>  Override pace multiplier (e.g., --pace-multiplier gentle 0.3)
`);
        process.exit(0);
    }
  }

  return { personaKey, questCount, seed, simulateReflection, configOverrides };
}

// ── Output formatting ────────────────────────────────────────

function printResult(result: SimulationResult, simulateReflection = false): void {
  const { persona, stats, phaseTransitions, pathways, quests } = result;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${persona}`);
  console.log(`${"=".repeat(60)}`);

  // Summary stats
  console.log(`\n  Quests: ${quests.length}`);
  console.log(`  Avg Resonance: ${stats.avgResonance.toFixed(3)}`);
  console.log(`  Peak Resonance: ${stats.peakResonance.toFixed(3)}`);
  console.log(`  Pathways: ${stats.totalPathways} (${stats.dfsPathways} in DFS)`);
  console.log(`  Quests before first DFS: ${stats.questsBeforeFirstDFS ?? "never"}`);

  // Category distribution
  console.log(`\n  Category Distribution:`);
  const sortedCats = Object.entries(stats.categoryDistribution).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const bar = "\u2588".repeat(count);
    console.log(`    ${cat.padEnd(14)} ${bar} ${count}`);
  }

  // Pathways
  if (pathways.length > 0) {
    console.log(`\n  Pathways:`);
    for (const p of pathways) {
      const phase = p.phase === "dfs" ? "\x1b[32mDFS\x1b[0m" : "\x1b[33mBFS\x1b[0m";
      console.log(
        `    ${phase} "${p.themeLabel}" — ${p.questCount} quests, ` +
        `resonance ${p.avgResonance.toFixed(3)}, difficulty ${p.currentDifficulty}`,
      );
    }
  }

  // Phase transitions
  if (phaseTransitions.length > 0) {
    console.log(`\n  Phase Transitions:`);
    for (const t of phaseTransitions) {
      console.log(
        `    Quest #${t.questIndex}: "${t.themeLabel}" ${t.from} \u2192 ${t.to}`,
      );
    }
  }

  // Journey timeline
  console.log(`\n  Journey Timeline:`);
  console.log(`  ${"#".padEnd(4)} ${"Category".padEnd(14)} ${"Diff".padEnd(5)} ${"Rate".padEnd(5)} ${"Resonance".padEnd(10)} ${"Social".padEnd(18)} Phase`);
  console.log(`  ${"-".repeat(75)}`);
  for (const q of quests) {
    const resonanceBar = "\u2593".repeat(Math.round(q.resonance.score * 10)).padEnd(10);
    console.log(
      `  ${String(q.index).padEnd(4)} ${q.venueCategory.padEnd(14)} ${String(q.difficulty).padEnd(5)} ${String(q.rating).padEnd(5)} ${resonanceBar} ${q.socialContext.padEnd(18)} ${q.phase}`,
    );
  }

  // Resonance component averages
  const avgComps = {
    rating: result.quests.reduce((s, q) => s + q.resonance.components.ratingSignal, 0) / result.quests.length,
    journal: result.quests.reduce((s, q) => s + q.resonance.components.journalDepth, 0) / result.quests.length,
    sentiment: result.quests.reduce((s, q) => s + q.resonance.components.sentimentSignal, 0) / result.quests.length,
    social: result.quests.reduce((s, q) => s + q.resonance.components.socialEscalation, 0) / result.quests.length,
    speed: result.quests.reduce((s, q) => s + q.resonance.components.speedSignal, 0) / result.quests.length,
    difficulty: result.quests.reduce((s, q) => s + q.resonance.components.difficultyAlignment, 0) / result.quests.length,
  };
  console.log(`\n  Resonance Components (avg):`);
  console.log(`    Rating:     ${avgComps.rating.toFixed(3)}`);
  console.log(`    Journal:    ${avgComps.journal.toFixed(3)}`);
  console.log(`    Sentiment:  ${avgComps.sentiment.toFixed(3)}${!simulateReflection ? " (neutral — no LLM in synthetic mode)" : ""}`);
  console.log(`    Social:     ${avgComps.social.toFixed(3)}`);
  console.log(`    Speed:      ${avgComps.speed.toFixed(3)}`);
  console.log(`    Difficulty:  ${avgComps.difficulty.toFixed(3)}`);

  // Final phase context (what the LLM would see)
  console.log(`\n  LLM Phase Context:`);
  console.log(`  ${"-".repeat(50)}`);
  for (const line of result.finalPhaseContext.recommendation.split("\n")) {
    console.log(`  ${line}`);
  }
}

// ── Main ─────────────────────────────────────────────────────

function main(): void {
  const { personaKey, questCount, seed, simulateReflection, configOverrides } = parseArgs();

  const sim = new SimulationService({});
  const personasToRun = personaKey
    ? { [personaKey]: PERSONAS[personaKey] }
    : PERSONAS;

  if (personaKey && !PERSONAS[personaKey]) {
    console.error(`Unknown persona: ${personaKey}`);
    console.error(`Available: ${Object.keys(PERSONAS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nSidequest Journey Simulator`);
  console.log(`Config overrides: ${Object.keys(configOverrides).length > 0 ? JSON.stringify(configOverrides, null, 2) : "none"}`);
  console.log(`Quests per persona: ${questCount} | Seed: ${seed}${simulateReflection ? " | Reflection: ON" : ""}`);

  for (const [, persona] of Object.entries(personasToRun)) {
    const result = sim.runSimulation({
      config: configOverrides,
      persona,
      questCount,
      seed,
      simulateReflection,
    });
    printResult(result, simulateReflection);
  }
}

main();
