import type { DataSource } from "typeorm";
import { Sidequest, Objective } from "@realtime-markers/database";
import {
  type QuestConfig,
  type ResonanceWeights,
  DEFAULT_QUEST_CONFIG,
} from "./shared/QuestConfig";
import { type OpenAIService, OpenAIModel } from "./shared/OpenAIService";

// ── Social escalation ladder (ordered) ───────────────────────
const SOCIAL_LADDER = ["solo", "with_someone", "met_someone_new", "group_activity"] as const;

// ── Emotion / first-person heuristic word lists ──────────────
const EMOTION_WORDS = new Set([
  "loved", "love", "excited", "nervous", "anxious", "surprised",
  "comfortable", "uncomfortable", "happy", "scared", "proud",
  "alive", "peaceful", "calm", "energized", "inspired",
  "grateful", "connected", "lonely", "overwhelmed", "curious",
]);

const FIRST_PERSON_RE = /\b(I felt|I was|I am|I realized|I noticed|I talked|I met|I went|I tried|I enjoyed|I learned)\b/i;

// ── Types ────────────────────────────────────────────────────

export interface ResonanceInput {
  rating: number | null;
  journalEntry: string | null;
  socialContext: string | null;
  completedActivity: string | null;
  difficulty: number | null;
  checkedInAt: Date | null;
  questCreatedAt: Date;
  venueCategory: string | null;
  distanceFromHome: number | null;
  userPace: string;
  previousSocialContexts: string[];
  goalTags?: string[];
  // Precomputed LLM analysis (async, may be null if not yet analyzed)
  reflectionDepth: number | null;
  reflectionSentiment: number | null;
  reflectionTags: string[] | null;
}

export interface ResonanceComponents {
  ratingSignal: number;
  journalDepth: number;
  sentimentSignal: number;
  socialEscalation: number;
  speedSignal: number;
  difficultyAlignment: number;
}

export interface ResonanceResult {
  score: number;
  components: ResonanceComponents;
  objectiveId?: string;
  venueCategory?: string | null;
  reflectionTags?: string[];
}

// ── Weight blending ──────────────────────────────────────────

function blendWeightsForGoals(
  defaults: ResonanceWeights,
  goalWeights: Record<string, ResonanceWeights>,
  goalTags?: string[],
): ResonanceWeights {
  if (!goalTags || goalTags.length === 0) return defaults;

  const matched = goalTags
    .map((tag) => goalWeights[tag])
    .filter(Boolean) as ResonanceWeights[];

  if (matched.length === 0) return defaults;

  // Average all matching goal weight profiles
  const blended: ResonanceWeights = {
    rating: matched.reduce((s, w) => s + w.rating, 0) / matched.length,
    journalDepth: matched.reduce((s, w) => s + w.journalDepth, 0) / matched.length,
    sentiment: matched.reduce((s, w) => s + w.sentiment, 0) / matched.length,
    socialEscalation: matched.reduce((s, w) => s + w.socialEscalation, 0) / matched.length,
    speedToCompletion: matched.reduce((s, w) => s + w.speedToCompletion, 0) / matched.length,
    difficultyAlignment: matched.reduce((s, w) => s + w.difficultyAlignment, 0) / matched.length,
  };

  return blended;
}

// ── Pure computation (no DB, no side-effects) ────────────────

export function computeResonance(
  input: ResonanceInput,
  config: QuestConfig = DEFAULT_QUEST_CONFIG,
): ResonanceResult {
  const w = blendWeightsForGoals(
    config.resonance.weights,
    config.resonance.goalWeights,
    input.goalTags,
  );

  const ratingSignal = computeRatingSignal(input.rating);
  const journalDepth = computeJournalDepth(input.journalEntry, config.resonance.journalMaxChars, input.reflectionDepth);
  const sentimentSignal = computeSentimentSignal(input.reflectionSentiment);
  const socialEscalation = computeSocialEscalation(input.socialContext, input.previousSocialContexts);
  const speedSignal = computeSpeedSignal(input.checkedInAt, input.questCreatedAt, config.resonance.speedMaxHours);
  const difficultyAlignment = computeDifficultyAlignment(input.difficulty, input.userPace, config.resonance.idealDifficultyByPace);

  const components: ResonanceComponents = {
    ratingSignal,
    journalDepth,
    sentimentSignal,
    socialEscalation,
    speedSignal,
    difficultyAlignment,
  };

  const score = clamp(
    ratingSignal * w.rating +
    journalDepth * w.journalDepth +
    sentimentSignal * w.sentiment +
    socialEscalation * w.socialEscalation +
    speedSignal * w.speedToCompletion +
    difficultyAlignment * w.difficultyAlignment,
    0,
    1,
  );

  return {
    score,
    components,
    venueCategory: input.venueCategory,
    reflectionTags: input.reflectionTags ?? undefined,
  };
}

// ── Component functions ──────────────────────────────────────

function computeRatingSignal(rating: number | null): number {
  if (rating == null || rating < 1) return 0;
  return (Math.min(rating, 5) - 1) / 4;
}

function computeJournalDepth(
  journal: string | null,
  maxChars: number,
  llmReflectionDepth: number | null,
): number {
  if (!journal || journal.trim().length === 0) return 0;

  // Use LLM-derived depth when available
  if (llmReflectionDepth != null) return clamp(llmReflectionDepth, 0, 1);

  // Fallback: heuristic for when LLM analysis hasn't completed yet
  const text = journal.trim();
  let score = Math.min(1, text.length / maxChars);

  if (FIRST_PERSON_RE.test(text)) {
    score += 0.2;
  }

  const words = text.toLowerCase().split(/\s+/);
  const emotionCount = words.filter((w) => EMOTION_WORDS.has(w)).length;
  if (emotionCount > 0) {
    score += Math.min(0.15, emotionCount * 0.05);
  }

  return clamp(score, 0, 1);
}

function computeSentimentSignal(llmSentiment: number | null): number {
  // Sentiment is -1 (very negative) to +1 (very positive), stored as such.
  // Map to 0–1 for resonance: -1 → 0, 0 → 0.5, +1 → 1
  if (llmSentiment == null) return 0.5; // neutral when unknown
  return clamp((llmSentiment + 1) / 2, 0, 1);
}

function computeSocialEscalation(
  current: string | null,
  previous: string[],
): number {
  if (!current) return 0;

  const currentIdx = SOCIAL_LADDER.indexOf(current as typeof SOCIAL_LADDER[number]);
  if (currentIdx < 0) return 0;

  // Absolute position score — being at group_activity is inherently high-signal
  const absoluteScore = currentIdx / (SOCIAL_LADDER.length - 1);

  if (previous.length === 0) {
    return absoluteScore;
  }

  // Find the highest previous rung
  let maxPrevIdx = -1;
  for (const prev of previous) {
    const idx = SOCIAL_LADDER.indexOf(prev as typeof SOCIAL_LADDER[number]);
    if (idx > maxPrevIdx) maxPrevIdx = idx;
  }

  if (maxPrevIdx < 0) {
    return absoluteScore;
  }

  // Blend absolute position (where they are) with relative movement (did they escalate?)
  // This way, maintaining group_activity still scores high (~0.83), not 0.5
  let relativeScore: number;
  if (currentIdx > maxPrevIdx) relativeScore = 1.0;    // escalated
  else if (currentIdx === maxPrevIdx) relativeScore = 0.7;  // maintained
  else relativeScore = 0.2;                             // regressed

  return absoluteScore * 0.6 + relativeScore * 0.4;
}

function computeSpeedSignal(
  checkedInAt: Date | null,
  questCreatedAt: Date,
  maxHours: number,
): number {
  if (!checkedInAt) return 0;

  const hours = (checkedInAt.getTime() - questCreatedAt.getTime()) / (1000 * 60 * 60);
  if (hours <= 0) return 1;

  return clamp(1 - hours / maxHours, 0, 1);
}

function computeDifficultyAlignment(
  difficulty: number | null,
  pace: string,
  idealByPace: Record<string, number>,
): number {
  if (difficulty == null) return 0.5; // neutral if unknown

  const ideal = idealByPace[pace] ?? 5;
  return clamp(1 - Math.abs(difficulty - ideal) / 9, 0, 1);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── DB-backed service (wraps pure function with data fetching) ─

export interface ResonanceService {
  computeResonanceForSidequest(sidequestId: string): Promise<ResonanceResult | null>;
  computeResonanceBatch(userId: string, limit?: number): Promise<ResonanceResult[]>;
}

interface ResonanceServiceDeps {
  dataSource: DataSource;
  config?: QuestConfig;
}

class ResonanceServiceImpl implements ResonanceService {
  private dataSource: DataSource;
  private config: QuestConfig;

  constructor(deps: ResonanceServiceDeps) {
    this.dataSource = deps.dataSource;
    this.config = deps.config ?? DEFAULT_QUEST_CONFIG;
  }

  async computeResonanceForSidequest(sidequestId: string): Promise<ResonanceResult | null> {
    const sidequest = await this.dataSource.getRepository(Sidequest).findOne({
      where: { id: sidequestId },
      relations: ["objectives"],
    });
    if (!sidequest) return null;

    const user = await this.dataSource.query(
      `SELECT pace_preference, comfort_profile FROM users WHERE id = $1`,
      [sidequest.userId],
    );
    const pace = user[0]?.pace_preference ?? "steady";
    const goalTags: string[] = user[0]?.comfort_profile?.goalTags ?? [];

    // Get previous social contexts for escalation detection
    const prevContexts = await this.getPreviousSocialContexts(sidequest.userId, sidequestId);

    // Use the first (and typically only) objective
    const obj = sidequest.objectives?.[0];
    if (!obj) return null;

    const input: ResonanceInput = {
      rating: sidequest.rating ?? null,
      journalEntry: obj.journalEntry ?? null,
      socialContext: obj.socialContext ?? null,
      completedActivity: obj.completedActivity ?? null,
      difficulty: obj.difficulty ?? null,
      checkedInAt: obj.checkedInAt ?? null,
      questCreatedAt: sidequest.createdAt,
      venueCategory: obj.venueCategory ?? null,
      distanceFromHome: sidequest.distanceFromHome != null ? Number(sidequest.distanceFromHome) : null,
      userPace: pace,
      previousSocialContexts: prevContexts,
      goalTags,
      reflectionDepth: obj.reflectionDepth ?? null,
      reflectionSentiment: obj.reflectionSentiment ?? null,
      reflectionTags: obj.reflectionTags ?? null,
    };

    const result = computeResonance(input, this.config);
    result.objectiveId = obj.id;
    return result;
  }

  async computeResonanceBatch(userId: string, limit = 50): Promise<ResonanceResult[]> {
    const sidequests = await this.dataSource.getRepository(Sidequest).find({
      where: { userId, completedAt: Not(IsNull()) } as any,
      relations: ["objectives"],
      order: { completedAt: "DESC" },
      take: limit,
    });

    const user = await this.dataSource.query(
      `SELECT pace_preference, comfort_profile FROM users WHERE id = $1`,
      [userId],
    );
    const pace = user[0]?.pace_preference ?? "steady";
    const goalTags: string[] = user[0]?.comfort_profile?.goalTags ?? [];

    const results: ResonanceResult[] = [];
    const seenContexts: string[] = [];

    // Process oldest first so social escalation accumulates correctly
    for (const sq of sidequests.reverse()) {
      const obj = sq.objectives?.[0];
      if (!obj) continue;

      const input: ResonanceInput = {
        rating: sq.rating ?? null,
        journalEntry: obj.journalEntry ?? null,
        socialContext: obj.socialContext ?? null,
        completedActivity: obj.completedActivity ?? null,
        difficulty: obj.difficulty ?? null,
        checkedInAt: obj.checkedInAt ?? null,
        questCreatedAt: sq.createdAt,
        venueCategory: obj.venueCategory ?? null,
        distanceFromHome: sq.distanceFromHome != null ? Number(sq.distanceFromHome) : null,
        userPace: pace,
        previousSocialContexts: [...seenContexts],
        goalTags,
        reflectionDepth: obj.reflectionDepth ?? null,
        reflectionSentiment: obj.reflectionSentiment ?? null,
        reflectionTags: obj.reflectionTags ?? null,
      };

      const result = computeResonance(input, this.config);
      result.objectiveId = obj.id;
      results.push(result);

      if (obj.socialContext) seenContexts.push(obj.socialContext);
    }

    return results;
  }

  private async getPreviousSocialContexts(userId: string, excludeSidequestId: string): Promise<string[]> {
    const rows: { social_context: string }[] = await this.dataSource.query(
      `SELECT o.social_context
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.id != $2
         AND s.completed_at IS NOT NULL
         AND o.social_context IS NOT NULL
       ORDER BY s.completed_at ASC`,
      [userId, excludeSidequestId],
    );
    return rows.map((r) => r.social_context);
  }
}

// Need this import for the IsNull/Not usage in computeResonanceBatch
import { Not, IsNull } from "typeorm";

// ── Async LLM journal analysis ─────────────────────────────

export interface JournalAnalysis {
  depth: number;       // 0–1: how deeply reflective the entry is
  sentiment: number;   // -1 to +1: negative to positive
  tags: string[];      // qualitative labels (e.g. "growth_narrative", "self_awareness")
}

const JOURNAL_ANALYSIS_PROMPT = `You analyze journal entries from a wellness app where users reflect on real-world activities they completed (visiting places, trying new things, social interactions, etc).

Evaluate the journal entry and return a JSON object with exactly these fields:

- "depth" (number, 0 to 1): How deeply reflective is the entry?
  0.0–0.2: Surface level ("I went there, it was fine")
  0.3–0.5: Some personal detail or observation
  0.6–0.8: Genuine reflection, self-awareness, or insight about themselves
  0.9–1.0: Deep introspection, growth narrative, or meaningful realization

- "sentiment" (number, -1 to 1): Overall emotional tone
  -1.0: Very negative (distress, regret, fear)
  -0.5: Somewhat negative (discomfort, disappointment)
   0.0: Neutral or mixed
   0.5: Somewhat positive (enjoyment, satisfaction)
   1.0: Very positive (joy, gratitude, feeling alive)

- "tags" (array of strings): Zero to three labels from this set:
  "growth_narrative" — describes personal growth or overcoming a barrier
  "self_awareness" — shows insight into own patterns, feelings, or behavior
  "social_connection" — reflects meaningfully on interaction with others
  "discomfort_processed" — acknowledges discomfort but processes it constructively
  "surface_level" — minimal reflection, mostly factual

Return ONLY the JSON object, no other text.`;

export async function analyzeJournalReflection(
  openAIService: OpenAIService,
  journalEntry: string,
): Promise<JournalAnalysis> {
  const result = await openAIService.executeChatCompletion(
    {
      model: OpenAIModel.GPT54Nano,
      messages: [
        { role: "system", content: JOURNAL_ANALYSIS_PROMPT },
        { role: "user", content: journalEntry },
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: "json_object" },
    },
    "journal_reflection_analysis",
  );

  const content = result.choices[0]?.message?.content;
  if (!content) {
    return { depth: 0.5, sentiment: 0, tags: [] };
  }

  const parsed = JSON.parse(content);
  return {
    depth: clamp(parsed.depth ?? 0.5, 0, 1),
    sentiment: clamp(parsed.sentiment ?? 0, -1, 1),
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

export function createResonanceService(deps: ResonanceServiceDeps): ResonanceService {
  return new ResonanceServiceImpl(deps);
}
