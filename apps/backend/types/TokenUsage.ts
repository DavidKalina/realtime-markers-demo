// types/TokenUsage.ts

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function addTokenUsage(
  a?: TokenUsage,
  b?: TokenUsage,
): TokenUsage | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  return {
    promptTokens: (a.promptTokens || 0) + (b.promptTokens || 0),
    completionTokens: (a.completionTokens || 0) + (b.completionTokens || 0),
    totalTokens: (a.totalTokens || 0) + (b.totalTokens || 0),
  };
}

export function fromOpenAIUsage(usage?: {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
}): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

