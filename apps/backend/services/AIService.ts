import { openai } from "@ai-sdk/openai";
import {
  generateObject,
  type LanguageModel,
  embed,
  type EmbedResult,
} from "ai";
import { AIResponseSchema } from "./shared/schemas/eventSchemas";
import {
  getEventImageAnalysisMessages,
  type EventImageAnalysisResponse,
  type ImageAnalysisPromptData,
} from "./shared/prompts/eventPrompts";

export class AiService {
  private static instance: AiService;
  model: LanguageModel = openai("gpt-4o");
  embeddingModel = openai.embedding("text-embedding-3-small");

  private constructor(model: LanguageModel) {
    this.model = model;
  }

  public static getInstance(): AiService {
    if (!this.instance) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
      }
      this.instance = new AiService(openai("gpt-4o"));
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
}
