import { OpenAIModel, type OpenAIService } from "../shared/OpenAIService";
import type {
  LLMResponseRaw,
  PrescriptionStrategyInput,
  ScoutCandidate,
  StrategyBrief,
} from "./PrescriptionStrategy";
import {
  detectGoalActionType,
  isConcreteGoalActionType,
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
  const contractBlock = buildQuestScriptBlock(brief, venue);
  const priorVisitsBlock = buildPriorVisitsBlock(ctx, venue);
  const marketContextBlock = buildMarketContextBlock(ctx, venue);
  const verificationBlock = buildVerificationBlock(brief);
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
${contractBlock}
${
  ctx.journeyPhaseContext
    ? `
${ctx.journeyPhaseContext}`
    : ""
}
${
  ctx.datingProgressionContext
    ? `
${ctx.datingProgressionContext}`
    : ""
}
${
  brief.travelRationale && brief.opportunityScope !== "clamped_home"
    ? `
REGIONAL / NEARBY OPPORTUNITY FRAMING:
This venue requires extra travel. Name that honestly in the summary, strategy note, or hook. Frame it as an intentional opportunity-zone quest because the user's home base may be too sparse for this goal. Difficulty should include travel load.`
    : ""
}
${
  ctx.journeyDiversityContext
    ? `
${ctx.journeyDiversityContext}
IMPORTANT: If a direct goal-touch rep just happened, do not write another near-identical copy of that same invite in the same kind of venue. Broaden the room mix while keeping the social thread alive.`
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
  ctx.datingProgression?.isRelevant
    ? `
DATED LADDER WRITING RULES:
- Current capability: ${ctx.datingProgression.capabilityId ?? ctx.datingProgression.stage}${ctx.datingProgression.capabilityLabel ? ` — ${ctx.datingProgression.capabilityLabel}` : ""}
- Capability mode: ${ctx.datingProgression.enactmentMode ?? "bfs"}
- Current enactment pattern: ${ctx.datingProgression.currentPatternLabel ?? ctx.datingProgression.currentPatternId ?? "unspecified"}
- Legacy dating stage: ${ctx.datingProgression.stage}
- Preferred rep shapes now: ${ctx.datingProgression.preferredRepShapes.join(", ")}
- Direct dating rep allowed: ${ctx.datingProgression.allowDirectDatingRep ? "yes" : "no"}
- If direct dating rep is NOT allowed, the FULL REP ("d") must NOT include a direct invite, asking someone out, or asking for contact.
- Use these stage rules:
  - room_exposure / warm_signal: be in a date-worthy room, maybe make one tiny warm signal, but NO direct dating ask.
  - conversation_continuation: keep an existing conversation alive with one honest reply or question. NO invite yet.
  - message_closure: message-first only. A low-pressure invite is allowed only when direct dating rep is allowed.
- The smaller/tiny reps should soften the same stage, not jump to a different ladder rung.
- Do NOT set act="milestone" for dating-ladder quests; use act="actionable" when there's a concrete next step and "suggestive" otherwise.`
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
${priorVisitsBlock}
${marketContextBlock}
${verificationBlock}

VENUE TRUTH RULES:
- Never describe the venue as indoor, structured, class-based, or room-like unless the actual category supports that.
- A Trail / Park is a calm public place or outdoor place, not a structured room.
- A library or community center can be structured only if the rep is actually tied to a program, class, club, desk interaction, or shared area that exists there.
- Your job is to render the chosen venue truthfully, not to rescue a weak venue by renaming it.

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
  "sn": "<strategy note: 1-2 sentences explaining WHY you chose this quest for this user right now. Write like a thoughtful friend explaining their reasoning. Reference specific things — their visit count, comfort progression, social tier, or growth phase. Examples: 'You've been here twice — a third visit is when staff start recognizing you.', 'This is a group class because you've proven you can go places solo. Time to be around people.' IF A 'PRIOR VISITS' BLOCK IS PRESENT ABOVE, you MUST open sn by explicitly naming the arc — reference the last visit (its rating or what they did there) and name what's concretely different about this rep (new capacity, escalated social angle, deeper engagement). Do NOT write a generic strategy note that could apply to a first visit. Example: 'Last time at Gabe's you observed the room at a 4-rating; this time, order at the counter and stay ten extra minutes — same anchor, new edge.'>",
  "mr": "<MARKET REFLECTION — OPTIONAL. Set to a short, honest sentence (or null) only when the MARKET CONTEXT block above signals something the user should hear: their home town is sparse for this goal, the algorithm is pointing them somewhere new, or they're being asked to step outside the familiar zone. Talk TO the user, not about them. Voice: a thoughtful friend who reads the situation honestly. Examples: 'Frederick is small for what you're working toward — let's try Erie this week.', 'You've been getting solid reps in town, but the math is rough for dating here. This Longmont trip is the algorithm putting its money where its mouth is.', 'Your home base is doing real work, but the bigger-pool moves live a short drive out. We're testing one this week.' Set to null when there's nothing market-meaningful to say (e.g., user is in a strong-viability zone, or this is a routine local rep).>",
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
    "hook": "<why THIS spot expands their world — 1 sentence, make it feel personal. If PRIOR VISITS exist, the hook must acknowledge the return (e.g., 'Back to Gabe's — but this time the rep is different') rather than pitching the venue as if it were new>",
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

/**
 * Tell the writer when there's something market-meaningful to say to the user.
 *
 * Surfaces only when at least one signal is non-trivial — a weak home base,
 * a recommended away-zone, or a meaningful gap between the venue's city and
 * the user's home city. Otherwise the block is empty and the writer should
 * leave `mr` null (Quest Writer doesn't invent market reflections out of
 * thin air for routine local reps).
 */
function buildMarketContextBlock(
  ctx: PrescriptionStrategyInput["promptContext"],
  venue: ScoutCandidate,
): string {
  const oz = ctx.opportunityZones;
  const willingness = ctx.willingness;
  const homeCity = ctx.homeCity ?? ctx.city;
  const venueDistance = venue.distanceFromHome ?? null;

  const homeBaseViability = oz?.homeBaseViability ?? null;
  const recommendedCity = oz?.recommendedCity ?? null;
  const isAwayFromHomeBase =
    venueDistance != null && venueDistance > 5 && oz != null;

  const hasSignal =
    homeBaseViability === "weak" ||
    homeBaseViability === "limited" ||
    isAwayFromHomeBase;

  if (!hasSignal) return "";

  const lines: string[] = ["MARKET CONTEXT (for the optional `mr` field):"];
  lines.push(`- Home city: ${homeCity}.`);
  if (homeBaseViability) {
    lines.push(`- Home-base viability for this goal: ${homeBaseViability}.`);
  }
  if (recommendedCity && recommendedCity !== homeCity) {
    lines.push(
      `- Algorithm-recommended zone for this goal: ${recommendedCity}.`,
    );
  }
  if (venueDistance != null) {
    lines.push(
      `- This venue is ${venueDistance.toFixed(1)} mi from home${
        venueDistance > 5 ? " — meaningful travel for this user" : ""
      }.`,
    );
  }
  if (willingness?.willingnessSignal) {
    lines.push(`- Observed willingness: ${willingness.willingnessSignal}.`);
  }
  lines.push(
    "Decide whether to populate `mr`. Populate it when a thoughtful friend would say something honest about the geography (small town, stretch trip, market reality). Otherwise return null. Do NOT pad — one or two sentences max, and only when it adds real signal the user wouldn't already see in the strategy note.",
  );
  return `\n${lines.join("\n")}\n`;
}

/**
 * When the verification agent has researched the winner via web_search,
 * surface the *facts* — current hours, real pricing, upcoming events,
 * ambiance — so the writer can quote them in the description and action
 * items instead of falling back to generic "check the website" copy.
 *
 * This is the moment the harness shows the user it actually knows the
 * room, not just the room's name.
 */
function buildVerificationBlock(brief: StrategyBrief): string {
  const v = brief.venueVerification;
  if (!v) return "";

  const lines: string[] = ["VERIFIED VENUE FACTS (from live web research):"];
  lines.push(`- Verdict: ${v.verdict} — ${v.reasoning}`);
  if (!v.currentlyOperating) {
    lines.push(
      "- ⚠ Web research suggests this venue may not be currently operating. Add a soft confirmation line in the action items: 'call ahead to confirm they are open.'",
    );
  }
  if (v.dropInFriendly === false) {
    lines.push(
      `- Pricing posture: NOT drop-in friendly${v.priceFloor != null ? ` (cost floor ~$${v.priceFloor})` : ""}. Surface this honestly in action items so the user isn't surprised.`,
    );
  } else if (v.priceFloor != null) {
    lines.push(
      `- Cost floor: ~$${v.priceFloor} for a single visit. You can quote this directly in action items or the description.`,
    );
  } else if (v.dropInFriendly) {
    lines.push("- Drop-in friendly, no membership required.");
  }
  if (v.currentHours) {
    lines.push(`- Current hours: ${v.currentHours}`);
  }
  if (v.upcomingEvents.length > 0) {
    lines.push(
      `- Upcoming events / specials worth mentioning: ${v.upcomingEvents.join(" · ")}`,
    );
  }
  if (v.ambianceNotes) {
    lines.push(`- Actual ambiance (from research): ${v.ambianceNotes}`);
  }
  if (v.factualNotes) {
    lines.push(`- Other useful detail: ${v.factualNotes}`);
  }
  if (v.qualityViolations.length > 0) {
    lines.push(
      `- Quality flags from research: ${v.qualityViolations.join(", ")}. Acknowledge in the strategy note or action items rather than glossing over.`,
    );
  }

  lines.push(
    "\nWRITER GUIDANCE: Prefer the verified facts over generic placeholders. If hours are known, quote them in 'd' or 'ai'. If an event is happening, mention it in the hook or action items. If pricing is steep, name the cost in 'ai'. Do NOT invent details that contradict these facts.",
  );

  return `\n${lines.join("\n")}\n`;
}

function buildPriorVisitsBlock(
  ctx: PrescriptionStrategyInput["promptContext"],
  venue: ScoutCandidate,
): string {
  const visits = ctx.venueVisitHistory?.[venue.venueName];
  if (!visits || visits.length === 0) return "";
  const lines = visits.map((v, i) => {
    const label = i === 0 ? "Last visit" : `Visit ${visits.length - i}`;
    const rating = v.rating != null ? `${v.rating}/5` : "unrated";
    const capacity = v.capacityTrack ? ` · ${v.capacityTrack}` : "";
    const role = v.questRole ? ` · role=${v.questRole}` : "";
    return `  - ${label}: "${v.title}" — ${rating}${capacity}${role}`;
  });
  return `
PRIOR VISITS — ${venue.venueName} (${visits.length} completed):
${lines.join("\n")}
This is a RETURN to this venue, not a first visit. The user has been here before and the algorithm is intentionally deepening the pathway. Your job is to make the return feel earned: name the arc, reference what they did last time, and make the new rep clearly different (new capacity angle, escalated social challenge, longer stay, new interaction). Do NOT write copy that treats this venue as new territory.`;
}

function buildQuestScriptBlock(
  brief: StrategyBrief,
  venue: ScoutCandidate,
): string {
  const contract = brief.questContract;
  if (!contract) return "";

  const lines = [
    "\nQUEST SCRIPT CONTRACT — NON-NEGOTIABLE:",
    "- The planner owns what the user does. You are only rendering it warmly.",
    `- Capability: ${contract.capabilityLabel} (${contract.capabilityId})`,
    `- Required action: ${contract.requiredAction ?? contract.repIntent}`,
  ];

  if (contract.requiredElements?.length) {
    lines.push(
      "- Required elements:",
      ...contract.requiredElements.map((element) => `  - ${element}`),
    );
  }
  if (contract.exampleActions.length) {
    lines.push(
      "- Planner example actions:",
      ...contract.exampleActions.map((action) => `  - ${action}`),
    );
  }
  if (contract.forbiddenActions.length) {
    lines.push(
      "- Forbidden actions:",
      ...contract.forbiddenActions.map((action) => `  - ${action}`),
    );
  }
  if (contract.forbiddenSubstitutions?.length) {
    lines.push(
      "- Forbidden substitutions:",
      ...contract.forbiddenSubstitutions.map(
        (substitution) => `  - ${substitution}`,
      ),
    );
  }
  if (contract.smallerRep) {
    lines.push(
      `- Smaller rep must preserve this behavior: ${contract.smallerRep}`,
    );
  }
  if (contract.tinyRep) {
    lines.push(`- Tiny rep must preserve this behavior: ${contract.tinyRep}`);
  }
  if (contract.minimumViableWin) {
    lines.push(`- Minimum viable win: ${contract.minimumViableWin}`);
  }
  if (contract.exitRamp) {
    lines.push(`- Exit ramp: ${contract.exitRamp}`);
  }
  if (contract.directGoalTouch) {
    lines.push(
      `- Use ${venue.venueName} as the named venue in the invite.`,
      "- The full rep MUST include the concrete dating invite. It cannot be only observation, friendliness, or preparation.",
    );
  }
  return `${lines.join("\n")}\n`;
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

export function normalizeWriterOutput(
  parsed: Record<string, unknown>,
  input: PrescriptionStrategyInput,
  brief: StrategyBrief,
  venue: ScoutCandidate,
): void {
  const ctx = input.promptContext;
  const contract = brief.questContract;
  const enforceNonDirectDatingFallback = () => {
    const stage = ctx.datingProgression?.stage ?? "room_exposure";
    if (
      contract?.capabilityId === "specific_invitation" &&
      contract.repShape === "draft_message"
    ) {
      item.d = `Go to ${venue.venueName}, use the place as the anchor, and draft one low-pressure invite to a real dating-app match or existing romantic conversation. Name ${venue.venueName}, offer one or two concrete time windows, and save the draft without sending it today.`;
      item.sr =
        contract.smallerRep ??
        `Draft the invite with ${venue.venueName} and one possible time window, but do not send it.`;
      item.tr =
        contract.tinyRep ??
        `Pick the person and write the first sentence: "I've been meaning to try ${venue.venueName}."`;
      item.mvw =
        contract.minimumViableWin ??
        "You created a specific dating invite draft for a real person.";
      item.er =
        contract.exitRamp ??
        "If drafting feels too sharp, pick the person and venue only.";
      item.ai = [
        `💬 Draft the invite using ${venue.venueName}.`,
        "🕰️ Include one or two possible time windows, then save it without sending.",
      ];
    } else if (stage === "conversation_continuation") {
      item.d = `Go to ${venue.venueName}, settle in for a few minutes, and send one honest reply or follow-up question in a conversation that already exists. Keep it light and specific, then put your phone away and stay a little longer.`;
      item.sr = `Go to ${venue.venueName} and draft the reply in your notes without sending it yet.`;
      item.tr = `Open the conversation and write one possible next question. You do not have to send it today.`;
      item.mvw = "You wrote one honest follow-up.";
      item.er =
        "If the conversation energy feels off, save the draft and leave it for another day.";
    } else {
      item.d = `Spend 15-20 minutes at ${venue.venueName} and notice whether it feels like a place you would genuinely suggest for coffee, brunch, or a low-pressure date later. If it feels easy, save the place in your notes with one sentence about why it fits you.`;
      item.sr = `Go to ${venue.venueName}, stay long enough to get the vibe, and jot down one reason it could work as a future spot.`;
      item.tr = `Walk in, look around for a few minutes, and decide whether this feels like your kind of place.`;
      item.mvw =
        "You identified one real place you could imagine suggesting later.";
      item.er =
        "If the place feels off, leave and count that as useful information.";
    }
  };
  const enforceDirectDatingScript = () => {
    const venueName = venue.venueName;
    const venueKind =
      venue.venueCategory === "Restaurant" ||
      venue.venueCategory === "Brunch Spot"
        ? "a low-pressure bite"
        : venue.venueCategory === "Art Gallery"
          ? "a short gallery visit"
          : venue.venueCategory === "Board Game Venue"
            ? "a low-key game night"
            : "coffee";
    const inviteLine = `I've been meaning to try ${venueName}. Want to meet there for ${venueKind} for 30 minutes Thursday evening or Saturday afternoon?`;
    item.d = `Open one real dating-app match or existing romantic conversation and send a specific, low-pressure invite tied to ${venueName}. Use your own words, but make sure it names the place and offers two windows, like: "${inviteLine}"`;
    item.sr =
      contract?.smallerRep ??
      `Draft that exact invite to one real person, naming ${venueName} and two possible time windows, but do not send it yet.`;
    item.tr =
      contract?.tinyRep ??
      `Pick the person and write the first sentence: "I've been meaning to try ${venueName}."`;
    item.mvw =
      contract?.minimumViableWin ??
      "You created a specific dating invite for a real person.";
    item.er =
      contract?.exitRamp ??
      "If sending feels too sharp, save the complete draft and decide later.";
    item.ai = [
      `💬 Send or draft: "${inviteLine}"`,
      "🕰️ Keep the ask small: 30 minutes and two possible windows.",
    ];
    item.act = "actionable";
    item.dgt = true;
    item.gat = "dating_app_invite";
  };
  const sanitizeGroundingLanguage = (value: unknown): string | unknown => {
    if (typeof value !== "string") return value;
    if (venue.venueCategory !== "Trail / Park") return value;
    return value
      .replace(/\bstructured room\b/gi, "public place")
      .replace(/\bstructured public room\b/gi, "public place")
      .replace(/\bstructured public place\b/gi, "public place")
      .replace(/\bnew indoor public place\b/gi, "public place")
      .replace(/\bindoor public place\b/gi, "public place")
      .replace(/\bindoor room\b/gi, "place")
      .replace(/\broom family\b/gi, "place type");
  };

  if ((parsed as any).items?.length > 1) {
    (parsed as any).items = (parsed as any).items.slice(0, 1);
  }

  if (!(parsed as any).items?.[0]) return;

  const item = (parsed as any).items[0];
  item.vn = venue.venueName;
  item.va = venue.venueAddress;
  item.vc = venue.venueCategory;
  (parsed as any).s = sanitizeGroundingLanguage((parsed as any).s);
  (parsed as any).sn = sanitizeGroundingLanguage((parsed as any).sn);
  item.d = sanitizeGroundingLanguage(item.d);
  item.sr = sanitizeGroundingLanguage(item.sr);
  item.tr = sanitizeGroundingLanguage(item.tr);
  item.hook = sanitizeGroundingLanguage(item.hook);

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
  if (ctx.datingProgression?.isRelevant) {
    const goalActionText = [item.d, ...(Array.isArray(item.ai) ? item.ai : [])]
      .filter(Boolean)
      .join(" ");
    const detectedGoalActionType = detectGoalActionType(goalActionText);
    const writerGoalActionType = normalizeGoalActionType(item.gat);
    const writerClaimedDirect = item.dgt === true;
    const contractAllowsDirect = contract?.directGoalTouch === true;
    const directAllowed =
      contractAllowsDirect && ctx.datingProgression.allowDirectDatingRep;
    const directRequired =
      contractAllowsDirect && ctx.datingProgression.allowDirectDatingRep;
    if (directRequired && !isConcreteGoalActionType(detectedGoalActionType)) {
      console.warn(
        "[multi-agent] Writer missed the direct dating quest script; enforcing planner-owned invite action.",
      );
      enforceDirectDatingScript();
    } else if (
      isConcreteGoalActionType(detectedGoalActionType) &&
      directAllowed &&
      contract?.allowedGoalActionTypes?.length &&
      !contract.allowedGoalActionTypes.includes(detectedGoalActionType)
    ) {
      console.warn(
        "[multi-agent] Writer produced the wrong direct dating action type; enforcing planner-owned invite action.",
      );
      enforceDirectDatingScript();
    } else if (
      isConcreteGoalActionType(detectedGoalActionType) &&
      !directAllowed
    ) {
      console.warn(
        "[multi-agent] Writer produced a direct dating ask before the ladder allowed it; downgrading attribution and actionability.",
      );
      enforceNonDirectDatingFallback();
      item.dgt = false;
      item.gat = "none";
      item.act = "suggestive";
    } else if (!isConcreteGoalActionType(detectedGoalActionType)) {
      item.dgt = false;
      item.gat = "none";
      if (
        writerClaimedDirect ||
        isConcreteGoalActionType(writerGoalActionType)
      ) {
        console.warn(
          "[multi-agent] Writer claimed direct goal touch, but no concrete dating action was detected in the full rep.",
        );
      }
    } else {
      item.act = "actionable";
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
  if (typeof item.dgt !== "boolean") {
    item.dgt = isConcreteGoalActionType(normalizeGoalActionType(item.gat));
  }
  const finalFullText: string = item.d ?? `Visit ${venue.venueName}.`;
  if (item.sr && finalFullText && finalFullText.length < item.sr.length) {
    console.warn(
      `[multi-agent] Writer variants may be inverted — full (${finalFullText.length} chars) shorter than smaller (${item.sr.length} chars)`,
    );
  }
}
