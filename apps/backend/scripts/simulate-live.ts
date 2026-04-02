/**
 * Live simulation runner — creates real quests via the backend API.
 *
 * This script:
 * 1. Logs in as a seeded user and applies a persona profile
 * 2. Calls the prescribe endpoint (real LLM + Google Places + Overpass)
 * 3. Polls for job completion
 * 4. Simulates checkin, journal, social context, and rating via API
 * 5. Lets resonance + pathway detection fire naturally
 * 6. Prints the real quests prescribed and the evolving phase context
 *
 * Usage:
 *   npx tsx apps/backend/scripts/simulate-live.ts
 *   npx tsx apps/backend/scripts/simulate-live.ts --quests 10
 *   npx tsx apps/backend/scripts/simulate-live.ts --persona adventurous-alex --quests 5
 *   npx tsx apps/backend/scripts/simulate-live.ts --dry-run
 *
 * NOTE: Each quest costs ~$0.02-0.05 (GPT-5.4-nano + Google Places).
 */

import { computeResonance, type ResonanceInput, type ResonanceResult } from "../services/ResonanceService";
import { DEFAULT_QUEST_CONFIG } from "../services/shared/QuestConfig";

// ── Journey tracking ─────────────────────────────────────────

interface JourneyEntry {
  index: number;
  title: string;
  venueName: string;
  venueCategory: string;
  difficulty: number;
  rating: number;
  resonance: number;
  resonanceComponents: ResonanceResult["components"];
  socialContext: string;
  journalSnippet: string | null;
  hook: string;
  rarity: string;
  distanceFromHome: number;
  comfortRadius: number;
}

// ── Persona definitions ──────────────────────────────────────

interface LivePersona {
  name: string;
  pace: "gentle" | "steady" | "push_me";
  goals: string[];
  goalTags: string[];
  barriers: string;
  comfortZone: string;
  activities: string[];
  vibes: string[];
  homeLatitude: number;
  homeLongitude: number;
  ratingBias: number;
  journalProbability: number;
  socialEscalationRate: number;
}

const PERSONAS: Record<string, LivePersona> = {
  "shy-sarah": {
    name: "Shy Sarah",
    pace: "gentle",
    goals: ["I want to meet people and feel less isolated"],
    goalTags: ["Meet people", "Decompress"],
    barriers: "Social anxiety, get overwhelmed in crowds, prefer quiet spaces",
    comfortZone: "Usually just go to work and come home. Sometimes walk around the block.",
    activities: ["Coffee", "Reading", "Nature", "Wellness"],
    vibes: ["Meet people", "Decompress"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.55,
    journalProbability: 0.7,
    socialEscalationRate: 0.12,
  },
  "adventurous-alex": {
    name: "Adventurous Alex",
    pace: "push_me",
    goals: ["I want to find my community and try everything this city has"],
    goalTags: ["Explore my area", "Get active", "Pick up a new skill"],
    barriers: "Get bored easily, need novelty to stay engaged",
    comfortZone: "I go to the gym and a couple bars but stick to the same neighborhood.",
    activities: ["Hiking", "Fitness", "Music", "Food", "Art", "Drinks"],
    vibes: ["Explore my area", "Get active", "Pick up a new skill"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.72,
    journalProbability: 0.35,
    socialEscalationRate: 0.35,
  },
  "routine-rick": {
    name: "Routine Rick",
    pace: "steady",
    goals: ["I want to break out of my routine and build new habits"],
    goalTags: ["Build a routine", "Get active", "Meet people"],
    barriers: "Creature of habit, hard to break patterns, winter makes it worse",
    comfortZone: "Work, home, same grocery store, same takeout places.",
    activities: ["Coffee", "Food", "Nature", "Fitness", "Photography"],
    vibes: ["Build a routine", "Get active", "Meet people"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.6,
    journalProbability: 0.5,
    socialEscalationRate: 0.2,
  },
};

// ── Social ladder + journal templates ────────────────────────

const SOCIAL_LADDER = ["solo", "with_someone", "met_someone_new", "group_activity"];

const EMOTION_JOURNALS = [
  "I felt really comfortable here. The vibe was exactly what I needed today. I noticed I wasn't anxious at all.",
  "I was nervous at first but I ended up having a great time. I talked to someone at the counter and they were really friendly.",
  "I loved this place. I realized I've been avoiding spots like this for no good reason. I felt alive.",
  "I tried something totally new and I was surprised by how much I enjoyed it. I want to come back.",
  "I met someone who recommended another spot nearby. I felt energized and connected for the first time in a while.",
  "I went with a friend and we had a blast. I felt grateful to have someone to share this with.",
  "I was anxious walking in but I pushed through. I'm proud of myself for showing up.",
  "This was exactly the kind of push I needed. I felt inspired and curious about what else is out there.",
];

const NEUTRAL_JOURNALS = [
  "Nice spot. Pretty chill.",
  "It was fine, nothing special but I'm glad I went.",
  "Decent experience. Might come back.",
];

// ── Seeded PRNG ──────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── HTTP helpers ─────────────────────────────────────────────

const BASE_URL = process.env.API_URL || "http://localhost:3000";

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Login failed (${res.status}): ${err}`);
  }

  const data = await res.json() as any;
  return data.token || data.accessToken;
}

async function pollJobCompletion(
  jobId: string,
  token: string,
  timeoutMs = 120000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await api("GET", `/api/jobs/${jobId}/progress`, token);
    if (data?.status === "completed") return data;
    if (data?.status === "failed") throw new Error(`Job failed: ${data.error || "unknown"}`);

    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    const progress = data?.progress ?? 0;
    const step = data?.progressStep ?? "working...";
    process.stdout.write(`\r│  [${progress}%] ${step} (${elapsed}s)`);

    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Job timed out");
}

// ── CLI arg parsing ──────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let email = "user@example.com";
  let password = "user123";
  let personaKey = "shy-sarah";
  let questCount = 5;
  let seed = 42;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--email": email = args[++i]; break;
      case "--password": password = args[++i]; break;
      case "--persona": personaKey = args[++i]; break;
      case "--quests": questCount = parseInt(args[++i], 10); break;
      case "--seed": seed = parseInt(args[++i], 10); break;
      case "--dry-run": dryRun = true; break;
      case "--help":
        console.log(`
Live Sidequest Simulator — Real LLM prescriptions via backend API

Usage: npx tsx apps/backend/scripts/simulate-live.ts [options]

Options:
  --email <email>     User email (default: user@example.com)
  --password <pass>   User password (default: user123)
  --persona <name>    Persona profile (shy-sarah, adventurous-alex, routine-rick)
  --quests <n>        Number of quests to prescribe (default: 5)
  --seed <n>          Random seed (default: 42)
  --dry-run           Set up user profile but don't prescribe quests

Estimated cost: ~$0.02-0.05 per quest (GPT-5.4-nano + Google Places)
`);
        process.exit(0);
    }
  }

  return { email, password, personaKey, questCount, seed, dryRun };
}

// ── Synthetic data generators ────────────────────────────────

function generateRating(bias: number, rand: () => number): number {
  const base = bias + (rand() - 0.5) * 0.4;
  const normalized = Math.max(0, Math.min(1, base));
  return Math.max(1, Math.min(5, Math.round(normalized * 4 + 1)));
}

function generateSocialContext(currentLevel: number, escalationRate: number, rand: () => number): string {
  if (rand() < escalationRate && currentLevel < SOCIAL_LADDER.length - 1) {
    return SOCIAL_LADDER[currentLevel + 1];
  }
  if (rand() < 0.2 && currentLevel > 0) {
    return SOCIAL_LADDER[currentLevel - 1];
  }
  return SOCIAL_LADDER[currentLevel];
}

function generateJournal(probability: number, rand: () => number): string | null {
  if (rand() > probability) return null;
  if (rand() < 0.6) {
    return EMOTION_JOURNALS[Math.floor(rand() * EMOTION_JOURNALS.length)];
  }
  return NEUTRAL_JOURNALS[Math.floor(rand() * NEUTRAL_JOURNALS.length)];
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const { email, password, personaKey, questCount, seed, dryRun } = parseArgs();

  const persona = PERSONAS[personaKey];
  if (!persona) {
    console.error(`Unknown persona: ${personaKey}`);
    console.error(`Available: ${Object.keys(PERSONAS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Live Sidequest Simulator                ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Persona:  ${persona.name}`);
  console.log(`  User:     ${email}`);
  console.log(`  Quests:   ${questCount}`);
  console.log(`  Est cost: $${(questCount * 0.035).toFixed(2)}`);
  console.log();

  // 1. Login
  console.log("Logging in...");
  const token = await login(email, password);
  console.log("  Authenticated.");

  // 2. Set home anchor
  console.log("Setting home anchor...");
  await api("POST", "/api/sidequests/home-anchor", token, {
    latitude: persona.homeLatitude,
    longitude: persona.homeLongitude,
  });

  // 3. Apply comfort profile
  console.log(`Applying "${persona.name}" profile...`);
  await api("PUT", "/api/sidequests/comfort-profile", token, {
    pacePreference: persona.pace,
    comfortProfile: {
      comfortZone: persona.comfortZone,
      barriers: persona.barriers,
      goals: persona.goals[0],
      goalTags: persona.goalTags,
    },
  });

  console.log(`  Home: (${persona.homeLatitude}, ${persona.homeLongitude})`);
  console.log(`  Pace: ${persona.pace}`);
  console.log(`  Goals: ${persona.goalTags.join(", ")}`);

  if (dryRun) {
    console.log("\n--dry-run: Profile applied. Exiting.");
    return;
  }

  // 4. Run simulation loop
  const rand = mulberry32(seed);
  let currentSocialLevel = 0;
  const previousSocialContexts: string[] = [];
  const journey: JourneyEntry[] = [];

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Starting ${questCount}-quest simulation...`);
  console.log(`${"─".repeat(60)}\n`);

  for (let i = 0; i < questCount; i++) {
    console.log(`\n╭─ Quest ${i + 1}/${questCount} ${"─".repeat(40)}`);

    // 4a. Prescribe
    console.log("│  Prescribing quest...");
    const prescribeRes = await api("POST", "/api/sidequests/prescribe", token, {
      latitude: persona.homeLatitude,
      longitude: persona.homeLongitude,
    });

    if (prescribeRes.status !== 202) {
      console.error(`│  Prescription failed (${prescribeRes.status}): ${JSON.stringify(prescribeRes.data)}`);
      continue;
    }

    const { jobId } = prescribeRes.data;

    // 4b. Poll for completion
    let jobResult: any;
    try {
      jobResult = await pollJobCompletion(jobId, token);
      console.log(); // newline after progress
    } catch (err: any) {
      console.error(`\n│  ${err.message}`);
      continue;
    }

    const sidequestId = jobResult?.result?.sidequestId;
    if (!sidequestId) {
      console.error("│  No sidequest ID in job result");
      continue;
    }

    // 4c. Fetch the quest details
    const questRes = await api("GET", `/api/sidequests/${sidequestId}`, token);
    const quest = questRes.data;

    if (!quest || !quest.objectives?.length) {
      console.error("│  Quest has no objectives");
      continue;
    }

    const obj = quest.objectives[0];
    console.log(`│`);
    console.log(`│  "${quest.title}"`);
    console.log(`│     ${obj.venueName} — ${obj.venueCategory}`);
    console.log(`│     ${obj.venueAddress ?? "no address"}`);
    console.log(`│     Hook: ${obj.hook ?? "none"}`);
    console.log(`│     Difficulty: ${obj.difficulty ?? "?"} | Rarity: ${quest.rarity ?? "?"}`);
    console.log(`│     Distance: ${quest.distanceFromHome ? Number(quest.distanceFromHome).toFixed(2) + " mi" : "?"}`);

    // 4d. Activate
    await api("POST", `/api/sidequests/${sidequestId}/activate`, token);

    // 4e. Checkin
    console.log(`│`);
    console.log(`│  Checking in...`);
    await api("POST", `/api/sidequests/${sidequestId}/objectives/${obj.id}/checkin`, token, {
      latitude: Number(obj.latitude),
      longitude: Number(obj.longitude),
    });

    // 4f. Generate synthetic completion data
    const socialContext = generateSocialContext(currentSocialLevel, persona.socialEscalationRate, rand);
    const journalEntry = generateJournal(persona.journalProbability, rand);
    const rating = generateRating(persona.ratingBias, rand);

    if (socialContext) {
      const idx = SOCIAL_LADDER.indexOf(socialContext);
      if (idx > currentSocialLevel) currentSocialLevel = idx;
    }

    // 4g. Save journal + social context
    await api("PUT", `/api/sidequests/objectives/${obj.id}/journal`, token, {
      journalEntry: journalEntry ?? undefined,
      socialContext,
      completedActivity: `Visited ${obj.venueName}`,
    });

    // 4h. Rate (triggers resonance + pathway detection)
    await api("POST", `/api/sidequests/${sidequestId}/rate`, token, { rating });

    // 4i. Compute resonance locally
    const resonanceInput: ResonanceInput = {
      rating,
      journalEntry,
      socialContext,
      completedActivity: `Visited ${obj.venueName}`,
      difficulty: obj.difficulty ?? null,
      checkedInAt: new Date(),
      questCreatedAt: new Date(quest.createdAt),
      venueCategory: obj.venueCategory ?? null,
      distanceFromHome: quest.distanceFromHome ? Number(quest.distanceFromHome) : null,
      userPace: persona.pace,
      previousSocialContexts: [...previousSocialContexts],
    };
    const resonance = computeResonance(resonanceInput, DEFAULT_QUEST_CONFIG);

    if (socialContext) previousSocialContexts.push(socialContext);

    // 4j. Fetch comfort zone
    const czRes = await api("GET", "/api/sidequests/comfort-zone", token);
    const comfortRadius = czRes.data?.comfortRadiusMiles ?? 0;

    console.log(`│  Rating: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}`);
    console.log(`│  Social: ${socialContext}`);
    console.log(`│  Journal: ${journalEntry ? `"${journalEntry.slice(0, 60)}..."` : "(none)"}`);
    console.log(`│  Resonance: ${resonance.score.toFixed(3)} (rate=${resonance.components.ratingSignal.toFixed(2)} journal=${resonance.components.journalDepth.toFixed(2)} social=${resonance.components.socialEscalation.toFixed(2)} speed=${resonance.components.speedSignal.toFixed(2)} diff=${resonance.components.difficultyAlignment.toFixed(2)})`);
    console.log(`│  Comfort radius: ${comfortRadius.toFixed?.(1) ?? "?"} mi`);

    // Track journey
    journey.push({
      index: i,
      title: quest.title ?? "",
      venueName: obj.venueName ?? "",
      venueCategory: obj.venueCategory ?? "other",
      difficulty: obj.difficulty ?? 0,
      rating,
      resonance: resonance.score,
      resonanceComponents: resonance.components,
      socialContext,
      journalSnippet: journalEntry ? journalEntry.slice(0, 40) : null,
      hook: obj.hook ?? "",
      rarity: quest.rarity ?? "?",
      distanceFromHome: quest.distanceFromHome ? Number(quest.distanceFromHome) : 0,
      comfortRadius: typeof comfortRadius === "number" ? comfortRadius : 0,
    });

    console.log(`╰${"─".repeat(55)}`);

    // Small delay between quests
    if (i < questCount - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 5. Final summary
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  SIMULATION COMPLETE — ${persona.name}`);
  console.log(`${"═".repeat(80)}`);

  // Stats
  const allScores = journey.map((j) => j.resonance);
  const avgResonance = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const peakResonance = allScores.length > 0 ? Math.max(...allScores) : 0;

  console.log(`\n  Quests: ${journey.length}`);
  console.log(`  Avg Resonance: ${avgResonance.toFixed(3)}`);
  console.log(`  Peak Resonance: ${peakResonance.toFixed(3)}`);
  console.log(`  Comfort Radius: ${journey[0]?.comfortRadius.toFixed(1) ?? "?"} mi → ${journey[journey.length - 1]?.comfortRadius.toFixed(1) ?? "?"} mi`);

  // Category breakdown
  const catCounts: Record<string, number> = {};
  for (const j of journey) {
    catCounts[j.venueCategory] = (catCounts[j.venueCategory] ?? 0) + 1;
  }
  console.log(`\n  Category Distribution:`);
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const bar = "█".repeat(count);
    console.log(`    ${cat.padEnd(14)} ${bar} ${count}`);
  }

  // Journey timeline
  console.log(`\n  Journey Timeline:`);
  console.log(`  ${"#".padEnd(4)} ${"Category".padEnd(14)} ${"Venue".padEnd(28)} ${"Diff".padEnd(5)} ${"Rate".padEnd(5)} ${"Resonance".padEnd(10)} ${"Social".padEnd(18)} ${"Rarity".padEnd(12)} Hook`);
  console.log(`  ${"─".repeat(140)}`);
  for (const j of journey) {
    const resonanceBar = "▓".repeat(Math.round(j.resonance * 10)).padEnd(10);
    const venue = j.venueName.length > 26 ? j.venueName.slice(0, 25) + "…" : j.venueName;
    const hook = j.hook.length > 60 ? j.hook.slice(0, 59) + "…" : j.hook;
    console.log(
      `  ${String(j.index).padEnd(4)} ${j.venueCategory.padEnd(14)} ${venue.padEnd(28)} ${String(j.difficulty).padEnd(5)} ${String(j.rating).padEnd(5)} ${resonanceBar} ${j.socialContext.padEnd(18)} ${j.rarity.padEnd(12)} ${hook}`,
    );
  }

  // Resonance component breakdown
  console.log(`\n  Resonance Components (avg across all quests):`);
  const avgComponents = {
    ratingSignal: journey.reduce((s, j) => s + j.resonanceComponents.ratingSignal, 0) / journey.length,
    journalDepth: journey.reduce((s, j) => s + j.resonanceComponents.journalDepth, 0) / journey.length,
    socialEscalation: journey.reduce((s, j) => s + j.resonanceComponents.socialEscalation, 0) / journey.length,
    speedSignal: journey.reduce((s, j) => s + j.resonanceComponents.speedSignal, 0) / journey.length,
    difficultyAlignment: journey.reduce((s, j) => s + j.resonanceComponents.difficultyAlignment, 0) / journey.length,
  };
  console.log(`    Rating Signal:        ${avgComponents.ratingSignal.toFixed(3)}  (weight: 35%)`);
  console.log(`    Journal Depth:        ${avgComponents.journalDepth.toFixed(3)}  (weight: 25%)`);
  console.log(`    Social Escalation:    ${avgComponents.socialEscalation.toFixed(3)}  (weight: 15%)`);
  console.log(`    Speed to Completion:  ${avgComponents.speedSignal.toFixed(3)}  (weight: 15%)`);
  console.log(`    Difficulty Alignment: ${avgComponents.difficultyAlignment.toFixed(3)}  (weight: 10%)`);

  // Deck stats
  const statsRes = await api("GET", "/api/sidequests/deck-stats", token);
  if (statsRes.data) {
    const s = statsRes.data;
    console.log(`\n  Deck Stats:`);
    console.log(`    Cards played: ${s.cardsPlayed}`);
    console.log(`    Cards in deck: ${s.cardsInDeck}`);
    console.log(`    New this week: ${s.newThisWeek}`);
  }

  // World size
  const worldRes = await api("GET", "/api/sidequests/world-size", token);
  if (worldRes.data) {
    console.log(`\n  World Size: ${worldRes.data.worldSizeSqMiles?.toFixed(2) ?? "?"} sq mi`);
    console.log(`  Furthest from home: ${worldRes.data.furthestFromHomeMiles?.toFixed(2) ?? "?"} mi`);
  }

  console.log(`\n  Done.`);
}

main().catch((err) => {
  console.error("\nSimulation failed:", err.message);
  process.exit(1);
});
