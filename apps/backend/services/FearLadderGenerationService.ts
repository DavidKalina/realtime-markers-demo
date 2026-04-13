import { type OpenAIService, OpenAIModel } from "./shared/OpenAIService";

export interface GenerateFearLadderInput {
  primaryGoal: string;
  goals: string[];
  barriers: string[];
  activities: string[];
}

export interface GeneratedScenario {
  id: string;
  text: string;
  dimension: string;
}

export interface GenerateFearLadderResult {
  scenarios: GeneratedScenario[];
  dimensions: string[];
}

const SYSTEM_PROMPT = `You are designing a personalized fear ladder for a social-life-building app. The user is trying to build a social life from scratch, and you need to create 10 scenarios that represent steps of increasing social challenge.

Each scenario should be a concrete, real-world social action — something specific and observable, not vague or abstract.

You must create exactly 5 dimensions that are relevant to the user's social goals. Each dimension represents a different type of social challenge they'll face. Assign exactly 2 scenarios to each dimension.

For example, if someone wants to "build a friend group":
- Dimensions might be: solo_comfort, casual_interaction, group_settings, vulnerability, initiative
- Scenarios might range from "Sit at the bar instead of a table" to "Invite someone you met to hang out again"

If someone wants to "start dating":
- Dimensions might be: solo_outings, conversation_skills, group_social, self_disclosure, romantic_initiative
- Scenarios might range from "Go to a coffee shop and stay for 30 minutes" to "Ask someone for their number after a good conversation"

If someone wants to "stop being a homebody":
- Dimensions might be: leaving_house, public_spaces, social_proximity, brief_interaction, sustained_engagement
- Scenarios might range from "Walk to a nearby park and sit for 20 minutes" to "Attend a group class and introduce yourself to the person next to you"

Guidelines:
- Focus on social scenarios — being around people, interacting, opening up, initiating
- Scenarios should span from mildly uncomfortable to genuinely scary for someone who's socially stuck
- Keep scenario text concise (under 60 characters ideally, max 80)
- Dimension names should be lowercase_snake_case
- Scenario IDs should be lowercase_snake_case, descriptive, and unique
- Make scenarios specific and actionable — include concrete details like durations, venues, or actions
- Consider the user's stated barriers and interests when crafting scenarios`;

const TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "submit_fear_ladder",
    description: "Submit the generated fear ladder with scenarios and dimensions",
    parameters: {
      type: "object",
      properties: {
        dimensions: {
          type: "array",
          items: { type: "string" },
          description: "Exactly 5 dimension names in lowercase_snake_case",
          minItems: 5,
          maxItems: 5,
        },
        scenarios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique snake_case identifier" },
              text: { type: "string", description: "The scenario description (what the user would do)" },
              dimension: { type: "string", description: "Which dimension this belongs to" },
            },
            required: ["id", "text", "dimension"],
          },
          description: "Exactly 10 scenarios, 2 per dimension",
          minItems: 10,
          maxItems: 10,
        },
      },
      required: ["dimensions", "scenarios"],
    },
  },
};

export async function generateFearLadder(openAIService: OpenAIService, input: GenerateFearLadderInput): Promise<GenerateFearLadderResult> {
  const userMessage = buildUserMessage(input);

  const response = await openAIService.executeChatCompletion({
    model: OpenAIModel.GPT4OMini,
    temperature: 0.7,
    max_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "function", function: { name: "submit_fear_ladder" } },
  }, "fear_ladder_generation");

  const toolCall = response.choices[0]?.message?.tool_calls?.[0] as
    | { type: "function"; function: { name: string; arguments: string } }
    | undefined;
  if (!toolCall || toolCall.function.name !== "submit_fear_ladder") {
    throw new Error("LLM did not return a valid fear ladder tool call");
  }

  const parsed = JSON.parse(toolCall.function.arguments) as {
    dimensions: string[];
    scenarios: { id: string; text: string; dimension: string }[];
  };

  validateFearLadder(parsed);

  return {
    scenarios: parsed.scenarios,
    dimensions: parsed.dimensions,
  };
}

function buildUserMessage(input: GenerateFearLadderInput): string {
  const parts: string[] = [];

  parts.push(`PRIMARY GOAL: "${input.primaryGoal}"`);

  if (input.goals.length > 0) {
    parts.push(`Supporting goals: ${input.goals.join(", ")}`);
  }

  if (input.barriers.length > 0) {
    parts.push(`Barriers they face: ${input.barriers.join(", ")}`);
  }

  if (input.activities.length > 0) {
    parts.push(`Activities they enjoy: ${input.activities.join(", ")}`);
  }

  parts.push(
    "\nGenerate a personalized fear ladder with 10 scenarios across 5 dimensions that are specifically relevant to achieving this goal. Use the submit_fear_ladder tool.",
  );

  return parts.join("\n");
}

function validateFearLadder(result: { dimensions: string[]; scenarios: { id: string; text: string; dimension: string }[] }): void {
  if (result.dimensions.length !== 5) {
    throw new Error(`Expected 5 dimensions, got ${result.dimensions.length}`);
  }

  if (result.scenarios.length !== 10) {
    throw new Error(`Expected 10 scenarios, got ${result.scenarios.length}`);
  }

  const ids = new Set(result.scenarios.map((s) => s.id));
  if (ids.size !== 10) {
    throw new Error("Scenario IDs are not unique");
  }

  for (const scenario of result.scenarios) {
    if (!result.dimensions.includes(scenario.dimension)) {
      throw new Error(`Scenario "${scenario.id}" references unknown dimension "${scenario.dimension}"`);
    }
  }

  for (const dim of result.dimensions) {
    const count = result.scenarios.filter((s) => s.dimension === dim).length;
    if (count !== 2) {
      throw new Error(`Dimension "${dim}" has ${count} scenarios, expected 2`);
    }
  }
}
