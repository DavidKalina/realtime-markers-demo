/**
 * Live simulation runner — creates real quests via the backend API.
 *
 * This script:
 * 1. Logs in as a seeded user and applies a persona profile
 * 2. Generates a personalized fear ladder via LLM
 * 3. Has the LLM rate the fear ladder scenarios in-character
 * 4. Calls the prescribe endpoint (real LLM + Google Places + Overpass)
 * 5. Simulates pre-quest predictions (anxiety, difficulty, expected outcome)
 * 6. Simulates checkin, journal, social context, and rating via API
 * 7. Lets resonance + pathway detection fire naturally
 * 8. Prints the real quests prescribed and the evolving phase context
 *
 * Usage:
 *   npx tsx apps/backend/scripts/simulate-live.ts
 *   npx tsx apps/backend/scripts/simulate-live.ts --quests 10
 *   npx tsx apps/backend/scripts/simulate-live.ts --persona comedian-carl --quests 5
 *   npx tsx apps/backend/scripts/simulate-live.ts --dry-run
 *
 * NOTE: Each quest costs ~$0.02-0.05 (GPT-5.4-nano + Google Places).
 */

import "dotenv/config";
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
  predictedAnxiety: number | null;
  predictedDifficulty: number | null;
  actionability: string | null;
}

// ── Persona definitions ──────────────────────────────────────

interface LivePersona {
  name: string;
  primaryGoal: string;
  northStar: string;
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
    primaryGoal: "Overcome social anxiety and feel comfortable going out alone",
    northStar: "I want to walk into a crowded room and feel like I belong there.",
    pace: "gentle",
    goals: ["I want to meet people and feel less isolated"],
    goalTags: ["socialize", "unwind"],
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
    primaryGoal: "Discover every hidden gem in my city and build a community",
    northStar: "I want to be the person everyone asks for recommendations.",
    pace: "push_me",
    goals: ["I want to find my community and try everything this city has"],
    goalTags: ["explore", "fitness", "new_skill"],
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
    primaryGoal: "Break out of my routine and build healthier habits",
    northStar: "I want to look forward to my weekends instead of dreading them.",
    pace: "steady",
    goals: ["I want to break out of my routine and build new habits"],
    goalTags: ["routine", "fitness", "socialize"],
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
  "comedian-carl": {
    name: "Comedian Carl",
    primaryGoal: "Become a stand-up comedian and perform at open mics regularly",
    northStar: "I want to do a 10-minute set that makes a room full of strangers laugh.",
    pace: "steady",
    goals: ["I want to build the confidence to perform comedy on stage"],
    goalTags: ["new_skill", "socialize"],
    barriers: "Fear of public speaking, don't know the comedy scene, afraid of bombing",
    comfortZone: "Watch comedy specials at home. Went to one show once but didn't talk to anyone.",
    activities: ["Theatre", "Karaoke", "Drinks", "Music", "Board games"],
    vibes: ["Pick up a new skill", "Meet people"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.58,
    journalProbability: 0.65,
    socialEscalationRate: 0.2,
  },
  "fitness-fiona": {
    name: "Fitness Fiona",
    primaryGoal: "Train for and complete a half marathon",
    northStar: "I want to cross a finish line and feel like I earned it.",
    pace: "push_me",
    goals: ["I want to get in shape and find a running community"],
    goalTags: ["fitness", "routine", "socialize"],
    barriers: "Never ran more than a mile, intimidated by running groups, hard to stay motivated alone",
    comfortZone: "I do yoga at home and walk my dog. That's about it for exercise.",
    activities: ["Hiking", "Fitness", "Nature", "Cycling", "Wellness"],
    vibes: ["Get active", "Build a routine", "Meet people"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.65,
    journalProbability: 0.55,
    socialEscalationRate: 0.25,
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
  let personaKey = "";
  let goal = "";
  let questCount = 5;
  let seed = 42;
  let dryRun = false;
  let skipProfile = false;
  let skipFearLadder = false;
  let model = "";
  let strategy = "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--email": email = args[++i]; break;
      case "--password": password = args[++i]; break;
      case "--persona": personaKey = args[++i]; break;
      case "--goal": goal = args[++i]; break;
      case "--quests": questCount = parseInt(args[++i], 10); break;
      case "--seed": seed = parseInt(args[++i], 10); break;
      case "--dry-run": dryRun = true; break;
      case "--skip-profile": skipProfile = true; break;
      case "--skip-fear-ladder": skipFearLadder = true; break;
      case "--model": model = args[++i]; break;
      case "--strategy": strategy = args[++i]; break;
      case "--help":
        console.log(`
Live Sidequest Simulator — Real LLM prescriptions via backend API

Usage: npx tsx apps/backend/scripts/simulate-live.ts [options]

Options:
  --email <email>        User email (default: user@example.com)
  --password <pass>      User password (default: user123)
  --persona <name>       Hardcoded persona (shy-sarah, adventurous-alex, routine-rick, comedian-carl, fitness-fiona)
  --goal <text>          Generate a persona from a goal (e.g. "become a stand-up comedian")
  --quests <n>           Number of quests to prescribe (default: 5)
  --seed <n>             Random seed (default: 42)
  --dry-run              Set up user profile but don't prescribe quests
  --skip-profile         Use existing user profile instead of applying persona
  --skip-fear-ladder     Skip fear ladder generation (use existing or none)
  --model <model>        Override prescription model (e.g. gpt-5.4-nano, gpt-5.4-mini, gpt-5.4)
  --strategy <name>      Prescription strategy: "monolithic" or "multi-agent"

Examples:
  npx tsx apps/backend/scripts/simulate-live.ts --goal "become a stand-up comedian" --quests 10
  npx tsx apps/backend/scripts/simulate-live.ts --goal "train for a half marathon" --quests 15
  npx tsx apps/backend/scripts/simulate-live.ts --persona shy-sarah --quests 5

Estimated cost: ~$0.02-0.05 per quest (GPT-5.4-nano + Google Places)
`);
        process.exit(0);
    }
  }

  return { email, password, personaKey, goal, questCount, seed, dryRun, skipProfile, skipFearLadder, model, strategy };
}

/**
 * Generate a full persona from just a goal string using the LLM.
 */
async function generatePersonaFromGoal(goal: string): Promise<LivePersona> {
  console.log(`Generating persona from goal: "${goal}"...`);

  const result = await llmJson(
    `You are creating a realistic persona for a goal-achievement app simulation. Given a goal, generate a complete user profile. The person should feel real — with specific barriers, a specific comfort zone, and a name that fits.

Respond with JSON matching this exact shape:
{
  "name": "Firstname Lastname",
  "primaryGoal": "<the goal, slightly expanded if needed>",
  "northStar": "<1 sentence — what success ultimately looks like to them>",
  "pace": "gentle" | "steady" | "push_me",
  "goals": ["<1 sentence describing what they want>"],
  "goalTags": ["<2-3 tags from: explore, socialize, discover_hobby, routine, fitness, new_skill, unwind>"],
  "barriers": "<comma-separated barriers they face>",
  "comfortZone": "<1-2 sentences describing their current routine/habits>",
  "activities": ["<5-8 activity names from: Coffee, Hiking, Art, Reading, Food, Music, Fitness, Nature, Skating, Photography, Wellness, Drinks, Theatre, Swimming, Dog walks, Gaming, Camping, Cycling, Karaoke, Climbing, Skiing, Spa, Brunch, Board games>"],
  "vibes": ["<2-3 vibe labels>"],
  "ratingBias": <0.4-0.8 float — lower means they'll rate quests lower on average>,
  "journalProbability": <0.3-0.8 float — how likely they are to journal>,
  "socialEscalationRate": <0.05-0.4 float — how quickly they escalate social context>
}

Guidelines:
- "gentle" pace: anxious, cautious, needs easing in
- "steady" pace: moderate, willing but not rushing
- "push_me" pace: eager, wants to be challenged
- ratingBias should correlate with confidence (anxious = lower ~0.5, confident = higher ~0.7)
- journalProbability should correlate with introspection
- socialEscalationRate should correlate with social comfort`,
    `Goal: "${goal}"`,
    600,
  );

  if (!result) {
    throw new Error("Failed to generate persona from goal — is OPENAI_API_KEY set?");
  }

  // Validate and fill defaults
  const persona: LivePersona = {
    name: result.name ?? "Generated User",
    primaryGoal: result.primaryGoal ?? goal,
    northStar: result.northStar ?? `I want to achieve: ${goal}`,
    pace: ["gentle", "steady", "push_me"].includes(result.pace) ? result.pace : "steady",
    goals: Array.isArray(result.goals) ? result.goals : [goal],
    goalTags: Array.isArray(result.goalTags) ? result.goalTags : ["new_skill"],
    barriers: typeof result.barriers === "string" ? result.barriers : "Uncertainty, not knowing where to start",
    comfortZone: typeof result.comfortZone === "string" ? result.comfortZone : "Sticks to familiar routines.",
    activities: Array.isArray(result.activities) ? result.activities : ["Coffee", "Food", "Nature"],
    vibes: Array.isArray(result.vibes) ? result.vibes : [],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: typeof result.ratingBias === "number" ? Math.max(0.4, Math.min(0.8, result.ratingBias)) : 0.6,
    journalProbability: typeof result.journalProbability === "number" ? Math.max(0.3, Math.min(0.8, result.journalProbability)) : 0.5,
    socialEscalationRate: typeof result.socialEscalationRate === "number" ? Math.max(0.05, Math.min(0.4, result.socialEscalationRate)) : 0.2,
  };

  console.log(`  Name: ${persona.name}`);
  console.log(`  Goal: ${persona.primaryGoal}`);
  console.log(`  North Star: ${persona.northStar}`);
  console.log(`  Pace: ${persona.pace}`);
  console.log(`  Barriers: ${persona.barriers}`);
  console.log(`  Comfort Zone: ${persona.comfortZone}`);
  console.log(`  Activities: ${persona.activities.join(", ")}`);
  console.log(`  Rating bias: ${persona.ratingBias.toFixed(2)}, Journal prob: ${persona.journalProbability.toFixed(2)}, Social rate: ${persona.socialEscalationRate.toFixed(2)}`);

  return persona;
}

// ── LLM helpers ─────────────────────────────────────────────

async function llmComplete(systemPrompt: string, userPrompt: string, maxTokens = 200): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        max_completion_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const data = await res.json() as any;
    if (data.error) {
      console.error(`  [LLM Error] ${data.error.message ?? JSON.stringify(data.error)}`);
      return null;
    }
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error(`  [LLM Exception] ${err}`);
    return null;
  }
}

async function llmJson(systemPrompt: string, userPrompt: string, maxTokens = 500): Promise<any | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        max_completion_tokens: maxTokens,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const data = await res.json() as any;
    if (data.error) {
      console.error(`  [LLM Error] ${data.error.message ?? JSON.stringify(data.error)}`);
      return null;
    }
    const text = data.choices?.[0]?.message?.content?.trim();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.error(`  [LLM Exception] ${err}`);
    return null;
  }
}

/**
 * Have the LLM rate fear ladder scenarios in-character as the persona.
 * Returns a record of scenario ID → rating (1-5).
 */
async function rateFearLadderAsPersona(
  persona: LivePersona,
  scenarios: { id: string; text: string; dimension: string }[],
): Promise<Record<string, number>> {
  const scenarioList = scenarios.map((s, i) => `${i + 1}. [${s.id}] "${s.text}" (dimension: ${s.dimension})`).join("\n");

  const result = await llmJson(
    `You are roleplaying as a person with this profile:
- Goal: ${persona.primaryGoal}
- Barriers: ${persona.barriers}
- Current comfort zone: ${persona.comfortZone}
- Pace preference: ${persona.pace}

Rate each scenario on how scary/challenging it would be for this person on a scale of 1-10:
1-2 = Not scary at all
3-4 = A little scary
5-6 = Moderate
7-8 = Scary
9-10 = Terrifying

Respond with a JSON object where keys are scenario IDs and values are integer ratings 1-10.
Be consistent with the persona — a gentle/anxious person should rate things higher, a push_me/adventurous person should rate things lower.`,
    `Rate these fear ladder scenarios:\n\n${scenarioList}\n\nRespond with JSON: { "scenario_id": rating, ... }`,
    400,
  );

  if (!result || typeof result !== "object") {
    // Fallback: generate ratings based on persona pace
    const fallback: Record<string, number> = {};
    const baseRating = persona.pace === "gentle" ? 7 : persona.pace === "push_me" ? 3 : 5;
    for (const s of scenarios) {
      fallback[s.id] = Math.max(1, Math.min(10, Math.round(baseRating + (Math.random() - 0.5) * 4)));
    }
    return fallback;
  }

  // Validate and clamp
  const ratings: Record<string, number> = {};
  for (const s of scenarios) {
    const raw = result[s.id];
    ratings[s.id] = typeof raw === "number" ? Math.max(1, Math.min(10, Math.round(raw))) : 5;
  }
  return ratings;
}

/**
 * Generate pre-quest predictions in-character as the persona.
 */
async function generatePredictions(
  persona: LivePersona,
  questTitle: string,
  venueName: string,
  venueCategory: string,
  hook: string,
  difficulty: number,
  questIndex: number,
  fearScore: number,
): Promise<{ anxiety: number; difficulty: number; outcome: string } | null> {
  const result = await llmJson(
    `You are roleplaying as a person with this profile:
- Goal: ${persona.primaryGoal}
- Barriers: ${persona.barriers}
- Fear score: ${fearScore.toFixed(2)}/1.0 (higher = more anxious)
- Pace: ${persona.pace}
- This is quest #${questIndex + 1} in their journey.

Before going on a quest, predict how you think it will go. Be honest and in-character.`,
    `You're about to go on this quest:
- Title: "${questTitle}"
- Venue: ${venueName} (${venueCategory})
- Hook: ${hook}
- Assigned difficulty: ${difficulty}/10

Respond with JSON:
{
  "anxiety": <1-10 integer, how anxious you feel about this>,
  "difficulty": <1-10 integer, how hard you think it will be>,
  "outcome": "<1-2 sentences predicting what will happen>"
}`,
    200,
  );

  if (!result) return null;

  return {
    anxiety: typeof result.anxiety === "number" ? Math.max(1, Math.min(10, Math.round(result.anxiety))) : 5,
    difficulty: typeof result.difficulty === "number" ? Math.max(1, Math.min(10, Math.round(result.difficulty))) : 5,
    outcome: typeof result.outcome === "string" ? result.outcome.slice(0, 500) : "Not sure what to expect.",
  };
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

async function generateLLMJournal(
  persona: LivePersona,
  venueName: string,
  venueCategory: string,
  hook: string,
  rating: number,
  socialContext: string,
  questIndex: number,
  overallScore: number,
): Promise<string | null> {
  const sentiment = rating >= 4 ? "positive and a bit surprised" : rating >= 3 ? "neutral, reflective" : "mixed, a bit uncomfortable";
  const socialDesc = socialContext === "solo" ? "went alone" : socialContext === "with_someone" ? "went with someone" : socialContext === "met_someone_new" ? "met someone new there" : "was in a group setting";

  return llmComplete(
    `You are a person pursuing this goal: "${persona.primaryGoal}". Your fear/anxiety score is ${overallScore.toFixed(2)}/1.0. You're writing a short journal entry after completing quest #${questIndex + 1}.`,
    `You visited "${venueName}" (a ${venueCategory}). The hook was: "${hook}". You ${socialDesc}. Your mood is ${sentiment}. Write 2-3 sentences in first person, casually. Be honest about how you felt — include any nervousness, growth, or surprise. Don't be overly positive or performative.`,
    150,
  );
}

// ── Fear ladder scoring (mirrors frontend) ───────────────────

function scoreFearLadder(
  responses: Record<string, number>,
  scenarios: { id: string; dimension: string }[],
  dimensions: string[],
): { overallScore: number; dimensionScores: Record<string, number>; derivedPace: string } {
  const answered = scenarios.filter((s) => responses[s.id] != null);
  if (answered.length === 0) {
    const defaultScores: Record<string, number> = {};
    for (const dim of dimensions) defaultScores[dim] = 0.5;
    return { overallScore: 0.5, dimensionScores: defaultScores, derivedPace: "steady" };
  }

  const dimMean = (answered.reduce((acc, s) => acc + responses[s.id], 0) / answered.length - 1) / 9;
  const dimensionScores: Record<string, number> = {};
  for (const dim of dimensions) {
    const dimScenarios = answered.filter((s) => s.dimension === dim);
    if (dimScenarios.length === 0) {
      dimensionScores[dim] = dimMean;
    } else {
      const dimSum = dimScenarios.reduce((acc, s) => acc + responses[s.id], 0);
      dimensionScores[dim] = (dimSum / dimScenarios.length - 1) / 9;
    }
  }

  const sorted = answered.map((s) => responses[s.id]).sort((a, b) => a - b);
  const p75Index = Math.min(Math.ceil(sorted.length * 0.75) - 1, sorted.length - 1);
  const p75 = (sorted[p75Index] - 1) / 9;
  const overallScore = dimMean * 0.5 + p75 * 0.5;

  let derivedPace: string;
  if (overallScore >= 0.6) derivedPace = "gentle";
  else if (overallScore <= 0.3) derivedPace = "push_me";
  else derivedPace = "steady";

  return { overallScore, dimensionScores, derivedPace };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const { email, password, personaKey, goal, questCount, seed, dryRun, skipProfile, skipFearLadder, model: simModel, strategy: simStrategy } = parseArgs();

  let persona: LivePersona | undefined;

  if (goal) {
    // Generate persona dynamically from goal
    persona = await generatePersonaFromGoal(goal);
  } else if (personaKey) {
    persona = PERSONAS[personaKey];
    if (!persona && !skipProfile) {
      console.error(`Unknown persona: ${personaKey}`);
      console.error(`Available: ${Object.keys(PERSONAS).join(", ")}`);
      process.exit(1);
    }
  } else if (!skipProfile) {
    // Default to shy-sarah
    persona = PERSONAS["shy-sarah"];
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Live Sidequest Simulator                ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Persona:  ${skipProfile ? "(using existing profile)" : persona!.name}`);
  console.log(`  Goal:     ${skipProfile ? "(existing)" : persona!.primaryGoal}`);
  console.log(`  User:     ${email}`);
  console.log(`  Quests:   ${questCount}`);
  console.log(`  Model:    ${simModel || "(default)"}`);
  console.log(`  Strategy: ${simStrategy || "(default)"}`);
  console.log(`  Est cost: $${(questCount * 0.035).toFixed(2)}`);
  console.log();

  // 1. Login
  console.log("Logging in...");
  const token = await login(email, password);
  console.log("  Authenticated.");

  let simFearScore = 0.5;
  let generatedScenarios: { id: string; text: string; dimension: string }[] | null = null;
  let generatedDimensions: string[] | null = null;

  if (!skipProfile && persona) {
    // 2. Set home anchor
    console.log("Setting home anchor...");
    await api("POST", "/api/sidequests/home-anchor", token, {
      latitude: persona.homeLatitude,
      longitude: persona.homeLongitude,
    });

    // 3. Generate fear ladder (unless skipped)
    if (!skipFearLadder) {
      console.log("Generating personalized fear ladder...");
      const ladderRes = await api("POST", "/api/sidequests/generate-fear-ladder", token, {
        primaryGoal: persona.primaryGoal,
        goals: persona.goalTags,
        barriers: persona.barriers.split(", "),
        activities: persona.activities,
      });

      if (ladderRes.status === 200 && ladderRes.data?.scenarios) {
        generatedScenarios = ladderRes.data.scenarios;
        generatedDimensions = ladderRes.data.dimensions;

        console.log(`  Generated ${generatedScenarios!.length} scenarios across ${generatedDimensions!.length} dimensions:`);
        for (const dim of generatedDimensions!) {
          const dimScenarios = generatedScenarios!.filter((s) => s.dimension === dim);
          console.log(`    ${dim}: ${dimScenarios.map((s) => `"${s.text}"`).join(", ")}`);
        }

        // 4. Have the LLM rate scenarios in-character
        console.log("  Rating scenarios in-character...");
        const ratings = await rateFearLadderAsPersona(persona, generatedScenarios!);

        console.log("  Ratings:");
        for (const s of generatedScenarios!) {
          const r = ratings[s.id] ?? 3;
          const label = r <= 2 ? "Not scary" : r <= 4 ? "A little" : r <= 6 ? "Moderate" : r <= 8 ? "Scary" : "Terrifying";
          console.log(`    ${s.text.padEnd(55)} ${r}/5 (${label})`);
        }

        // 5. Score and save
        const scored = scoreFearLadder(ratings, generatedScenarios!, generatedDimensions!);
        simFearScore = scored.overallScore;

        console.log(`  Overall fear score: ${scored.overallScore.toFixed(3)}`);
        console.log(`  Derived pace: ${scored.derivedPace}`);
        console.log(`  Dimension scores: ${Object.entries(scored.dimensionScores).map(([d, s]) => `${d}=${s.toFixed(2)}`).join(", ")}`);

        // Save to comfort profile
        await api("PUT", "/api/sidequests/comfort-profile", token, {
          pacePreference: scored.derivedPace,
          comfortProfile: {
            comfortZone: persona.comfortZone,
            barriers: persona.barriers,
            goals: persona.goals[0],
            goalTags: persona.goalTags,
            northStar: persona.northStar,
            primaryGoal: persona.primaryGoal,
          },
          fearLadder: {
            overallScore: scored.overallScore,
            dimensionScores: scored.dimensionScores,
            responses: ratings,
            scenarios: generatedScenarios,
            dimensions: generatedDimensions,
          },
        });
      } else {
        console.log(`  Fear ladder generation failed (${ladderRes.status}), using defaults`);
        // Apply profile without fear ladder
        await api("PUT", "/api/sidequests/comfort-profile", token, {
          pacePreference: persona.pace,
          comfortProfile: {
            comfortZone: persona.comfortZone,
            barriers: persona.barriers,
            goals: persona.goals[0],
            goalTags: persona.goalTags,
            northStar: persona.northStar,
            primaryGoal: persona.primaryGoal,
          },
        });
      }
    } else {
      // Apply profile without fear ladder
      console.log(`Applying "${persona.name}" profile (skipping fear ladder)...`);
      await api("PUT", "/api/sidequests/comfort-profile", token, {
        pacePreference: persona.pace,
        comfortProfile: {
          comfortZone: persona.comfortZone,
          barriers: persona.barriers,
          goals: persona.goals[0],
          goalTags: persona.goalTags,
          northStar: persona.northStar,
          primaryGoal: persona.primaryGoal,
        },
      });
    }

    console.log(`  Home: (${persona.homeLatitude}, ${persona.homeLongitude})`);
    console.log(`  Goal: ${persona.primaryGoal}`);
  } else {
    console.log("  Using existing user profile (--skip-profile)");
    // Fetch existing profile for simulation params
    const profileRes = await api("GET", "/api/sidequests/comfort-zone", token);
    if (profileRes.data) {
      // Update sim params from existing profile
    }
    const meRes = await api("POST", "/api/auth/me", token);
    const fearLadder = meRes.data?.fearLadder ?? meRes.data?.user?.fearLadder;
    if (fearLadder?.overallScore != null) {
      simFearScore = fearLadder.overallScore;
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: Profile applied. Exiting.");
    return;
  }

  // Resolve simulation parameters
  let simLat = persona?.homeLatitude ?? 0;
  let simLng = persona?.homeLongitude ?? 0;
  let simRatingBias = persona?.ratingBias ?? 0.6;
  let simJournalProb = persona?.journalProbability ?? 0.5;
  let simSocialRate = persona?.socialEscalationRate ?? 0.2;

  if (skipProfile) {
    const profileRes = await api("GET", "/api/sidequests/comfort-zone", token);
    if (profileRes.data) {
      simLat = profileRes.data.homeLatitude ?? simLat;
      simLng = profileRes.data.homeLongitude ?? simLng;
    }
    // Scale biases based on fear ladder
    simRatingBias = 0.45 + (1 - simFearScore) * 0.3;
    simJournalProb = 0.4 + simFearScore * 0.4;
    simSocialRate = 0.05 + (1 - simFearScore) * 0.3;
    console.log(`  Fear score: ${simFearScore.toFixed(3)} → rating bias ${simRatingBias.toFixed(2)}, journal prob ${simJournalProb.toFixed(2)}, social rate ${simSocialRate.toFixed(2)}`);
  }

  // Run simulation loop
  const rand = mulberry32(seed);
  let currentSocialLevel = 0;
  const previousSocialContexts: string[] = [];
  const journey: JourneyEntry[] = [];

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Starting ${questCount}-quest simulation...`);
  console.log(`${"─".repeat(60)}\n`);

  for (let i = 0; i < questCount; i++) {
    console.log(`\n╭─ Quest ${i + 1}/${questCount} ${"─".repeat(40)}`);

    // Prescribe
    console.log("│  Prescribing quest...");
    const prescribeRes = await api("POST", "/api/sidequests/prescribe", token, {
      latitude: simLat,
      longitude: simLng,
      ...(simModel && { model: simModel }),
      ...(simStrategy && { strategy: simStrategy }),
    });

    if (prescribeRes.status !== 202) {
      console.error(`│  Prescription failed (${prescribeRes.status}): ${JSON.stringify(prescribeRes.data)}`);
      continue;
    }

    const { jobId } = prescribeRes.data;

    // Poll for completion
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

    // Fetch the quest details
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
    console.log(`│     Difficulty: ${obj.difficulty ?? "?"} | Rarity: ${quest.rarity ?? "?"} | Actionability: ${obj.actionability ?? "?"}`);
    console.log(`│     Distance: ${quest.distanceFromHome ? Number(quest.distanceFromHome).toFixed(2) + " mi" : "?"}`);

    // Pre-quest predictions
    let predictedAnxiety: number | null = null;
    let predictedDifficulty: number | null = null;
    if (persona && process.env.OPENAI_API_KEY) {
      console.log(`│`);
      console.log(`│  Generating pre-quest predictions...`);
      const prediction = await generatePredictions(
        persona,
        quest.title ?? "",
        obj.venueName ?? "the venue",
        obj.venueCategory ?? "place",
        obj.hook ?? "",
        obj.difficulty ?? 3,
        i,
        simFearScore,
      );

      if (prediction) {
        predictedAnxiety = prediction.anxiety;
        predictedDifficulty = prediction.difficulty;
        console.log(`│  Predicted anxiety: ${prediction.anxiety}/10`);
        console.log(`│  Predicted difficulty: ${prediction.difficulty}/10`);
        console.log(`│  Expected outcome: "${prediction.outcome.slice(0, 70)}${prediction.outcome.length > 70 ? "..." : ""}"`);

        await api("PUT", `/api/sidequests/objectives/${obj.id}/prediction`, token, {
          predictedAnxiety: prediction.anxiety,
          predictedDifficulty: prediction.difficulty,
          predictedOutcome: prediction.outcome,
        });
      }
    }

    // Activate
    await api("POST", `/api/sidequests/${sidequestId}/activate`, token);

    // Checkin
    console.log(`│`);
    console.log(`│  Checking in...`);
    await api("POST", `/api/sidequests/${sidequestId}/objectives/${obj.id}/checkin`, token, {
      latitude: Number(obj.latitude),
      longitude: Number(obj.longitude),
    });

    // Generate synthetic completion data
    const socialContext = generateSocialContext(currentSocialLevel, simSocialRate, rand);
    const rating = generateRating(simRatingBias, rand);

    // Generate journal
    let journalEntry: string | null;
    if (persona && process.env.OPENAI_API_KEY && rand() < simJournalProb) {
      journalEntry = await generateLLMJournal(
        persona,
        obj.venueName ?? "the venue",
        obj.venueCategory ?? "place",
        obj.hook ?? "",
        rating,
        socialContext,
        i,
        simFearScore,
      );
    } else {
      journalEntry = generateJournal(simJournalProb, rand);
    }

    if (socialContext) {
      const idx = SOCIAL_LADDER.indexOf(socialContext);
      if (idx > currentSocialLevel) currentSocialLevel = idx;
    }

    // Save journal + social context
    await api("PUT", `/api/sidequests/objectives/${obj.id}/journal`, token, {
      journalEntry: journalEntry ?? undefined,
      socialContext,
      completedActivity: `Visited ${obj.venueName}`,
    });

    // Rate (triggers resonance + pathway detection)
    await api("POST", `/api/sidequests/${sidequestId}/rate`, token, { rating });

    // Compute resonance locally
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
      userPace: persona?.pace ?? "steady",
      previousSocialContexts: [...previousSocialContexts],
      reflectionDepth: null,
      reflectionSentiment: null,
      reflectionTags: null,
    };
    const resonance = computeResonance(resonanceInput, DEFAULT_QUEST_CONFIG);

    if (socialContext) previousSocialContexts.push(socialContext);

    // Fetch comfort zone
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
      predictedAnxiety,
      predictedDifficulty,
      actionability: obj.actionability ?? null,
    });

    console.log(`╰${"─".repeat(55)}`);

    // Small delay between quests
    if (i < questCount - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 5. Final summary
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  SIMULATION COMPLETE — ${skipProfile ? email : persona!.name}`);
  console.log(`  Goal: ${skipProfile ? "(existing)" : persona!.primaryGoal}`);
  console.log(`${"═".repeat(80)}`);

  // Stats
  const allScores = journey.map((j) => j.resonance);
  const avgResonance = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const peakResonance = allScores.length > 0 ? Math.max(...allScores) : 0;

  console.log(`\n  Quests: ${journey.length}`);
  console.log(`  Avg Resonance: ${avgResonance.toFixed(3)}`);
  console.log(`  Peak Resonance: ${peakResonance.toFixed(3)}`);
  console.log(`  Comfort Radius: ${journey[0]?.comfortRadius.toFixed(1) ?? "?"} mi → ${journey[journey.length - 1]?.comfortRadius.toFixed(1) ?? "?"} mi`);

  // Expectancy calibration
  const withPredictions = journey.filter((j) => j.predictedAnxiety != null || j.predictedDifficulty != null);
  if (withPredictions.length > 0) {
    console.log(`\n  Expectancy Calibration (${withPredictions.length} quests with predictions):`);
    const anxietyDeltas = withPredictions.filter((j) => j.predictedAnxiety != null).map((j) => j.predictedAnxiety! - j.difficulty);
    const diffDeltas = withPredictions.filter((j) => j.predictedDifficulty != null).map((j) => j.predictedDifficulty! - j.difficulty);
    if (anxietyDeltas.length > 0) {
      const avgAnxDelta = anxietyDeltas.reduce((a, b) => a + b, 0) / anxietyDeltas.length;
      console.log(`    Avg anxiety delta: ${avgAnxDelta > 0 ? "+" : ""}${avgAnxDelta.toFixed(2)} (${avgAnxDelta > 0.5 ? "overestimates" : avgAnxDelta < -0.5 ? "underestimates" : "well-calibrated"})`);
    }
    if (diffDeltas.length > 0) {
      const avgDiffDelta = diffDeltas.reduce((a, b) => a + b, 0) / diffDeltas.length;
      console.log(`    Avg difficulty delta: ${avgDiffDelta > 0 ? "+" : ""}${avgDiffDelta.toFixed(2)} (${avgDiffDelta > 0.5 ? "overestimates" : avgDiffDelta < -0.5 ? "underestimates" : "well-calibrated"})`);
    }
  }

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

  // Actionability breakdown
  const actCounts: Record<string, number> = {};
  for (const j of journey) {
    const act = j.actionability ?? "unknown";
    actCounts[act] = (actCounts[act] ?? 0) + 1;
  }
  console.log(`\n  Actionability Distribution:`);
  for (const [act, count] of Object.entries(actCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${act.padEnd(14)} ${"█".repeat(count)} ${count}`);
  }

  // Journey timeline
  console.log(`\n  Journey Timeline:`);
  console.log(`  ${"#".padEnd(4)} ${"Category".padEnd(14)} ${"Venue".padEnd(28)} ${"Diff".padEnd(5)} ${"Rate".padEnd(5)} ${"Resonance".padEnd(10)} ${"Social".padEnd(18)} ${"Act".padEnd(12)} Hook`);
  console.log(`  ${"─".repeat(140)}`);
  for (const j of journey) {
    const resonanceBar = "▓".repeat(Math.round(j.resonance * 10)).padEnd(10);
    const venue = j.venueName.length > 26 ? j.venueName.slice(0, 25) + "…" : j.venueName;
    const hook = j.hook.length > 60 ? j.hook.slice(0, 59) + "…" : j.hook;
    const act = (j.actionability ?? "?").slice(0, 10);
    console.log(
      `  ${String(j.index).padEnd(4)} ${j.venueCategory.padEnd(14)} ${venue.padEnd(28)} ${String(j.difficulty).padEnd(5)} ${String(j.rating).padEnd(5)} ${resonanceBar} ${j.socialContext.padEnd(18)} ${act.padEnd(12)} ${hook}`,
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
