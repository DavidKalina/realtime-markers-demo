// src/services/OpenAIService.ts
import { OpenAI } from "openai";
import type { RedisService } from "./RedisService";
import type { OpenAICacheService } from "./OpenAICacheService";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

export enum OpenAIModel {
  GPT4O = "gpt-4o",
  GPT4OMini = "gpt-4o-mini",
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
  [OpenAIModel.TextEmbedding3Small]: {
    tokensPerMinute: 1000000,
    requestsPerMinute: 3000,
  },
};

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  tokensPerMinute: 3000,
  requestsPerMinute: 300,
};

export interface OpenAIService {
  executeChatCompletion(params: {
    model: OpenAIModel;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: "json_object" | "text" };
  }): Promise<ChatCompletion>;

  generateEmbedding(text: string, model?: OpenAIModel): Promise<number[]>;

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
}

export class OpenAIServiceImpl implements OpenAIService {
  private openai: OpenAI;
  private redisService: RedisService;
  private openAICacheService: OpenAICacheService;
  private activeRequests: Map<string, number> = new Map();

  constructor(private dependencies: OpenAIServiceDependencies) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    this.redisService = dependencies.redisService;
    this.openAICacheService = dependencies.openAICacheService;

    // Create the OpenAI instance with a custom fetch function
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Use a fetch wrapper to implement rate limiting and retries
      fetch: this.createFetchWithRateLimit(),
    });
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

  // Helper method for extracting model from a request payload
  async executeChatCompletion(params: {
    model: OpenAIModel;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: "json_object" | "text" };
  }): Promise<ChatCompletion> {
    const nonStreamingParams: ChatCompletionCreateParamsNonStreaming = {
      ...params,
      stream: false,
    };
    return this.openai.chat.completions.create(nonStreamingParams);
  }

  // Helper method for generating embeddings with caching
  async generateEmbedding(
    text: string,
    model: OpenAIModel = OpenAIModel.TextEmbedding3Small,
  ): Promise<number[]> {
    // Try to get from cache first
    const cachedEmbedding = await this.openAICacheService.getEmbedding(text);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    const response = await this.openai.embeddings.create({
      model: model,
      input: text,
      encoding_format: "float",
    });

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
