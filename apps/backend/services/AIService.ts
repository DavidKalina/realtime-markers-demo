import { openai } from "@ai-sdk/openai";
import {
  generateObject,
  type LanguageModel,
  type EmbeddingModel,
  embed,
  cosineSimilarity,
  type EmbedResult,
} from "ai";
import { AIResponseSchema } from "./shared/schemas/eventSchemas";
import {
  getEventImageAnalysisMessages,
  type EventImageAnalysisResponse,
  type ImageAnalysisPromptData,
} from "./shared/prompts/eventPrompts";

type ModelConfig = {
  modelId: string;
  envVar: string;
  embeddingModelId?: string;
};

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  "gpt-4": {
    modelId: "gpt-4",
    envVar: "OPENAI_API_KEY",
    embeddingModelId: "text-embedding-3-small",
  },
  "gpt-4o": {
    modelId: "gpt-4o",
    envVar: "OPENAI_API_KEY",
    embeddingModelId: "text-embedding-3-small",
  },
  // Add more models here as needed
};

export class AiService {
  private static instance: AiService;
  model: LanguageModel;
  embeddingModel: EmbeddingModel<string>;

  private constructor(modelConfig: ModelConfig) {
    this.model = openai(modelConfig.modelId);
    this.embeddingModel = openai.embedding(
      modelConfig.embeddingModelId || "text-embedding-3-small",
    );
  }

  public static getInstance(modelType: string = "gpt-4o"): AiService {
    if (!this.instance) {
      const config = MODEL_CONFIGS[modelType];
      if (!config) {
        throw new Error(`Unsupported model type: ${modelType}`);
      }

      if (!process.env[config.envVar]) {
        throw new Error(`${config.envVar} is not set for model ${modelType}`);
      }

      this.instance = new AiService(config);
    }
    return this.instance;
  }

  public static async describeImage(
    image: Buffer,
  ): Promise<{ object: EventImageAnalysisResponse }> {
    const service = this.getInstance();
    const imageAsUint8Array = await Bun.file(image).arrayBuffer();
    const imageAsBase64 = Buffer.from(imageAsUint8Array).toString("base64");
    const imageAsBase64Url = `data:image/jpeg;base64,${imageAsBase64}`;

    const promptData: ImageAnalysisPromptData = {
      imageUrl: imageAsBase64Url,
    };

    const result = await generateObject({
      model: service.model,
      output: "object",
      schema: AIResponseSchema,
      messages: getEventImageAnalysisMessages(promptData.imageUrl),
    });

    // Validate the response
    const validatedResult = AIResponseSchema.parse(result.object);
    return { object: validatedResult };
  }

  public static async generateEmbeddings(
    text: string,
  ): Promise<EmbedResult<string>> {
    const service = this.getInstance();

    const embeddings = await embed({
      model: service.embeddingModel,
      value: text,
    });

    return embeddings;
  }

  public static async generateEmbeddingsBatch(
    texts: string[],
  ): Promise<EmbedResult<string>[]> {
    const service = this.getInstance();

    const embeddingsPromises = texts.map((text) =>
      embed({
        model: service.embeddingModel,
        value: text,
      }),
    );

    return Promise.all(embeddingsPromises);
  }

  public static async calculateSimilarity(
    text1: string,
    text2: string,
  ): Promise<number> {
    const service = this.getInstance();

    const [embedding1, embedding2] = await Promise.all([
      embed({
        model: service.embeddingModel,
        value: text1,
      }),
      embed({
        model: service.embeddingModel,
        value: text2,
      }),
    ]);

    return cosineSimilarity(embedding1.embedding, embedding2.embedding);
  }
}
