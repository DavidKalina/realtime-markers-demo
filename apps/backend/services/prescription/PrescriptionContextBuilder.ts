/**
 * PrescriptionContextBuilder — pure functions that assemble prompt context
 * for quest prescription by reading user data from the database.
 *
 * Extracted from SidequestPrescriptionService to keep the orchestrator thin.
 */

import type { DataSource } from "typeorm";
import { User } from "../../entities";
import type { OpenAIService } from "../shared/OpenAIService";
import { OpenAIModel } from "../shared/OpenAIService";
import type { ComfortZoneService } from "../ComfortZoneService";
import type { CoverageService } from "../CoverageService";
import type { ResonanceService } from "../ResonanceService";
import type { PathwayService } from "../PathwayService";

// ─── Interfaces ────────────────────────────────────────────────────

export interface PrescriptionContextDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  comfortZoneService?: ComfortZoneService;
  coverageService?: CoverageService;
  resonanceService?: ResonanceService;
  pathwayService?: PathwayService;
}

export interface FearLadderReadiness {
  /** 0-3 phase index. Derived from demonstrated comfort, not quest count. */
  phase: number;
  /** Completed quest count (used as minimum floor only) */
  completedQuests: number;
  /** Average resonance across all completed quests */
  avgResonance: number;
  /** Average resonance over last 5 quests (recency signal) */
  recentResonance: number;
  /** Average rating (1-5) across all quests */
  avgRating: number;
  /** Whether user has shown growth signals in reflections */
  hasGrowthSignals: boolean;
  /** Number of quests with positive sentiment (> 0.2) */
  positiveQuestCount: number;
  /** Average difficulty of recent quests */
  recentAvgDifficulty: number;
  /** Whether user has a DFS pathway (found something they love) */
  hasDfsPathway: boolean;
  /** Human-readable reason for the phase */
  phaseReason: string;
}

export interface BlockerDetectionResult {
  /** The prompt context string injected into the LLM prompt */
  promptText: string;
  /** Structured blocker metadata, null if no blocker detected */
  blocker: { type: string; severity: string; phase: string } | null;
}

// ─── Social Micro-Rep Ladder ───────────────────────────────────────

export const SOCIAL_MICRO_REP_TIERS = [
  {
    tier: 0,
    label: "Ghost (just exist in the space)",
    reps: [
      "Sit in a public space for 15+ minutes without retreating",
      "Stay at the counter or bar instead of hiding in a corner",
      "Put your phone away for 5 minutes and just observe the room",
    ],
  },
  {
    tier: 1,
    label: "Acknowledge (be seen)",
    reps: [
      "Make eye contact with one person and nod",
      "Say \"thanks\" to the barista or server with a genuine smile",
      "Hold the door for someone on your way in or out",
    ],
  },
  {
    tier: 2,
    label: "Micro-interact (tiny exchanges)",
    reps: [
      "Compliment someone's shirt, book, or dog",
      "Ask a staff member for a recommendation",
      "Say \"have a good one\" to someone on your way out",
    ],
  },
  {
    tier: 3,
    label: "Brief conversation (2-3 exchanges)",
    reps: [
      "Ask someone what they're reading, playing, or working on",
      "Comment on something shared — the music, the weather, the event",
      "Ask a neighbor at the bar or counter \"been here before?\"",
    ],
  },
  {
    tier: 4,
    label: "Extended engagement (stay in it)",
    reps: [
      "Join a table or group activity and participate for the full round",
      "Ask someone about themselves and follow up on their answer",
      "Share something about yourself when someone asks",
    ],
  },
  {
    tier: 5,
    label: "Bridge-building (create future connection)",
    reps: [
      "Learn one person's name before you leave",
      "Ask \"do you come here often? What nights are best?\"",
      "Say \"this was fun — I'll probably come back next week\"",
    ],
  },
  {
    tier: 6,
    label: "Initiate (take the lead)",
    reps: [
      "Suggest a specific plan: \"want to grab coffee sometime?\"",
      "Exchange contact info with someone you enjoyed talking to",
      "Invite someone to join you at another event",
    ],
  },
];

// ─── Standalone helpers ────────────────────────────────────────────

function findSocialDimensionScore(fearLadder: { dimensionScores: Record<string, number> } | null): number | null {
  if (!fearLadder?.dimensionScores) return null;
  for (const [key, score] of Object.entries(fearLadder.dimensionScores)) {
    if (key === "social" || key.includes("social")) return score;
  }
  return null;
}

function findVulnerabilityDimensionScore(fearLadder: { dimensionScores: Record<string, number> } | null): number | null {
  if (!fearLadder?.dimensionScores) return null;
  for (const [key, score] of Object.entries(fearLadder.dimensionScores)) {
    if (key === "vulnerability" || key.includes("vulnerab")) return score;
  }
  return null;
}

function isSocialBlocker(blockerType: string): boolean {
  const lower = blockerType.toLowerCase();
  return ["social", "stranger", "conversation", "talking", "people", "interact"].some(k => lower.includes(k));
}

async function countCompletedQuests(dataSource: DataSource, userId: string): Promise<number> {
  const result = await dataSource.query(
    `SELECT COUNT(*)::int as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
    [userId],
  );
  return result[0]?.count ?? 0;
}

// ─── Context Builder Functions ─────────────────────────────────────

/**
 * Build context string for the prescription agent based on user's quest history.
 * Uses cached behavioral profile when available, falls back to raw queries.
 */
export async function buildPrescriptionContext(
  deps: PrescriptionContextDeps,
  userId: string,
  behavioralProfile: { summary: string; generatedAt: string; questCount: number } | null,
  goalTags: string[] = [],
): Promise<string> {
  const { dataSource } = deps;

  // Always fetch last 3 quests for recency (avoids immediate repeats)
  const recentQuests: {
    title: string;
    venue_category: string;
    distance_from_home: number;
  }[] = await dataSource.query(
    `
    SELECT
      s.title,
      o.venue_category,
      s.distance_from_home
    FROM sidequests s
    LEFT JOIN objectives o ON o.sidequest_id = s.id
    WHERE s.user_id = $1
      AND s.completed_at IS NOT NULL
      AND s.deleted_at IS NULL
    ORDER BY s.completed_at DESC
    LIMIT 3
    `,
    [userId],
  );

  // Always fetch category breakdown for diversity enforcement
  const categories: { venue_category: string; count: number }[] =
    await dataSource.query(
      `
    SELECT o.venue_category, COUNT(*)::int as count
    FROM objectives o
    JOIN sidequests s ON s.id = o.sidequest_id
    WHERE s.user_id = $1
      AND o.checked_in_at IS NOT NULL
      AND o.venue_category IS NOT NULL
    GROUP BY o.venue_category
    ORDER BY count DESC
    `,
      [userId],
    );

  const categoryDiversityBlock = buildCategoryDiversityBlock(categories);

  // Pending/prescribed-but-not-completed venues — hard blocklist to prevent back-to-back repeats
  const pendingVenues: { venue_name: string; venue_category: string }[] =
    await dataSource.query(
      `SELECT DISTINCT o.venue_name, o.venue_category
       FROM sidequests s
       JOIN objectives o ON o.sidequest_id = s.id
       WHERE s.user_id = $1
         AND s.deleted_at IS NULL
         AND s.completed_at IS NULL
         AND o.venue_name IS NOT NULL
       ORDER BY o.venue_name
       LIMIT 15`,
      [userId],
    );

  // Count completed quests for milestone detection
  const completedCountResult: { count: number }[] = await dataSource.query(
    `SELECT COUNT(*)::int as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
    [userId],
  );
  const completedQuestCount = completedCountResult[0]?.count ?? 0;

  // Venue-level repeat intelligence — includes whether the venue is on a DFS pathway
  const venueRepeats: { venue_name: string; visit_count: number; avg_rating: number; venue_category: string; on_dfs_pathway: boolean }[] =
    await dataSource.query(
      `SELECT
         o.venue_name,
         COUNT(*)::int AS visit_count,
         ROUND(AVG(s.rating)::numeric, 1)::float AS avg_rating,
         o.venue_category,
         EXISTS(
           SELECT 1 FROM pathways p
           WHERE p.user_id = $1
             AND p.phase = 'dfs'
             AND p.sidequest_ids && ARRAY(
               SELECT s2.id FROM sidequests s2
               JOIN objectives o2 ON o2.sidequest_id = s2.id
               WHERE o2.venue_name = o.venue_name AND s2.user_id = $1
             )
         ) AS on_dfs_pathway
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.venue_name IS NOT NULL
       GROUP BY o.venue_name, o.venue_category
       HAVING COUNT(*) >= 2
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      [userId],
    );
  const venueBlock = buildVenueRepeatBlock(venueRepeats);

  // Anchor venue candidates — venues the user wants to return to or has rated highly
  const anchorCandidates: { venue_name: string; venue_address: string; venue_category: string; visit_count: number; avg_rating: number; last_rating: number; user_opted_in: boolean }[] =
    await dataSource.query(
      `SELECT
         o.venue_name,
         o.venue_address,
         o.venue_category,
         COUNT(*)::int AS visit_count,
         ROUND(AVG(s.rating)::numeric, 1)::float AS avg_rating,
         (SELECT s2.rating FROM sidequests s2
          JOIN objectives o2 ON o2.sidequest_id = s2.id
          WHERE o2.venue_name = o.venue_name AND s2.user_id = $1
            AND s2.completed_at IS NOT NULL AND s2.deleted_at IS NULL
          ORDER BY s2.completed_at DESC LIMIT 1
         )::int AS last_rating,
         (SELECT o3.would_return FROM objectives o3
          JOIN sidequests s3 ON s3.id = o3.sidequest_id
          WHERE o3.venue_name = o.venue_name AND s3.user_id = $1
            AND o3.would_return IS NOT NULL
            AND s3.completed_at IS NOT NULL AND s3.deleted_at IS NULL
          ORDER BY s3.completed_at DESC LIMIT 1
         ) AS user_opted_in
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.venue_name IS NOT NULL
       GROUP BY o.venue_name, o.venue_address, o.venue_category
       HAVING AVG(s.rating) >= 3.5 OR (
         SELECT o3.would_return FROM objectives o3
         JOIN sidequests s3 ON s3.id = o3.sidequest_id
         WHERE o3.venue_name = o.venue_name AND s3.user_id = $1
           AND o3.would_return IS NOT NULL
           AND s3.completed_at IS NOT NULL AND s3.deleted_at IS NULL
         ORDER BY s3.completed_at DESC LIMIT 1
       ) = true
       ORDER BY user_opted_in DESC NULLS LAST, AVG(s.rating) DESC, COUNT(*) DESC
       LIMIT 5`,
      [userId],
    );
  const anchorBlock = buildAnchorVenueBlock(anchorCandidates, completedQuestCount);

  // "Would NOT return" blocklist — venues the user explicitly rejected
  const rejectedVenues: { venue_name: string; venue_category: string }[] =
    await dataSource.query(
      `SELECT DISTINCT o.venue_name, o.venue_category
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.venue_name IS NOT NULL
         AND o.would_return = false
         AND NOT EXISTS (
           -- Only block if the MOST RECENT signal for this venue is still "no"
           SELECT 1 FROM objectives o2
           JOIN sidequests s2 ON s2.id = o2.sidequest_id
           WHERE o2.venue_name = o.venue_name AND s2.user_id = $1
             AND o2.would_return = true
             AND s2.completed_at > s.completed_at
         )
       ORDER BY o.venue_name`,
      [userId],
    );
  const rejectedBlock = rejectedVenues.length > 0
    ? `\nDO NOT PRESCRIBE THESE VENUES — user said they would NOT return:\n${rejectedVenues.map(v => `- "${v.venue_name}" (${v.venue_category})`).join("\n")}\nThis is a HARD constraint. Do NOT send them back to these specific venues under any circumstances.\n`
    : "";

  // Category dampening — if user rejected 2+ venues in the same category, deprioritize it
  const rejectedCategoryCounts = new Map<string, number>();
  for (const v of rejectedVenues) {
    if (v.venue_category) {
      rejectedCategoryCounts.set(v.venue_category, (rejectedCategoryCounts.get(v.venue_category) ?? 0) + 1);
    }
  }
  const dampenedCategories = [...rejectedCategoryCounts.entries()].filter(([, count]) => count >= 2);
  const categoryDampeningBlock = dampenedCategories.length > 0
    ? `\n⚠️ CATEGORY DAMPENING: The user has rejected multiple venues in these categories: ${dampenedCategories.map(([cat, n]) => `"${cat}" (${n} rejected)`).join(", ")}. Strongly deprioritize these categories — the user is signaling they don't enjoy this type of experience.\n`
    : "";

  // Distress detection — check if the most recent journal entry was very negative
  const recentDistress: { journal_entry: string; reflection_sentiment: number; venue_name: string; venue_category: string }[] =
    await dataSource.query(
      `SELECT o.journal_entry, o.reflection_sentiment, o.venue_name, o.venue_category
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.journal_entry IS NOT NULL
         AND o.reflection_sentiment IS NOT NULL
         AND o.reflection_sentiment < -0.3
       ORDER BY s.completed_at DESC
       LIMIT 1`,
      [userId],
    );
  const distressBlock = recentDistress.length > 0 && recentDistress[0].reflection_sentiment < -0.3
    ? `\n🚨 RECENT DISTRESS SIGNAL: The user's most recent journal entry was notably negative (sentiment: ${recentDistress[0].reflection_sentiment.toFixed(2)}). They wrote: "${recentDistress[0].journal_entry.slice(0, 120)}..."\nThis is a moment to CHANGE PACE. Consider:\n- An enjoy quest (something purely fun, no growth pressure)\n- A different category entirely (break the pattern)\n- A gentler difficulty level\n- Avoid "${recentDistress[0].venue_name}" and similar venues for now\nDo NOT prescribe more of the same. The user needs to feel like the app heard them.\n`
    : "";

  // City visit counts for diminishing returns
  const cityVisits: { city: string; count: number }[] =
    await dataSource.query(
      `SELECT s.city, COUNT(*)::int as count
       FROM sidequests s
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND s.city IS NOT NULL
       GROUP BY s.city
       ORDER BY count DESC`,
      [userId],
    );
  const cityBlock = buildCityDiminishingBlock(cityVisits);

  // Quest arc narrative
  const arcNarrative = await buildArcNarrative(dataSource, userId);

  // Pending venues blocklist
  const pendingBlock = pendingVenues.length > 0
    ? `\nDO NOT PRESCRIBE THESE VENUES (already in the user's queue — not yet visited):\n${pendingVenues.map((v) => `- "${v.venue_name}" (${v.venue_category})`).join("\n")}\n`
    : "";

  // Milestone injection
  const milestoneQuests = [5, 10, 15, 20, 25, 30, 40, 50];
  const isMilestone = milestoneQuests.includes(completedQuestCount);
  const milestoneBlock = isMilestone
    ? `\n🎯 MILESTONE CHECK: The user has completed ${completedQuestCount} quests. This quest SHOULD be a "milestone" — a reflection checkpoint. Pick a comfortable, familiar-category venue and frame the quest around reflecting on their journey so far. The journal prompt should ask them to look back on what's changed since they started. Set actionability to "milestone".\n`
    : "";

  // If we have a cached behavioral profile, use it
  if (behavioralProfile && behavioralProfile.questCount > 0) {
    const recentList = recentQuests
      .map(
        (q) =>
          `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
      )
      .join("\n");

    return `BEHAVIORAL PROFILE (based on ${behavioralProfile.questCount} quests, updated ${behavioralProfile.generatedAt}):
${behavioralProfile.summary}
${arcNarrative ? `\nJOURNEY ARC: ${arcNarrative}` : ""}

MOST RECENT QUESTS (avoid repeating these):
${recentList || "(none)"}
${pendingBlock}
${rejectedBlock}
${distressBlock}
${categoryDiversityBlock}
${categoryDampeningBlock}
${venueBlock}
${anchorBlock}
${cityBlock}
${milestoneBlock}
${await buildSocialContext(dataSource, userId, goalTags)}`;
  }

  // Fallback for new users or pre-migration users: raw query approach
  if (recentQuests.length === 0) {
    return `HISTORY: This is a new user — no completed quests yet. Start gentle and close to home.${pendingBlock}`;
  }

  const recentList = recentQuests
    .map(
      (q) =>
        `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
    )
    .join("\n");

  return `HISTORY (last ${recentQuests.length} quests):
${recentList}
${arcNarrative ? `\nJOURNEY ARC: ${arcNarrative}` : ""}
${pendingBlock}
${rejectedBlock}
${distressBlock}
${categoryDiversityBlock}
${categoryDampeningBlock}
${venueBlock}
${anchorBlock}
${cityBlock}
${milestoneBlock}
PRESCRIPTION STRATEGY: Look at their history and prescribe something that meaningfully expands — a new category, a further distance, or an area of town they haven't explored. If anchor venues exist, a return visit with a new angle is an option but not the default.

${await buildSocialContext(dataSource, userId, goalTags)}`;
}

export async function buildSocialContext(dataSource: DataSource, userId: string, goalTags: string[] = []): Promise<string> {
  const wantsSocial = goalTags.includes("socialize");
  const wantsSkill = goalTags.includes("new_skill");
  const wantsFitness = goalTags.includes("fitness");

  const socialCounts: { social_context: string; count: number }[] =
    await dataSource.query(
      `
      SELECT o.social_context, COUNT(*)::int as count
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND o.checked_in_at IS NOT NULL
        AND o.social_context IS NOT NULL
      GROUP BY o.social_context
      ORDER BY count DESC
      `,
      [userId],
    );

  // No social data yet — only give goal-based guidance
  if (socialCounts.length === 0) {
    if (!wantsSocial && !wantsSkill && !wantsFitness) return "";
    const lines: string[] = [];
    if (wantsSocial) lines.push("SOCIAL GOAL: This user wants to meet people. As they build consistency, start weaving in venues with natural social opportunities (busy cafes, farmer's markets, community events). Don't push group activities until they have a few completions under their belt.");
    if (wantsSkill) lines.push("SKILL GOAL: This user wants to pick up a new skill. When they're ready, consider workshops, classes, or maker spaces — but start with low-commitment options (drop-in, free, no signup).");
    if (wantsFitness) lines.push("FITNESS GOAL: This user wants to get active. Trails and parks are a natural start. As they build the habit, consider group fitness (run clubs, outdoor yoga, climbing gyms).");
    return lines.join("\n");
  }

  const total = socialCounts.reduce((sum, c) => sum + c.count, 0);
  const breakdown = socialCounts
    .map((c) => `${c.social_context}: ${c.count}`)
    .join(", ");

  const soloCount = socialCounts.find((c) => c.social_context === "solo")?.count ?? 0;
  const groupCount = socialCounts.find((c) => c.social_context === "group_activity")?.count ?? 0;
  const metNewCount = socialCounts.find((c) => c.social_context === "met_someone_new")?.count ?? 0;
  const withSomeoneCount = socialCounts.find((c) => c.social_context === "with_someone")?.count ?? 0;
  const socialCount = groupCount + metNewCount + withSomeoneCount;

  const lines: string[] = [`SOCIAL PATTERN (${total} check-ins with social data): ${breakdown}`];

  if (total >= 3 && socialCount === 0 && wantsSocial) {
    lines.push("This user wants to meet people but goes solo every time. Prescribe venues with natural social opportunities (busy cafes, farmer's markets, group fitness classes, community events). Don't force it — just create the conditions.");
  } else if (total >= 5 && groupCount === 0 && soloCount > socialCount && (wantsSocial || wantsSkill || wantsFitness)) {
    lines.push("This user mostly goes solo with occasional company. They haven't tried a group activity yet. If they seem ready (consistent habit, comfortable with the area), a low-pressure group option could be a meaningful stretch — a free outdoor yoga class, a run club, trivia night as a spectator.");
  } else if (groupCount >= 2 || metNewCount >= 2) {
    lines.push("This user is socially active — they've done group activities or met new people. They're comfortable in social settings. Consider prescribing experiences that deepen community connection: recurring events, classes, or spots where they'd become a regular.");
  }

  return lines.join("\n");
}

/**
 * Build social micro-rep context for the LLM prompt.
 * Determines the user's current social comfort tier (0-6) and provides
 * specific micro-actions for the LLM to weave into suggested activities.
 * Only activates for users where social growth is relevant.
 */
export async function buildSocialMicroRepContext(
  dataSource: DataSource,
  userId: string,
  fearLadder: { dimensionScores: Record<string, number> } | null,
  readiness: FearLadderReadiness,
  goalTags: string[],
  blockerMeta: { type: string; severity: string; phase: string } | null,
): Promise<string> {
  // Gate: only inject for users where social growth is relevant
  const wantsSocial = goalTags.includes("socialize");
  const socialDimScore = findSocialDimensionScore(fearLadder);
  const hasSocialAnxiety = socialDimScore !== null && socialDimScore > 0.4;
  const hasSocialBlocker = blockerMeta !== null && isSocialBlocker(blockerMeta.type);

  if (!wantsSocial && !hasSocialAnxiety && !hasSocialBlocker) return "";

  // Query social context history
  const socialCounts: { social_context: string; count: number }[] =
    await dataSource.query(
      `SELECT o.social_context, COUNT(*)::int as count
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND o.checked_in_at IS NOT NULL
         AND o.social_context IS NOT NULL
       GROUP BY o.social_context`,
      [userId],
    );

  const soloCount = socialCounts.find((c) => c.social_context === "solo")?.count ?? 0;
  const metNewCount = socialCounts.find((c) => c.social_context === "met_someone_new")?.count ?? 0;
  const groupCount = socialCounts.find((c) => c.social_context === "group_activity")?.count ?? 0;
  const withSomeoneCount = socialCounts.find((c) => c.social_context === "with_someone")?.count ?? 0;
  const totalSocial = metNewCount + groupCount + withSomeoneCount;
  const totalCheckins = soloCount + totalSocial;

  // Compute tier (0-6)
  const { phase } = readiness;

  // Base tier from phase (floor)
  let tier = 0;
  if (phase >= 1) tier = 1;
  if (phase >= 2) tier = 2;
  if (phase >= 3) tier = 4;

  // Social history boosts (data-driven)
  if (totalCheckins >= 3 && totalSocial === 0) {
    // Goes out but always solo — keep low
    tier = Math.min(tier, 1);
  }
  if (metNewCount >= 1) {
    tier = Math.max(tier, 2);
  }
  if (metNewCount >= 3 || groupCount >= 2) {
    tier = Math.max(tier, 3);
  }
  if (metNewCount >= 5 && groupCount >= 3) {
    tier = Math.max(tier, 4);
  }
  if (groupCount >= 5 && metNewCount >= 5) {
    tier = Math.max(tier, 5);
  }

  // Fear ladder social dimension cap
  if (socialDimScore !== null) {
    if (socialDimScore >= 0.75) {
      tier = Math.min(tier, 2);
    } else if (socialDimScore >= 0.5) {
      tier = Math.min(tier, 3);
    }
  }

  // Vulnerability dimension cap — higher tiers require self-disclosure
  const vulnDimScore = findVulnerabilityDimensionScore(fearLadder);
  if (vulnDimScore !== null && vulnDimScore >= 0.75 && tier > 3) {
    tier = Math.min(tier, 3);
  }

  // Blocker hard cap (highest priority)
  if (hasSocialBlocker && blockerMeta) {
    if (blockerMeta.phase === "avoid") {
      tier = Math.min(tier, 0);
    } else if (blockerMeta.phase === "building") {
      tier = Math.min(tier, 1);
    } else if (blockerMeta.phase === "reintroduce") {
      tier = Math.min(tier, 2);
    }
  }

  // Final clamp
  tier = Math.max(0, Math.min(6, tier));

  // Build prompt text
  const currentTier = SOCIAL_MICRO_REP_TIERS[tier];
  const stretchTier = tier < 6 ? SOCIAL_MICRO_REP_TIERS[tier + 1] : null;

  const lines: string[] = [];
  lines.push(`\nSOCIAL MICRO-REP (Tier ${tier}/6 — ${currentTier.label}):`);
  lines.push(`This user's social comfort level is at Tier ${tier}. When crafting suggested activities (sa), weave ONE of these social micro-reps into the venue experience:`);

  for (const rep of currentTier.reps) {
    lines.push(`  - ${rep}`);
  }

  if (stretchTier) {
    lines.push(`Optional stretch (Tier ${tier + 1}): "${stretchTier.reps[0]}" — only if the venue naturally supports it. Use soft language ("if it feels right", "you could try").`);
  }

  lines.push(`IMPORTANT: The micro-rep should be ONE of the 2-3 suggested activities (sa), not all of them. The other activities should be about the venue experience itself. Do NOT make the social micro-rep the quest's primary objective or title. It's a small nudge woven into a larger experience.`);

  if (hasSocialBlocker) {
    lines.push(`NOTE: This user has an active social blocker (${blockerMeta!.phase} phase). Keep the micro-rep especially gentle. Frame it as entirely optional.`);
  }

  return lines.join("\n");
}

/**
 * Detect recurring blockers by analyzing recent quest history.
 * Looks at action items vs completed activity + journal entries
 * to find patterns where the user consistently avoids or struggles
 * with a specific type of action.
 */
export async function buildBlockerContext(deps: PrescriptionContextDeps, userId: string): Promise<BlockerDetectionResult> {
  const { dataSource, openAIService } = deps;
  const noBlocker: BlockerDetectionResult = { promptText: "", blocker: null };
  const completedCount = await countCompletedQuests(dataSource, userId);
  if (completedCount < 5) return noBlocker;

  // Fetch recent completed quests with objective details
  const recentObjectives: {
    quest_title: string;
    action_items: string[];
    suggested_activities: string[];
    completed_activity: string | null;
    journal_entry: string | null;
    rating: number | null;
    rating_comment: string | null;
    difficulty: number | null;
    venue_category: string | null;
  }[] = await dataSource.query(
    `SELECT
       s.title AS quest_title,
       o.action_items,
       o.suggested_activities,
       o.completed_activity,
       o.journal_entry,
       s.rating,
       s.rating_comment,
       o.difficulty,
       o.venue_category
     FROM objectives o
     JOIN sidequests s ON s.id = o.sidequest_id
     WHERE s.user_id = $1
       AND s.completed_at IS NOT NULL
       AND s.deleted_at IS NULL
     ORDER BY s.completed_at DESC
     LIMIT 15`,
    [userId],
  );

  // Need at least a few quests with journal or activity data to analyze
  const withSignal = recentObjectives.filter(
    (o) => o.journal_entry || o.completed_activity || o.rating_comment,
  );
  if (withSignal.length < 3) return noBlocker;

  // Build compact summaries for LLM analysis
  const questSummaries = recentObjectives
    .map((obj, i) => {
      const parts: string[] = [`Quest ${i + 1}: "${obj.quest_title}" (${obj.venue_category ?? "unknown"})`];
      if (obj.action_items?.length)
        parts.push(`  Prescribed actions: ${obj.action_items.join("; ")}`);
      if (obj.suggested_activities?.length)
        parts.push(`  Suggested activities: ${obj.suggested_activities.join("; ")}`);
      parts.push(`  What they did: ${obj.completed_activity ? `"${obj.completed_activity}"` : "(nothing reported)"}`);
      if (obj.journal_entry)
        parts.push(`  Journal: "${obj.journal_entry}"`);
      if (obj.rating_comment)
        parts.push(`  Rating comment: "${obj.rating_comment}"`);
      if (obj.rating != null)
        parts.push(`  Rating: ${obj.rating}/5`);
      return parts.join("\n");
    })
    .join("\n\n");

  try {
    const response = await openAIService.executeChatCompletion(
      {
        model: OpenAIModel.GPT54Mini,
        messages: [
          {
            role: "system",
            content: `You analyze a user's quest history to detect recurring blockers and assess their current recovery phase.

STEP 1 — DETECT BLOCKER:
Look for a specific action the user consistently avoids, fails at, or expresses anxiety about across 2-3+ quests. Look at:
- Actions prescribed but not completed
- Journal entries mentioning the same fear/avoidance repeatedly
- Low ratings on quests requiring a specific action type
A single bad experience is NOT a blocker — the pattern must repeat.

STEP 2 — ASSESS PHASE (if blocker detected):
Look at the MOST RECENT 3-4 quests (listed first) and determine the user's current state:
- "avoid": The last 2-3 quests still show blocker failures (low ratings, avoidance journals). The user needs a full break from the blocked action.
- "building": The last 2-3 quests show improvement — better ratings, positive journals, successful completions on NON-blocker quests. The user is rebuilding confidence but isn't ready for the blocked action yet.
- "reintroduce": The user has had 3+ recent successful quests with good ratings (3+). They're showing confidence and readiness. It's time to GENTLY reintroduce the blocked action as OPTIONAL, not required.

Respond with JSON:
If blocker found: {"detected":true,"blockerType":"<short label>","evidence":"<2-3 sentences>","severity":"mild|moderate|strong","phase":"avoid|building|reintroduce","phaseReason":"<1 sentence explaining why this phase>","suggestedProgression":"<3-4 step micro-progression>"}
If no blocker: {"detected":false}`,
          },
          {
            role: "user",
            content: `Here are this user's recent completed quests (most recent first). Is there a recurring blocker, and if so, what phase are they in?\n\n${questSummaries}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_completion_tokens: 500,
      },
      "blocker_detection",
    );

    const text = response.choices[0]?.message?.content?.trim() ?? "{}";
    const result = JSON.parse(text);
    if (!result.detected) return noBlocker;

    const phase: string = result.phase ?? "avoid";
    const blockerMeta = { type: result.blockerType as string, severity: result.severity as string, phase };

    console.log(
      `[prescribeQuest] Blocker detected: "${result.blockerType}" (${result.severity}, phase=${phase}) — ${result.evidence}`,
    );

    if (phase === "reintroduce") {
      return { blocker: blockerMeta, promptText: `\nRECURRING BLOCKER — READY TO REINTRODUCE: ${result.blockerType.toUpperCase()}
${result.evidence}
Phase: REINTRODUCE — ${result.phaseReason ?? "User has shown consistent recent improvement."}

The user previously struggled with "${result.blockerType}" but has been building confidence through recent successes. They're ready for a gentle reintroduction.

REINTRODUCTION RULES:
- Prescribe a quest where "${result.blockerType}" is OPTIONAL and NATURAL, not the primary objective.
- Frame the quest around an enjoyable activity. The blocked action should be a "nice to have" bonus, not the goal.
- Use soft language: "if it feels right", "you might", "no pressure to" — NOT "introduce yourself" or "talk to someone."
- Difficulty should stay moderate (3-5). Don't spike it.
- If the user succeeds, great. If not, it's still a good quest without the blocked action.\n` };
    }

    if (phase === "building") {
      return { blocker: blockerMeta, promptText: `\nRECURRING BLOCKER — BUILDING CONFIDENCE: ${result.blockerType.toUpperCase()}
${result.evidence}
Phase: BUILDING — ${result.phaseReason ?? "User is showing improvement on recent quests."}

The user has a blocker around "${result.blockerType}" but is showing recent progress. Keep prescribing experiences where they can succeed WITHOUT the blocked action. Don't reintroduce it yet — let the momentum build for 1-2 more quests.

PRESCRIPTION RULES:
- Focus on activities where the user can participate fully without "${result.blockerType}".
- Solo activities, structured classes, hands-on workshops, and observation-based quests are ideal.
- Social interaction may happen naturally — that's fine — but it must NOT be prescribed as an objective.
- Keep difficulty low-moderate (2-4). The goal is continued easy wins.\n` };
    }

    // Default: "avoid" phase
    return { blocker: blockerMeta, promptText: `\nRECURRING BLOCKER — ACTIVE AVOIDANCE: ${result.blockerType.toUpperCase()}
${result.evidence}
Phase: AVOID — ${result.phaseReason ?? "User is still in active failure mode."}

THIS USER KEEPS FAILING AT "${result.blockerType}". Prescribing it again will produce another 1-star failure.

PRESCRIPTION RULES:
1. DO NOT make "${result.blockerType}" a quest objective, action item, or suggested activity.
2. Prescribe experiences where the user can succeed WITHOUT the blocked action — solo activities, observation, skill-building, or structured environments.
3. Keep difficulty low (1-3). The goal is EASY WINS to rebuild confidence.

MICRO-PROGRESSION (follow this arc over the next several quests):
${result.suggestedProgression}\n` };
  } catch (err) {
    console.error("[prescribeQuest] Blocker detection failed:", err);
    return noBlocker;
  }
}

export async function buildArcNarrative(dataSource: DataSource, userId: string): Promise<string> {
  // Get journey milestones
  const milestones: {
    total: number;
    first_category: string | null;
    first_city: string | null;
    latest_category: string | null;
    latest_city: string | null;
    unique_cities: number;
    unique_categories: number;
    first_social: string | null;
    latest_social: string | null;
  }[] = await dataSource.query(
    `WITH ordered AS (
      SELECT
        o.venue_category,
        s.city,
        o.social_context,
        s.completed_at,
        ROW_NUMBER() OVER (ORDER BY s.completed_at ASC) as rn_asc,
        ROW_NUMBER() OVER (ORDER BY s.completed_at DESC) as rn_desc
      FROM sidequests s
      JOIN objectives o ON o.sidequest_id = s.id
      WHERE s.user_id = $1 AND s.completed_at IS NOT NULL AND s.deleted_at IS NULL
    )
    SELECT
      (SELECT COUNT(*) FROM ordered) as total,
      (SELECT venue_category FROM ordered WHERE rn_asc = 1) as first_category,
      (SELECT city FROM ordered WHERE rn_asc = 1) as first_city,
      (SELECT venue_category FROM ordered WHERE rn_desc = 1) as latest_category,
      (SELECT city FROM ordered WHERE rn_desc = 1) as latest_city,
      (SELECT COUNT(DISTINCT city) FROM ordered) as unique_cities,
      (SELECT COUNT(DISTINCT venue_category) FROM ordered WHERE venue_category IS NOT NULL) as unique_categories,
      (SELECT social_context FROM ordered WHERE social_context IS NOT NULL ORDER BY rn_asc LIMIT 1) as first_social,
      (SELECT social_context FROM ordered WHERE social_context IS NOT NULL ORDER BY rn_desc LIMIT 1) as latest_social`,
    [userId],
  );

  const m = milestones[0];
  if (!m || m.total < 3) return "";

  const parts: string[] = [];

  // Opening: where they started
  parts.push(`This user started with ${m.first_category ?? "a"} quest in ${m.first_city ?? "their hometown"}`);

  // Social arc
  if (m.first_social && m.latest_social && m.first_social !== m.latest_social) {
    const socialLabels: Record<string, string> = {
      solo: "going solo",
      with_someone: "bringing someone along",
      met_someone_new: "meeting new people",
      group_activity: "doing group activities",
    };
    parts.push(
      `went from ${socialLabels[m.first_social] ?? m.first_social} to ${socialLabels[m.latest_social] ?? m.latest_social}`,
    );
  }

  // Expansion
  if (Number(m.unique_cities) > 1) {
    parts.push(`has explored ${m.unique_cities} cities and ${m.unique_categories} categories`);
  } else {
    parts.push(`has tried ${m.unique_categories} different categories`);
  }

  // Current
  parts.push(`and most recently visited a ${m.latest_category ?? "venue"} in ${m.latest_city ?? "their area"}`);

  return parts.join(", ") + ". Frame this quest as the next chapter in their story.";
}

export function buildCategoryDiversityBlock(
  categories: { venue_category: string; count: number }[],
): string {
  if (categories.length === 0) return "";

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const categoryList = categories
    .map((c) => `${c.venue_category}: ${c.count}`)
    .join(", ");

  const lines: string[] = [`CATEGORY BREAKDOWN (${total} completed): ${categoryList}`];

  const top = categories[0];
  const topPct = Math.round((top.count / total) * 100);

  // Thresholds tighten as quest count grows — early journeys need concentration,
  // but by quest 20+ one category shouldn't dominate
  const hardBlockPct = total >= 20 ? 25 : 40;
  const warnPct = total >= 20 ? 20 : 30;

  // Hard block if one category dominates
  if (top.count >= 2 && topPct >= hardBlockPct) {
    lines.push(
      `⚠️ CATEGORY OVERLOAD: "${top.venue_category}" accounts for ${topPct}% of all quests (${top.count}/${total}). ` +
      `DO NOT prescribe "${top.venue_category}" this time. Choose a DIFFERENT category. ` +
      `Consider: restaurant, trail, music venue, volunteer, class, market, gallery — especially categories from the user's stated interests they haven't explored yet.`,
    );
  } else if (top.count >= 2 && topPct >= warnPct) {
    lines.push(
      `NOTE: "${top.venue_category}" is becoming dominant (${top.count}/${total}). Strongly prefer a different category this time.`,
    );
  }

  // Check for second-dominant category too (prevents two categories hogging everything)
  if (categories.length >= 2) {
    const second = categories[1];
    const secondPct = Math.round((second.count / total) * 100);
    if (top.count + second.count >= total * 0.5 && total >= 10) {
      lines.push(
        `"${top.venue_category}" + "${second.venue_category}" together account for ${topPct + secondPct}% of all quests. The journey is narrowing — actively explore OTHER categories.`,
      );
    }
  }

  // Suggest untried categories
  const tried = new Set(categories.map((c) => c.venue_category));
  if (tried.size < 6) {
    lines.push(`Only ${tried.size} category types explored so far. Prioritize trying a completely new type of venue or activity they haven't done before.`);
  } else if (total >= 20 && tried.size < 10) {
    lines.push(`${tried.size} categories explored across ${total} quests. The user's interests include activities not yet explored — look for restaurants, music venues, trails, volunteer spots, or classes.`);
  }

  return lines.join("\n");
}

export function buildCityDiminishingBlock(
  cities: { city: string; count: number }[],
): string {
  if (cities.length === 0) return "";

  const total = cities.reduce((sum, c) => sum + c.count, 0);
  if (total < 5) return ""; // Too early to enforce

  const lines: string[] = [];
  const topCity = cities[0];
  const topPct = Math.round((topCity.count / total) * 100);

  const cityList = cities.map((c) => `${c.city}: ${c.count}`).join(", ");
  lines.push(`CITY VISITS (${total} total): ${cityList}`);

  if (topCity.count >= 5 && topPct >= 40) {
    const underexplored = cities.filter((c) => c.count <= 2).map((c) => c.city);
    lines.push(
      `"${topCity.city}" has ${topPct}% of all quests (${topCity.count}/${total}). ` +
      `Prioritize venues in other cities to spread exploration.` +
      (underexplored.length > 0 ? ` Underexplored: ${underexplored.join(", ")}.` : ""),
    );
  }

  return lines.join("\n");
}

export function buildVenueRepeatBlock(
  venues: { venue_name: string; visit_count: number; avg_rating: number; venue_category: string; on_dfs_pathway: boolean }[],
): string {
  if (venues.length === 0) return "";

  const lines: string[] = ["VENUE REPEATS:"];

  for (const v of venues) {
    const isHighResonance = v.avg_rating >= 4;
    const isLowResonance = v.avg_rating < 3;

    if (v.visit_count >= 3 && isLowResonance) {
      // Lazy repeat — hard block regardless of pathway
      lines.push(
        `⚠️ "${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
        `DO NOT send them here again. Find somewhere new.`,
      );
    } else if (v.on_dfs_pathway && isHighResonance) {
      // DFS anchor venue — this is where real growth is happening. Allow generous returns.
      if (v.visit_count >= 8) {
        lines.push(
          `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `Core anchor on a deep pathway. Still valuable, but mix in other venues on this pathway to avoid staleness.`,
        );
      } else {
        lines.push(
          `✅ "${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `This is an anchor venue on a deep pathway — returning here builds real progress. Returning is encouraged, especially with escalating difficulty or new social challenges each time.`,
        );
      }
    } else if (v.visit_count >= 6 && isHighResonance) {
      // High-rated but not on DFS — they love it but need to explore too
      lines.push(
        `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
        `They clearly love this spot. Alternate with new venues — every other quest here is fine, but don't let it crowd out exploration.`,
      );
    } else if (v.visit_count >= 6) {
      // Too many visits with mediocre rating — hard block
      lines.push(
        `⚠️ "${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
        `DO NOT prescribe this venue — they need to explore new places. Find a different venue.`,
      );
    } else if (v.visit_count >= 2 && !isHighResonance) {
      // Mediocre repeat — discourage
      lines.push(
        `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
        `Becoming repetitive. Prefer a different venue this time.`,
      );
    } else if (v.visit_count >= 3 && isHighResonance) {
      // Genuine anchor — allow with encouragement
      lines.push(
        `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
        `This is a valued spot. Returning is OK if the quest escalates — new challenge, new social angle, or deeper engagement each time.`,
      );
    }
  }

  return lines.length > 1 ? lines.join("\n") : "";
}

/**
 * Build anchor venue recommendations — high-rated venues the user should return to.
 * This is the "become a regular" signal. Framed as a positive recommendation, not a constraint.
 */
export function buildAnchorVenueBlock(
  anchors: { venue_name: string; venue_address: string; venue_category: string; visit_count: number; avg_rating: number; last_rating: number; user_opted_in: boolean }[],
  completedQuestCount: number,
): string {
  // Only activate after enough quests to have meaningful signal
  if (anchors.length === 0 || completedQuestCount < 5) return "";

  const optedIn = anchors.filter(a => a.user_opted_in);
  const suggested = anchors.filter(a => !a.user_opted_in);

  const lines: string[] = [];

  if (optedIn.length > 0) {
    lines.push(`\nANCHOR VENUES — USER WANTS TO RETURN:`);
    lines.push(`The user explicitly said they'd come back to these spots. Prioritize return visits here with escalating challenges.`);
    for (const a of optedIn) {
      const visits = a.visit_count === 1 ? "1 visit" : `${a.visit_count} visits`;
      lines.push(`  ★★ "${a.venue_name}" (${a.venue_category}) — ${visits}, avg rating ${a.avg_rating} — USER OPTED IN`);
    }
  }

  if (suggested.length > 0) {
    lines.push(`\nPOTENTIAL ANCHOR VENUES:`);
    lines.push(`These are places the user rated well but hasn't said they'd return to. Use as soft suggestions, not mandates.`);
    for (const a of suggested) {
      const visits = a.visit_count === 1 ? "1 visit" : `${a.visit_count} visits`;
      lines.push(`  ★ "${a.venue_name}" (${a.venue_category}) — ${visits}, avg rating ${a.avg_rating}`);
    }
  }

  return lines.join("\n");
}

export function buildSocialSituationContext(socialSituation: {
  ageRange: string;
  gender: string;
  timeInArea: string;
  currentSocialLife: string;
  lookingFor: string[];
  workSituation: string;
  livingSituation: string;
  dailyRoutine?: string;
  transportation?: string;
  budget?: string;
} | null | undefined, city: string): string {
  if (!socialSituation) return "";

  const timeLabels: Record<string, string> = {
    just_moved: "just moved here",
    under_1yr: "less than a year",
    "1_3yr": "1-3 years",
    "3plus_yr": "3+ years",
  };
  const socialLabels: Record<string, string> = {
    isolated: "pretty isolated",
    few_acquaintances: "a few acquaintances but no real friends",
    casual_friends: "some casual friends",
    solid_group: "a solid friend group",
  };
  const routineLabels: Record<string, string> = {
    nine_to_five: "standard 9-to-5",
    flexible: "flexible hours",
    shift_work: "shift work (irregular hours)",
    nights_weekends: "free nights & weekends",
    unpredictable: "unpredictable schedule",
  };
  const transportLabels: Record<string, string> = {
    car: "has a car",
    transit: "uses public transit",
    bike: "bikes",
    walk: "walks",
    rideshare: "uses rideshare",
  };
  const budgetLabels: Record<string, string> = {
    free_only: "free activities only",
    low: "budget-conscious (under $20/quest)",
    moderate: "$20-$50 per quest",
    flexible: "budget is not a concern",
  };

  // Only include lines where data is actually populated
  const lines: string[] = [];

  // Demographics line — only if we have age or gender
  const hasAge = !!socialSituation.ageRange;
  const hasGender = !!socialSituation.gender && socialSituation.gender !== "prefer_not_to_say";
  if (hasAge || hasGender) {
    const parts = [hasAge ? socialSituation.ageRange : "", hasGender ? socialSituation.gender : ""].filter(Boolean).join(", ");
    lines.push(`- ${parts}, living in ${city}`);
  }

  if (socialSituation.timeInArea) {
    lines.push(`- In area: ${timeLabels[socialSituation.timeInArea] ?? socialSituation.timeInArea}`);
  }
  if (socialSituation.currentSocialLife) {
    lines.push(`- Current social life: ${socialLabels[socialSituation.currentSocialLife] ?? socialSituation.currentSocialLife}`);
  }
  if (socialSituation.lookingFor?.length) {
    lines.push(`- Looking for: ${socialSituation.lookingFor.join(", ")}`);
  }
  if (socialSituation.workSituation) {
    lines.push(`- Work: ${socialSituation.workSituation}`);
  }
  if (socialSituation.livingSituation) {
    lines.push(`- Living: ${socialSituation.livingSituation}`);
  }
  if (socialSituation.dailyRoutine) {
    lines.push(`- Schedule: ${routineLabels[socialSituation.dailyRoutine] ?? socialSituation.dailyRoutine}`);
  }
  if (socialSituation.transportation) {
    lines.push(`- Transportation: ${transportLabels[socialSituation.transportation] ?? socialSituation.transportation}`);
  }
  if (socialSituation.budget) {
    lines.push(`- Budget: ${budgetLabels[socialSituation.budget] ?? socialSituation.budget}`);
  }

  if (lines.length === 0) return "";
  return `SOCIAL SITUATION:\n${lines.join("\n")}`;
}

export function buildFearLadderContext(fearLadder: {
  overallScore: number;
  dimensionScores: Record<string, number>;
  responses: Record<string, number>;
  scenarios?: { id: string; text: string; dimension: string }[];
  dimensions?: string[];
}, readiness: FearLadderReadiness): string {
  const { dimensionScores, responses } = fearLadder;
  const { phase, completedQuests, phaseReason } = readiness;
  const lines: string[] = [];

  lines.push(`- FEAR LADDER ASSESSMENT (phase ${phase}/3): ${phaseReason}`);
  lines.push(`- Progress: ${completedQuests} quests, avg resonance ${readiness.avgResonance.toFixed(2)}, avg rating ${readiness.avgRating.toFixed(1)}${readiness.hasGrowthSignals ? ", showing growth signals in reflections" : ""}`);

  // If we have dynamic (LLM-generated) scenarios, use those for context
  if (fearLadder.scenarios && fearLadder.scenarios.length > 0) {
    return buildDynamicFearLadderContext(fearLadder as Required<Pick<typeof fearLadder, "scenarios">> & typeof fearLadder, readiness, lines);
  }

  // Legacy path: hardcoded scenario-specific guidance
  const scenarioGuidance: Record<string, { hard: string; soft: string; open: string; safe: string }> = {
    coffee_alone:     { hard: "even low-key solo venues feel hard — start with outdoor/walking quests instead", soft: "solo sit-down venues are a gentle stretch — try it if low-key", open: "solo venues should feel comfortable by now", safe: "coffee shops, cafes, and other solo-sit-down spots are great" },
    eat_alone:        { hard: "DO NOT send them to eat at a restaurant alone", soft: "solo dining is a stretch — only if the venue is casual and low-pressure", open: "solo dining could be a good challenge now", safe: "solo dining is fine" },
    park_alone:       { hard: "even solo outdoor spots feel intimidating", soft: "solo outdoor spots are a gentle stretch", open: "solo outdoor is comfortable", safe: "parks, trails, and solo outdoor walks are their comfort zone" },
    talk_stranger:    { hard: "DO NOT require talking to strangers or staff beyond ordering. No \"ask someone about...\" or \"strike up a conversation\" activities", soft: "very light social interaction is OK (e.g. ordering, brief chat) — but don't make it the main challenge", open: "light social interactions are fair game now — the user is building confidence. A suggested activity like \"ask the barista about their favorite\" is fine", safe: "light social interaction is fine" },
    fitness_class:    { hard: "DO NOT prescribe fitness classes, yoga studios, group exercise, or any class-format activity", soft: "group classes are still a big stretch — only consider very beginner-friendly, drop-in options", open: "fitness/yoga classes are now worth trying — the user has built enough confidence for structured group settings", safe: "group fitness classes are fine" },
    group_event:      { hard: "DO NOT prescribe meetups, group events, workshops, or any activity where they'd join a group of strangers", soft: "small, casual group settings (e.g. a workshop with 5 people) are worth considering — but nothing large or formal", open: "group events and meetups are on the table — the user has enough experience to handle them", safe: "group events and meetups are fine" },
    new_activity:     { hard: "stick to activities adjacent to what they already know — do NOT throw them into something completely unfamiliar", soft: "new activities are OK if they're adjacent to familiar ones — no total unknowns yet", open: "novel activities are welcome — the user is ready to explore", safe: "novel activities are welcome" },
    new_neighborhood: { hard: "stay in or near familiar areas — unfamiliar neighborhoods add too much stress", soft: "new neighborhoods are OK if there's a familiar anchor (e.g. a coffee shop in a new area)", open: "exploring new neighborhoods should feel natural now", safe: "exploring new neighborhoods is fine" },
    ask_rec:          { hard: "avoid activities that require asking strangers for help or recommendations", soft: "very light ask-for-help moments are OK — like asking a cashier, not a stranger on the street", open: "asking people for recs is a reasonable challenge now", safe: "asking people for recs is comfortable" },
    live_show:        { hard: "DO NOT send them to concerts, shows, or performances alone — too exposed", soft: "small intimate performances could work — nothing large or high-energy", open: "live shows and performances solo are a solid growth challenge now", safe: "live shows and performances solo are fine" },
  };

  const constraints: string[] = [];
  const safeBets: string[] = [];

  for (const [scenarioId, guidance] of Object.entries(scenarioGuidance)) {
    const rating = responses[scenarioId];
    if (rating == null) continue;

    if (rating >= 4) {
      if (phase === 0) constraints.push(guidance.hard);
      else if (phase === 1) constraints.push(guidance.soft);
      else if (phase === 2) constraints.push(guidance.open);
    } else if (rating === 3 && phase === 0) {
      constraints.push(guidance.soft);
    } else if (rating <= 2) {
      safeBets.push(guidance.safe);
    }
  }

  if (constraints.length > 0) {
    const header = phase === 0
      ? "HARD CONSTRAINTS (user rated these scenarios 4-5 out of 5 scary — respect these):"
      : phase === 1
      ? "SOFT CONSTRAINTS (user found these scary — they're responding well to quests but approach these with care):"
      : "GROWTH OPPORTUNITIES (user originally found these scary — their feedback shows they may be ready):";
    lines.push(`\n${header}`);
    for (const c of constraints) {
      lines.push(`  - ${c}`);
    }
  }

  if (safeBets.length > 0) {
    lines.push(`\nSAFE ZONES (user rated these 1-2 — reliable comfort options):`);
    for (const safe of safeBets) {
      lines.push(`  - ${safe}`);
    }
  }

  // Dimension summary
  const dimLabels: Record<string, string> = {
    solo: "Being alone in public",
    social: "Social interaction",
    novelty: "Trying new things",
    physical: "Physical/outdoor activities",
    vulnerability: "Feeling exposed",
  };

  const dimSummary = Object.entries(dimensionScores)
    .map(([dim, score]) => `${dimLabels[dim] ?? dim}: ${score <= 0.25 ? "comfortable" : score <= 0.5 ? "moderate" : score <= 0.75 ? "anxious" : "very anxious"}`)
    .join(", ");
  lines.push(`- Dimension summary: ${dimSummary}`);

  return lines.join("\n");
}

/**
 * Build fear ladder context from LLM-generated (dynamic) scenarios.
 * Uses the scenario text and dimension to generate guidance based on rating + phase.
 */
export function buildDynamicFearLadderContext(fearLadder: {
  overallScore: number;
  dimensionScores: Record<string, number>;
  responses: Record<string, number>;
  scenarios: { id: string; text: string; dimension: string }[];
  dimensions?: string[];
}, readiness: FearLadderReadiness, lines: string[]): string {
  const { dimensionScores, responses, scenarios } = fearLadder;
  const { phase } = readiness;

  const highScary: string[] = [];
  const moderateScary: string[] = [];
  const comfortable: string[] = [];

  for (const scenario of scenarios) {
    const rating = responses[scenario.id];
    if (rating == null) continue;

    const label = `"${scenario.text}" (${scenario.dimension})`;

    if (rating >= 4) {
      if (phase === 0) {
        highScary.push(`AVOID quests similar to ${label} — user rated this ${rating}/5 scary and is still early in their journey`);
      } else if (phase === 1) {
        highScary.push(`Approach with care: ${label} rated ${rating}/5 — user is progressing but this is still a big stretch`);
      } else if (phase === 2) {
        moderateScary.push(`Growth opportunity: ${label} was rated ${rating}/5 but user's feedback suggests they may be ready`);
      }
      // Phase 3: no constraint
    } else if (rating === 3 && phase === 0) {
      moderateScary.push(`Gentle stretch: ${label} rated ${rating}/5 — approach carefully at this stage`);
    } else if (rating <= 2) {
      comfortable.push(`${label} — user is comfortable with this type of challenge`);
    }
  }

  if (highScary.length > 0) {
    const header = phase === 0
      ? "HARD CONSTRAINTS (user rated these scenarios highly scary — respect these):"
      : phase === 1
      ? "SOFT CONSTRAINTS (user found these scary — approaching with care):"
      : "GROWTH OPPORTUNITIES (user may be ready for these):";
    lines.push(`\n${header}`);
    for (const c of highScary) lines.push(`  - ${c}`);
  }

  if (moderateScary.length > 0 && phase <= 1) {
    lines.push(`\nMODERATE CHALLENGES:`);
    for (const c of moderateScary) lines.push(`  - ${c}`);
  }

  if (comfortable.length > 0) {
    lines.push(`\nSAFE ZONES (user rated these comfortable):`);
    for (const c of comfortable) lines.push(`  - ${c}`);
  }

  // Dimension summary using dynamic dimension names
  const dimSummary = Object.entries(dimensionScores)
    .map(([dim, score]) => {
      const label = dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return `${label}: ${score <= 0.25 ? "comfortable" : score <= 0.5 ? "moderate" : score <= 0.75 ? "anxious" : "very anxious"}`;
    })
    .join(", ");
  lines.push(`- Dimension summary: ${dimSummary}`);

  return lines.join("\n");
}

/**
 * Build LLM context from expectancy violation data.
 * Tells the agent how miscalibrated the user's fear predictions are,
 * so it can push harder when the user consistently overestimates threat.
 */
export function buildExpectancyContext(cal: NonNullable<import("../../entities").User["expectancyCalibration"]>): string {
  if (cal.totalViolations < 2) return ""; // Not enough data yet

  const lines: string[] = [];
  lines.push(`\nEXPECTANCY VIOLATION DATA (${cal.totalViolations} quests with predictions):`);

  // Interpret the anxiety calibration
  const avgAnx = cal.avgAnxietyDelta;
  if (avgAnx > 1.5) {
    lines.push(`- STRONG OVERESTIMATOR: On average, this user predicts anxiety ${avgAnx.toFixed(1)} points higher than reality. Their fear model is significantly miscalibrated — they're consistently more capable than they think. You can push harder than their fear ladder suggests.`);
  } else if (avgAnx > 0.5) {
    lines.push(`- MILD OVERESTIMATOR: This user tends to predict ${avgAnx.toFixed(1)} points more anxiety than they actually experience. They're generally pleasantly surprised by their quests — gentle escalation is working.`);
  } else if (avgAnx < -0.5) {
    lines.push(`- UNDERESTIMATOR: This user actually feels MORE anxious than predicted (${Math.abs(avgAnx).toFixed(1)} points). Quests are landing harder than expected — ease up or stay at current level.`);
  } else {
    lines.push(`- WELL CALIBRATED: Predictions roughly match reality (Δ${avgAnx.toFixed(1)}). Their self-awareness is good — trust their comfort level signals.`);
  }

  // Difficulty calibration
  const avgDiff = cal.avgDifficultyDelta;
  if (avgDiff > 1.0) {
    lines.push(`- They also overestimate difficulty by ~${avgDiff.toFixed(1)} points — quests feel easier than expected. Consider bumping target difficulty.`);
  } else if (avgDiff < -0.5) {
    lines.push(`- They underestimate difficulty by ~${Math.abs(avgDiff).toFixed(1)} points — quests feel harder than expected. Keep difficulty conservative.`);
  }

  // Recent trend (are they getting better calibrated or worse?)
  if (cal.recentViolations.length >= 3) {
    const recent3 = cal.recentViolations.slice(0, 3);
    const recentAvgAnx = recent3.reduce((sum, v) => sum + v.anxietyDelta, 0) / recent3.length;
    if (Math.abs(recentAvgAnx - avgAnx) > 0.5) {
      if (recentAvgAnx > avgAnx) {
        lines.push(`- TREND: Recent quests show even larger overestimation — their confidence is growing faster than their predictions reflect.`);
      } else {
        lines.push(`- TREND: Recent quests show smaller overestimation — they're calibrating better. Their predictions are becoming more accurate.`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Build difficulty guidance for the LLM instead of dictating a specific number.
 * The LLM should judge difficulty based on the actual quest relative to the user's profile.
 */
export function buildDifficultyGuidance(pace: string, readiness: FearLadderReadiness, isStretch = false, isEnjoy = false, difficultyTier?: "easy" | "medium" | "stretch"): string {
  // Onboarding tier overrides — each quest in the first pack gets a distinct difficulty band
  if (difficultyTier === "easy") {
    return `- DIFFICULTY GUIDANCE: This is the EASY tier — their first quest should be a quick win. Difficulty MUST be 1-2. Pick something approachable, close to home, low commitment. The goal is to show them what a quest feels like with zero intimidation.`;
  }
  if (difficultyTier === "medium") {
    return `- DIFFICULTY GUIDANCE: This is the MEDIUM tier — a step up from the easy quest. Difficulty MUST be 3-4. Pick something that requires a bit more effort or novelty — a new neighborhood, a slightly unfamiliar activity, a longer outing. It should feel doable but not trivial.`;
  }
  if (difficultyTier === "stretch") {
    return `- DIFFICULTY GUIDANCE: This is the STRETCH tier — an ambitious option for when they're feeling brave. Difficulty MUST be 5-7. Push on novelty and distance — a category they haven't tried, further from home. It should feel exciting, not terrifying. This exists so they always have a way to leap ahead.`;
  }

  if (isEnjoy) {
    return `- DIFFICULTY GUIDANCE: This is an ENJOY quest — a cheat meal. Difficulty 1-3 ONLY. This is NOT about growth, NOT about their goal. Pick something purely fun based on their interests. Think: great food, games, scenic spots, live music, adventure activities. The only thing that matters is they'd smile doing it.`;
  }

  if (isStretch) {
    return `- DIFFICULTY GUIDANCE: This is a STRETCH quest. Pick something that genuinely pushes them — aim for difficulty 6-9. They've earned this challenge.`;
  }

  if (readiness.phase === 0) {
    return `- DIFFICULTY GUIDANCE: They're just starting out. Difficulty MUST be 1-3. Do NOT exceed 3. This is a hard constraint — easy wins build momentum and trust. Anything above 3 will overwhelm a new user.`;
  }

  if (readiness.phase === 1) {
    const hint = readiness.recentAvgDifficulty <= 3
      ? ` Their recent quests averaged difficulty ${readiness.recentAvgDifficulty.toFixed(1)} — if they're rating 3+ stars, it's time to nudge upward.`
      : "";
    return `- DIFFICULTY GUIDANCE: They're building confidence. Difficulty MUST be 2-5. Do NOT exceed 5. Gentle stretches are landing well. Don't default to the low end; if their recent ratings are 3+ stars, lean toward 4-5.${hint}`;
  }

  if (readiness.phase === 2) {
    const hint = readiness.recentAvgDifficulty <= 4
      ? ` Their recent quests averaged difficulty ${readiness.recentAvgDifficulty.toFixed(1)} — they've been coasting. Push into 5-6 territory.`
      : "";
    return `- DIFFICULTY GUIDANCE: They're showing real growth. Difficulty MUST be 4-7. Do NOT go below 4 or above 7. Push toward meaningful challenges — do NOT default to the bottom of this range. They can handle more than they think.${hint}`;
  }

  // Phase 3 — thriving
  const questCount = readiness.completedQuests;
  if (questCount >= 40) {
    return `- DIFFICULTY GUIDANCE: Veteran explorer — ${questCount} quests completed, thriving. The full 1-10 range is open. Match difficulty to the actual challenge of the quest for THIS person. Don't hold back if the quest warrants it.`;
  }

  return `- DIFFICULTY GUIDANCE: They're thriving. Lean into growth edges — aim for difficulty 5-8. Recent avg difficulty was ${readiness.recentAvgDifficulty.toFixed(1)} — push meaningfully above that. Use your judgment based on the specific venue and activity.`;
}

export function buildSiblingInstructions(ctx: {
  batchIndex: number;
  totalInBatch: number;
  questRole: string;
  difficultyTier?: string;
  targetPathway?: { id: string; theme: string; label: string; phase: string };
  previousSiblings: { title: string; venueCategory: string; venueName: string }[];
}): string {
  const lines: string[] = [];

  lines.push(`\nWEEKLY PACK CONTEXT (quest ${ctx.batchIndex + 1} of ${ctx.totalInBatch}):`);

  if (ctx.questRole === "deepen" && ctx.targetPathway) {
    lines.push(
      `- ROLE: DEEPEN. This quest should deepen the user's "${ctx.targetPathway.label}" pathway.`,
      `  Pick a venue in the "${ctx.targetPathway.theme}" category. Escalate slightly — busier time, social element, or a new angle within this category.`,
    );
  } else if (ctx.questRole === "explore") {
    lines.push(
      `- ROLE: EXPLORE. This quest should push into NEW territory the user hasn't tried.`,
      `  Avoid categories already covered by active pathways. Prioritize novelty.`,
    );
  } else if (ctx.questRole === "enjoy") {
    lines.push(
      `- ROLE: ENJOY — THIS IS A CHEAT MEAL. This quest is a pure reward. NOT about their goal, NOT about growth.`,
      `  Think: a great restaurant, a disc golf course, an arcade, a scenic trail, a fun brewery, a concert — whatever this person would genuinely have FUN doing.`,
      `  Pick something based on their stated interests/activities, not their pathways. Ignore their goal and barriers for this quest.`,
      `  No social pressure. No journaling expectation. No growth framing. Just fun.`,
      `  Stay within their comfort radius. Difficulty 1-3. The only metric: would they smile doing this?`,
    );
  } else if (ctx.questRole === "stretch") {
    lines.push(
      `- ROLE: STRETCH GOAL. This quest is an optional accelerator — it should push BEYOND the user's current comfort zone.`,
      `  This card exists so the user always has a way to leap ahead if they're feeling brave.`,
      `  Push on MULTIPLE dimensions simultaneously: further distance AND unfamiliar category AND higher social/novelty challenge.`,
      `  Target difficulty should be significantly above their usual range — this is the card that pushes boundaries.`,
      `  Search further out — aim for 1.5-2x the user's current comfort radius.`,
      `  Pick venues or activities that would be a genuine stretch: a new neighborhood, a category they haven't tried, a social element they'd normally avoid.`,
      `  The quest should feel ambitious but NOT impossible — exciting, not terrifying.`,
      `  DO NOT soften this quest to match their current level. The other 2 cards in this batch already do that.`,
    );
  } else if (ctx.difficultyTier === "easy") {
    lines.push(
      `- ROLE: EASY START. This is their very first quest — make it a quick, approachable win.`,
      `  Search within 3-5 miles of the user's location. Pick somewhere close, familiar-feeling, low time commitment.`,
      `  Think: a cozy cafe, a nearby park, a casual spot they could walk or make a short drive to.`,
      `  The goal is to build trust in the system. They should finish this and think "that was easy, what's next?"`,
    );
  } else if (ctx.difficultyTier === "medium") {
    lines.push(
      `- ROLE: MEDIUM CHALLENGE. This quest should feel like a meaningful step up from the easy one.`,
      `  A bit more novelty — a neighborhood they don't frequent, an activity with a slightly higher bar.`,
      `  Still very doable, but it should feel like they accomplished something.`,
    );
  } else {
    lines.push(`- ROLE: DISCOVER. Explore freely — the user is just getting started.`);
  }

  if (ctx.previousSiblings.length > 0) {
    lines.push(`- Already prescribed in this batch (DO NOT duplicate venues or categories):`);
    for (const s of ctx.previousSiblings) {
      lines.push(`  • "${s.title}" at ${s.venueName} (${s.venueCategory})`);
    }
  }

  return lines.join("\n");
}

/**
 * Build role instructions for individual (non-pack) prescriptions.
 * Lighter than buildSiblingInstructions — no batch context, just the role guidance.
 */
export function buildIndividualRoleInstructions(
  role: string,
  targetPathway?: { id: string; theme: string; label: string; phase: string },
  activities?: string[],
): string {
  if (role === "enjoy") {
    const activityHint = activities?.length
      ? `Their stated interests: ${activities.join(", ")}.`
      : "Pick something universally fun — good food, games, nature, music.";
    return [
      `\nQUEST ROLE: ENJOY — THIS IS A CHEAT MEAL`,
      `This quest is a pure reward. It is NOT about their goal, NOT about growth, NOT about pathways.`,
      `Think: a great restaurant, a disc golf course, an arcade, a scenic trail, a fun brewery, a concert, a go-kart track, a farmers market — whatever this person would genuinely have FUN doing.`,
      `${activityHint}`,
      `Pick something based on what they'd choose on a perfect free afternoon. Ignore their goal, their barriers, their pathways — this quest exists to make them glad they opened the app.`,
      `No social pressure. No journaling expectation. No "notice how this connects to your goal." Just fun.`,
      `Stay within or near their comfort radius. Difficulty 1-3. The only metric that matters is: would they smile doing this?`,
    ].join("\n");
  }

  if (role === "stretch") {
    return [
      `\nQUEST ROLE: STRETCH`,
      `This quest should push BEYOND their current comfort zone.`,
      `Push on MULTIPLE dimensions: further distance AND unfamiliar category AND higher social challenge.`,
      `Target difficulty should be significantly above their usual range.`,
      `Search further out — aim for 1.5-2x their comfort radius.`,
      `The quest should feel ambitious but NOT impossible — exciting, not terrifying.`,
    ].join("\n");
  }

  // "explore" — no special instructions needed, default behavior is exploration
  return "";
}

// ─── Fear Ladder Readiness (resonance-driven) ──────────────────

export async function computeFearLadderReadiness(dataSource: DataSource, userId: string): Promise<FearLadderReadiness> {
  // Single query: get completed quests with their objective data
  const rows: {
    rating: number | null;
    difficulty: number | null;
    reflection_sentiment: number | null;
    reflection_tags: string[] | null;
    completed_at: Date;
  }[] = await dataSource.query(`
    SELECT
      s.rating,
      o.difficulty,
      o.reflection_sentiment,
      o.reflection_tags,
      s.completed_at
    FROM sidequests s
    JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
    WHERE s.user_id = $1
      AND s.completed_at IS NOT NULL
      AND s.deleted_at IS NULL
    ORDER BY s.completed_at DESC
  `, [userId]);

  const completedQuests = rows.length;

  if (completedQuests === 0) {
    return {
      phase: 0, completedQuests: 0, avgResonance: 0, recentResonance: 0,
      avgRating: 0, hasGrowthSignals: false, positiveQuestCount: 0,
      recentAvgDifficulty: 0, hasDfsPathway: false,
      phaseReason: "No quests completed yet — starting gentle",
    };
  }

  // Compute signals
  const ratings = rows.filter(r => r.rating != null).map(r => r.rating!);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  const difficulties = rows.filter(r => r.difficulty != null).map(r => r.difficulty!);
  const recentDifficulties = difficulties.slice(0, 5);
  const recentAvgDifficulty = recentDifficulties.length > 0
    ? recentDifficulties.reduce((a, b) => a + b, 0) / recentDifficulties.length : 1;

  const positiveQuestCount = rows.filter(r =>
    r.reflection_sentiment != null && r.reflection_sentiment > 0.2
  ).length;

  const growthTags = new Set(["growth_narrative", "discomfort_processed", "social_connection", "self_awareness"]);
  const hasGrowthSignals = rows.some(r =>
    r.reflection_tags?.some(tag => growthTags.has(tag))
  );

  // Check for DFS pathways
  const dfsCount: { count: number }[] = await dataSource.query(
    `SELECT COUNT(*)::int as count FROM pathways WHERE user_id = $1 AND phase = 'dfs'`,
    [userId],
  );
  const hasDfsPathway = (dfsCount[0]?.count ?? 0) > 0;

  // Get resonance scores from pathways
  const pathwayRows: { resonance_scores: { score: number }[] }[] = await dataSource.query(
    `SELECT resonance_scores FROM pathways WHERE user_id = $1 AND resonance_scores IS NOT NULL`,
    [userId],
  );
  const allResonanceScores = pathwayRows.flatMap(p => (p.resonance_scores ?? []).map(r => r.score));
  const avgResonance = allResonanceScores.length > 0
    ? allResonanceScores.reduce((a, b) => a + b, 0) / allResonanceScores.length : 0;
  const recentScores = allResonanceScores.slice(0, 5);
  const recentResonance = recentScores.length > 0
    ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;

  // ── Phase determination (resonance-driven with persistence as a signal) ──
  //
  // Three paths to phase advancement — user can advance via ANY of these:
  //   A) Strong feedback: high ratings + resonance (they love it)
  //   B) Growth signals: reflection tags show self-awareness, growth narratives
  //   C) Persistence: they keep showing up consistently, even at moderate ratings
  //      Showing up 8+ times at 3 stars IS progress — they're building the habit.
  //
  // Phase 0 → 1: ≥3 quests AND (avg rating ≥ 3 OR avg resonance ≥ 0.4)
  //              Signal: "they're going out and not hating it"
  //
  // Phase 1 → 2: ANY of:
  //   - Growth signals in reflections (any quest)
  //   - Avg rating ≥ 3.5 with ≥5 quests
  //   - Persistence: ≥8 quests with avg rating ≥ 2.5 (kept showing up)
  //   Signal: "they're either growing, thriving, or building the habit"
  //
  // Phase 2 → 3: ANY of:
  //   - Has DFS pathway (found something they deeply resonate with)
  //   - Recent resonance ≥ 0.55 AND avg rating ≥ 3.5
  //   - Persistence: ≥15 quests with avg rating ≥ 3 (long-term commitment)
  //   Signal: "they've earned the full menu"

  let phase = 0;
  let phaseReason = "Early days — building the habit of going out";

  // Phase 0 → 1: low bar — they're going out and it's OK
  if (completedQuests >= 3 && (avgRating >= 3 || avgResonance >= 0.4)) {
    phase = 1;
    phaseReason = `Going out and responding OK (${completedQuests} quests, avg rating ${avgRating.toFixed(1)}) — ready for gentle stretches`;
  }

  // Phase 1 → 2: growth OR persistence
  if (phase >= 1) {
    if (hasGrowthSignals) {
      phase = 2;
      phaseReason = `Showing growth signals in reflections — ready for real challenges`;
    } else if (completedQuests >= 5 && avgRating >= 3.5) {
      phase = 2;
      phaseReason = `Consistently positive (avg rating ${avgRating.toFixed(1)} across ${completedQuests} quests) — opening up`;
    } else if (completedQuests >= 8 && avgRating >= 2.5) {
      phase = 2;
      phaseReason = `Persistent — ${completedQuests} quests completed. Showing up consistently is growth. Time to stretch`;
    }
  }

  // Phase 2 → 3: deep engagement OR long-term commitment
  if (phase >= 2) {
    if (hasDfsPathway) {
      phase = 3;
      phaseReason = "Found a deep passion pathway — fully open to growth";
    } else if (recentResonance >= 0.55 && avgRating >= 3.5) {
      phase = 3;
      phaseReason = `Thriving (rating ${avgRating.toFixed(1)}, resonance ${recentResonance.toFixed(2)}) — no constraints needed`;
    } else if (completedQuests >= 15 && avgRating >= 3) {
      phase = 3;
      phaseReason = `Long-term commitment — ${completedQuests} quests at avg ${avgRating.toFixed(1)} stars. They've earned the full menu`;
    }
  }

  // Expectancy violation accelerator: if they consistently overestimate fear,
  // they're more capable than the standard signals suggest — bump up a phase.
  // Requires enough data (3+ violations) and strong overestimation (avg > 1.5).
  const cal = await dataSource.getRepository(User).findOne({
    where: { id: userId },
    select: ["id", "expectancyCalibration"],
  });
  if (cal?.expectancyCalibration && cal.expectancyCalibration.totalViolations >= 3) {
    const avgAnxDelta = cal.expectancyCalibration.avgAnxietyDelta;
    if (avgAnxDelta > 1.5 && phase < 3) {
      phase = Math.min(3, phase + 1);
      phaseReason = `Strong fear overestimator (avg Δ${avgAnxDelta.toFixed(1)}) — their predictions consistently overshoot reality. Accelerating.`;
    }
  }

  // Safety valve: if recent quests have LOW ratings, drop back a phase.
  // This prevents escalation when the user is genuinely struggling.
  // Exclude 1-star ratings — these are often blocker-triggered avoidance
  // and should not penalise the user's phase progression.
  const recentRatings = ratings.slice(0, 5);
  const recentNonBlockerRatings = recentRatings.filter(r => r > 1);
  const recentAvgRating = recentNonBlockerRatings.length > 0
    ? recentNonBlockerRatings.reduce((a, b) => a + b, 0) / recentNonBlockerRatings.length : avgRating;
  // Only drop phase if we have enough non-blocker data AND it's still low,
  // and never undo an expectancy-accelerated phase bump in the same pass.
  const wasAccelerated = cal?.expectancyCalibration
    && cal.expectancyCalibration.totalViolations >= 3
    && cal.expectancyCalibration.avgAnxietyDelta > 1.5;
  if (recentAvgRating < 2.5 && phase > 0 && recentNonBlockerRatings.length >= 3 && !wasAccelerated) {
    phase = Math.max(0, phase - 1);
    phaseReason = `Recent quests aren't landing well (recent avg rating ${recentAvgRating.toFixed(1)}) — pulling back`;
  }

  return {
    phase, completedQuests, avgResonance, recentResonance,
    avgRating, hasGrowthSignals, positiveQuestCount,
    recentAvgDifficulty, hasDfsPathway, phaseReason,
  };
}

// ─── Individual Quest Role Selection ──────────────────────────────

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
