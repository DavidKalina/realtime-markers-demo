// src/services/OpenAIService.ts
import { OpenAI } from "openai";
import { Redis } from "ioredis";
import type { RedisService } from "./RedisService";
import {
  createOpenAICacheService,
  type OpenAICacheService,
} from "./OpenAICacheService";
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

type OperationType = "embeddings" | "chat" | "api";
type RateLimitKey = `${OpenAIModel}:${OperationType}`;

interface RateLimitConfig {
  tokensPerMinute: number;
  requestsPerMinute: number;
}

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

export class OpenAIServiceImpl implements OpenAIService {
  private openai: OpenAI;
  private redisService: RedisService;
  private openAICacheService: OpenAICacheService;
  private activeRequests: Map<string, number> = new Map();

  constructor(
    redis: Redis,
    redisService: RedisService,
    openAICacheService: OpenAICacheService,
  ) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    this.redisService = redisService;
    this.openAICacheService = openAICacheService;

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

      try {
        // Increment active requests counter
        this.incrementActiveRequests(requestKey);

        // Use simple retry logic instead of exponential backoff
        let retries = 5;
        let delay = 1000;
        let lastError: Error | null = null;

        while (retries > 0) {
          try {
            const response = await originalFetch(url, init);

            // Handle rate limit errors
            if (response.status === 429) {
              console.warn(`Rate limit hit for ${model}, backing off...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay *= 2; // Double the delay for next retry
              retries--;
              continue;
            }

            // Handle server errors
            if (response.status >= 500) {
              console.warn(
                `Server error (${response.status}) for ${model}, retrying...`,
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay *= 2;
              retries--;
              continue;
            }

            return response;
          } catch (error) {
            console.error(
              `Error in OpenAI request (${retries} retries left):`,
              error instanceof Error ? error.message : "Unknown error",
            );
            lastError =
              error instanceof Error ? error : new Error("Unknown error");
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            retries--;
          }
        }

        // If we've exhausted all retries, throw the last error
        if (lastError) {
          throw lastError;
        }

        // This should never happen, but just in case
        throw new Error("Failed to make request after all retries");
      } finally {
        // Decrement active requests counter
        this.decrementActiveRequests(requestKey);
      }
    };

    return customFetch as typeof fetch;
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

  private incrementActiveRequests(key: string): void {
    const current = this.activeRequests.get(key) || 0;
    this.activeRequests.set(key, current + 1);
  }

  private decrementActiveRequests(key: string): void {
    const current = this.activeRequests.get(key) || 1;
    this.activeRequests.set(key, Math.max(0, current - 1));
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
  redis: Redis,
  redisService: RedisService,
): OpenAIService {
  const openAICacheService = createOpenAICacheService();
  return new OpenAIServiceImpl(redis, redisService, openAICacheService);
}
