import type { OpenAIService } from "./OpenAIService";
import { OpenAIModel } from "./OpenAIService";

type ResponseInputItem =
  import("openai/resources/responses/responses").ResponseInputItem;
type Tool = import("openai/resources/responses/responses").Tool;
type ResponseFunctionToolCall =
  import("openai/resources/responses/responses").ResponseFunctionToolCall;

export interface AgentToolResult {
  output: string;
  /** If true, this tool call is the terminal one — stop the loop and return it. */
  terminal?: boolean;
  /** Optional rejection message — tell the model to try again. */
  rejection?: string;
}

export type AgentToolHandler = (
  args: Record<string, unknown>,
) => Promise<AgentToolResult>;

export interface AgentRoundInfo {
  round: number;
  toolCalls: string[];
}

export interface AgentConfig {
  model?: OpenAIModel;
  instructions: string;
  tools: Tool[];
  /** Map of function tool name → handler. web_search is handled by the API. */
  toolHandlers: Record<string, AgentToolHandler>;
  maxRounds?: number;
  temperature?: number;
  maxOutputTokens?: number;
  caller?: string;
  onRoundComplete?: (info: AgentRoundInfo) => Promise<void>;
}

export interface AgentResult<T = Record<string, unknown>> {
  /** The parsed args from the terminal tool call. */
  result: T;
  /** Which tool was terminal. */
  terminalTool: string;
  /** How many rounds the loop ran. */
  rounds: number;
}

/**
 * Generic agentic loop over OpenAI's Responses API with tool calling.
 *
 * Handles:
 * - Conversation state accumulation
 * - Function tool call routing to handlers
 * - Built-in web_search pass-through (the API resolves it automatically)
 * - Retry on transient 500s
 * - Max rounds safety valve
 * - Terminal tool calls (handler returns { terminal: true })
 * - Rejection (handler returns { rejection: "..." } to force retry)
 */
export class OpenAIResponsesAgent {
  constructor(private openAIService: OpenAIService) {}

  async run<T = Record<string, unknown>>(
    config: AgentConfig,
    initialMessage: string,
  ): Promise<AgentResult<T>> {
    const maxRounds = config.maxRounds ?? 12;
    const model = config.model ?? OpenAIModel.GPT54Mini;
    const caller = config.caller ?? "agent";

    const inputItems: ResponseInputItem[] = [
      { role: "user", content: initialMessage },
    ];

    for (let round = 0; round < maxRounds; round++) {
      let response: Awaited<
        ReturnType<typeof this.openAIService.executeResponseWithTools>
      >;

      try {
        response = await this.openAIService.executeResponseWithTools(
          {
            model,
            instructions: config.instructions,
            input: inputItems,
            tools: config.tools,
            temperature: config.temperature ?? 0.8,
            max_output_tokens: config.maxOutputTokens ?? 2500,
          },
          caller,
        );
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        if (status && status >= 500 && round < maxRounds - 1) {
          console.warn(
            `[${caller}] OpenAI ${status} on round ${round + 1}, retrying...`,
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }

      console.log(
        `[${caller}] Round ${round + 1}: status=${response.status}, output items=${response.output.length}`,
      );

      const functionCalls = response.output.filter(
        (item): item is ResponseFunctionToolCall =>
          item.type === "function_call",
      );

      // No function calls — model is done or stuck
      if (functionCalls.length === 0) {
        if (response.status === "completed") {
          // Push output back and ask to call the terminal tool
          const terminalTools = Object.keys(config.toolHandlers);
          inputItems.push(
            ...(response.output as ResponseInputItem[]),
            {
              role: "user",
              content: `Now call ${terminalTools[terminalTools.length - 1]} with your final result based on what you found.`,
            },
          );
          continue;
        }
        break;
      }

      // Feed all output back (includes web_search results resolved by the API)
      const feedbackItems: ResponseInputItem[] = [
        ...(response.output as ResponseInputItem[]),
      ];

      for (const call of functionCalls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(call.arguments);
        } catch {
          feedbackItems.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: "Invalid JSON arguments",
          });
          continue;
        }

        const handler = config.toolHandlers[call.name];
        if (!handler) {
          feedbackItems.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: `Unknown tool: ${call.name}`,
          });
          continue;
        }

        console.log(
          `[${caller}] Round ${round + 1}: ${call.name}(${JSON.stringify(args)})`,
        );

        const result = await handler(args);

        if (result.rejection) {
          feedbackItems.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: result.rejection,
          });
          continue;
        }

        if (result.terminal) {
          console.log(
            `[${caller}] Terminal tool ${call.name} after ${round + 1} rounds`,
          );
          return {
            result: args as T,
            terminalTool: call.name,
            rounds: round + 1,
          };
        }

        feedbackItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: result.output,
        });
      }

      if (config.onRoundComplete) {
        await config.onRoundComplete({
          round: round + 1,
          toolCalls: functionCalls.map((c) => c.name),
        });
      }

      inputItems.push(...feedbackItems);
    }

    throw new Error(
      `Agent "${caller}" failed to reach a terminal tool call within ${maxRounds} rounds`,
    );
  }
}
