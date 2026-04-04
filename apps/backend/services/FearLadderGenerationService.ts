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

export interface FearLadderGenerationService {
  generateFearLadder(input: GenerateFearLadderInput): Promise<GenerateFearLadderResult>;
}

interface FearLadderGenerationServiceDeps {
  openAIService: OpenAIService;
}

const SYSTEM_PROMPT = `You are designing a personalized fear ladder for a goal-achievement app. The user has a specific goal they want to achieve, and you need to create 10 scenarios that represent steps of increasing challenge toward that goal.

Each scenario should be a concrete, real-world action the user could take — something specific and observable, not vague or abstract.

You must create exactly 5 dimensions that are relevant to the user's goal. Each dimension represents a different type of challenge they'll face. Assign exactly 2 scenarios to each dimension.

For example, if someone wants to "become a stand-up comedian":
- Dimensions might be: performance, social_networking, creative_practice, vulnerability, consistency
- Scenarios might range from "Watch a live comedy show in the audience" to "Perform a 5-minute set at an open mic night"

If someone wants to "overcome social anxiety":
- Dimensions might be: solo_outings, social_interaction, novelty, physical_activity, vulnerability
- Scenarios might range from "Sit alone at a coffee shop for 30 minutes" to "Attend a meetup or group event solo"

Guidelines:
- Scenarios should span a range from mildly challenging to quite challenging for someone pursuing this goal
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

class FearLadderGenerationServiceImpl implements FearLadderGenerationService {
  private openAIService: OpenAIService;

  constructor(deps: FearLadderGenerationServiceDeps) {
    this.openAIService = deps.openAIService;
  }

  async generateFearLadder(input: GenerateFearLadderInput): Promise<GenerateFearLadderResult> {
    const userMessage = this.buildUserMessage(input);

    const response = await this.openAIService.executeChatCompletion({
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

    this.validate(parsed);

    return {
      scenarios: parsed.scenarios,
      dimensions: parsed.dimensions,
    };
  }

  private buildUserMessage(input: GenerateFearLadderInput): string {
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

  private validate(result: { dimensions: string[]; scenarios: { id: string; text: string; dimension: string }[] }): void {
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
}

export function createFearLadderGenerationService(
  deps: FearLadderGenerationServiceDeps,
): FearLadderGenerationService {
  return new FearLadderGenerationServiceImpl(deps);
}
