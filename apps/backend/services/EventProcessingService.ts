// services/EventProcessingService.ts
import { OpenAI } from "openai";
import { Repository } from "typeorm";
import { Event } from "../entities/Event";
import { FlyerImage, FlyerProcessingStatus } from "../entities/FlyerImage";

interface ScanResult {
  confidence: number;
  eventDetails: {
    title: string;
    date: string;
    location: string;
    description: string;
  };
  similarity: {
    score: number;
    matchingEventId?: string;
  };
}

export class EventProcessingService {
  constructor(
    private openai: OpenAI,
    private eventRepository: Repository<Event>,
    private flyerRepository: Repository<FlyerImage>
  ) {}

  async processFlyer(flyerId: string): Promise<ScanResult> {
    const flyer = await this.flyerRepository.findOneOrFail({ where: { id: flyerId } });

    // 1. Get the image data and convert to base64
    const base64Image = await this.getBase64Image(flyer.imageUrl);

    // 2. Process with OpenAI Vision API
    const visionResult = await this.processWithVisionAPI(base64Image);

    // 3. Generate text embeddings
    const embedding = await this.generateEmbedding(visionResult.text!);

    // 4. Check for similar events
    const similarity = await this.findSimilarEvents(embedding);

    // 5. Extract event details using GPT-4
    const eventDetails = await this.extractEventDetails(visionResult.text!);

    // 6. Update flyer status
    flyer.status = FlyerProcessingStatus.COMPLETED;
    flyer.processedAt = new Date();
    flyer.visionData = visionResult;
    await this.flyerRepository.save(flyer);

    return {
      confidence: visionResult.confidence || 0,
      eventDetails,
      similarity,
    };
  }

  private async getBase64Image(imageUrl: string): Promise<string> {
    // If the imageUrl is already a base64 string, return it
    if (imageUrl.startsWith("data:image")) {
      return imageUrl;
    }

    // If it's a URL, fetch it
    if (imageUrl.startsWith("http")) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }

    // If it's a local file path, read it
    try {
      const buffer = await import("fs/promises").then((fs) => fs.readFile(imageUrl));
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } catch (error) {
      throw new Error(`Failed to read image: ${error instanceof Error ? error?.message : null}`);
    }
  }

  private async processWithVisionAPI(base64Image: string) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze this event flyer and extract the following details in a structured format:
                     - Event Title
                     - Event Date and Time
                     - Location
                     - Description
                     - Any contact information or social media handles
                     Please be as specific and accurate as possible.`,
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    return {
      success: true,
      text: response.choices[0].message.content,
      confidence: 0.95,
    };
  }

  private async generateEmbedding(text: string) {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  }

  private async findSimilarEvents(embedding: number[]) {
    // Use PostgreSQL's vector similarity search with cosine similarity
    const similarEvents = await this.eventRepository
      .createQueryBuilder("event")
      .where("event.embedding IS NOT NULL")
      .orderBy(`(event.embedding <=> :embedding)`, "ASC") // Cosine similarity
      .setParameter("embedding", embedding)
      .limit(5)
      .getMany();

    if (similarEvents.length === 0) {
      return { score: 0 };
    }

    // Calculate cosine similarity score for the best match
    const bestMatch = similarEvents[0];
    const similarityScore = this.calculateCosineSimilarity(embedding, bestMatch.embedding!);

    return {
      score: similarityScore,
      matchingEventId: bestMatch.id,
    };
  }

  private async extractEventDetails(text: string) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a precise event information extractor. Extract event details and format them consistently.",
        },
        {
          role: "user",
          content: `Extract the following details from this text in a JSON format:
                   ${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsedDetails = JSON.parse(response.choices[0]?.message.content?.trim() ?? "");
    return {
      title: parsedDetails.title || "",
      date: parsedDetails.date || "",
      location: parsedDetails.location || "",
      description: parsedDetails.description || "",
    };
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }
}
