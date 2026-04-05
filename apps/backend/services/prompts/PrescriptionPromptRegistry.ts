/**
 * Prescription Prompt Registry
 *
 * Modular prompt system for A/B testing different prompt strategies.
 * Each registered version is a function that receives a context object
 * and returns { instructions, initialMessage }.
 *
 * Usage:
 *   const registry = createPrescriptionPromptRegistry();
 *   registry.register("v2-warm", buildWarmPrompt);
 *   const { instructions, initialMessage } = registry.build("v2-warm", ctx);
 */

// ── Context passed to every prompt builder ──────────────────

export interface PrescriptionPromptContext {
  // User
  user: {
    comfortProfile: {
      primaryGoal?: string;
      barriers?: string;
      goals?: string;
      goalTags?: string[];
      northStar?: string;
      comfortZone?: string;
    } | null;
    onboardingProfile: {
      activities?: string[];
    } | null;
    pacePreference: string | null;
    fearLadder: Record<string, any> | null;
    expectancyCalibration: Record<string, any> | null;
  };

  // Location
  homeLat: number;
  homeLng: number;
  searchLat: number;
  searchLng: number;
  city: string;
  isAwayFromHome: boolean;
  distFromHome: number;

  // Comfort zone
  radius: number;
  pace: string;

  // Time
  hour: number;
  dayOfWeek: string;

  // Computed context sections (pre-built by the service's helper methods)
  historyContext: string;
  coverageContext: string;
  explorationProfileLabel: string;
  expansionTarget: string;
  phaseContext: string;
  fearLadderContext: string;
  expectancyContext: string;
  difficultyGuidance: string;
  siblingInstructions: string;

  // Quest role
  isStretch: boolean;
  siblingContext: {
    questRole: string;
    batchId: string;
    batchIndex: number;
    totalInBatch: number;
    targetPathway?: { theme: string; label: string };
    previousSiblings: { title: string; venueCategory: string; venueName: string }[];
  } | null;
}

// ── Prompt builder output ───────────────────────────────────

export interface PrescriptionPromptOutput {
  instructions: string;
  initialMessage: string;
}

// ── Builder function type ───────────────────────────────────

export type PrescriptionPromptBuilder = (ctx: PrescriptionPromptContext) => PrescriptionPromptOutput;

// ── Registry ────────────────────────────────────────────────

export interface PrescriptionPromptRegistry {
  register(name: string, builder: PrescriptionPromptBuilder): void;
  get(name: string): PrescriptionPromptBuilder;
  build(name: string, ctx: PrescriptionPromptContext): PrescriptionPromptOutput;
  list(): string[];
}

class PrescriptionPromptRegistryImpl implements PrescriptionPromptRegistry {
  private builders = new Map<string, PrescriptionPromptBuilder>();

  register(name: string, builder: PrescriptionPromptBuilder): void {
    this.builders.set(name, builder);
  }

  get(name: string): PrescriptionPromptBuilder {
    const builder = this.builders.get(name);
    if (!builder) {
      throw new Error(
        `Prompt version "${name}" not found. Available: ${[...this.builders.keys()].join(", ")}`,
      );
    }
    return builder;
  }

  build(name: string, ctx: PrescriptionPromptContext): PrescriptionPromptOutput {
    return this.get(name)(ctx);
  }

  list(): string[] {
    return [...this.builders.keys()];
  }
}

// ── Default prompt (v1) — extracted from current SidequestPrescriptionService ──

const PROFILE_ONE_LINERS: Record<string, string> = {
  early_explorer: "New user. Stay close, stay gentle. Build the habit of going out.",
  depth_focused: "Keeps returning to same spots. Nudge toward a new direction — even a familiar category in a new part of town counts.",
  breadth_focused: "Explores widely but doesn't revisit. If a cluster has repeat visits and diverse categories, prescribe a new experience there.",
  well_rounded: "Strong coverage. Challenge them — push further, try unusual categories, or explore the widest directional gap.",
};

export const defaultPrompt: PrescriptionPromptBuilder = (ctx) => {
  const {
    user, homeLat, homeLng, searchLat, searchLng, city,
    isAwayFromHome, distFromHome, radius, pace, hour, dayOfWeek,
    historyContext, coverageContext, explorationProfileLabel,
    expansionTarget, phaseContext, fearLadderContext, expectancyContext,
    difficultyGuidance, siblingInstructions, isStretch,
  } = ctx;

  const comfortProfile = user.comfortProfile;

  const instructions = `You are a Goal Achievement Guide. You prescribe ONE location-based quest designed to ${isStretch ? "ambitiously push" : "steadily advance"} this user toward their goal through real-world action.

YOUR APPROACH:
- Progress through action, not theory. The goal is to get the user ${isStretch ? "significantly outside" : "slightly outside"} their comfort zone — not ${isStretch ? "terrify them, but genuinely challenge them" : "overwhelm them"}.
${isStretch
    ? `- STRETCH GOAL: Push on MULTIPLE dimensions at once — further distance AND unfamiliar category AND/OR higher social challenge. This is the ambitious card.
- Search at 1.5-2x the user's comfort radius (${(radius * 1.5).toFixed(1)}-${(radius * 2).toFixed(1)} miles). Go further than you normally would.
- Pick a category or activity type the user hasn't tried yet. Combine novelty with distance.`
    : `- Stretch on ONE dimension at a time: either further distance (familiar category) OR unfamiliar category (familiar distance). Never both.`}
- The user's current comfort radius is ${radius.toFixed(1)} miles from home. Use this as context${isStretch ? " — then exceed it" : ", NOT as a target to push past"}.
- Keep it achievable. One stop. ${isStretch ? "The win is them rising to the challenge." : "Low friction. The win is them going, not the venue being perfect."}
${comfortProfile?.primaryGoal ? `
SEARCH STRATEGY:
- The user's goal is "${comfortProfile.primaryGoal}". Your searches should DIRECTLY advance this goal.
- Search for venues, events, classes, groups, and resources specifically related to their goal.
- Use web_search to find upcoming events, open registrations, meetup groups, and communities in "${city}".
- Use search_places for physical venues where goal-related activity happens.
- Only fall back to generic exploration (cafes, parks) as recovery/reflection stops between goal-focused quests — at most 1 in 3 quests should be generic.
` : ""}
${comfortProfile?.primaryGoal ? `ACTIONABILITY RULES:
- This user has a specific goal. MOST quests should be "actionable" — search the web for real signup links, event schedules, class registrations, or step-by-step instructions and include them in the description and suggested activities.
- "suggestive" is for recovery/exploration quests with no specific next step beyond showing up. Use sparingly.
- "milestone" is for reflection checkpoints — use when prompted by the MILESTONE CHECK instruction in the history context.
- For "actionable" quests: include specific URLs, phone numbers, event dates/times, or registration steps in the description field.
` : ""}
EXPANSION PHILOSOPHY:
${phaseContext || `- Breadth-first by default. ${comfortProfile?.primaryGoal ? "Explore different facets of their goal — venues, communities, skills, and resources that advance it." : "Push into unexplored directions until the user finds an area worth investing in."}\n- Only go deeper in an area if the user has ORGANICALLY revisited it (multiple visits, diverse categories). That's the signal they found their thread.`}
- A comedy open mic across the street is more impactful than driving across the state for coffee. Distance is NOT progress — novelty is.
- Never prescribe further just because you can. The goal is meaningful expansion, not mileage.${explorationProfileLabel ? `\n- Exploration profile: ${explorationProfileLabel} — ${PROFILE_ONE_LINERS[explorationProfileLabel] ?? ""}` : ""}
${siblingInstructions}
USER PROFILE:
- Home: (${homeLat.toFixed(4)}, ${homeLng.toFixed(4)})
- Currently near: ${city} (${searchLat.toFixed(4)}, ${searchLng.toFixed(4)})${isAwayFromHome ? ` — ${distFromHome.toFixed(1)} miles from home` : ""}
- Comfort radius: ${radius.toFixed(1)} miles
${isAwayFromHome ? "- USER IS AWAY FROM HOME. Search near their CURRENT location, not their home. Keep it easy — they're already out of their usual zone." : ""}
- Pace: ${pace === "gentle" ? "Gentle — ease them in, stay close, familiar categories" : pace === "push_me" ? "Push me — they want to be challenged, stretch further" : "Steady — balanced expansion, moderate stretches"}
${comfortProfile?.primaryGoal ? `- PRIMARY GOAL: "${comfortProfile.primaryGoal}" — every quest should advance this goal or build supporting skills/confidence` : ""}
${comfortProfile ? `- What keeps them from going out: "${comfortProfile.barriers}"` : ""}
${comfortProfile?.goalTags?.length ? `- Goals: ${comfortProfile.goalTags.join(", ")}` : ""}
${comfortProfile?.goals ? `- Additional context: "${comfortProfile.goals}"` : ""}
${comfortProfile?.northStar ? `- North star (what success means to them): "${comfortProfile.northStar}"` : ""}
${user.onboardingProfile?.activities?.length ? `- Activities they enjoy: ${user.onboardingProfile.activities.join(", ")}` : ""}
${fearLadderContext}
${expectancyContext}
${comfortProfile?.goalTags?.includes("discover_hobby") ? `- HOBBY DISCOVERY MODE: This user wants to find a new hobby. Prioritize venues where they can TRY an activity hands-on (studios, classes, open sessions, meetups, workshops) — not just observe. Favor categories they haven't explored yet. If they listed activities they enjoy, use those as adjacent starting points (e.g. if they like hiking, try a climbing gym; if they like coffee, try a roasting workshop).` : ""}

${historyContext}
${coverageContext ? `\n${coverageContext}\n` : ""}${expansionTarget ? `\n${expansionTarget}\n` : ""}
TOOLS:
- web_search: discover interesting spots
- search_places: verify venues with Google Places (exact name, address, coordinates)
- search_trails: find trails/paths from OpenStreetMap
- submit_quest: finalize the quest (TERMINAL)

CONSTRAINTS:
- EXACTLY 1 stop. This is a single-destination quest.
- Use EXACT venue names and addresses from search_places results.
- For trails, use ONLY trails returned by search_trails.
- Current time: ${hour}:00, ${dayOfWeek} — don't pick closed venues.
- Title: 3-6 words, encouraging and warm (not clinical).
- Summary: 1-2 sentences framing why this quest matters for their growth.
- hook: why THIS spot expands their world (1 sentence).
- sa (suggested activities): 3-4 things they could do at this spot. Each should start with an emoji. Keep it casual and short. Example: ["🚶 Walk the loop", "📖 Bring a book", "📸 Snap a photo", "☕ Grab a drink"]. Not assignments — just ideas.
- jp (journal prompt): a reflective question for after the visit. Short, open-ended. Examples: "How did it feel being somewhere new?", "Would you come back?", "What surprised you?"
- df (difficulty): 1-10 integer. Judge this based on how challenging THIS specific quest would be for THIS specific user given their profile, fears, history, and current growth phase. Consider distance from home, category familiarity, social demands of the venue, and how far outside their comfort zone this pushes them. 1 = trivially easy, 3 = comfortable, 5 = moderate stretch, 7 = significant challenge, 10 = maximum push.
- act (actionability): "actionable" if you can provide concrete next steps (signup links, phone numbers, event times, step-by-step instructions), "suggestive" for general exploration (go check this place out), "milestone" for reflection checkpoints.${comfortProfile?.primaryGoal ? " This user has a specific goal — prefer actionable." : ""}
${difficultyGuidance}
${hour >= 22 || hour < 6 ? `\nLATE-NIGHT MODE: It's late — focus on 24-hour spots, scenic night walks/viewpoints, or a "plan for tomorrow morning" quest.` : ""}`;

  const initialMessage = `Prescribe a comfort-zone expansion quest for this user.
${isAwayFromHome ? `They're currently in ${city}, about ${distFromHome.toFixed(1)} miles from home. Search near their CURRENT location.` : `Their home is in ${city}. Search within ~${radius.toFixed(0)} miles of their home location.`}
${user.onboardingProfile?.activities?.length ? `They enjoy: ${user.onboardingProfile.activities.join(", ")}` : "Surprise them with something approachable."}`;

  return { instructions, initialMessage };
};

// ── Factory ─────────────────────────────────────────────────

export function createPrescriptionPromptRegistry(): PrescriptionPromptRegistry {
  const registry = new PrescriptionPromptRegistryImpl();
  registry.register("v1-default", defaultPrompt);
  return registry;
}
