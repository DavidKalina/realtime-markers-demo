// src/services/OpenAIService.ts
import { OpenAI } from "openai";
import type { DataSource, Repository } from "typeorm";
import { LlmUsageLog } from "../../entities";
import type { RedisService } from "./RedisService";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources/chat/completions";

export enum OpenAIModel {
  GPT4O = "gpt-4o",
  GPT4OMini = "gpt-4o-mini",
  GPT5 = "gpt-5",
  GPT51 = "gpt-5.1",
  GPT52 = "gpt-5.2",
  GPT54 = "gpt-5.4",
  GPT54Mini = "gpt-5.4-mini",
  GPT54Nano = "gpt-5.4-nano",
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
  [OpenAIModel.GPT54]: { tokensPerMinute: 5000, requestsPerMinute: 300 },
  [OpenAIModel.GPT54Mini]: { tokensPerMinute: 10000, requestsPerMinute: 600 },
  [OpenAIModel.GPT54Nano]: { tokensPerMinute: 15000, requestsPerMinute: 1000 },
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
  [OpenAIModel.GPT54Mini]: { input: 0.75, output: 4.5 },
  [OpenAIModel.GPT54Nano]: { input: 0.20, output: 1.25 },
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

// ── Inline TTL cache (replaces OpenAICacheService) ──────────────────
const MAX_MEMORY_CACHE_SIZE = 1000;
const EMBEDDING_CACHE_PREFIX = "openai:embedding:";
const RATE_LIMIT_CACHE_PREFIX = "openai:ratelimit:";
const EMBEDDING_TTL = 24 * 60 * 60; // 24 hours
const RATE_LIMIT_TTL = 120; // 2 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.value as T;
    if (entry) this.store.delete(key);
    return null;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= MAX_MEMORY_CACHE_SIZE) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
// ─────────────────────────────────────────────────────────────────────

// Define dependencies interface for cleaner constructor
export interface OpenAIServiceDependencies {
  redisService: RedisService;
  dataSource: DataSource;
}

export class OpenAIService {
  private openai: OpenAI;
  private redisService: RedisService;
  private cache = new MemoryCache();
  private activeRequests: Map<string, number> = new Map();
  private llmUsageRepository: Repository<LlmUsageLog>;

  constructor(private dependencies: OpenAIServiceDependencies) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set — AI features will be unavailable",
      );
    }

    this.redisService = dependencies.redisService;

    this.llmUsageRepository =
      dependencies.dataSource.getRepository(LlmUsageLog);

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

    return customFetch as unknown as typeof fetch;
  }

  private async checkRateLimit(
    key: string,
    limits: RateLimitConfig,
    model?: OpenAIModel,
    operation?: string,
  ): Promise<void> {
    if (!model || !operation) return;

    const rateLimitKey = `${RATE_LIMIT_CACHE_PREFIX}${model}:${operation}:${Math.floor(Date.now() / 60000)}`;
    const currentCount = this.cache.get<number>(rateLimitKey) || 0;
    const requestCount = currentCount + 1;
    this.cache.set(rateLimitKey, requestCount, RATE_LIMIT_TTL);

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
        const rlKey = `${RATE_LIMIT_CACHE_PREFIX}${model}:${operation}:${Math.floor(Date.now() / 60000)}`;
        const count = this.cache.get<number>(rlKey);
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
      tools?: ChatCompletionTool[];
      tool_choice?: ChatCompletionToolChoiceOption;
    },
    caller: string = "unknown",
  ): Promise<ChatCompletion> {
    const start = Date.now();
    // Newer models require max_completion_tokens instead of max_tokens
    const { max_tokens, ...rest } = params;
    const nonStreamingParams: ChatCompletionCreateParamsNonStreaming = {
      ...rest,
      ...(max_tokens != null
        ? { max_completion_tokens: max_tokens }
        : {}),
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

  async executeResponseWithTools(
    params: {
      model: OpenAIModel;
      instructions?: string;
      input: import("openai/resources/responses/responses").ResponseInputItem[];
      tools?: import("openai/resources/responses/responses").Tool[];
      max_output_tokens?: number;
      temperature?: number;
    },
    caller: string = "unknown",
  ): Promise<import("openai/resources/responses/responses").Response> {
    const start = Date.now();
    const response = await this.openai.responses.create({
      model: params.model,
      instructions: params.instructions,
      input: params.input,
      tools: params.tools,
      max_output_tokens: params.max_output_tokens,
      temperature: params.temperature,
    });
    const durationMs = Date.now() - start;

    if (response.usage) {
      this.logUsage({
        model: params.model,
        operation: "response_with_tools",
        caller,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        durationMs,
      });
    }

    return response;
  }

  async generateEmbedding(
    text: string,
    model: OpenAIModel = OpenAIModel.TextEmbedding3Small,
    caller: string = "unknown",
  ): Promise<number[]> {
    // Try to get from cache first
    const cachedEmbedding = this.cache.get<number[]>(`${EMBEDDING_CACHE_PREFIX}${text}`);
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
    this.cache.set(`${EMBEDDING_CACHE_PREFIX}${text}`, embedding, EMBEDDING_TTL);

    return embedding;
  }

  // Reset all rate limit counters
  async resetRateLimits(): Promise<void> {
    this.cache.deleteByPrefix(RATE_LIMIT_CACHE_PREFIX);
  }
}

