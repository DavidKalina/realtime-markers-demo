import { type OpenAIService, OpenAIModel } from "./shared/OpenAIService";

// ── Types ────────────────────────────────────────────────────

export type GoalFeasibility = "actionable" | "ambitious" | "out_of_scope" | "unfeasible" | "concerning";

export interface GoalAssessment {
  specificity: number;
  feasibility: GoalFeasibility;
  needsRefinement: boolean;
  refinedGoal: string | null;
  firstQuestion: string | null;
  redirectMessage: string | null;
  reframeSuggestion: string | null;
  reframedGoal: string | null;
  state: RefinementState;
}

export interface RefinementState {
  rawGoal: string;
  turns: { question: string; answer: string }[];
  extractedSignals: ExtractedSignals;
}

export interface ExtractedSignals {
  domain?: string;
  timeHorizon?: string;
  targetDate?: string;
  goalLocation?: string;
  currentBaseline?: string;
  successLooksLike?: string;
}

export interface RefinementStep {
  done: boolean;
  question: string | null;
  refinedGoal: string | null;
  state: RefinementState;
}

// ── Prompts ──────────────────────────────────────────────────

const ASSESS_SYSTEM_PROMPT = `You evaluate how specific and actionable a user's stated goal is for a social-life-building app.

WHAT THIS APP DOES:
This app helps people build a social life from scratch. It prescribes real-world outings — visiting places, attending events, joining activities, social challenges — and tracks social comfort expansion through a 7-tier micro-rep ladder (solo → acknowledging people → micro-interactions → conversations → extended engagement → bridge-building → initiating). It's specifically designed for people who have overthought their social life into paralysis and need concrete, small steps to get unstuck.

THE APP IS BEST FOR goals involving:
- Building a social life: making friends, finding community, becoming a regular somewhere, building a friend group
- Social confidence: overcoming social anxiety, approach anxiety, learned helplessness around socializing
- Dating readiness: building the social ecosystem that makes meeting people natural
- Getting out of the house: breaking homebody patterns, building a routine of going places
- Finding your people: joining groups, trying activities, discovering what clicks socially
- Post-college, new-city, or small-town social rebuilding

THE APP IS NOT THE RIGHT TOOL FOR goals that primarily need:
- Financial planning, budgeting, or money management
- Physical fitness tracking (reps, sets, calories, body composition)
- Academic study or test preparation
- Career advancement, job searching, or professional networking (unless the core issue is social confidence)
- Medical or clinical mental health treatment
- Technical skill acquisition (coding, languages via textbook study, etc.)

STEP 1 — FEASIBILITY CHECK:
Before anything else, assess whether this is a goal the app can meaningfully help with.

- "actionable": A goal where going places, doing things, and reflecting is the core path forward. Most in-scope goals fall here.
- "ambitious": A big in-scope goal but grounded in reality — performing at open mics, building a whole social circle from scratch, becoming a regular at 10 different spots. The app can help build toward it.
- "out_of_scope": A legitimate goal, but one where this app's core mechanic (go to a place, do a thing, reflect) isn't the right primary tool. The goal might have a slice the app CAN help with — if so, offer to reframe toward that slice. Examples: "build a great physique" (fitness tracker territory, but the app could help with gym anxiety or trying new physical activities), "save enough to move out" (financial planning, but the app could help with exploring neighborhoods and building independence skills), "get straight A's" (study tools, but the app could help with finding study spots or study groups).
- "unfeasible": Fantasy, delusion, or impossibility. Examples: "become king of the earth", "gain superpowers". Do NOT earnestly help with these.
- "concerning": Contains hints of harmful intent, self-harm, harming others, or serious mental health crisis. Do NOT proceed with these.

IMPORTANT: Be generous with scope. If a goal has a meaningful "getting out into the world" component, it's in scope. "Start a business" is out_of_scope (needs business tools), but "overcome my fear of networking events" is actionable. "Learn guitar" is out_of_scope (needs practice tools), but "find a music community and start jamming with people" is actionable. Always look for the in-scope slice before marking out_of_scope.

STEP 2 — SPECIFICITY (only if feasibility is "actionable" or "ambitious"):

A SPECIFIC goal has ALL of these:
- A clear domain (social, career, fitness, creative, etc.)
- Some sense of what success looks like — how would you know you achieved it?
- Enough context about WHERE they are now and WHERE they want to be that you could design real-world experiences to bridge the gap
- If the goal has a natural endpoint (moving, running a race, launching something), a rough timeframe

A goal can sound concrete but still be vague if it's missing critical context. Ask yourself: "Could I design a 3-month series of real-world experiences for this person based on ONLY this sentence?" If no, it needs refinement.

Examples — VAGUE (needs refinement):
- "be happier" — vague (happiness how? through what?)
- "be more confident" — vague (confident in what context?)
- "improve myself" — very vague
- "move out of my parents' house" — clear outcome but missing everything: when, where, what's blocking them, what skills they need to build. Score ~0.3
- "get in shape" — clear domain but no specifics about what that means for them
- "start a business" — which kind? when? what's stopping them?
- "make friends" — where? what kind of social life do they want?

Examples — SPECIFIC (no refinement needed):
- "feel comfortable going to bars and talking to strangers" — specific
- "run a half marathon by October" — very specific
- "make 3 close friends in my new city" — specific
- "move to Denver by next spring and feel financially and socially ready" — specific
- "overcome my stage fright and perform at an open mic night" — specific

If refinement IS needed, ask ONE clarifying question. The question should:
- Be warm and conversational, not clinical
- Target the most important missing piece (usually: what does success look like, or in what context?)
- Be short — one sentence, maybe two
- If the goal has a natural time component, ask about timing naturally (e.g. "Do you have a timeframe in mind, or is this more of an ongoing thing?")

If the goal is already specific enough, return a lightly cleaned-up version as the refined goal.

Also extract any signals you can detect — domain, time references, location references.

Respond with JSON:
{
  "specificity": <0-1>,
  "feasibility": "actionable" | "ambitious" | "out_of_scope" | "unfeasible" | "concerning",
  "needsRefinement": <boolean — true if specificity < 0.6>,
  "refinedGoal": "<cleaned-up goal if specific enough, otherwise null>",
  "firstQuestion": "<clarifying question if needs refinement, otherwise null>",
  "redirectMessage": "<warm, non-judgmental message if unfeasible or concerning, otherwise null>",
  "reframeSuggestion": "<if out_of_scope: a warm message acknowledging their goal, explaining what the app does well, and suggesting an in-scope reframe. Otherwise null>",
  "reframedGoal": "<if out_of_scope AND there's a natural in-scope slice: a reframed version of their goal that fits the app. Otherwise null>",
  "domain": "<detected domain: social, career, fitness, creative, health, independence, relocation, financial, etc.>",
  "targetDate": "<ISO date string if a specific date or month is mentioned, e.g. '2026-10-01', otherwise null>",
  "goalLocation": "<city or place if mentioned, otherwise null>"
}

For redirectMessage examples:
- unfeasible: "That's a fun one! But this app works best with goals you can make real progress on through everyday experiences. What's something you'd genuinely like to work toward?"
- concerning: "It sounds like you might be going through a tough time. This app isn't equipped to help with that, but talking to someone who can would be a great first step. Please reach out to a trusted person or the 988 Suicide & Crisis Lifeline (call or text 988)."

For reframeSuggestion examples:
- "build a great physique": "Getting fit is awesome! This app isn't a fitness tracker — but it IS great at helping you discover new physical activities, overcome gym anxiety, and find workout communities. Want to focus on something like 'get comfortable going to the gym and trying new classes'?"
- "save money to move out": "That's a solid goal. The financial side is outside what this app does, but we're great at helping you explore neighborhoods, build independence skills, and get comfortable being out on your own. Want to focus on something like 'explore where I want to live and build confidence being independent'?"
- "learn to play guitar": "Love that! This app can't teach you chords, but it CAN help you find jam sessions, open mics, music shops, and communities of musicians. Want to reframe toward 'find a music community and get comfortable playing with others'?"`;

const REFINE_SYSTEM_PROMPT = `You are helping a user clarify their goal for a personal growth app. You're in a short conversation (max 3 questions total) to turn a vague goal into something specific and actionable.

You have context from prior turns in the conversation. Based on what you've learned so far, decide:
1. Do you have enough information to write a clear, refined goal? If yes, write it.
2. If not, ask ONE more clarifying question targeting the biggest remaining gap.

The refined goal should be:
- Written in first person ("I want to...")
- Specific enough that someone could design real-world experiences around it
- Concrete but not overly narrow — it should leave room for the app to be creative
- Natural-sounding, not corporate or clinical
- If a timeframe was mentioned, include it naturally (e.g. "...within the next 6 months")

Good refined goals:
- "I want to feel comfortable going to social events alone and starting conversations with people I don't know"
- "I want to build a consistent running habit and complete a half marathon within 6 months"
- "I want to overcome my fear of performing and do an open mic night"
- "I want to move to Denver by next spring and feel ready — financially, socially, and practically"

Bad refined goals (too vague):
- "I want to be more social"
- "I want to be healthier"
- "I want to grow as a person"

Bad refined goals (too narrow/prescriptive):
- "I want to go to exactly 3 coffee shops per week and talk to the barista each time"

When asking questions, consider whether the goal might have:
- A natural time component ("Do you have a rough timeframe in mind?")
- A location component ("Is there a specific city or area you're thinking about?")
- A baseline ("Where are you at with this right now?")

Don't ask about ALL of these — just the one that would most improve the goal's specificity. And only ask if it's natural for this type of goal. A fitness goal naturally has a timeframe. A social goal might not.

Respond with JSON:
{
  "done": <boolean>,
  "question": "<next question if not done, null if done>",
  "refinedGoal": "<final refined goal if done, null if not done>",
  "extractedSignals": {
    "domain": "<social, career, fitness, creative, health, independence, relocation, financial, etc.>",
    "timeHorizon": "<weeks, months, ongoing — if mentioned>",
    "targetDate": "<ISO date string if a specific date/month was mentioned, otherwise null>",
    "goalLocation": "<city or place if mentioned, otherwise null>",
    "currentBaseline": "<where they are now — if mentioned>",
    "successLooksLike": "<what success looks like to them — if mentioned>"
  }
}`;

const MAX_TURNS = 3;
const SPECIFICITY_THRESHOLD = 0.6;

// ── Functions ───────────────────────────────────────────────

export async function assessGoal(openAIService: OpenAIService, rawGoal: string): Promise<GoalAssessment> {
  const response = await openAIService.executeChatCompletion(
    {
      model: OpenAIModel.GPT4OMini,
      messages: [
        { role: "system", content: ASSESS_SYSTEM_PROMPT },
        { role: "user", content: rawGoal.trim() },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 400,
    },
    "goal_refinement_assess",
  );

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    return {
      specificity: 0,
      feasibility: "actionable",
      needsRefinement: true,
      refinedGoal: null,
      firstQuestion: "Can you tell me a bit more about what that looks like for you? What would be different in your life if you achieved this?",
      redirectMessage: null,
      reframeSuggestion: null,
      reframedGoal: null,
      state: { rawGoal, turns: [], extractedSignals: {} },
    };
  }

  const parsed = JSON.parse(content);
  const specificity = clamp(parsed.specificity ?? 0, 0, 1);
  const feasibility: GoalFeasibility = parsed.feasibility ?? "actionable";

  if (feasibility === "unfeasible" || feasibility === "concerning") {
    return {
      specificity,
      feasibility,
      needsRefinement: false,
      refinedGoal: null,
      firstQuestion: null,
      redirectMessage: parsed.redirectMessage ?? (feasibility === "concerning"
        ? "It sounds like you might be going through a tough time. Please reach out to someone who can help — the 988 Suicide & Crisis Lifeline is available 24/7 (call or text 988)."
        : "This app works best with goals you can make real progress on through everyday experiences. What's something you'd genuinely like to work toward?"),
      reframeSuggestion: null,
      reframedGoal: null,
      state: { rawGoal, turns: [], extractedSignals: {} },
    };
  }

  if (feasibility === "out_of_scope") {
    return {
      specificity,
      feasibility,
      needsRefinement: false,
      refinedGoal: null,
      firstQuestion: null,
      redirectMessage: null,
      reframeSuggestion: parsed.reframeSuggestion ?? "This app is best at helping you get out into the world — exploring places, building social confidence, and trying new things. Is there a piece of your goal that involves getting out there?",
      reframedGoal: parsed.reframedGoal ?? null,
      state: { rawGoal, turns: [], extractedSignals: {} },
    };
  }

  const needsRefinement = specificity < SPECIFICITY_THRESHOLD;

  const initialSignals: ExtractedSignals = {
    domain: parsed.domain ?? undefined,
    targetDate: parsed.targetDate ?? undefined,
    goalLocation: parsed.goalLocation ?? undefined,
  };

  if (!initialSignals.targetDate) {
    initialSignals.targetDate = inferTargetDate(initialSignals, parsed.refinedGoal ?? rawGoal);
  }

  const state: RefinementState = {
    rawGoal,
    turns: [],
    extractedSignals: initialSignals,
  };

  return {
    specificity,
    feasibility,
    needsRefinement,
    refinedGoal: needsRefinement ? null : (parsed.refinedGoal ?? rawGoal),
    firstQuestion: needsRefinement ? (parsed.firstQuestion ?? null) : null,
    redirectMessage: null,
    reframeSuggestion: null,
    reframedGoal: null,
    state,
  };
}

export async function refineNext(
  openAIService: OpenAIService,
  state: RefinementState,
  userResponse: string,
): Promise<RefinementStep> {
  const lastQuestion = state.turns.length > 0
    ? state.turns[state.turns.length - 1].question
    : "initial assessment";

  const updatedTurns = [
    ...state.turns,
    { question: lastQuestion, answer: userResponse.trim() },
  ];

  const forceDone = updatedTurns.length >= MAX_TURNS;

  const conversationContext = updatedTurns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join("\n\n");

  const userMessage = `ORIGINAL GOAL: "${state.rawGoal}"

CONVERSATION SO FAR:
${conversationContext}

${forceDone ? "You MUST finalize the refined goal now — this is the last turn. Write the best refined goal you can from what you know." : `Turns used: ${updatedTurns.length}/${MAX_TURNS}. You have ${MAX_TURNS - updatedTurns.length} question(s) left. If you have enough to write a good refined goal, do it now — don't ask questions just because you can.`}`;

  const response = await openAIService.executeChatCompletion(
    {
      model: OpenAIModel.GPT4OMini,
      messages: [
        { role: "system", content: REFINE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 400,
    },
    "goal_refinement_next",
  );

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    return {
      done: true,
      question: null,
      refinedGoal: state.rawGoal,
      state: { ...state, turns: updatedTurns },
    };
  }

  const parsed = JSON.parse(content);
  const done = forceDone || parsed.done === true;

  const extractedSignals: ExtractedSignals = {
    ...state.extractedSignals,
    ...(parsed.extractedSignals ?? {}),
  };

  if (!extractedSignals.targetDate) {
    extractedSignals.targetDate = inferTargetDate(extractedSignals, parsed.refinedGoal ?? null);
  }

  const updatedState: RefinementState = {
    ...state,
    turns: updatedTurns,
    extractedSignals,
  };

  if (done) {
    return {
      done: true,
      question: null,
      refinedGoal: parsed.refinedGoal ?? state.rawGoal,
      state: updatedState,
    };
  }

  return {
    done: false,
    question: parsed.question ?? null,
    refinedGoal: null,
    state: updatedState,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function inferTargetDate(signals: ExtractedSignals, refinedGoal: string | null): string | undefined {
  if (signals.targetDate) return signals.targetDate;

  const sources = [signals.timeHorizon, refinedGoal].filter(Boolean).join(" ");
  const monthMatch = sources.match(/(\d+)\s*months?/i);
  const yearMatch = sources.match(/(\d+)\s*years?/i);
  const weekMatch = sources.match(/(\d+)\s*weeks?/i);

  let daysFromNow: number | null = null;
  if (monthMatch) {
    daysFromNow = parseInt(monthMatch[1], 10) * 30;
  } else if (yearMatch) {
    daysFromNow = parseInt(yearMatch[1], 10) * 365;
  } else if (weekMatch) {
    daysFromNow = parseInt(weekMatch[1], 10) * 7;
  } else if (sources.match(/by\s+(next\s+)?(spring|summer|fall|autumn|winter)/i)) {
    const now = new Date();
    const month = now.getMonth();
    const seasonMonths: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };
    const match = sources.match(/by\s+(?:next\s+)?(spring|summer|fall|autumn|winter)/i);
    if (match) {
      let targetMonth = seasonMonths[match[1].toLowerCase()] ?? 6;
      let targetYear = now.getFullYear();
      if (targetMonth <= month) targetYear++;
      if (sources.includes("next")) targetYear = Math.max(targetYear, now.getFullYear() + 1);
      const target = new Date(targetYear, targetMonth, 1);
      daysFromNow = Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    }
  }

  if (daysFromNow && daysFromNow > 0) {
    const target = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    return target.toISOString().split("T")[0];
  }

  return undefined;
}
