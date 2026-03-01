// src/services/OpenAIService.ts
import { OpenAI } from "openai";
import type { DataSource, Repository } from "typeorm";
import { LlmUsageLog } from "@realtime-markers/database";
import type { RedisService } from "./RedisService";
import type { OpenAICacheService } from "./OpenAICacheService";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";

export enum OpenAIModel {
  GPT4O = "gpt-4o",
  GPT4OMini = "gpt-4o-mini",
  GPT5 = "gpt-5",
  GPT51 = "gpt-5.1",
  GPT52 = "gpt-5.2",
  TextEmbedding3Small = "text-embedding-3-small",
}

interface RateLimitConfig {
  tokensPerMinute: number;
  requestsPerMinute: number;
}

type RateLimitKey = `${OpenAIModel}:${"embeddings" | "chat" | "api"}`;

const MODEL_RATE_LIMITS: Record<OpenAIModel, RateLimitConfig> = {
  [OpenAIModel.GPT4O]: { tokensPerMinute: 5000, requestsPerMinute: 500 },
  [OpenAIModel.GPT4OMini]: { tokensPerMinute: 10000, requestsPerMinute: 1000 },
  [OpenAIModel.GPT5]: { tokensPerMinute: 5000, requestsPerMinute: 300 },
  [OpenAIModel.GPT51]: { tokensPerMinute: 5000, requestsPerMinute: 300 },
  [OpenAIModel.GPT52]: { tokensPerMinute: 5000, requestsPerMinute: 300 },
  [OpenAIModel.TextEmbedding3Small]: {
    tokensPerMinute: 1000000,
    requestsPerMinute: 3000,
  },
};

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  tokensPerMinute: 3000,
  requestsPerMinute: 300,
};

// Cost per 1M tokens (input / output) — update as pricing changes
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [OpenAIModel.GPT4O]: { input: 2.5, output: 10 },
  [OpenAIModel.GPT4OMini]: { input: 0.15, output: 0.6 },
  [OpenAIModel.GPT5]: { input: 2.5, output: 10 },
  [OpenAIModel.GPT51]: { input: 2.5, output: 10 },
  [OpenAIModel.GPT52]: { input: 2.5, output: 10 },
  [OpenAIModel.TextEmbedding3Small]: { input: 0.02, output: 0 },
};

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 2.5, output: 10 };
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

export interface ResponsesCreateParams {
  model: OpenAIModel;
  instructions?: string;
  input:
    | string
    | Array<{ role: "developer" | "user" | "assistant"; content: string }>;
  max_output_tokens?: number;
  reasoning?: { effort: "none" | "minimal" | "low" | "medium" | "high" };
}

export interface OpenAIService {
  executeChatCompletion(
    params: {
      model: OpenAIModel;
      messages: ChatCompletionMessageParam[];
      temperature?: number;
      max_tokens?: number;
      max_completion_tokens?: number;
      response_format?: { type: "json_object" | "text" };
    },
    caller?: string,
  ): Promise<ChatCompletion>;

  executeResponse(
    params: ResponsesCreateParams,
    caller?: string,
  ): Promise<string>;

  streamChatCompletion(params: {
    model: OpenAIModel;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
  }): Promise<Stream<ChatCompletionChunk>>;

  generateEmbedding(
    text: string,
    model?: OpenAIModel,
    caller?: string,
  ): Promise<number[]>;

  getStats(): Promise<{
    activeRequests: Record<string, number>;
    rateLimits: Record<RateLimitKey, number>;
  }>;

  resetRateLimits(): Promise<void>;
}

// Define dependencies interface for cleaner constructor
export interface OpenAIServiceDependencies {
  redisService: RedisService;
  openAICacheService: OpenAICacheService;
  dataSource?: DataSource;
}

export class OpenAIServiceImpl implements OpenAIService {
  private openai: OpenAI;
  private redisService: RedisService;
  private openAICacheService: OpenAICacheService;
  private activeRequests: Map<string, number> = new Map();
  private llmUsageRepository: Repository<LlmUsageLog> | null = null;

  constructor(private dependencies: OpenAIServiceDependencies) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set — AI features will be unavailable",
      );
    }

    this.redisService = dependencies.redisService;
    this.openAICacheService = dependencies.openAICacheService;

    if (dependencies.dataSource) {
      this.llmUsageRepository =
        dependencies.dataSource.getRepository(LlmUsageLog);
    }

    // Create the OpenAI instance with a custom fetch function
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Use a fetch wrapper to implement rate limiting and retries
      fetch: this.createFetchWithRateLimit(),
    });
  }

  private logUsage(params: {
    model: string;
    operation: string;
    caller: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs: number;
  }): void {
    if (!this.llmUsageRepository) return;
    const cost = estimateCost(
      params.model,
      params.promptTokens,
      params.completionTokens,
    );
    this.llmUsageRepository
      .save({
        model: params.model,
        operation: params.operation,
        caller: params.caller,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        estimatedCost: cost,
        durationMs: params.durationMs,
      })
      .catch((err) => console.error("Failed to log LLM usage:", err));
  }

  // Create a custom fetch function with rate limiting and retries
  private createFetchWithRateLimit(): typeof fetch {
    const originalFetch = fetch;

    const customFetch = async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      // Determine which model is being used from the request body
      let model: OpenAIModel | undefined;
      if (init?.body) {
        try {
          const body = JSON.parse(init.body.toString());
          const modelStr = body.model;
          if (
            modelStr &&
            Object.values(OpenAIModel).includes(modelStr as OpenAIModel)
          ) {
            model = modelStr as OpenAIModel;
          }
        } catch (e) {
          // If we can't parse the body, use default rate limit
        }
      }

      // Determine operation type from URL
      const urlString = url.toString();
      const operation = urlString.includes("embeddings")
        ? "embeddings"
        : urlString.includes("chat/completions")
          ? "chat"
          : "api";

      const requestKey = `${operation}:${model || "default"}`;
      const rateLimits = model ? MODEL_RATE_LIMITS[model] : DEFAULT_RATE_LIMITS;

      // Check rate limits before proceeding
      await this.checkRateLimit(requestKey, rateLimits, model, operation);

      // Track active requests
      this.activeRequests.set(
        requestKey,
        (this.activeRequests.get(requestKey) || 0) + 1,
      );

      try {
        // Make the actual request
        const response = await originalFetch(url, init);

        // If the request was successful, return the response
        if (response.ok) {
          return response;
        }

        // If we got a rate limit error, wait and retry
        if (response.status === 429) {
          console.warn(`Rate limit hit for ${requestKey}, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return originalFetch(url, init);
        }

        return response;
      } finally {
        // Decrement active requests count
        const currentCount = this.activeRequests.get(requestKey) || 0;
        if (currentCount > 0) {
          this.activeRequests.set(requestKey, currentCount - 1);
        }
      }
    };

    return customFetch;
  }

  private async checkRateLimit(
    key: string,
    limits: RateLimitConfig,
    model?: OpenAIModel,
    operation?: string,
  ): Promise<void> {
    if (!model || !operation) return;

    const requestCount = await this.openAICacheService.incrementRateLimitCount(
      model,
      operation,
    );

    if (requestCount > limits.requestsPerMinute) {
      // If we're over the limit, determine wait time
      const secondsToNextMinute = 60 - (Math.floor(Date.now() / 1000) % 60);
      const waitTime = Math.max(100, (secondsToNextMinute * 1000) / 2);

      console.warn(`Rate limit approached for ${key}, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // Get statistics about API usage
  async getStats(): Promise<{
    activeRequests: Record<string, number>;
    rateLimits: Record<RateLimitKey, number>;
  }> {
    const stats = {
      activeRequests: Object.fromEntries(this.activeRequests.entries()),
      rateLimits: {} as Record<RateLimitKey, number>,
    };

    // Get rate limit stats for each model and operation
    for (const model of Object.values(OpenAIModel)) {
      for (const operation of ["embeddings", "chat", "api"] as const) {
        const count = await this.openAICacheService.getRateLimitCount(
          model,
          operation,
        );
        if (count !== null) {
          const key = `${model}:${operation}` as RateLimitKey;
          stats.rateLimits[key] = count;
        }
      }
    }

    return stats;
  }

  async executeChatCompletion(
    params: {
      model: OpenAIModel;
      messages: ChatCompletionMessageParam[];
      temperature?: number;
      max_tokens?: number;
      max_completion_tokens?: number;
      response_format?: { type: "json_object" | "text" };
    },
    caller: string = "unknown",
  ): Promise<ChatCompletion> {
    const start = Date.now();
    const nonStreamingParams: ChatCompletionCreateParamsNonStreaming = {
      ...params,
      stream: false,
    };
    const response =
      await this.openai.chat.completions.create(nonStreamingParams);
    const durationMs = Date.now() - start;

    if (response.usage) {
      this.logUsage({
        model: params.model,
        operation: "chat_completion",
        caller,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        durationMs,
      });
    }

    return response;
  }

  async executeResponse(
    params: ResponsesCreateParams,
    caller: string = "unknown",
  ): Promise<string> {
    const start = Date.now();
    const response = await this.openai.responses.create({
      model: params.model,
      instructions: params.instructions,
      input: params.input,
      max_output_tokens: params.max_output_tokens,
      reasoning: params.reasoning,
    });
    const durationMs = Date.now() - start;

    if (response.usage) {
      this.logUsage({
        model: params.model,
        operation: "response",
        caller,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        durationMs,
      });
    }

    return response.output_text;
  }

  async streamChatCompletion(params: {
    model: OpenAIModel;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
  }): Promise<Stream<ChatCompletionChunk>> {
    return this.openai.chat.completions.create({
      ...params,
      stream: true,
    });
  }

  async generateEmbedding(
    text: string,
    model: OpenAIModel = OpenAIModel.TextEmbedding3Small,
    caller: string = "unknown",
  ): Promise<number[]> {
    // Try to get from cache first
    const cachedEmbedding = await this.openAICacheService.getEmbedding(text);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    const start = Date.now();
    const response = await this.openai.embeddings.create({
      model: model,
      input: text,
      encoding_format: "float",
    });
    const durationMs = Date.now() - start;

    if (response.usage) {
      this.logUsage({
        model,
        operation: "embedding",
        caller,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: 0,
        totalTokens: response.usage.total_tokens,
        durationMs,
      });
    }

    const embedding = response.data[0].embedding;

    // Cache the embedding
    await this.openAICacheService.setEmbedding(text, embedding);

    return embedding;
  }

  // Reset all rate limit counters
  async resetRateLimits(): Promise<void> {
    await this.openAICacheService.resetRateLimitCounters();
  }
}

/**
 * Factory function to create an OpenAIService instance
 */
export function createOpenAIService(
  dependencies: OpenAIServiceDependencies,
): OpenAIService {
  return new OpenAIServiceImpl(dependencies);
}
