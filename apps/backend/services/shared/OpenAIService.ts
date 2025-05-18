// src/services/OpenAIService.ts
import { OpenAI } from "openai";
import { Redis } from "ioredis";

export enum OpenAIModel {
  GPT4O = "gpt-4o",
  GPT4OMini = "gpt-4o-mini",
  TextEmbedding3Small = "text-embedding-3-small",
}

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

export class OpenAIService {
  private static instance: OpenAI;
  private static redis: Redis | null = null;

  // Track active requests for each model
  private static activeRequests: Map<string, number> = new Map();

  // Track rate limit state
  private static rateLimitCounters: Map<string, number> = new Map();
  private static lastRateLimitReset: number = Date.now();

  public static initRedis(options: {
    host: string;
    port: number;
    password?: string;
  }) {
    this.redis = new Redis({
      host: options.host,
      port: options.port,
      password: options.password || undefined,
    });
  }
  public static getInstance(): OpenAI {
    if (!this.instance) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      // Create the OpenAI instance with a custom fetch function
      this.instance = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        // Use a fetch wrapper to implement rate limiting and retries
        fetch: this.createFetchWithRateLimit(),
      });
    }
    return this.instance;
  }

  // Create a custom fetch function with rate limiting and retries
  private static createFetchWithRateLimit(): typeof fetch {
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
      await this.checkRateLimit(requestKey, rateLimits);

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
          } catch (error: any) {
            console.error(
              `Error in OpenAI request (${retries} retries left):`,
              error.message,
            );
            lastError = error;
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

  private static async checkRateLimit(
    key: string,
    limits: RateLimitConfig,
  ): Promise<void> {
    // Reset counters if a minute has passed
    const now = Date.now();
    const minutesPassed = Math.floor((now - this.lastRateLimitReset) / 60000);

    if (minutesPassed > 0) {
      this.rateLimitCounters.clear();
      this.lastRateLimitReset = now;
    }

    // Use Redis if available, otherwise fall back to in-memory tracking
    if (this.redis) {
      const minute = Math.floor(Date.now() / 60000);
      const requestCountKey = `openai:${key}:requests:${minute}`;

      const requestCount = await this.redis.incr(requestCountKey);
      await this.redis.expire(requestCountKey, 120); // Keep for 2 minutes

      if (requestCount > limits.requestsPerMinute) {
        // If we're over the limit, determine wait time
        const secondsToNextMinute = 60 - (Math.floor(Date.now() / 1000) % 60);
        const waitTime = Math.max(100, (secondsToNextMinute * 1000) / 2);

        console.warn(`Rate limit approached for ${key}, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    } else {
      // In-memory fallback
      const currentCount = this.rateLimitCounters.get(key) || 0;
      this.rateLimitCounters.set(key, currentCount + 1);

      if (currentCount > limits.requestsPerMinute) {
        const waitTime = 1000; // Simple 1 second delay
        console.warn(`Rate limit approached for ${key}, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  private static incrementActiveRequests(key: string): void {
    const current = this.activeRequests.get(key) || 0;
    this.activeRequests.set(key, current + 1);
  }

  private static decrementActiveRequests(key: string): void {
    const current = this.activeRequests.get(key) || 1;
    this.activeRequests.set(key, Math.max(0, current - 1));
  }

  // Get statistics about API usage
  public static getStats(): Record<string, any> {
    const stats: Record<string, any> = {
      activeRequests: Object.fromEntries(this.activeRequests.entries()),
      rateLimits: Object.fromEntries(this.rateLimitCounters.entries()),
    };

    return stats;
  }

  // Helper method for extracting model from a request payload
  public static async executeChatCompletion(params: {
    model: OpenAIModel;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: "json_object" | "text" };
  }): Promise<any> {
    const openai = this.getInstance();
    const result = await openai.chat.completions.create(params);
    return result;
  }

  // Helper method for generating embeddings
  public static async generateEmbedding(
    text: string,
    model: OpenAIModel = OpenAIModel.TextEmbedding3Small,
  ): Promise<number[]> {
    const openai = this.getInstance();

    const response = await openai.embeddings.create({
      model: model,
      input: text,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  }
}
