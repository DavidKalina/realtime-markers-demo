import { OpenAIModel, type OpenAIService } from "../shared/OpenAIService";
import type {
  LLMResponseRaw,
  PrescriptionStrategyInput,
  ScoutCandidate,
  StrategyBrief,
} from "./PrescriptionStrategy";
import {
  detectGoalActionType,
  normalizeGoalActionType,
} from "./GoalMilestoneContext";

interface QuestWriterAgentDeps {
  openAIService: OpenAIService;
  model: string;
}

export class QuestWriterAgent {
  private openAIService: OpenAIService;
  private model: string;

  constructor(deps: QuestWriterAgentDeps) {
    this.openAIService = deps.openAIService;
    this.model = deps.model;
  }

  async run(
    input: PrescriptionStrategyInput,
    brief: StrategyBrief,
    venue: ScoutCandidate,
  ): Promise<LLMResponseRaw> {
    const systemPrompt = buildWriterPrompt(input, brief, venue);

    const response = await this.openAIService.executeChatCompletion(
      {
        model: this.model as OpenAIModel,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: "Write this quest. Make it warm and personal.",
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_completion_tokens: 2000,
      },
      "writer_agent",
    );

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      console.error(
        `[multi-agent] Writer returned empty response. Finish reason: ${response.choices[0]?.finish_reason}`,
      );
      return fallbackQuest(brief, venue);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error(
        `[multi-agent] Writer returned invalid JSON (${text.length} chars). Attempting repair...`,
      );
      parsed = repairWriterJson(text);
    }

    normalizeWriterOutput(parsed, input, brief, venue);
    return parsed as unknown as LLMResponseRaw;
  }
}

function buildWriterPrompt(
  input: PrescriptionStrategyInput,
  brief: StrategyBrief,
  venue: ScoutCandidate,
): string {
  const ctx = input.promptContext;
  return `You are a Quest Writer for someone building a social life. You craft warm, encouraging quests that make showing up feel achievable — not clinical, not cringe. You receive a venue and a user profile — your job is to make this quest feel like something a thoughtful friend would suggest.

Write like that friend, not a therapist or a GPS app.

USER:
${ctx.user.comfortProfile?.primaryGoal ? `- Goal: "${ctx.user.comfortProfile.primaryGoal}"` : ""}
${ctx.user.comfortProfile?.barriers ? `- Barriers: "${ctx.user.comfortProfile.barriers}"` : ""}
- Pace: ${ctx.pace}
${ctx.user.onboardingProfile?.activities?.length ? `- Interests: ${ctx.user.onboardingProfile.activities.join(", ")}` : ""}

STRATEGY CONTEXT:
- Capacity rep (THE primary thing being trained): ${brief.capacityTrack} — "${brief.repIntent}"
- Experience type: ${brief.experienceType}
- Social challenge: ${brief.socialChallengeLevel}
- Strategy difficulty range: ${brief.difficultyRange[0]}-${brief.difficultyRange[1]} — the final df MUST stay inside this range.
- Suggested timing: ${brief.suggestedTiming || "flexible"}
- Rationale: ${brief.rationale}
- Opportunity scope: ${brief.opportunityScope ?? "local_home_base"}
${brief.travelRationale ? `- Travel rationale: ${brief.travelRationale}` : ""}

The venue is the environment. The rep is the prescription. Your title, description, smaller/tiny versions, minimum viable win, and hook should all reinforce the capacity rep above — not just describe the venue.
${
  brief.travelRationale && brief.opportunityScope !== "clamped_home"
    ? `
REGIONAL / NEARBY OPPORTUNITY FRAMING:
This venue requires extra travel. Name that honestly in the summary, strategy note, or hook. Frame it as an intentional opportunity-zone quest because the user's home base may be too sparse for this goal. Difficulty should include travel load.`
    : ""
}
${
  ctx.goalMilestoneContext
    ? `
${ctx.goalMilestoneContext}
IMPORTANT: The GOAL MILESTONE MAP is a journey/planning milestone. It is NOT the same as objective act="milestone". Only use act="milestone" when the HISTORY context has an explicit reflection MILESTONE CHECK.`
    : ""
}
${
  ctx.activeGoalMilestone?.goalClosureDue
    ? `
GOAL-CLOSURE MILESTONE WRITING RULES:
- The FULL REP ("d") must include one direct dating-intent action tied to this real venue.
- Good full-rep actions: send a dating-app match a specific invite to this venue, suggest coffee/drinks to someone already in conversation, ask for contact info after a good interaction, or make a natural low-pressure invitation.
- The smaller rep may be drafting the message or choosing the exact invite. The tiny rep may be opening the app, writing the first line, or saving the venue.
- Do NOT set act="milestone" for this; use act="actionable" because this is a goal-action milestone, not a reflection checkpoint.`
    : ""
}
${
  ctx.blockerContext
    ? `
BLOCKER CONTEXT — READ THIS CAREFULLY:
This user has a recurring blocker. They keep failing at a specific action and it's destroying their confidence.
${ctx.blockerContext}
DO NOT include the blocked action as an objective, action item, or suggested activity. Instead, frame the quest around the VENUE EXPERIENCE ITSELF — enjoying the space, building comfort, noticing details. If social interaction might happen naturally, that's fine, but it must NOT be a prescribed step. The user needs to rebuild confidence through easy wins, not face another failure.`
    : ""
}

${ctx.difficultyGuidance}
${
  ctx.socialMicroRepContext
    ? `
${ctx.socialMicroRepContext}`
    : ""
}

VENUE:
- Name: ${venue.venueName}
- Address: ${venue.venueAddress}
- Category: ${venue.venueCategory}
${venue.notes ? `- Why chosen: ${venue.notes}` : ""}

REP VARIANTS — IMPORTANT:
Every prescription MUST ship with three versions, a minimum viable win, and an exit ramp. This is how we make failure safe.

- "d" (full rep): the target version — what you'd ideally like them to do.
- "sr" (smaller rep): a reduced-intensity fallback. Same venue, same capacity direction, lower demand. Example if full is "attend the 45-minute class": smaller could be "walk in, stay for 10 minutes, leave when you want."
- "tr" (tiny rep): the minimum viable action. Still counts. Example: "walk to the entrance and decide whether to go in. Either answer is fine."
- "mvw" (minimum viable win): one short line describing what counts as "I did the thing." The bar for calling it done. Example: "You made it through the door." or "You stayed for one song."
- "er" (exit ramp): one short line describing how they can leave without failure. Example: "Leave anytime — no penalty, no explanation owed." or "If it feels off in the first 5 minutes, walk out."

The tiny rep should be almost impossible to fail. The full rep can stretch. Never prescribe multiple dimensions of stretch at once (not both distance AND social intensity — pick one).

Respond with JSON. The "items" array must contain EXACTLY 1 stop — no more:
{
  "t": "<title, 3-6 words, warm and encouraging>",
  "s": "<summary, 1-2 sentences framing why this quest matters for their growth>",
  "sn": "<strategy note: 1-2 sentences explaining WHY you chose this quest for this user right now. Write like a thoughtful friend explaining their reasoning. Reference specific things — their visit count, comfort progression, social tier, or growth phase. Examples: 'You've been here twice — a third visit is when staff start recognizing you.', 'This is a group class because you've proven you can go places solo. Time to be around people.'>",
  "items": [{
    "t": "<stop title>",
    "d": "<FULL REP. 2-3 sentences max. What to do — concrete and direct. No URLs or phone numbers here>",
    "sr": "<SMALLER REP. 1-2 sentences. Reduced intensity, same direction of growth. Required.>",
    "tr": "<TINY REP. 1-2 sentences. The minimum viable action — should feel almost impossible to fail. Required.>",
    "mvw": "<MINIMUM VIABLE WIN. One short line. What counts as 'done'. Required.>",
    "er": "<EXIT RAMP. One short line. How to leave without failure. Required.>",
    "e": "<emoji>",
    "ec": <estimated cost or null>,
    "vn": "${venue.venueName}",
    "va": "${venue.venueAddress}",
    "eid": null,
    "vc": "${venue.venueCategory}",
    "hook": "<why THIS spot expands their world — 1 sentence, make it feel personal>",
    "sa": ["<2-3 emoji-prefixed activity ideas — what people typically do here. Examples: '🚶 Walk the loop', '📸 Snap a photo'. NO URLs or phones here>"],
    "ai": ["<1-3 concrete next steps with links/phones/instructions. Examples: '🔗 example.com/signup — register for class', '📞 (555) 123-4567 — ask about open hours'. Only include if actionable info exists, otherwise empty array>"],
    "jp": "<reflective journal prompt — short, open-ended, personal>",
    "df": <difficulty 1-10 — judge based on THIS venue for THIS person. Use the FULL range from the difficulty guidance, not just the bottom. If guidance says 4-7, don't default to 4>,
    "act": "<actionable|suggestive|milestone>",
    "dgt": <boolean — true only when the full rep directly touches the user's named goal>,
    "gat": "<none|dating_app_invite|suggest_coffee|ask_contact|natural_invitation|other_direct_goal_action>"
  }]
}`;
}

function fallbackQuest(
  brief: StrategyBrief,
  venue: ScoutCandidate,
): LLMResponseRaw {
  return {
    t: `Visit ${venue.venueName}`,
    s: brief.rationale,
    sn: brief.rationale,
    items: [
      {
        t: venue.venueName,
        d: `Head to ${venue.venueName} and explore what catches your eye.`,
        sr: `Walk to ${venue.venueName}, step inside, stay for five minutes. Leave when you're ready.`,
        tr: `Walk to the entrance and decide whether to go in. Either answer counts.`,
        mvw: "You made it to the door.",
        er: "Leave anytime — no penalty, no explanation owed.",
        e: "📍",
        ec: null,
        vn: venue.venueName,
        va: venue.venueAddress,
        eid: null,
        vc: venue.venueCategory,
        hook: brief.rationale,
        sa: [
          "🚶 Just show up and look around",
          "📸 Take a photo",
          "💬 Say hi to someone",
        ],
        ai: [],
        jp: "How did it feel to go somewhere new?",
        df: brief.difficultyRange[0],
        act: "suggestive",
        dgt: false,
        gat: "none",
      },
    ],
  };
}

function repairWriterJson(text: string): Record<string, unknown> {
  let repaired = text;
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
  try {
    const parsed = JSON.parse(repaired);
    console.log("[multi-agent] JSON repair succeeded");
    return parsed;
  } catch {
    throw new Error(
      `Writer produced unparseable JSON: ${text.slice(0, 200)}...`,
    );
  }
}

function normalizeWriterOutput(
  parsed: Record<string, unknown>,
  input: PrescriptionStrategyInput,
  brief: StrategyBrief,
  venue: ScoutCandidate,
): void {
  const ctx = input.promptContext;

  if ((parsed as any).items?.length > 1) {
    (parsed as any).items = (parsed as any).items.slice(0, 1);
  }

  if (!(parsed as any).items?.[0]) return;

  const item = (parsed as any).items[0];
  item.vn = venue.venueName;
  item.va = venue.venueAddress;
  item.vc = venue.venueCategory;

  const rawDifficulty = Number(item.df);
  if (Number.isFinite(rawDifficulty)) {
    const clampedDifficulty = Math.max(
      brief.difficultyRange[0],
      Math.min(brief.difficultyRange[1], Math.round(rawDifficulty)),
    );
    if (clampedDifficulty !== rawDifficulty) {
      console.log(
        `[multi-agent] Writer difficulty clamp: ${rawDifficulty}→${clampedDifficulty} (strategy ${brief.difficultyRange[0]}-${brief.difficultyRange[1]})`,
      );
    }
    item.df = clampedDifficulty;
  } else {
    item.df = brief.difficultyRange[0];
  }

  const fullText: string = item.d ?? `Visit ${venue.venueName}.`;
  if (!item.sr || typeof item.sr !== "string" || !item.sr.trim()) {
    item.sr = `Go to ${venue.venueName}, stay about ten minutes, leave when you want.`;
  }
  if (!item.tr || typeof item.tr !== "string" || !item.tr.trim()) {
    item.tr = `Walk to the entrance of ${venue.venueName} and decide whether to go in. Either answer counts.`;
  }
  if (!item.mvw || typeof item.mvw !== "string" || !item.mvw.trim()) {
    item.mvw = "You made it to the door.";
  }
  if (!item.er || typeof item.er !== "string" || !item.er.trim()) {
    item.er = "Leave anytime — no penalty, no explanation owed.";
  }
  if (ctx.activeGoalMilestone?.goalClosureDue) {
    const goalActionText = [
      item.t,
      item.d,
      item.hook,
      item.sr,
      item.tr,
      ...(Array.isArray(item.sa) ? item.sa : []),
      ...(Array.isArray(item.ai) ? item.ai : []),
    ]
      .filter(Boolean)
      .join(" ");
    const detectedGoalActionType = detectGoalActionType(goalActionText);
    const writerGoalActionType = normalizeGoalActionType(item.gat);
    const writerClaimedDirect = item.dgt === true;
    item.act = "actionable";
    if (detectedGoalActionType === "none") {
      item.dgt = false;
      item.gat = "none";
      if (writerClaimedDirect || writerGoalActionType !== "none") {
        console.warn(
          "[multi-agent] Writer claimed direct goal touch, but no concrete dating action was detected in the full rep.",
        );
      }
    } else {
      item.dgt = true;
      item.gat = detectedGoalActionType;
    }
  } else if (
    item.act === "milestone" &&
    !ctx.historyContext.includes("MILESTONE CHECK")
  ) {
    item.act = ctx.user.comfortProfile?.primaryGoal
      ? "actionable"
      : "suggestive";
  }
  if (!item.gat) item.gat = "none";
  if (typeof item.dgt !== "boolean") item.dgt = item.gat !== "none";
  if (item.sr && fullText && fullText.length < item.sr.length) {
    console.warn(
      `[multi-agent] Writer variants may be inverted — full (${fullText.length} chars) shorter than smaller (${item.sr.length} chars)`,
    );
  }
}
