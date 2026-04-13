import { type OpenAIService, OpenAIModel } from "./shared/OpenAIService";

export interface GenerateBarriersInput {
  primaryGoal: string;
}

export interface GeneratedBarrier {
  key: string;
  label: string;
  text: string;
}

export interface GenerateBarriersResult {
  barriers: GeneratedBarrier[];
}

interface BarrierGenerationServiceDeps {
  openAIService: OpenAIService;
}

const SYSTEM_PROMPT = `You are helping a social-life-building app personalize onboarding. The user is someone trying to build or rebuild their social life. Given their primary goal, generate 6-8 barriers — things that might realistically keep them stuck.

Each barrier should have:
- key: a unique lowercase_snake_case identifier
- label: a short chip label with a leading emoji (e.g. "😰 Overthinking it"). Keep under 30 characters.
- text: a one-sentence description used for calibration (e.g. "Overthinks every social decision into paralysis")

Guidelines:
- Focus on social/emotional barriers: overthinking, feeling behind peers, not knowing what to do, past failures, energy drain, approach anxiety
- Include a mix of internal barriers (self-doubt, paralysis, learned helplessness, comparison) and external barriers (small town, limited options, time, schedule)
- These are social life barriers, not generic productivity obstacles
- Order from most common/relatable to least
- Keep labels concise and scannable — users tap these as chips in a multi-select UI`;

const TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "submit_barriers",
    description: "Submit the generated barriers for the user's goal",
    parameters: {
      type: "object",
      properties: {
        barriers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Unique snake_case identifier" },
              label: { type: "string", description: "Emoji + short label for chip display" },
              text: { type: "string", description: "One-sentence description for calibration" },
            },
            required: ["key", "label", "text"],
          },
          description: "6-8 barriers specific to the user's goal",
          minItems: 6,
          maxItems: 8,
        },
      },
      required: ["barriers"],
    },
  },
};

export class BarrierGenerationService {
  private openAIService: OpenAIService;

  constructor(deps: BarrierGenerationServiceDeps) {
    this.openAIService = deps.openAIService;
  }

  async generateBarriers(input: GenerateBarriersInput): Promise<GenerateBarriersResult> {
    const userMessage = `PRIMARY GOAL: "${input.primaryGoal}"\n\nGenerate 6-8 personalized barriers that might hold someone back from achieving this goal. Use the submit_barriers tool.`;

    const response = await this.openAIService.executeChatCompletion({
      model: OpenAIModel.GPT4OMini,
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "function", function: { name: "submit_barriers" } },
    }, "barrier_generation");

    const toolCall = response.choices[0]?.message?.tool_calls?.[0] as
      | { type: "function"; function: { name: string; arguments: string } }
      | undefined;
    if (!toolCall || toolCall.function.name !== "submit_barriers") {
      throw new Error("LLM did not return a valid barriers tool call");
    }

    const parsed = JSON.parse(toolCall.function.arguments) as {
      barriers: GeneratedBarrier[];
    };

    this.validate(parsed.barriers);

    return { barriers: parsed.barriers };
  }

  private validate(barriers: GeneratedBarrier[]): void {
    if (barriers.length < 6 || barriers.length > 8) {
      throw new Error(`Expected 6-8 barriers, got ${barriers.length}`);
    }

    const keys = new Set(barriers.map((b) => b.key));
    if (keys.size !== barriers.length) {
      throw new Error("Barrier keys are not unique");
    }

    for (const b of barriers) {
      if (!b.key || !b.label || !b.text) {
        throw new Error(`Barrier "${b.key}" is missing required fields`);
      }
    }
  }
}

