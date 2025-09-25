import type { DataSource, Repository } from "typeorm";
import { TokenUsageDaily } from "@realtime-markers/database";
import { OpenAIModel } from "./OpenAIService";

export interface TokenUsageRecordArgs {
  model: OpenAIModel;
  operation: "chat" | "embeddings";
  scope?: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  date?: string; // YYYY-MM-DD
}

export interface TokenUsageService {
  record(args: TokenUsageRecordArgs): Promise<void>;
}

export class TokenUsageServiceImpl implements TokenUsageService {
  private repo: Repository<TokenUsageDaily>;

  constructor(private dataSource: DataSource) {
    this.repo = dataSource.getRepository(TokenUsageDaily);
  }

  async record(args: TokenUsageRecordArgs): Promise<void> {
    const usageDate = args.date || new Date().toISOString().slice(0, 10);
    const scope = args.scope || "general";

    // Try upsert by unique key (usage_date, model, operation, scope)
    const existing = await this.repo.findOne({
      where: {
        usageDate,
        model: args.model,
        operation: args.operation,
        scope,
      },
    });

    const deltaPrompt = args.usage.promptTokens || 0;
    const deltaCompletion = args.usage.completionTokens || 0;
    const deltaTotal = args.usage.totalTokens || 0;

    if (existing) {
      existing.promptTokens += deltaPrompt;
      existing.completionTokens += deltaCompletion;
      existing.totalTokens += deltaTotal;
      await this.repo.save(existing);
      return;
    }

    const row = this.repo.create({
      usageDate,
      model: args.model,
      operation: args.operation,
      scope,
      promptTokens: deltaPrompt,
      completionTokens: deltaCompletion,
      totalTokens: deltaTotal,
    });
    await this.repo.save(row);
  }
}

export function createTokenUsageService(dataSource: DataSource): TokenUsageService {
  return new TokenUsageServiceImpl(dataSource);
}

