import { openai } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { AIResponseSchema } from "./shared/schemas/eventSchemas";
import {
  getEventImageAnalysisMessages,
  type EventImageAnalysisResponse,
  type ImageAnalysisPromptData,
} from "./shared/prompts/eventPrompts";

export class AiService {
  private static instance: AiService;
  model: LanguageModel = openai("gpt-4o");

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
}
