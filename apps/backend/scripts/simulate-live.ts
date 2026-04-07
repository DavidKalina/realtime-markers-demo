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
  blockerTriggered: boolean;
  isBreakthrough: boolean;
  questType: string;
  questRole: string | null;
}

interface PathwaySnapshot {
  questIndex: number;
  globalPhase: string;
  pathways: { theme: string; themeLabel: string; phase: string; avgResonance: number; questCount: number }[];
}

interface MilestoneEvent {
  questIndex: number;
  milestone: string;
  percentElapsed: number;
  remainingDays: number;
  reflectionSaved: boolean;
}

// ── Persona definitions ──────────────────────────────────────

interface BlockerConfig {
  /** Human-readable description of the blocked action, e.g. "talking to strangers" */
  description: string;
  /** What the persona actually does instead of the blocked action */
  avoidanceActivity: string;
  /** Quest index after which blocker behavior starts (gives normal baseline first) */
  activateAfterQuest: number;
  /** How many consecutive non-blocked quests with rating >= 3 before the blocker resolves (default: 4) */
  resolveAfterSuccesses?: number;
}

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
  blocker?: BlockerConfig;
  /** ISO date string — if set, the simulation will test the timeline/pacing flow */
  targetDate?: string;
  /** City/location for the goal — used with targetDate for relocation goals */
  goalLocation?: string;
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
    targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  },
  "mover-mike": {
    name: "Mover Mike",
    primaryGoal: "Move out of my parents' house and into my own place in Denver",
    northStar: "I want to sign a lease on my own apartment and feel ready to live independently.",
    pace: "steady",
    goals: ["I want to become financially and socially ready to live on my own"],
    goalTags: ["independence", "socialize", "routine"],
    barriers: "Never lived alone, don't know how to budget, nervous about being isolated in a new city",
    comfortZone: "I live with my parents in the suburbs. I drive to work and come home. I go out with high school friends on weekends sometimes.",
    activities: ["Coffee", "Food", "Nature", "Fitness", "Board games"],
    vibes: ["Meet people", "Build a routine", "Explore my area"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.6,
    journalProbability: 0.6,
    socialEscalationRate: 0.18,
    targetDate: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    goalLocation: "Denver, CO",
  },
  "wallflower-wendy": {
    name: "Wallflower Wendy",
    primaryGoal: "Build a real social circle and feel comfortable at meetups and group events",
    northStar: "I want to walk into a room full of strangers and leave with a friend.",
    pace: "steady",
    goals: ["I want to make friends and stop being so isolated"],
    goalTags: ["socialize", "explore"],
    barriers: "Extreme shyness around strangers, freeze up in social situations, can go places but can't talk to anyone",
    comfortZone: "I go to coffee shops and parks alone. I've tried meetups but I always stand in the corner and leave early without talking to anyone.",
    activities: ["Coffee", "Reading", "Nature", "Art", "Board games", "Food"],
    vibes: ["Meet people", "Explore my area"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.55,
    journalProbability: 0.8, // High — she's introspective, writes about struggles
    socialEscalationRate: 0.08,
    blocker: {
      description: "initiating conversation with strangers or engaging socially at venues",
      avoidanceActivity: "Went there but stayed in the corner. Didn't talk to anyone.",
      activateAfterQuest: 2, // First 2 quests are normal baseline
    },
  },
};

// ── Social ladder + journal templates ────────────────────────

const SOCIAL_LADDER = ["solo", "with_someone", "met_someone_new", "group_activity"];

const POSITIVE_JOURNALS = [
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

const NEGATIVE_JOURNALS = [
  "I don't know. It just felt pointless. I went, I sat there, I left.",
  "This wasn't for me. I felt out of place the entire time.",
  "I forced myself to go but I wanted to leave the whole time. I don't think this is helping.",
  "Nobody talked to me. I just stood there feeling invisible. What's the point.",
  "I felt more lonely there than I do at home. At least at home I'm comfortable.",
  "Honestly I'm starting to wonder if this whole thing is a waste of time.",
  "I went but I didn't feel anything. Just going through the motions.",
  "The anxiety was bad today. I almost turned around in the parking lot.",
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
  let ratingBiasOverride: number | null = null;
  let blockerOverride = "";
  let challengeMix = 0;
  let weekPacks = false;

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
      case "--rating-bias": ratingBiasOverride = parseFloat(args[++i]); break;
      case "--blocker": blockerOverride = args[++i]; break;
      case "--challenge-mix": challengeMix = parseInt(args[++i], 10); break;
      case "--week-packs": weekPacks = true; break;
      case "--help":
        console.log(`
Live Sidequest Simulator — Real LLM prescriptions via backend API

Usage: npx tsx apps/backend/scripts/simulate-live.ts [options]

Options:
  --email <email>        User email (default: user@example.com)
  --password <pass>      User password (default: user123)
  --persona <name>       Hardcoded persona (shy-sarah, adventurous-alex, routine-rick, comedian-carl, fitness-fiona, mover-mike, wallflower-wendy)
  --goal <text>          Generate a persona from a goal (e.g. "become a stand-up comedian")
  --blocker <text>       Inject a recurring blocker (e.g. "talking to strangers", "making phone calls")
  --quests <n>           Number of quests to prescribe (default: 5)
  --seed <n>             Random seed (default: 42)
  --dry-run              Set up user profile but don't prescribe quests
  --skip-profile         Use existing user profile instead of applying persona
  --skip-fear-ladder     Skip fear ladder generation (use existing or none)
  --model <model>        Override prescription model (e.g. gpt-5.4-nano, gpt-5.4-mini, gpt-5.4)
  --strategy <name>      Prescription strategy: "monolithic" or "multi-agent"
  --rating-bias <0-1>    Override rating bias (0.2 = mostly 1-2 stars, 0.5 = mixed, 0.8 = mostly 4-5)
  --challenge-mix <n>    Prescribe every Nth quest as a challenge quest (e.g. 4 = every 4th quest)
  --week-packs           Use week-pack prescription (3 quests per pack) instead of individual

Examples:
  npx tsx apps/backend/scripts/simulate-live.ts --goal "become a stand-up comedian" --quests 10
  npx tsx apps/backend/scripts/simulate-live.ts --persona wallflower-wendy --quests 12
  npx tsx apps/backend/scripts/simulate-live.ts --goal "become a salesman" --blocker "making phone calls" --quests 10
  npx tsx apps/backend/scripts/simulate-live.ts --persona shy-sarah --blocker "talking to strangers" --quests 8
  npx tsx apps/backend/scripts/simulate-live.ts --persona adventurous-alex --challenge-mix 3 --quests 12
  npx tsx apps/backend/scripts/simulate-live.ts --persona fitness-fiona --week-packs --quests 12

Estimated cost: ~$0.02-0.05 per quest (GPT-5.4-nano + Google Places)
`);
        process.exit(0);
    }
  }

  return { email, password, personaKey, goal, questCount, seed, dryRun, skipProfile, skipFearLadder, model, strategy, ratingBiasOverride, blockerOverride, challengeMix, weekPacks };
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
  "socialEscalationRate": <0.05-0.4 float — how quickly they escalate social context>,
  "targetDate": "<YYYY-MM-DD or null — a realistic deadline if the goal is time-bound>",
  "goalLocation": "<city/region or null — if the goal involves a specific location>",
  "blocker": {
    "description": "<action they consistently avoid, or null if no blocker>",
    "avoidanceActivity": "<what they do instead when the blocker fires>"
  }
}

Guidelines:
- "gentle" pace: anxious, cautious, needs easing in
- "steady" pace: moderate, willing but not rushing
- "push_me" pace: eager, wants to be challenged
- ratingBias should correlate with confidence (anxious = lower ~0.5, confident = higher ~0.7)
- journalProbability should correlate with introspection
- socialEscalationRate should correlate with social comfort
- targetDate: set a realistic date 3-12 months from now if the goal has a natural deadline (race, move, event, season). Null if open-ended.
- goalLocation: only set if the goal references a specific city/region (e.g. "move to Denver"). Null otherwise.
- blocker: identify ONE recurring avoidance behavior that would realistically hold this person back. Set to null only if the goal has no obvious psychological barrier. Most goals have one.`,
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
    ...(result.targetDate && typeof result.targetDate === "string" && result.targetDate !== "null" && { targetDate: result.targetDate }),
    ...(result.goalLocation && typeof result.goalLocation === "string" && result.goalLocation !== "null" && { goalLocation: result.goalLocation }),
    ...(result.blocker && typeof result.blocker === "object" && result.blocker.description && result.blocker.description !== "null" && {
      blocker: {
        description: result.blocker.description,
        avoidanceActivity: result.blocker.avoidanceActivity ?? `Avoided ${result.blocker.description}. Did the easy parts and left.`,
        activateAfterQuest: 2,
      },
    }),
  };

  console.log(`  Name: ${persona.name}`);
  console.log(`  Goal: ${persona.primaryGoal}`);
  console.log(`  North Star: ${persona.northStar}`);
  console.log(`  Pace: ${persona.pace}`);
  console.log(`  Barriers: ${persona.barriers}`);
  console.log(`  Comfort Zone: ${persona.comfortZone}`);
  console.log(`  Activities: ${persona.activities.join(", ")}`);
  if (persona.targetDate) console.log(`  Target Date: ${persona.targetDate}`);
  if (persona.goalLocation) console.log(`  Goal Location: ${persona.goalLocation}`);
  if (persona.blocker) console.log(`  Blocker: "${persona.blocker.description}" → "${persona.blocker.avoidanceActivity}"`);
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

function generateJournal(probability: number, rating: number, rand: () => number): string | null {
  // Low ratings → less likely to journal at all
  const adjustedProb = rating <= 2 ? probability * 0.4 : rating <= 3 ? probability * 0.7 : probability;
  if (rand() > adjustedProb) return null;

  if (rating <= 2) {
    return NEGATIVE_JOURNALS[Math.floor(rand() * NEGATIVE_JOURNALS.length)];
  }
  if (rating >= 4) {
    return POSITIVE_JOURNALS[Math.floor(rand() * POSITIVE_JOURNALS.length)];
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
  const sentiment = rating >= 4
    ? "positive and a bit surprised — this actually felt good"
    : rating >= 3
    ? "neutral, meh — it was fine but nothing special"
    : rating === 2
    ? "disappointed — it didn't click, felt out of place or bored"
    : "bad — anxious, lonely, or frustrated. Questioning whether this is worth it";
  const socialDesc = socialContext === "solo" ? "went alone" : socialContext === "with_someone" ? "went with someone" : socialContext === "met_someone_new" ? "met someone new there" : "was in a group setting";

  return llmComplete(
    `You are a person pursuing this goal: "${persona.primaryGoal}". Your fear/anxiety score is ${overallScore.toFixed(2)}/1.0. You're writing a short journal entry after quest #${questIndex + 1}. You rated it ${rating}/5 stars.`,
    `You visited "${venueName}" (a ${venueCategory}). The hook was: "${hook}". You ${socialDesc}. Your mood is ${sentiment}. Write 2-3 sentences in first person, casually. Be HONEST — if it sucked, say so. If you felt lonely or like it was pointless, say that. Don't sugarcoat. Match the ${rating}-star rating.`,
    150,
  );
}

// ── Blocker simulation ──────────────────────────────────────

/**
 * Ask the LLM whether a prescribed quest involves the persona's blocked action.
 * Returns true if the quest would require the blocked behavior.
 */
async function questTriggersBlocker(
  blocker: BlockerConfig,
  questTitle: string,
  description: string | null,
  actionItems: string[],
  suggestedActivities: string[],
): Promise<boolean> {
  const questContent = [
    `Title: ${questTitle}`,
    description ? `Description: ${description}` : null,
    actionItems.length > 0 ? `Action items: ${actionItems.join("; ")}` : null,
    suggestedActivities.length > 0 ? `Suggested activities: ${suggestedActivities.join("; ")}` : null,
  ].filter(Boolean).join("\n");

  const result = await llmJson(
    `You decide whether a quest involves a specific action. Respond with JSON: {"triggers": true} or {"triggers": false}.

The blocked action is: "${blocker.description}"

A quest "triggers" the blocker if completing it fully would require the person to do the blocked action — e.g., if the action items or suggested activities involve that behavior. Be reasonably inclusive — if the quest clearly creates an opportunity or expectation for that action, it triggers.`,
    `Does this quest involve "${blocker.description}"? Respond in JSON.\n\n${questContent}`,
    50,
  );

  return result?.triggers === true;
}

/**
 * Generate a blocker-specific journal entry via LLM.
 * The persona went to the venue but avoided the blocked action.
 */
async function generateBlockerJournal(
  persona: LivePersona,
  blocker: BlockerConfig,
  venueName: string,
  venueCategory: string,
  questIndex: number,
): Promise<string | null> {
  return llmComplete(
    `You are roleplaying as "${persona.name}", a person whose goal is: "${persona.primaryGoal}".

You have a recurring problem: you consistently avoid ${blocker.description}. You went to the venue but ${blocker.avoidanceActivity.toLowerCase()} This is quest #${questIndex + 1} in your journey, and you're frustrated because this keeps happening.

Write a 2-3 sentence journal entry in first person. Be honest and specific about the avoidance. Show the internal struggle — you WANT to do it but you just can't. Don't be melodramatic, be real. Vary the wording from a generic template — reference the actual venue.`,
    `You just visited "${venueName}" (a ${venueCategory}). Write your journal entry about how the blocker held you back again.`,
    150,
  );
}

const BLOCKER_JOURNAL_FALLBACKS = [
  "I went but I couldn't do it again. I just stood there watching everyone else and then left. I'm so frustrated with myself.",
  "Same thing as last time. I showed up, I walked around, but I couldn't bring myself to actually engage. What's wrong with me.",
  "I tried. I really tried. But when the moment came I just froze. I ended up on my phone pretending to be busy.",
  "Another one where I went through the motions but couldn't do the hard part. I keep telling myself next time will be different.",
  "I was there for like 20 minutes before I gave up and left. I could see other people doing exactly what I want to do and I just... couldn't.",
  "Showed up, ordered something, sat in the corner, left. The usual. I don't know how to break this pattern.",
  "I keep going to these places thinking this time will be different but I always end up doing the same thing — nothing.",
  "I wanted to. I was so close. But then I just couldn't pull the trigger. Walked out feeling worse than before I went in.",
];

/**
 * Generate a breakthrough journal — the persona finally does the blocked action.
 */
async function generateBreakthroughJournal(
  persona: LivePersona,
  blocker: BlockerConfig,
  venueName: string,
  venueCategory: string,
  questIndex: number,
): Promise<string | null> {
  return llmComplete(
    `You are roleplaying as "${persona.name}", a person whose goal is: "${persona.primaryGoal}".

You've had a recurring blocker: ${blocker.description}. For weeks you kept showing up to places but couldn't do it. But recently you've been building confidence through low-pressure wins — just being present, getting comfortable in spaces, noticing familiar faces.

Today, for the FIRST TIME, you actually did it. You ${blocker.description}. It wasn't perfect. It was small. But it happened. This is quest #${questIndex + 1}.

Write a 2-3 sentence journal entry in first person. Show genuine surprise and quiet pride — not over-the-top celebration. This is a real, hard-won moment. Reference the actual venue.`,
    `You just visited "${venueName}" (a ${venueCategory}) and for the first time you actually did the thing you've been avoiding. Write your journal entry.`,
    150,
  );
}

const BREAKTHROUGH_JOURNAL_FALLBACKS = [
  "I actually did it. It was tiny — just a few words — but I said something to someone I didn't know. My heart was pounding the whole time but I didn't freeze. I can't believe it.",
  "Something clicked today. I don't know if it was the place or just enough practice showing up, but I finally talked to someone. It was awkward and short but it happened.",
  "I introduced myself to someone. It lasted maybe 30 seconds. But after weeks of standing in corners, those 30 seconds felt like everything.",
  "I said hi to a stranger today and they said hi back and we talked for a minute. That's it. That's the whole story. But I'm genuinely proud of myself.",
];

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
  const { email, password, personaKey, goal, questCount, seed, dryRun, skipProfile, skipFearLadder, model: simModel, strategy: simStrategy, ratingBiasOverride, blockerOverride, challengeMix, weekPacks } = parseArgs();

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

  // Apply --blocker override to any persona
  if (blockerOverride && persona) {
    persona = {
      ...persona,
      blocker: {
        description: blockerOverride,
        avoidanceActivity: `Went there but avoided ${blockerOverride}. Did the easy parts and left.`,
        activateAfterQuest: 2,
      },
    };
  }

  const activeBlocker = persona?.blocker ?? null;

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Live Sidequest Simulator                ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Persona:  ${skipProfile ? "(using existing profile)" : persona!.name}`);
  console.log(`  Goal:     ${skipProfile ? "(existing)" : persona!.primaryGoal}`);
  console.log(`  User:     ${email}`);
  console.log(`  Quests:   ${questCount}`);
  console.log(`  Model:    ${simModel || "(default)"}`);
  console.log(`  Strategy: ${simStrategy || "(default)"}`);
  if (activeBlocker) {
    console.log(`  Blocker:  "${activeBlocker.description}" (activates after quest ${activeBlocker.activateAfterQuest})`);
  }
  if (challengeMix > 0) {
    console.log(`  Challenge: every ${challengeMix}${challengeMix === 1 ? "st" : challengeMix === 2 ? "nd" : challengeMix === 3 ? "rd" : "th"} quest`);
  }
  if (weekPacks) {
    console.log(`  Mode:     week packs (3 quests per pack)`);
  }
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
    // 2a. Submit onboarding profile
    const paceMap = { gentle: "chill" as const, steady: "balanced" as const, push_me: "send_it" as const };
    console.log("Submitting onboarding profile...");
    const onboardingRes = await api("POST", "/api/users/me/onboarding-profile", token, {
      activities: persona.activities,
      vibes: persona.vibes.length > 0 ? persona.vibes : ["Explore my area"],
      idealDay: persona.comfortZone,
      pace: paceMap[persona.pace] ?? "balanced",
    });
    if (onboardingRes.status === 200 || onboardingRes.status === 201) {
      console.log(`  Onboarding profile saved (activities: ${persona.activities.length}, vibes: ${persona.vibes.length}, pace: ${paceMap[persona.pace]})`);
    } else {
      console.log(`  Onboarding profile failed (${onboardingRes.status}): ${JSON.stringify(onboardingRes.data)}`);
    }

    // 2b. Set home anchor
    console.log("Setting home anchor...");
    await api("POST", "/api/sidequests/home-anchor", token, {
      latitude: persona.homeLatitude,
      longitude: persona.homeLongitude,
    });

    // 2b. Goal refinement
    console.log("Assessing goal specificity...");
    const assessRes = await api("POST", "/api/sidequests/assess-goal", token, {
      goal: persona.primaryGoal,
    });
    if (assessRes.status === 200 && assessRes.data) {
      const { specificity, feasibility, needsRefinement, refinedGoal } = assessRes.data;
      console.log(`  Specificity: ${specificity.toFixed(2)}, Feasibility: ${feasibility}`);
      if (feasibility === "unfeasible" || feasibility === "concerning" || feasibility === "out_of_scope") {
        console.log(`  ⚠ Goal rejected (${feasibility}): ${assessRes.data.redirectMessage ?? assessRes.data.reframeSuggestion}`);
        console.log("  Proceeding with raw goal anyway (simulation).");
      } else if (needsRefinement) {
        console.log(`  Goal needs refinement. First question: "${assessRes.data.firstQuestion}"`);
        // Simulate answering the refinement question
        let state = assessRes.data.state;
        const answers = [
          `I want to ${persona.primaryGoal.toLowerCase()} within the next ${persona.targetDate ? "few months" : "year or so"}.${persona.goalLocation ? ` I'm thinking about ${persona.goalLocation}.` : ""}`,
          "I just want to feel ready and confident about it. Like I've actually built the skills I need.",
        ];
        for (let i = 0; i < Math.min(answers.length, 3); i++) {
          const refineRes = await api("POST", "/api/sidequests/refine-goal", token, {
            state,
            response: answers[i] ?? "I'm not sure, whatever feels right.",
          });
          if (refineRes.status === 200 && refineRes.data) {
            if (refineRes.data.done && refineRes.data.refinedGoal) {
              persona.primaryGoal = refineRes.data.refinedGoal;
              console.log(`  ✓ Refined goal: "${persona.primaryGoal}"`);
              if (refineRes.data.state?.extractedSignals?.targetDate) {
                persona.targetDate = refineRes.data.state.extractedSignals.targetDate;
                console.log(`  ✓ Extracted target date: ${persona.targetDate}`);
              }
              if (refineRes.data.state?.extractedSignals?.goalLocation) {
                persona.goalLocation = refineRes.data.state.extractedSignals.goalLocation;
                console.log(`  ✓ Extracted goal location: ${persona.goalLocation}`);
              }
              break;
            }
            state = refineRes.data.state;
            if (refineRes.data.question) {
              console.log(`  Q: "${refineRes.data.question}"`);
            }
          }
        }
      } else if (refinedGoal) {
        persona.primaryGoal = refinedGoal;
        console.log(`  ✓ Goal already specific: "${persona.primaryGoal}"`);
      }
    }

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
            targetDate: persona.targetDate || undefined,
            goalLocation: persona.goalLocation || undefined,
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
            targetDate: persona.targetDate || undefined,
            goalLocation: persona.goalLocation || undefined,
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
          targetDate: persona.targetDate || undefined,
          goalLocation: persona.goalLocation || undefined,
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
  let simRatingBias = ratingBiasOverride ?? persona?.ratingBias ?? 0.6;
  let simJournalProb = persona?.journalProbability ?? 0.5;
  let simSocialRate = persona?.socialEscalationRate ?? 0.2;

  if (skipProfile) {
    const profileRes = await api("GET", "/api/sidequests/comfort-zone", token);
    if (profileRes.data) {
      simLat = profileRes.data.homeLatitude ?? simLat;
      simLng = profileRes.data.homeLongitude ?? simLng;
    }
    // Scale biases based on fear ladder
    simRatingBias = ratingBiasOverride ?? 0.45 + (1 - simFearScore) * 0.3;
    simJournalProb = 0.4 + simFearScore * 0.4;
    simSocialRate = 0.05 + (1 - simFearScore) * 0.3;
    console.log(`  Fear score: ${simFearScore.toFixed(3)} → rating bias ${simRatingBias.toFixed(2)}, journal prob ${simJournalProb.toFixed(2)}, social rate ${simSocialRate.toFixed(2)}`);
  }

  if (ratingBiasOverride != null) {
    console.log(`  ⚠️  Rating bias overridden to ${simRatingBias.toFixed(2)} (${simRatingBias <= 0.25 ? "mostly 1-2 stars" : simRatingBias <= 0.4 ? "mostly 2-3 stars" : "mixed"})`);
  }

  // Run simulation loop
  const rand = mulberry32(seed);
  let currentSocialLevel = 0;
  const previousSocialContexts: string[] = [];
  const journey: JourneyEntry[] = [];
  const pathwaySnapshots: PathwaySnapshot[] = [];
  const milestoneEvents: MilestoneEvent[] = [];
  let lastMilestone: string | null = null;
  let blockerConsecutiveSuccesses = 0;
  let blockerResolved = false;
  let blockerResolvedAtQuest: number | null = null;
  const blockerResolveThreshold = activeBlocker?.resolveAfterSuccesses ?? 3;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Starting ${questCount}-quest simulation...`);
  console.log(`${"─".repeat(60)}\n`);

  // ── Week-pack state ──────────────────────────────────────
  let packQueuedIds: string[] = [];

  for (let i = 0; i < questCount; i++) {
    console.log(`\n╭─ Quest ${i + 1}/${questCount} ${"─".repeat(40)}`);

    // Determine quest type for this iteration
    const isChallenge = challengeMix > 0 && ((i + 1) % challengeMix === 0);
    const challengeCategories = ["social_reach", "vulnerability", "hosting", "reconnection"] as const;
    const challengeCategory = isChallenge ? challengeCategories[i % challengeCategories.length] : undefined;

    let sidequestId: string | undefined;

    if (weekPacks && packQueuedIds.length === 0) {
      // Prescribe a new 3-quest pack
      console.log("│  Prescribing week pack (3 quests)...");
      const packRes = await api("POST", "/api/sidequests/prescribe-pack", token, {
        latitude: simLat,
        longitude: simLng,
      });

      if (packRes.status !== 202) {
        console.error(`│  Pack prescription failed (${packRes.status}): ${JSON.stringify(packRes.data)}`);
        continue;
      }

      let packResult: any;
      try {
        packResult = await pollJobCompletion(packRes.data.jobId, token);
        console.log();
      } catch (err: any) {
        console.error(`\n│  ${err.message}`);
        continue;
      }

      packQueuedIds = packResult?.result?.sidequestIds ?? [];
      if (packQueuedIds.length === 0) {
        console.error("│  Pack returned no sidequest IDs");
        continue;
      }
      console.log(`│  Pack prescribed: ${packQueuedIds.length} quests (${(packResult?.result?.titles ?? []).join(", ")})`);
    }

    if (weekPacks && packQueuedIds.length > 0) {
      sidequestId = packQueuedIds.shift()!;
    } else if (!weekPacks) {
      // Individual prescription
      console.log(`│  Prescribing ${isChallenge ? `challenge (${challengeCategory})` : "venue"} quest...`);
      const prescribeRes = await api("POST", "/api/sidequests/prescribe", token, {
        latitude: simLat,
        longitude: simLng,
        ...(simModel && { model: simModel }),
        ...(simStrategy && { strategy: simStrategy }),
        ...(isChallenge && { questType: "challenge", challengeCategory }),
      });

      if (prescribeRes.status !== 202) {
        console.error(`│  Prescription failed (${prescribeRes.status}): ${JSON.stringify(prescribeRes.data)}`);
        continue;
      }

      const { jobId } = prescribeRes.data;

      let jobResult: any;
      try {
        jobResult = await pollJobCompletion(jobId, token);
        console.log();
      } catch (err: any) {
        console.error(`\n│  ${err.message}`);
        continue;
      }

      sidequestId = jobResult?.result?.sidequestId;
    }

    if (!sidequestId) {
      console.error("│  No sidequest ID");
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
    console.log(`│     Type: ${quest.questType ?? "venue"} | Role: ${quest.questRole ?? "none"}${quest.questRole === "enjoy" ? " ★ ENJOY QUEST" : ""}`);
    console.log(`│     Distance: ${quest.distanceFromHome ? Number(quest.distanceFromHome).toFixed(2) + " mi" : "?"}`);
    if (obj.description) {
      console.log(`│     Description: ${obj.description}`);
    }
    if (obj.suggestedActivities?.length) {
      console.log(`│     Checklist:`);
      for (const sa of obj.suggestedActivities) {
        console.log(`│       ◇ ${sa}`);
      }
    }
    console.log(`│     Objectives in quest: ${quest.objectives.length}`);

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

    // Checkin (venue quests) or complete-challenge (challenge quests)
    const isActualChallenge = (quest.questType ?? "venue") === "challenge";
    console.log(`│`);
    if (isActualChallenge) {
      console.log(`│  Completing challenge...`);
      // Challenge completion requires a journal entry >= 20 chars
      const challengeJournal = persona && process.env.OPENAI_API_KEY
        ? await llmComplete(
            `You are "${persona.name}" completing a challenge quest. Write a 2-3 sentence reflection on doing: "${quest.title}". Be authentic.`,
            `Challenge: ${obj.description ?? quest.title}. How did it go?`,
            100,
          )
        : `I completed the challenge "${quest.title}". It pushed me outside my comfort zone but I did it.`;
      await api("POST", `/api/sidequests/${sidequestId}/objectives/${obj.id}/complete-challenge`, token, {
        journalEntry: challengeJournal ?? `I completed the challenge. It was harder than I expected but I'm glad I pushed through. Growing.`,
        socialContext: "solo",
      });
    } else {
      console.log(`│  Checking in...`);
      await api("POST", `/api/sidequests/${sidequestId}/objectives/${obj.id}/checkin`, token, {
        latitude: Number(obj.latitude),
        longitude: Number(obj.longitude),
      });
    }

    // ── Blocker detection ──────────────────────────────────
    let blockerTriggered = false;
    let isBreakthrough = false;
    if (activeBlocker && i >= activeBlocker.activateAfterQuest && process.env.OPENAI_API_KEY) {
      console.log(`│`);
      const questMatchesBlocker = await questTriggersBlocker(
        activeBlocker,
        quest.title ?? "",
        obj.description ?? null,
        obj.actionItems ?? [],
        obj.suggestedActivities ?? [],
      );

      if (questMatchesBlocker && !blockerResolved) {
        // Blocker still active — persona fails
        blockerTriggered = true;
        blockerConsecutiveSuccesses = 0; // Reset streak
        console.log(`│  Blocker: "${activeBlocker.description}" — TRIGGERED (streak reset to 0)`);
      } else if (questMatchesBlocker && blockerResolved) {
        // Blocker resolved — this is a breakthrough or post-breakthrough success
        isBreakthrough = blockerResolvedAtQuest === null;
        if (isBreakthrough) blockerResolvedAtQuest = i;
        console.log(`│  Blocker: "${activeBlocker.description}" — ${isBreakthrough ? "BREAKTHROUGH! First success!" : "POST-BREAKTHROUGH — completing normally"}`);
      } else {
        // Quest doesn't involve the blocked action
        console.log(`│  Blocker: no match — normal completion (success streak: ${blockerConsecutiveSuccesses}/${blockerResolveThreshold})`);
      }
    }

    // ── Generate synthetic completion data ────────────────
    let socialContext: string;
    let rating: number;
    let journalEntry: string | null = null;
    let completedActivity: string;

    if (blockerTriggered) {
      // Blocker override: low rating, solo, avoidance journal
      socialContext = "solo";
      rating = rand() < 0.6 ? 1 : 2;
      completedActivity = activeBlocker!.avoidanceActivity;

      // Generate blocker-specific journal (high probability — they're frustrated)
      if (persona && process.env.OPENAI_API_KEY && rand() < 0.85) {
        journalEntry = await generateBlockerJournal(
          persona,
          activeBlocker!,
          obj.venueName ?? "the venue",
          obj.venueCategory ?? "place",
          i,
        );
      }
      if (!journalEntry) {
        journalEntry = BLOCKER_JOURNAL_FALLBACKS[Math.floor(rand() * BLOCKER_JOURNAL_FALLBACKS.length)];
      }
    } else if (isBreakthrough) {
      // Breakthrough: persona does the blocked action for the first time!
      socialContext = "met_someone_new";
      rating = rand() < 0.7 ? 5 : 4;
      completedActivity = `Actually did it — ${activeBlocker!.description} for the first time`;

      if (persona && process.env.OPENAI_API_KEY) {
        journalEntry = await generateBreakthroughJournal(
          persona,
          activeBlocker!,
          obj.venueName ?? "the venue",
          obj.venueCategory ?? "place",
          i,
        );
      }
      if (!journalEntry) {
        journalEntry = BREAKTHROUGH_JOURNAL_FALLBACKS[Math.floor(rand() * BREAKTHROUGH_JOURNAL_FALLBACKS.length)];
      }
    } else {
      // Normal completion
      socialContext = generateSocialContext(currentSocialLevel, simSocialRate, rand);
      rating = generateRating(simRatingBias, rand);
      completedActivity = `Visited ${obj.venueName}`;

      // Generate journal — probability drops with low ratings
      const journalProb = rating <= 2 ? simJournalProb * 0.4 : rating <= 3 ? simJournalProb * 0.7 : simJournalProb;
      if (persona && process.env.OPENAI_API_KEY && rand() < journalProb) {
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
        journalEntry = generateJournal(simJournalProb, rating, rand);
      }
    }

    if (socialContext) {
      const idx = SOCIAL_LADDER.indexOf(socialContext);
      if (idx > currentSocialLevel) currentSocialLevel = idx;
    }

    // Track blocker resolution progress
    if (activeBlocker && !blockerResolved && !blockerTriggered && rating >= 3) {
      blockerConsecutiveSuccesses++;
      if (blockerConsecutiveSuccesses >= blockerResolveThreshold) {
        blockerResolved = true;
        console.log(`│  ★ BLOCKER RESOLVED — ${blockerConsecutiveSuccesses} consecutive successes. Persona is ready to face "${activeBlocker.description}" again.`);
      }
    } else if (blockerTriggered) {
      blockerConsecutiveSuccesses = 0;
    }

    // Save journal + social context
    await api("PUT", `/api/sidequests/objectives/${obj.id}/journal`, token, {
      journalEntry: journalEntry ?? undefined,
      socialContext,
      completedActivity,
    });

    // Rate (triggers resonance + pathway detection)
    await api("POST", `/api/sidequests/${sidequestId}/rate`, token, { rating });

    // Compute resonance locally
    const resonanceInput: ResonanceInput = {
      rating,
      journalEntry,
      socialContext,
      completedActivity,
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

    console.log(`│  ${blockerTriggered ? ">> BLOCKED " : isBreakthrough ? "★★ BREAKTHROUGH " : ""}Rating: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}`);
    console.log(`│  Social: ${socialContext}`);
    if (blockerTriggered || isBreakthrough) {
      console.log(`│  Activity: ${completedActivity}`);
    }
    console.log(`│  Journal: ${journalEntry ? `"${journalEntry.slice(0, 80)}${journalEntry.length > 80 ? "..." : ""}"` : "(none)"}`);
    console.log(`│  Resonance: ${resonance.score.toFixed(3)} (rate=${resonance.components.ratingSignal.toFixed(2)} journal=${resonance.components.journalDepth.toFixed(2)} social=${resonance.components.socialEscalation.toFixed(2)} speed=${resonance.components.speedSignal.toFixed(2)} diff=${resonance.components.difficultyAlignment.toFixed(2)})`);
    console.log(`│  Comfort radius: ${comfortRadius.toFixed?.(1) ?? "?"} mi`);

    // ── Pathway inspection ────────────────────────────────
    const pathwayRes = await api("GET", "/api/users/me/pathways", token);
    if (pathwayRes.data?.pathways) {
      const pw = pathwayRes.data;
      console.log(`│`);
      console.log(`│  Pathways (phase: ${pw.globalPhase}):`);
      for (const p of pw.pathways.slice(0, 5)) {
        const bar = "▓".repeat(Math.round(p.avgResonance * 10));
        console.log(`│    ${p.themeLabel.padEnd(16)} ${p.phase.padEnd(10)} res=${bar.padEnd(10)} quests=${p.questCount}`);
      }
      pathwaySnapshots.push({
        questIndex: i,
        globalPhase: pw.globalPhase,
        pathways: pw.pathways.map((p: any) => ({
          theme: p.theme,
          themeLabel: p.themeLabel,
          phase: p.phase,
          avgResonance: p.avgResonance,
          questCount: p.questCount,
        })),
      });
    }

    // ── Goal pacing / milestone check ─────────────────────
    if (persona?.targetDate || !skipProfile) {
      const pacingRes = await api("GET", "/api/sidequests/goal-pacing", token);
      if (pacingRes.data?.hasTimeline) {
        const p = pacingRes.data;
        console.log(`│  Timeline: ${p.percentElapsed}% elapsed, ${p.remainingDays}d remaining, milestone: ${p.milestone ?? "none"}`);

        // Check if a milestone transition happened
        if (p.milestone && p.milestone !== lastMilestone) {
          console.log(`│  ★ NEW MILESTONE: ${p.milestone}`);

          // Check if goal check-in is due
          const checkInRes = await api("GET", "/api/sidequests/goal-check-in", token);
          if (checkInRes.data?.isDue) {
            console.log(`│  Goal check-in due! Prompt: "${(checkInRes.data.journalPrompt ?? "").slice(0, 60)}..."`);

            // Generate and save a goal reflection
            let reflectionJournal = `Reflecting on my progress at the ${p.milestone} milestone. I've completed ${p.completedQuestCount ?? i + 1} quests so far.`;
            if (persona && process.env.OPENAI_API_KEY) {
              const llmReflection = await llmComplete(
                `You are "${persona.name}" pursuing: "${persona.primaryGoal}". You've completed ${i + 1} quests. You're at the "${p.milestone}" milestone (${p.percentElapsed}% of your timeline elapsed, ${p.remainingDays} days left). Write a 2-3 sentence goal reflection.`,
                checkInRes.data.journalPrompt ?? `Reflect on your progress so far. How are you feeling about your goal?`,
                150,
              );
              if (llmReflection) reflectionJournal = llmReflection;
            }

            const reflRes = await api("POST", "/api/sidequests/goal-reflection", token, {
              milestone: p.milestone,
              journalEntry: reflectionJournal,
              journalPrompt: checkInRes.data.journalPrompt ?? undefined,
              percentElapsed: p.percentElapsed,
              remainingDays: p.remainingDays,
              completedQuestCount: p.completedQuestCount ?? i + 1,
            });

            const saved = reflRes.status === 200 || reflRes.status === 201;
            console.log(`│  Goal reflection ${saved ? "saved" : "failed"}: "${reflectionJournal.slice(0, 60)}..."`);

            milestoneEvents.push({
              questIndex: i,
              milestone: p.milestone,
              percentElapsed: p.percentElapsed,
              remainingDays: p.remainingDays,
              reflectionSaved: saved,
            });
          }

          lastMilestone = p.milestone;
        }
      }
    }

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
      blockerTriggered,
      isBreakthrough,
      questType: quest.questType ?? "venue",
      questRole: quest.questRole ?? null,
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

  // Blocker stats
  const blockerCount = journey.filter((j) => j.blockerTriggered).length;
  if (activeBlocker) {
    const nonBlockerCount = journey.length - blockerCount;
    const blockerAvgRating = blockerCount > 0
      ? journey.filter((j) => j.blockerTriggered).reduce((s, j) => s + j.rating, 0) / blockerCount
      : 0;
    const normalAvgRating = nonBlockerCount > 0
      ? journey.filter((j) => !j.blockerTriggered).reduce((s, j) => s + j.rating, 0) / nonBlockerCount
      : 0;
    console.log(`\n  Blocker Analysis: "${activeBlocker.description}"`);
    const breakthroughCount = journey.filter((j) => j.isBreakthrough).length;
    console.log(`    Quests triggered: ${blockerCount}/${journey.length} (${((blockerCount / journey.length) * 100).toFixed(0)}%)`);
    console.log(`    Avg rating (blocked): ${blockerAvgRating.toFixed(1)} vs normal: ${normalAvgRating.toFixed(1)}`);
    console.log(`    Blocker active from quest ${activeBlocker.activateAfterQuest + 1} onward`);
    if (blockerResolvedAtQuest != null) {
      console.log(`    Breakthrough at quest ${blockerResolvedAtQuest + 1} (after ${blockerResolveThreshold} consecutive successes)`);
    } else if (blockerResolved) {
      console.log(`    Blocker resolved (${blockerConsecutiveSuccesses} successes) but no matching quest came up for breakthrough`);
    } else {
      console.log(`    Blocker NOT resolved (${blockerConsecutiveSuccesses}/${blockerResolveThreshold} consecutive successes)`);
    }
  }

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

  // Quest Type/Role distribution
  const typeCounts: Record<string, number> = {};
  const roleCounts: Record<string, number> = {};
  for (const j of journey) {
    typeCounts[j.questType] = (typeCounts[j.questType] ?? 0) + 1;
    const role = j.questRole ?? "unassigned";
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
  }
  console.log(`\n  Quest Type Distribution:`);
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(14)} ${"█".repeat(count)} ${count}`);
  }
  console.log(`\n  Quest Role Distribution:`);
  for (const [role, count] of Object.entries(roleCounts).sort((a, b) => b[1] - a[1])) {
    const marker = role === "enjoy" ? " ★" : "";
    console.log(`    ${role.padEnd(14)} ${"█".repeat(count)} ${count}${marker}`);
  }
  const enjoyCount = roleCounts["enjoy"] ?? 0;
  if (enjoyCount > 0) {
    console.log(`    → Enjoy quests appeared! (${enjoyCount}/${journey.length})`);
  } else if (journey.length >= 8) {
    console.log(`    → No enjoy quests appeared despite ${journey.length} quests (may need thriving pathway)`);
  }

  // Pathway progression
  if (pathwaySnapshots.length > 0) {
    console.log(`\n  Pathway Progression:`);
    const first = pathwaySnapshots[0];
    const last = pathwaySnapshots[pathwaySnapshots.length - 1];
    console.log(`    Global phase: ${first.globalPhase} → ${last.globalPhase}`);
    console.log(`    Pathways at end:`);
    for (const p of last.pathways) {
      const firstMatch = first.pathways.find((fp) => fp.theme === p.theme);
      const delta = firstMatch ? p.avgResonance - firstMatch.avgResonance : 0;
      const deltaStr = delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(3)})` : "";
      console.log(`      ${p.themeLabel.padEnd(16)} ${p.phase.padEnd(10)} res=${p.avgResonance.toFixed(3)}${deltaStr}  quests=${p.questCount}`);
    }
  }

  // Milestone timeline
  if (milestoneEvents.length > 0) {
    console.log(`\n  Milestone Timeline:`);
    for (const m of milestoneEvents) {
      console.log(`    Quest ${m.questIndex + 1}: ${m.milestone} (${m.percentElapsed}% elapsed, ${m.remainingDays}d left) ${m.reflectionSaved ? "— reflection saved" : "— reflection failed"}`);
    }
  } else if (persona?.targetDate) {
    console.log(`\n  Milestone Timeline: No milestones triggered (target date may be too far out for ${questCount} quests)`);
  }

  // Journey timeline
  console.log(`\n  Journey Timeline:${activeBlocker ? "  (BLK = blocker triggered)" : ""}`);
  console.log(`  ${"#".padEnd(4)} ${activeBlocker ? "BLK " : ""}${"Role".padEnd(10)} ${"Category".padEnd(14)} ${"Venue".padEnd(28)} ${"Diff".padEnd(5)} ${"Rate".padEnd(5)} ${"Resonance".padEnd(10)} ${"Social".padEnd(18)} Hook`);
  console.log(`  ${"─".repeat(activeBlocker ? 144 : 140)}`);
  for (const j of journey) {
    const resonanceBar = "▓".repeat(Math.round(j.resonance * 10)).padEnd(10);
    const venue = j.venueName.length > 26 ? j.venueName.slice(0, 25) + "…" : j.venueName;
    const hook = j.hook.length > 60 ? j.hook.slice(0, 59) + "…" : j.hook;
    const role = (j.questRole ?? "—").slice(0, 8);
    const blk = activeBlocker ? (j.blockerTriggered ? " >> " : j.isBreakthrough ? " ★★ " : "    ") : "";
    console.log(
      `  ${String(j.index).padEnd(4)}${blk}${role.padEnd(10)} ${j.venueCategory.padEnd(14)} ${venue.padEnd(28)} ${String(j.difficulty).padEnd(5)} ${String(j.rating).padEnd(5)} ${resonanceBar} ${j.socialContext.padEnd(18)} ${hook}`,
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
