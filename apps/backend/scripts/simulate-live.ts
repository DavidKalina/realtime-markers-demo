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

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeResonance, type ResonanceInput, type ResonanceResult } from "../services/ResonanceService";
import { DEFAULT_QUEST_CONFIG } from "../services/shared/QuestConfig";

const scriptDirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirname, "../../../.env") });
dotenv.config();

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
  capacityTrack: string | null;
  repIntent: string | null;
  predictedAnxiety: number | null;
  predictedDifficulty: number | null;
  actualAnxiety: number | null;
  actualDifficulty: number | null;
  actionability: string | null;
  blockerTriggered: boolean;
  isBreakthrough: boolean;
  questType: string;
  questRole: string | null;
  wouldReturn: boolean | null;
  /** Rejection reasons the persona fired before accepting a prescription for this slot. */
  rejections: RejectionReason[];
}

type RejectionReason =
  | "TOO_SOCIAL"
  | "TOO_FAR"
  | "TOO_PUBLIC"
  | "TOO_MUCH_EFFORT"
  | "NOT_MY_VIBE"
  | "BAD_TIMING"
  | "NEED_GENTLER";

const REJECTION_REASONS: readonly RejectionReason[] = [
  "TOO_SOCIAL",
  "TOO_FAR",
  "TOO_PUBLIC",
  "TOO_MUCH_EFFORT",
  "NOT_MY_VIBE",
  "BAD_TIMING",
  "NEED_GENTLER",
] as const;

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
  goalKey?: string;
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
}

const PERSONAS: Record<string, LivePersona> = {
  "shy-sarah": {
    name: "Shy Sarah",
    primaryGoal: "Overcome social anxiety and feel comfortable going out alone",
    goalKey: "stop_homebody",
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
    goalKey: "find_people",
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
    goalKey: "stop_homebody",
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
    goalKey: "find_people",
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
    goalKey: "find_people",
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
  "mover-mike": {
    name: "Mover Mike",
    primaryGoal: "Move out of my parents' house and into my own place in Denver",
    goalKey: "from_scratch",
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
  },
  "wallflower-wendy": {
    name: "Wallflower Wendy",
    primaryGoal: "Build a real social circle and feel comfortable at meetups and group events",
    goalKey: "build_friends",
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
  "dating-dylan": {
    name: "Dating Dylan",
    primaryGoal: "Start dating again and feel comfortable asking someone out",
    goalKey: "start_dating",
    pace: "steady",
    goals: ["I want to feel confident meeting people and going on low-pressure dates"],
    goalTags: ["socialize"],
    barriers: "Overthinks attraction, afraid of rejection, feels like he has no interesting life to invite someone into",
    comfortZone: "Swipes on dating apps at home but rarely sends messages. Goes to the gym and coffee shops alone, but avoids showing romantic interest.",
    activities: ["Coffee", "Food", "Art", "Music", "Board games", "Fitness", "Brunch"],
    vibes: ["Meet people", "Explore my area", "Pick up a new skill"],
    homeLatitude: 40.0986,
    homeLongitude: -104.9719,
    ratingBias: 0.57,
    journalProbability: 0.75,
    socialEscalationRate: 0.12,
    blocker: {
      description: "expressing romantic interest or asking someone on a date",
      avoidanceActivity: "Kept it friendly and left without expressing interest or making a plan.",
      activateAfterQuest: 5,
      resolveAfterSuccesses: 4,
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
const ENABLE_GOAL_TIMELINE_PROBE = process.env.ENABLE_SIM_GOAL_TIMELINE_PROBE === "true";

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
  let skipProgressive = false;
  let abandonmentProb = 0.18;
  let promoteProb = 0.3;
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
      case "--skip-progressive": skipProgressive = true; break;
      case "--abandon": abandonmentProb = Math.max(0, Math.min(1, parseFloat(args[++i]))); break;
      case "--promote-prob": promoteProb = Math.max(0, Math.min(1, parseFloat(args[++i]))); break;
      case "--help":
        console.log(`
Live Sidequest Simulator — Real LLM prescriptions via backend API

Usage: npx tsx apps/backend/scripts/simulate-live.ts [options]

Options:
  --email <email>        User email (default: user@example.com)
  --password <pass>      User password (default: user123)
  --persona <name>       Hardcoded persona (shy-sarah, adventurous-alex, routine-rick, comedian-carl, fitness-fiona, mover-mike, wallflower-wendy, dating-dylan)
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
  --skip-progressive     Front-load all onboarding (disables phased onboarding across quests)
  --abandon <0-1>        Abandonment probability after /activate (default: 0.18). 0 disables.
  --promote-prob <0-1>   Probability of "Seal Memory" promote on ratings >= 4 (default: 0.3)

Examples:
  npx tsx apps/backend/scripts/simulate-live.ts --goal "become a stand-up comedian" --quests 10
  npx tsx apps/backend/scripts/simulate-live.ts --persona wallflower-wendy --quests 12
  npx tsx apps/backend/scripts/simulate-live.ts --persona dating-dylan --quests 30
  npx tsx apps/backend/scripts/simulate-live.ts --goal "become a salesman" --blocker "making phone calls" --quests 10
  npx tsx apps/backend/scripts/simulate-live.ts --persona shy-sarah --blocker "talking to strangers" --quests 8
  npx tsx apps/backend/scripts/simulate-live.ts --persona adventurous-alex --challenge-mix 3 --quests 12

Estimated cost: ~$0.02-0.05 per quest (GPT-5.4-nano + Google Places)
`);
        process.exit(0);
    }
  }

  return { email, password, personaKey, goal, questCount, seed, dryRun, skipProfile, skipFearLadder, model, strategy, ratingBiasOverride, blockerOverride, challengeMix, skipProgressive, abandonmentProb, promoteProb };
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
  console.log(`  Pace: ${persona.pace}`);
  console.log(`  Barriers: ${persona.barriers}`);
  console.log(`  Comfort Zone: ${persona.comfortZone}`);
  console.log(`  Activities: ${persona.activities.join(", ")}`);
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
 * Returns a record of scenario ID → rating (1-10).
 */
async function rateFearLadderAsPersona(
  persona: LivePersona,
  scenarios: { id: string; text: string; dimension: string }[],
  rand: () => number,
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
      fallback[s.id] = Math.max(1, Math.min(10, Math.round(baseRating + (rand() - 0.5) * 4)));
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
  pastPredictions?: { predicted: number; actual: number; title: string }[],
): Promise<{ anxiety: number; difficulty: number; outcome: string } | null> {
  // Build calibration feedback from past predictions
  let calibrationBlock = "";
  if (pastPredictions && pastPredictions.length >= 2) {
    const avgDelta = pastPredictions.reduce((sum, p) => sum + (p.predicted - p.actual), 0) / pastPredictions.length;
    const recent3 = pastPredictions.slice(-3);
    const examples = recent3.map(p =>
      `  - "${p.title}": predicted ${p.predicted}/5 anxiety, actual anxiety felt like ${p.actual.toFixed(1)}/5 (off by ${p.predicted - p.actual > 0 ? "+" : ""}${(p.predicted - p.actual).toFixed(1)})`
    ).join("\n");

    if (avgDelta > 1.0) {
      calibrationBlock = `\nIMPORTANT — Your past predictions have been TOO HIGH:
${examples}
  On average, you overestimate anxiety by ${avgDelta.toFixed(1)} points. Things have consistently gone BETTER than you expected.
  Factor this into your prediction — your gut says higher, but your track record says lower. Try to be more realistic this time.\n`;
    } else if (avgDelta < -0.5) {
      calibrationBlock = `\nNote — Your past predictions have been slightly low:
${examples}
  Things have been a bit harder than expected. Factor this in.\n`;
    }
  }

  const result = await llmJson(
    `You are roleplaying as a person with this profile:
- Goal: ${persona.primaryGoal}
- Barriers: ${persona.barriers}
- Fear score: ${fearScore.toFixed(2)}/1.0 (higher = more anxious)
- Pace: ${persona.pace}
- This is quest #${questIndex + 1} in their journey.
${calibrationBlock}
Before going on a quest, predict how you think it will go. Be honest and in-character.`,
    `You're about to go on this quest:
- Title: "${questTitle}"
- Venue: ${venueName} (${venueCategory})
- Hook: ${hook}
- Assigned difficulty: ${difficulty}/10

Respond with JSON:
{
  "anxiety": <1-5 integer, how anxious you feel about this: 1=calm, 5=very anxious>,
  "difficulty": <1-5 integer, how hard you think it will be: 1=easy, 5=very hard>,
  "outcome": "<1-2 sentences predicting what will happen>"
}`,
    200,
  );

  if (!result) return null;

  return {
    anxiety: typeof result.anxiety === "number" ? Math.max(1, Math.min(5, Math.round(result.anxiety))) : 3,
    difficulty: typeof result.difficulty === "number" ? Math.max(1, Math.min(5, Math.round(result.difficulty))) : 3,
    outcome: typeof result.outcome === "string" ? result.outcome.slice(0, 500) : "Not sure what to expect.",
  };
}

/**
 * Decide in-character whether the persona rejects a prescription, and with
 * what reason. Returns null to accept. Exercises the calibration loop:
 * /reject → backend clamps the next brief → new prescription should address
 * the dimension the persona flagged.
 *
 * Calibration is a property we want to regression-test — if "Shy Sarah"
 * gets a crowded meetup on quest 2 and the strategist keeps sending
 * social-heavy prescriptions after she rejects TOO_SOCIAL, that's a
 * product failure, not a prompt tuning issue.
 */
async function decideRejection(
  persona: LivePersona | undefined,
  quest: {
    title?: string;
    distanceFromHome?: number | string;
    capacityTrack?: string;
    repIntent?: string;
    objectives?: { venueName?: string; venueCategory?: string; difficulty?: number; hook?: string; description?: string }[];
  },
  fearScore: number,
  questIndex: number,
  attemptNumber: number,
  rand: () => number,
): Promise<RejectionReason | null> {
  if (!persona) return null;

  if (!process.env.OPENAI_API_KEY) {
    return ruleBasedRejection(persona, quest, fearScore, attemptNumber, rand);
  }

  const obj = quest.objectives?.[0] ?? {};
  const attemptNote =
    attemptNumber > 0
      ? ` (you've already rejected ${attemptNumber} prescription${attemptNumber === 1 ? "" : "s"} for this slot; on recalibration #${attemptNumber + 1})`
      : "";

  const result = await llmJson(
    `You are roleplaying as "${persona.name}":
- Goal: ${persona.primaryGoal}
- Barriers: ${persona.barriers}
- Current comfort zone: ${persona.comfortZone}
- Fear score: ${fearScore.toFixed(2)}/1.0 (higher = more anxious)
- Pace preference: ${persona.pace}
- This is quest #${questIndex + 1} in your journey${attemptNote}.

You just saw a prescription. Decide in-character whether to ACCEPT it or reject with a specific reason. A thoughtful person rejects rarely — roughly 15-25% of the time — so lean toward ACCEPT unless something really doesn't fit. Use a gentle pace + high fear score as a signal to reject more.

Rejection reasons (pick the most honest one if you reject):
- TOO_SOCIAL — social challenge level is higher than you can handle today
- TOO_FAR — distance feels too far right now
- TOO_PUBLIC — venue would feel too exposed / too busy
- TOO_MUCH_EFFORT — logistics too heavy (planning, gear, signups, new-user forms)
- NOT_MY_VIBE — category / activity just isn't what you want
- BAD_TIMING — suggested time-of-day doesn't fit your life
- NEED_GENTLER — the whole thing feels like too big a step regardless of which dimension

Be consistent with yourself: if you already rejected this slot once, the recalibrated version should probably be acceptable unless it genuinely failed to adjust.`,
    `The prescription:
- Title: "${quest.title ?? "(untitled)"}"
- Venue: ${obj.venueName ?? "?"} (${obj.venueCategory ?? "?"})
- Capacity rep: ${quest.capacityTrack ?? "?"} — ${quest.repIntent ?? "?"}
- Difficulty: ${obj.difficulty ?? "?"}/10
- Distance from home: ${quest.distanceFromHome != null ? Number(quest.distanceFromHome).toFixed(1) + " mi" : "?"}
- Hook: ${obj.hook ?? "?"}
- Description: ${(obj.description ?? "").slice(0, 240)}

Respond with JSON:
{
  "decision": "ACCEPT" | "TOO_SOCIAL" | "TOO_FAR" | "TOO_PUBLIC" | "TOO_MUCH_EFFORT" | "NOT_MY_VIBE" | "BAD_TIMING" | "NEED_GENTLER",
  "reason": "<one short sentence, in-character, why>"
}`,
    180,
  );

  const decision = typeof result?.decision === "string" ? result.decision.toUpperCase() : "ACCEPT";
  if (decision === "ACCEPT") return null;
  if ((REJECTION_REASONS as readonly string[]).includes(decision)) {
    if (typeof result?.reason === "string") {
      console.log(`│  Rejection reason: "${result.reason}"`);
    }
    return decision as RejectionReason;
  }
  return null;
}

function ruleBasedRejection(
  persona: LivePersona,
  quest: { distanceFromHome?: number | string; objectives?: { difficulty?: number; venueCategory?: string; hook?: string }[] },
  fearScore: number,
  attemptNumber: number,
  rand: () => number,
): RejectionReason | null {
  // Higher rejection rate for gentle/anxious personas, lower for push_me.
  // After one rejection the next prescription should be easier — drop rate so we don't spin.
  const baseRate =
    persona.pace === "gentle" ? 0.28 : persona.pace === "push_me" ? 0.08 : 0.15;
  const rate = baseRate * (attemptNumber === 0 ? 1 : 0.4);
  if (rand() > rate) return null;

  const obj = quest.objectives?.[0] ?? {};
  const difficulty = obj.difficulty ?? 3;
  const distance = quest.distanceFromHome != null ? Number(quest.distanceFromHome) : 0;
  const hook = (obj.hook ?? "").toLowerCase();
  const socialHeavy = /social|group|meetup|class|strangers|crowd|people/.test(hook);

  if (fearScore > 0.6 && socialHeavy) return "TOO_SOCIAL";
  if (distance > 6) return "TOO_FAR";
  if (persona.pace === "gentle" && difficulty > 5) return "NEED_GENTLER";
  if (difficulty > 7) return "TOO_MUCH_EFFORT";
  return "NOT_MY_VIBE";
}

// ── Synthetic data generators ────────────────────────────────

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function difficultyToPredictionScale(difficulty: number | null | undefined): number {
  const clamped = clampNumber(difficulty ?? 5, 1, 10);
  return 1 + ((clamped - 1) / 9) * 4;
}

function estimateActualAnxiety(
  rating: number,
  difficulty: number | null | undefined,
  socialContext: string,
  blockerTriggered: boolean,
): number {
  const difficultySignal = difficultyToPredictionScale(difficulty);
  const ratingSignal = 6 - clampNumber(rating, 1, 5);
  const socialSignal =
    socialContext === "group_activity" ? 4 :
    socialContext === "met_someone_new" ? 3 :
    socialContext === "with_someone" ? 2 :
    1;
  const blockerBump = blockerTriggered ? 1.1 : 0;
  return clampNumber(
    difficultySignal * 0.35 + ratingSignal * 0.45 + socialSignal * 0.12 + blockerBump,
    1,
    5,
  );
}

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
  const { email, password, personaKey, goal, questCount, seed, dryRun, skipProfile, skipFearLadder, model: simModel, strategy: simStrategy, ratingBiasOverride, blockerOverride, challengeMix, skipProgressive, abandonmentProb, promoteProb } = parseArgs();
  const progressiveOnboarding = !skipProgressive && !skipProfile;

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
  const rand = mulberry32(seed);

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
  console.log(`  Est cost: $${(questCount * 0.035).toFixed(2)}`);
  console.log();

  // 1. Login
  console.log("Logging in...");
  const token = await login(email, password);
  console.log("  Authenticated.");

  let simFearScore = 0.5;
  let generatedScenarios: { id: string; text: string; dimension: string }[] | null = null;
  let generatedDimensions: string[] | null = null;
  let pendingFearLadder: {
    overallScore: number;
    dimensionScores: Record<string, number>;
    responses: Record<string, number>;
    scenarios: { id: string; text: string; dimension: string }[];
    dimensions: string[];
    derivedPace: string;
  } | null = null;

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
        const ratings = await rateFearLadderAsPersona(persona, generatedScenarios!, rand);

        console.log("  Ratings:");
        for (const s of generatedScenarios!) {
          const r = ratings[s.id] ?? 3;
          const label = r <= 2 ? "Not scary" : r <= 4 ? "A little" : r <= 6 ? "Moderate" : r <= 8 ? "Scary" : "Terrifying";
          console.log(`    ${s.text.padEnd(55)} ${r}/10 (${label})`);
        }

        // 5. Score locally (simFearScore drives rating/journal/social biases).
        const scored = scoreFearLadder(ratings, generatedScenarios!, generatedDimensions!);
        simFearScore = scored.overallScore;

        console.log(`  Overall fear score: ${scored.overallScore.toFixed(3)}`);
        console.log(`  Derived pace: ${scored.derivedPace}`);
        console.log(`  Dimension scores: ${Object.entries(scored.dimensionScores).map(([d, s]) => `${d}=${s.toFixed(2)}`).join(", ")}`);

        pendingFearLadder = {
          overallScore: scored.overallScore,
          dimensionScores: scored.dimensionScores,
          responses: ratings,
          scenarios: generatedScenarios!,
          dimensions: generatedDimensions!,
          derivedPace: scored.derivedPace,
        };

        // Phase 0: comfort profile without fear ladder (progressive) OR with fear ladder (legacy).
        await api("PUT", "/api/sidequests/comfort-profile", token, {
          pacePreference: scored.derivedPace,
          comfortProfile: {
            comfortZone: persona.comfortZone,
            barriers: persona.barriers,
            goals: persona.goals[0],
            goalKey: persona.goalKey,
            goalTags: persona.goalTags,
            primaryGoal: persona.primaryGoal,
          },
          ...(progressiveOnboarding
            ? { onboardingPhase: 0 }
            : {
                fearLadder: {
                  overallScore: scored.overallScore,
                  dimensionScores: scored.dimensionScores,
                  responses: ratings,
                  scenarios: generatedScenarios,
                  dimensions: generatedDimensions,
                },
              }),
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
            goalKey: persona.goalKey,
            goalTags: persona.goalTags,
            primaryGoal: persona.primaryGoal,
          },
          ...(progressiveOnboarding && { onboardingPhase: 0 }),
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
          primaryGoal: persona.primaryGoal,
        },
        ...(progressiveOnboarding && { onboardingPhase: 0 }),
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
  let currentSocialLevel = 0;
  const previousSocialContexts: string[] = [];
  const journey: JourneyEntry[] = [];
  const pathwaySnapshots: PathwaySnapshot[] = [];
  const milestoneEvents: MilestoneEvent[] = [];
  const seenSidequestIds = new Set<string>();
  let lastMilestone: string | null = null;
  let blockerConsecutiveSuccesses = 0;
  let blockerResolved = false;
  let blockerResolvedAtQuest: number | null = null;
  const blockerResolveThreshold = activeBlocker?.resolveAfterSuccesses ?? 3;

  // Tick-based flow state: rating is deferred to a future tick so the sim
  // exercises the same /unrated → /rate path the UI's "pending reflection"
  // card drives. `tick` advances once per outer-loop iteration.
  let tick = 0;
  let completedCount = 0;
  let attempts = 0;
  let abandonmentCount = 0;
  let abandonedSlotsWithRejections = 0;
  let promoteCount = 0;
  let batchDeleteCount = 0;
  let locationSpoofCount = 0;
  let currentOnboardingPhase = progressiveOnboarding ? 0 : 3;
  const maxAttempts = Math.max(questCount + 3, Math.ceil(questCount * 1.4));
  const allRejections: RejectionReason[] = [];

  interface PendingRate {
    scheduledRateTick: number;
    completeTick: number;
    completionIndex: number;
    attemptIndex: number;
    sidequestId: string;
    quest: any;
    obj: any;
    rating: number;
    journalEntry: string | null;
    socialContext: string;
    completedActivity: string;
    wouldReturn: boolean | undefined;
    predictedAnxiety: number | null;
    predictedDifficulty: number | null;
    blockerTriggered: boolean;
    isBreakthrough: boolean;
    rejections: RejectionReason[];
  }
  const pendingRates: PendingRate[] = [];

  // Processes a deferred rate: hits /rate, fetches pathways/pacing, pushes
  // to journey. Mirrors the post-completion block that used to run inline.
  const processRate = async (pr: PendingRate, nowTick: number): Promise<void> => {
    const { sidequestId, quest, obj, rating, journalEntry, socialContext, completedActivity, wouldReturn, predictedAnxiety, predictedDifficulty, blockerTriggered, isBreakthrough, rejections, completionIndex } = pr;

    const rateRes = await api("POST", `/api/sidequests/${sidequestId}/rate`, token, { rating });
    if (rateRes.status < 200 || rateRes.status >= 300) {
      console.log(`│  ⚠ Rating save failed (${rateRes.status}): ${JSON.stringify(rateRes.data)}`);
    }

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
      completedVersion: null,
    };
    const resonance = computeResonance(resonanceInput, DEFAULT_QUEST_CONFIG);

    if (socialContext) previousSocialContexts.push(socialContext);

    const czRes = await api("GET", "/api/sidequests/comfort-zone", token);
    const comfortRadius = czRes.data?.comfortRadiusMiles ?? 0;
    const actualDifficulty = difficultyToPredictionScale(obj.difficulty ?? null);
    const actualAnxiety = estimateActualAnxiety(
      rating,
      obj.difficulty ?? null,
      socialContext,
      blockerTriggered,
    );

    console.log(`│  [rate tick ${nowTick}, completed ${completeTickLabel(pr)}] ${blockerTriggered ? ">> BLOCKED " : isBreakthrough ? "★★ BREAKTHROUGH " : ""}Rating: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}`);
    console.log(`│  Social: ${socialContext}`);
    if (blockerTriggered || isBreakthrough) {
      console.log(`│  Activity: ${completedActivity}`);
    }
    console.log(`│  Journal: ${journalEntry ? `"${journalEntry.slice(0, 80)}${journalEntry.length > 80 ? "..." : ""}"` : "(none)"}`);
    if (wouldReturn !== undefined) {
      console.log(`│  Would return: ${wouldReturn ? "✅ yes" : "❌ no"}`);
    }
    console.log(`│  Resonance: ${resonance.score.toFixed(3)} (rate=${resonance.components.ratingSignal.toFixed(2)} journal=${resonance.components.journalDepth.toFixed(2)} social=${resonance.components.socialEscalation.toFixed(2)} speed=${resonance.components.speedSignal.toFixed(2)} diff=${resonance.components.difficultyAlignment.toFixed(2)})`);
    console.log(`│  Comfort radius: ${comfortRadius.toFixed?.(1) ?? "?"} mi`);

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
        questIndex: completionIndex,
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

    if (!skipProfile && ENABLE_GOAL_TIMELINE_PROBE) {
      const pacingRes = await api("GET", "/api/sidequests/goal-pacing", token);
      if (pacingRes.data?.hasTimeline) {
        const p = pacingRes.data;
        console.log(`│  Timeline: ${p.percentElapsed}% elapsed, ${p.remainingDays}d remaining, milestone: ${p.milestone ?? "none"}`);

        if (p.milestone && p.milestone !== lastMilestone) {
          console.log(`│  ★ NEW MILESTONE: ${p.milestone}`);

          const checkInRes = await api("GET", "/api/sidequests/goal-check-in", token);
          if (checkInRes.data?.isDue) {
            console.log(`│  Goal check-in due! Prompt: "${(checkInRes.data.journalPrompt ?? "").slice(0, 60)}..."`);

            let reflectionJournal = `Reflecting on my progress at the ${p.milestone} milestone. I've completed ${p.completedQuestCount ?? completionIndex + 1} quests so far.`;
            if (persona && process.env.OPENAI_API_KEY) {
              const llmReflection = await llmComplete(
                `You are "${persona.name}" pursuing: "${persona.primaryGoal}". You've completed ${completionIndex + 1} quests. You're at the "${p.milestone}" milestone (${p.percentElapsed}% of your timeline elapsed, ${p.remainingDays} days left). Write a 2-3 sentence goal reflection.`,
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
              completedQuestCount: p.completedQuestCount ?? completionIndex + 1,
            });

            const saved = reflRes.status === 200 || reflRes.status === 201;
            console.log(`│  Goal reflection ${saved ? "saved" : "failed"}: "${reflectionJournal.slice(0, 60)}..."`);

            milestoneEvents.push({
              questIndex: completionIndex,
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

    journey.push({
      index: completionIndex,
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
      capacityTrack: quest.capacityTrack ?? null,
      repIntent: quest.repIntent ?? null,
      predictedAnxiety,
      predictedDifficulty,
      actualAnxiety,
      actualDifficulty,
      actionability: obj.actionability ?? null,
      blockerTriggered,
      isBreakthrough,
      questType: quest.questType ?? "venue",
      questRole: quest.questRole ?? null,
      wouldReturn: wouldReturn ?? null,
      rejections,
    });

    if (predictedAnxiety != null) {
      predictionHistory.push({
        predicted: predictedAnxiety,
        actual: actualAnxiety,
        title: quest.title ?? "",
      });
    }

    // Promote ("Seal Memory") on well-rated quests — mirrors /app/deck.tsx.
    const isVenueQ = (quest.questType ?? "venue") === "venue";
    if (isVenueQ && rating >= 4 && rand() < promoteProb) {
      const promoRes = await api("POST", `/api/sidequests/${sidequestId}/promote`, token);
      if (promoRes.status === 200) {
        promoteCount++;
        console.log(`│  ★ Sealed Memory (promoted)`);
      }
    }

    // Periodic deck cleanup — mirrors batch-delete from /app/itineraries.
    if (journey.length > 0 && journey.length % 5 === 0) {
      const completedRes = await api("GET", "/api/sidequests/completed?limit=25", token);
      const completedList: any[] = completedRes.data?.data ?? [];
      const lowRated = completedList
        .filter((s: any) => typeof s.rating === "number" && s.rating <= 2)
        .slice(0, 2)
        .map((s: any) => s.id);
      if (lowRated.length > 0) {
        const delRes = await api("POST", "/api/sidequests/batch-delete", token, { ids: lowRated });
        if (delRes.status === 200) {
          const n = delRes.data?.deletedCount ?? 0;
          batchDeleteCount += n;
          console.log(`│  🗑  Batch-deleted ${n} low-rated quest(s)`);
        }
      }
    }
  };

  // Advances progressive onboarding based on completedCount. Phases mirror
  // /app/progressive-onboarding.tsx: 1=social-context, 2=fear-ladder.
  const maybeAdvanceOnboarding = async (): Promise<void> => {
    if (!progressiveOnboarding || !persona) return;

    if (currentOnboardingPhase < 1 && completedCount >= 1) {
      console.log(`│  ▷ Progressive onboarding: phase 1 (social-situation)`);
      const res = await api("PUT", "/api/sidequests/comfort-profile", token, {
        socialSituation: {
          ageRange: "25-34",
          gender: "",
          timeInArea: "",
          currentSocialLife: "",
          lookingFor: [],
          workSituation: "",
          livingSituation: "",
          dailyRoutine: "work_from_home",
          transportation: "car",
          budget: "moderate",
        },
        onboardingPhase: 1,
      });
      if (res.status === 200 || res.status === 201) {
        currentOnboardingPhase = 1;
      }
    }

    if (currentOnboardingPhase < 2 && completedCount >= 2 && pendingFearLadder) {
      console.log(`│  ▷ Progressive onboarding: phase 2 (fear-ladder)`);
      const res = await api("PUT", "/api/sidequests/comfort-profile", token, {
        pacePreference: pendingFearLadder.derivedPace,
        fearLadder: {
          overallScore: pendingFearLadder.overallScore,
          dimensionScores: pendingFearLadder.dimensionScores,
          responses: pendingFearLadder.responses,
          scenarios: pendingFearLadder.scenarios,
          dimensions: pendingFearLadder.dimensions,
        },
        onboardingPhase: 2,
      });
      if (res.status === 200 || res.status === 201) {
        currentOnboardingPhase = 2;
      }
    }

    if (currentOnboardingPhase < 3 && completedCount >= 3) {
      const res = await api("PUT", "/api/sidequests/comfort-profile", token, {
        onboardingPhase: 3,
      });
      if (res.status === 200 || res.status === 201) {
        currentOnboardingPhase = 3;
      }
    }
  };

  const completeTickLabel = (pr: PendingRate): string => `t${pr.completeTick}→t${pr.scheduledRateTick}`;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Starting ${questCount}-quest simulation...`);
  console.log(`${"─".repeat(60)}\n`);

  let challengeCount = 0;
  const predictionHistory: { predicted: number; actual: number; title: string }[] = [];

  while (completedCount < questCount && attempts < maxAttempts) {
    tick++;

    // Drain any ratings that are due this tick (FIFO by scheduledRateTick).
    const dueRates = pendingRates
      .filter((p) => p.scheduledRateTick <= tick)
      .sort((a, b) => a.scheduledRateTick - b.scheduledRateTick || a.completionIndex - b.completionIndex);
    if (dueRates.length > 0) {
      for (let k = pendingRates.length - 1; k >= 0; k--) {
        if (pendingRates[k].scheduledRateTick <= tick) pendingRates.splice(k, 1);
      }
      for (const pr of dueRates) {
        await processRate(pr, tick);
      }
    }

    await maybeAdvanceOnboarding();

    // Stop starting new quests once we've queued enough.
    if (completedCount + pendingRates.length >= questCount) {
      if (pendingRates.length === 0) break;
      continue;
    }

    attempts++;
    const i = attempts - 1;
    console.log(`\n╭─ Attempt ${attempts} (completed ${completedCount}/${questCount}, tick ${tick}) ${"─".repeat(20)}`);

    // Determine quest type for this iteration
    const isChallenge = challengeMix > 0 && ((i + 1) % challengeMix === 0);
    const challengeCategories = ["social_reach", "vulnerability", "hosting", "reconnection"] as const;
    const challengeCategory = isChallenge ? challengeCategories[challengeCount % challengeCategories.length] : undefined;
    if (isChallenge) challengeCount++;

    let sidequestId: string | undefined;
    let quest: any;
    let obj: any;
    const rejectionsThisSlot: RejectionReason[] = [];
    const MAX_REJECTIONS = 2;

    console.log(`│  Prescribing ${isChallenge ? `challenge (${challengeCategory})` : "venue"} quest...`);
    const prescribeRes = await api("POST", "/api/sidequests/prescribe", token, {
      latitude: simLat,
      longitude: simLng,
      simulationBypassDailyLimit: true,
      ...(simModel && { model: simModel }),
      ...(isChallenge && { questType: "challenge", challengeCategory }),
    });

    if (prescribeRes.status !== 202) {
      console.error(`│  Prescription failed (${prescribeRes.status}): ${JSON.stringify(prescribeRes.data)}`);
      if (prescribeRes.status === 429) break;
      continue;
    }

    let jobId: string | undefined = prescribeRes.data.jobId;

    // Rejection loop — persona decides whether to accept each prescription.
    // Backend auto-enqueues a fresh prescribe_quest job on /reject and
    // hands back a new jobId. We cap retries at MAX_REJECTIONS so the sim
    // can't spin forever on a miscalibrated persona.
    let acceptFailed = false;
    for (let attempt = 0; ; attempt++) {
      if (!jobId) {
        acceptFailed = true;
        break;
      }
      let jobResult: any;
      try {
        jobResult = await pollJobCompletion(jobId, token);
        console.log();
      } catch (err: any) {
        console.error(`\n│  ${err.message}`);
        acceptFailed = true;
        break;
      }

      sidequestId = jobResult?.result?.sidequestId;
      if (!sidequestId) {
        console.error("│  No sidequest ID");
        acceptFailed = true;
        break;
      }
      if (seenSidequestIds.has(sidequestId)) {
        console.error(`│  Duplicate sidequest ID returned (${sidequestId}); skipping to avoid counting the same quest twice.`);
        acceptFailed = true;
        break;
      }

      const questRes = await api("GET", `/api/sidequests/${sidequestId}`, token);
      quest = questRes.data;
      obj = quest?.objectives?.[0];

      if (!quest || !quest.objectives?.length) {
        console.error("│  Quest has no objectives");
        acceptFailed = true;
        break;
      }

      const attemptLabel = attempt === 0 ? "" : `  (recalibration #${attempt})`;
      console.log(`│`);
      console.log(`│  "${quest.title}"${attemptLabel}`);
      console.log(`│     ${obj.venueName} — ${obj.venueCategory}`);
      console.log(`│     ${obj.venueAddress ?? "no address"}`);
      console.log(`│     Hook: ${obj.hook ?? "none"}`);
      console.log(`│     Capacity: ${quest.capacityTrack ?? "?"} — ${quest.repIntent ?? "?"}`);
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

      // Challenges don't go through the calibration loop — they don't have
      // the "too far / too social" dimensions and are meant as fixed reps.
      if (isChallenge || attempt >= MAX_REJECTIONS) break;

      const rejection = await decideRejection(persona, quest, simFearScore, i, attempt, rand);
      if (!rejection) break;

      rejectionsThisSlot.push(rejection);
      allRejections.push(rejection);
      console.log(`│  ❌ Rejected: ${rejection} (${rejectionsThisSlot.length}/${MAX_REJECTIONS + 1})`);

      const rejectRes = await api("POST", `/api/sidequests/${sidequestId}/reject`, token, {
        reason: rejection,
        latitude: simLat,
        longitude: simLng,
      });

      if (rejectRes.status !== 202 || !rejectRes.data?.jobId) {
        console.log(`│  Reject endpoint returned ${rejectRes.status}: ${JSON.stringify(rejectRes.data)} — proceeding with current prescription`);
        break;
      }

      jobId = rejectRes.data.jobId;
      console.log(`│  Waiting for recalibrated prescription...`);
    }

    if (acceptFailed || !sidequestId || !quest || !obj) continue;
    seenSidequestIds.add(sidequestId);

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
        predictionHistory,
      );

      if (prediction) {
        predictedAnxiety = prediction.anxiety;
        predictedDifficulty = prediction.difficulty;
        console.log(`│  Predicted anxiety: ${prediction.anxiety}/5`);
        console.log(`│  Predicted difficulty: ${prediction.difficulty}/5`);
        console.log(`│  Expected outcome: "${prediction.outcome.slice(0, 70)}${prediction.outcome.length > 70 ? "..." : ""}"`);

        const predictionRes = await api("PUT", `/api/sidequests/objectives/${obj.id}/prediction`, token, {
          predictedAnxiety: prediction.anxiety,
          predictedDifficulty: prediction.difficulty,
          predictedOutcome: prediction.outcome,
        });
        if (predictionRes.status < 200 || predictionRes.status >= 300) {
          console.log(`│  ⚠ Prediction save failed (${predictionRes.status}): ${JSON.stringify(predictionRes.data)}`);
        }
      }
    }

    // Activate
    const activateRes = await api("POST", `/api/sidequests/${sidequestId}/activate`, token);
    if (activateRes.status < 200 || activateRes.status >= 300) {
      console.log(`│  Activate failed (${activateRes.status}): ${JSON.stringify(activateRes.data)}`);
      console.log(`╰${"─".repeat(55)}`);
      continue;
    }

    // Abandonment check — real users drop ~15-20% of accepted quests mid-flight.
    // Deactivates the active slot and loops to prescribe a fresh one.
    // Venue quests are abandonable; challenges run fixed so we don't drop them.
    const isActualChallenge = (quest.questType ?? "venue") === "challenge";
    if (!isActualChallenge && abandonmentProb > 0 && rand() < abandonmentProb) {
      console.log(`│`);
      console.log(`│  🚪 Abandoning quest ("${quest.title}") mid-flight — calling /deactivate.`);
      const deacRes = await api("POST", "/api/sidequests/deactivate", token);
      if (deacRes.status === 200 || deacRes.status === 204) {
        abandonmentCount++;
        if (rejectionsThisSlot.length > 0) abandonedSlotsWithRejections++;
      } else {
        console.log(`│  Deactivate returned ${deacRes.status}; proceeding as if abandoned.`);
      }
      console.log(`╰${"─".repeat(55)}`);
      continue;
    }

    // Checkin (venue quests) or complete-challenge (challenge quests)
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
      const completeRes = await api("POST", `/api/sidequests/${sidequestId}/objectives/${obj.id}/complete-challenge`, token, {
        journalEntry: challengeJournal ?? `I completed the challenge. It was harder than I expected but I'm glad I pushed through. Growing.`,
        socialContext: "solo",
      });
      if (completeRes.status < 200 || completeRes.status >= 300) {
        console.log(`│  Challenge completion failed (${completeRes.status}): ${JSON.stringify(completeRes.data)}`);
        console.log(`╰${"─".repeat(55)}`);
        continue;
      }
    } else {
      // Location spoof: mirror tasks/backgroundLocationTask.ts — UI posts
      // /users/location from expo-task-manager, which triggers proximity
      // matching. Send the venue coords so the server sees the "arrival".
      const objectiveLat = Number(obj.latitude);
      const objectiveLng = Number(obj.longitude);
      const hasObjectiveLocation = obj.latitude != null && obj.longitude != null && Number.isFinite(objectiveLat) && Number.isFinite(objectiveLng);
      if (hasObjectiveLocation) {
        const spoofRes = await api("POST", "/api/users/location", token, {
          lat: objectiveLat,
          lng: objectiveLng,
        });
        if (spoofRes.status === 200) locationSpoofCount++;
        else console.log(`│  Location spoof failed (${spoofRes.status}): ${JSON.stringify(spoofRes.data)}`);
      }

      console.log(`│  Checking in...`);
      const checkinRes = await api(
        "POST",
        `/api/sidequests/${sidequestId}/objectives/${obj.id}/checkin`,
        token,
        hasObjectiveLocation ? { latitude: objectiveLat, longitude: objectiveLng } : undefined,
      );
      if (checkinRes.status < 200 || checkinRes.status >= 300) {
        console.log(`│  Check-in failed (${checkinRes.status}): ${JSON.stringify(checkinRes.data)}`);
        console.log(`╰${"─".repeat(55)}`);
        continue;
      }
    }

    // ── Blocker detection ──────────────────────────────────
    let blockerTriggered = false;
    let isBreakthrough = false;
    let questMatchesBlocker = false;
    let blockerDetectionRan = false;
    const blockerActiveForQuest = Boolean(activeBlocker && i >= activeBlocker.activateAfterQuest);
    if (activeBlocker && blockerActiveForQuest && process.env.OPENAI_API_KEY) {
      console.log(`│`);
      blockerDetectionRan = true;
      questMatchesBlocker = await questTriggersBlocker(
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
    if (activeBlocker && blockerActiveForQuest && blockerDetectionRan && !blockerResolved && !blockerTriggered && !questMatchesBlocker && rating >= 3) {
      blockerConsecutiveSuccesses++;
      if (blockerConsecutiveSuccesses >= blockerResolveThreshold) {
        blockerResolved = true;
        console.log(`│  ★ BLOCKER READINESS — ${blockerConsecutiveSuccesses} adjacent successes. Persona is ready to face "${activeBlocker.description}" again.`);
      }
    } else if (blockerTriggered) {
      blockerConsecutiveSuccesses = 0;
    }

    // Decide "would return" based on rating (only for venue quests, not blocked)
    // 4-5 stars: very likely yes, 3 stars: coin flip, 1-2 stars: no
    const isVenueQuest = (quest.questType ?? "venue") === "venue";
    let wouldReturn: boolean | undefined;
    if (isVenueQuest && !blockerTriggered) {
      if (rating >= 4) wouldReturn = rand() < 0.85;
      else if (rating === 3) wouldReturn = rand() < 0.4;
      else wouldReturn = false;
    }

    // Save journal + social context + would-return (always fires immediately;
    // rating is deferred below).
    const journalRes = await api("PUT", `/api/sidequests/objectives/${obj.id}/journal`, token, {
      journalEntry: journalEntry ?? undefined,
      socialContext,
      completedActivity,
      ...(wouldReturn !== undefined && { wouldReturn }),
    });
    if (journalRes.status < 200 || journalRes.status >= 300) {
      console.log(`│  ⚠ Journal save failed (${journalRes.status}): ${JSON.stringify(journalRes.data)}`);
    }

    // Queue the rate for a future tick. Matches the UI's PendingReflectionCard
    // — the user checks in now, rates later. 70% next-tick, 30% two-tick.
    const delayTicks = rand() < 0.7 ? 1 : 2;
    const thisCompletionIndex = completedCount;
    completedCount++;
    pendingRates.push({
      scheduledRateTick: tick + delayTicks,
      completeTick: tick,
      completionIndex: thisCompletionIndex,
      attemptIndex: i,
      sidequestId: sidequestId!,
      quest,
      obj,
      rating,
      journalEntry,
      socialContext,
      completedActivity,
      wouldReturn,
      predictedAnxiety,
      predictedDifficulty,
      blockerTriggered,
      isBreakthrough,
      rejections: rejectionsThisSlot,
    });
    console.log(`│  ⌛ Checked in on tick ${tick}; rate scheduled for tick ${tick + delayTicks}.`);
    console.log(`╰${"─".repeat(55)}`);

    // Small delay between iterations
    await new Promise((r) => setTimeout(r, 500));
  }

  // Drain any remaining deferred ratings.
  while (pendingRates.length > 0) {
    tick++;
    const due = pendingRates
      .filter((p) => p.scheduledRateTick <= tick)
      .sort((a, b) => a.scheduledRateTick - b.scheduledRateTick || a.completionIndex - b.completionIndex);
    if (due.length === 0) {
      // No ratings due yet — just advance the tick counter until the next one.
      const next = Math.min(...pendingRates.map((p) => p.scheduledRateTick));
      tick = next - 1;
      continue;
    }
    for (let k = pendingRates.length - 1; k >= 0; k--) {
      if (pendingRates[k].scheduledRateTick <= tick) pendingRates.splice(k, 1);
    }
    for (const pr of due) {
      await processRate(pr, tick);
    }
    await maybeAdvanceOnboarding();
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

  console.log(`\n  Quests: ${journey.length} completed (${attempts} attempts, ${abandonmentCount} abandoned across ${tick} ticks)`);
  console.log(`  Avg Resonance: ${avgResonance.toFixed(3)}`);
  console.log(`  Peak Resonance: ${peakResonance.toFixed(3)}`);
  console.log(`  Comfort Radius: ${journey[0]?.comfortRadius.toFixed(1) ?? "?"} mi → ${journey[journey.length - 1]?.comfortRadius.toFixed(1) ?? "?"} mi`);
  console.log(`  Sealed memories (promoted): ${promoteCount}`);
  console.log(`  Low-rated quests culled:    ${batchDeleteCount}`);
  console.log(`  Location spoofs sent:       ${locationSpoofCount}`);
  if (progressiveOnboarding) {
    console.log(`  Onboarding reached phase:   ${currentOnboardingPhase}`);
  }

  // Blocker stats
  const blockerCount = journey.filter((j) => j.blockerTriggered).length;
  if (activeBlocker) {
    const breakthroughCount = journey.filter((j) => j.isBreakthrough).length;
    const blockerMatchCount = blockerCount + breakthroughCount;
    const nonBlockerCount = journey.length - blockerCount;
    const blockerAvgRating = blockerCount > 0
      ? journey.filter((j) => j.blockerTriggered).reduce((s, j) => s + j.rating, 0) / blockerCount
      : 0;
    const normalAvgRating = nonBlockerCount > 0
      ? journey.filter((j) => !j.blockerTriggered).reduce((s, j) => s + j.rating, 0) / nonBlockerCount
      : 0;
    console.log(`\n  Blocker Analysis: "${activeBlocker.description}"`);
    console.log(`    Blocker-matching reps: ${blockerMatchCount}/${journey.length} (${((blockerMatchCount / journey.length) * 100).toFixed(0)}%)`);
    console.log(`    Setbacks: ${blockerCount}; breakthroughs: ${breakthroughCount}`);
    console.log(`    Avg rating (setbacks): ${blockerAvgRating.toFixed(1)} vs other reps: ${normalAvgRating.toFixed(1)}`);
    console.log(`    Blocker active from quest ${activeBlocker.activateAfterQuest + 1} onward`);
    if (blockerResolvedAtQuest != null) {
      console.log(`    Breakthrough at quest ${blockerResolvedAtQuest + 1} (after ${blockerResolveThreshold} consecutive successes)`);
    } else if (blockerResolved) {
      console.log(`    Blocker resolved (${blockerConsecutiveSuccesses} successes) but no matching quest came up for breakthrough`);
    } else {
      console.log(`    Blocker NOT resolved (${blockerConsecutiveSuccesses}/${blockerResolveThreshold} consecutive successes)`);
    }
  }

  // Calibration loop (rejections → recalibrated prescriptions)
  const slotsWithRejections = journey.filter((j) => j.rejections.length > 0);
  const totalRejections = allRejections.length;
  if (totalRejections > 0) {
    const reasonCounts: Record<string, number> = {};
    for (const r of allRejections) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    console.log(`\n  Calibration Loop:`);
    console.log(`    Completed slots with rejections: ${slotsWithRejections.length}/${journey.length} (${((slotsWithRejections.length / journey.length) * 100).toFixed(0)}%)`);
    if (abandonedSlotsWithRejections > 0) {
      console.log(`    Abandoned slots with rejections: ${abandonedSlotsWithRejections}/${abandonmentCount}`);
    }
    console.log(`    Total rejections: ${totalRejections}`);
    console.log(`    By reason:`);
    for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${reason.padEnd(18)} ${"█".repeat(count)} ${count}`);
    }
    // A recurring reason (3+ of the same kind) should trigger the pattern
    // detector in PrescriptionContextBuilder and clamp the next brief. Flag
    // it so you can eyeball whether the strategist actually adjusted.
    const patternReasons = Object.entries(reasonCounts).filter(([, c]) => c >= 3);
    if (patternReasons.length > 0) {
      console.log(`    ⚠ Pattern threshold hit (3+): ${patternReasons.map(([r, c]) => `${r} × ${c}`).join(", ")} — strategist should have clamped.`);
    }
  } else {
    console.log(`\n  Calibration Loop: no rejections fired across ${journey.length} quests.`);
  }

  // Expectancy calibration
  const withPredictions = journey.filter((j) => j.predictedAnxiety != null || j.predictedDifficulty != null);
  if (withPredictions.length > 0) {
    console.log(`\n  Expectancy Calibration (${withPredictions.length} quests with predictions):`);
    const anxietyDeltas = withPredictions
      .filter((j) => j.predictedAnxiety != null && j.actualAnxiety != null)
      .map((j) => j.predictedAnxiety! - j.actualAnxiety!);
    const diffDeltas = withPredictions
      .filter((j) => j.predictedDifficulty != null && j.actualDifficulty != null)
      .map((j) => j.predictedDifficulty! - j.actualDifficulty!);
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

  // Capacity track breakdown
  const capacityCounts: Record<string, number> = {};
  for (const j of journey) {
    const track = j.capacityTrack ?? "unknown";
    capacityCounts[track] = (capacityCounts[track] ?? 0) + 1;
  }
  console.log(`\n  Capacity Track Distribution:`);
  for (const [track, count] of Object.entries(capacityCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${track.padEnd(20)} ${"█".repeat(count)} ${count}`);
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

  // Case-study signals: does this look like durable life change?
  const socialIndexes = journey.map((j) => SOCIAL_LADDER.indexOf(j.socialContext));
  const firstSocial = socialIndexes.find((idx) => idx >= 0) ?? 0;
  const peakSocial = socialIndexes.length > 0 ? Math.max(...socialIndexes) : 0;
  const nonSoloCount = journey.filter((j) => j.socialContext !== "solo").length;
  const wouldReturnCount = journey.filter((j) => j.wouldReturn === true).length;
  const firstDeepenIndex = journey.findIndex((j) => j.questRole === "deepen");
  const firstDfsSnapshot = pathwaySnapshots.find((s) => s.pathways.some((p) => p.phase === "dfs"));
  const lastSnapshot = pathwaySnapshots[pathwaySnapshots.length - 1];
  const anchorCount = lastSnapshot
    ? lastSnapshot.pathways.filter((p) => p.phase === "dfs" || p.questCount >= 3).length
    : 0;

  console.log(`\n  Case Study Signals:`);
  console.log(`    Anchors at end:       ${anchorCount} (${lastSnapshot?.globalPhase ?? "no pathways"})`);
  console.log(`    First DFS signal:     ${firstDfsSnapshot ? `quest ${firstDfsSnapshot.questIndex + 1}` : "none yet"}`);
  console.log(`    First deepen role:    ${firstDeepenIndex >= 0 ? `quest ${firstDeepenIndex + 1}` : "none yet"}`);
  console.log(`    Would-return rate:    ${wouldReturnCount}/${journey.length} (${journey.length ? ((wouldReturnCount / journey.length) * 100).toFixed(0) : "0"}%)`);
  console.log(`    Social lift:          ${SOCIAL_LADDER[firstSocial] ?? "unknown"} → ${SOCIAL_LADDER[peakSocial] ?? "unknown"} (${nonSoloCount}/${journey.length} non-solo reps)`);

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
  }

  // Journey timeline
  console.log(`\n  Journey Timeline:${activeBlocker ? "  (>> = setback, ★★ = breakthrough)" : ""}`);
  console.log(`  ${"#".padEnd(4)} ${activeBlocker ? "MARK " : ""}${"Role".padEnd(10)} ${"Capacity".padEnd(13)} ${"Category".padEnd(14)} ${"Venue".padEnd(26)} ${"Diff".padEnd(5)} ${"Rate".padEnd(5)} ${"Resonance".padEnd(10)} ${"Social".padEnd(18)} Hook`);
  console.log(`  ${"─".repeat(activeBlocker ? 158 : 154)}`);
  for (const j of journey) {
    const resonanceBar = "▓".repeat(Math.round(j.resonance * 10)).padEnd(10);
    const venue = j.venueName.length > 24 ? j.venueName.slice(0, 23) + "…" : j.venueName;
    const hook = j.hook.length > 50 ? j.hook.slice(0, 49) + "…" : j.hook;
    const role = (j.questRole ?? "—").slice(0, 8);
    const capacity = (j.capacityTrack ?? "—").replace(/_/g, "-").slice(0, 12);
    const blk = activeBlocker ? (j.blockerTriggered ? " >> " : j.isBreakthrough ? " ★★ " : "    ") : "";
    console.log(
      `  ${String(j.index).padEnd(4)}${blk}${role.padEnd(10)} ${capacity.padEnd(13)} ${j.venueCategory.padEnd(14)} ${venue.padEnd(26)} ${String(j.difficulty).padEnd(5)} ${String(j.rating).padEnd(5)} ${resonanceBar} ${j.socialContext.padEnd(18)} ${hook}`,
    );
  }

  // Resonance component breakdown
  console.log(`\n  Resonance Components (avg across all quests):`);
  if (journey.length > 0) {
    const avgComponents = {
      ratingSignal: journey.reduce((s, j) => s + j.resonanceComponents.ratingSignal, 0) / journey.length,
      journalDepth: journey.reduce((s, j) => s + j.resonanceComponents.journalDepth, 0) / journey.length,
      sentimentSignal: journey.reduce((s, j) => s + j.resonanceComponents.sentimentSignal, 0) / journey.length,
      socialEscalation: journey.reduce((s, j) => s + j.resonanceComponents.socialEscalation, 0) / journey.length,
      speedSignal: journey.reduce((s, j) => s + j.resonanceComponents.speedSignal, 0) / journey.length,
      difficultyAlignment: journey.reduce((s, j) => s + j.resonanceComponents.difficultyAlignment, 0) / journey.length,
    };
    const weights = DEFAULT_QUEST_CONFIG.resonance.weights;
    console.log(`    Rating Signal:        ${avgComponents.ratingSignal.toFixed(3)}  (weight: ${(weights.rating * 100).toFixed(0)}%)`);
    console.log(`    Journal Depth:        ${avgComponents.journalDepth.toFixed(3)}  (weight: ${(weights.journalDepth * 100).toFixed(0)}%)`);
    console.log(`    Sentiment Signal:     ${avgComponents.sentimentSignal.toFixed(3)}  (weight: ${(weights.sentiment * 100).toFixed(0)}%)`);
    console.log(`    Social Escalation:    ${avgComponents.socialEscalation.toFixed(3)}  (weight: ${(weights.socialEscalation * 100).toFixed(0)}%)`);
    console.log(`    Speed to Completion:  ${avgComponents.speedSignal.toFixed(3)}  (weight: ${(weights.speedToCompletion * 100).toFixed(0)}%)`);
    console.log(`    Difficulty Alignment: ${avgComponents.difficultyAlignment.toFixed(3)}  (weight: ${(weights.difficultyAlignment * 100).toFixed(0)}%)`);
  } else {
    console.log("    No completed quests.");
  }

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
