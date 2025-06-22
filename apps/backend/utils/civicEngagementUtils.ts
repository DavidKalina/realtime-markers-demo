import type { IEmbeddingService } from "../services/event-processing/interfaces/IEmbeddingService";
import type { CreateCivicEngagementInput } from "../types/civicEngagement";

// Extended type for internal processing
export interface CivicEngagementDataWithEmbedding
  extends Partial<CreateCivicEngagementInput> {
  embedding?: number[];
}

/**
 * Generate embedding for civic engagement search functionality
 */
export async function generateCivicEngagementEmbedding(
  data: CivicEngagementDataWithEmbedding,
  embeddingService: IEmbeddingService,
): Promise<CivicEngagementDataWithEmbedding> {
  if (!data.embedding) {
    console.log(
      "[generateCivicEngagementEmbedding] Generating embedding for civic engagement:",
      data.title,
    );

    // Create text for embedding using a format optimized for civic engagements
    const textForEmbedding = `
      TITLE: ${data.title} ${data.title} ${data.title}
      TYPE: ${data.type || ""}
      DESCRIPTION: ${data.description || ""}
      LOCATION: ${data.address || ""}
      LOCATION_NOTES: ${data.locationNotes || ""}
    `.trim();

    try {
      data.embedding = await embeddingService.getEmbedding(textForEmbedding);
      console.log(
        "[generateCivicEngagementEmbedding] Generated embedding successfully",
      );
    } catch (embeddingError) {
      console.error(
        "[generateCivicEngagementEmbedding] Error generating embedding:",
        embeddingError,
      );
      // Continue without embedding - the civic engagement can still be created
      data.embedding = [];
    }
  }

  return data;
}

/**
 * Prepare update data by generating embeddings if needed
 */
export async function prepareCivicEngagementUpdateData(
  data: Partial<CivicEngagementDataWithEmbedding>,
  embeddingService: IEmbeddingService,
): Promise<Partial<CivicEngagementDataWithEmbedding>> {
  const processedData = { ...data };

  // Generate embedding if title or description changed
  if (data.title || data.description) {
    console.log(
      "[prepareCivicEngagementUpdateData] Generating embedding for updated civic engagement:",
      data.title,
    );

    // Create text for embedding using a format optimized for civic engagements
    const textForEmbedding = `
      TITLE: ${data.title || ""} ${data.title || ""} ${data.title || ""}
      TYPE: ${data.type || ""}
      DESCRIPTION: ${data.description || ""}
      LOCATION: ${data.address || ""}
      LOCATION_NOTES: ${data.locationNotes || ""}
    `.trim();

    try {
      processedData.embedding =
        await embeddingService.getEmbedding(textForEmbedding);
      console.log(
        "[prepareCivicEngagementUpdateData] Generated embedding successfully",
      );
    } catch (embeddingError) {
      console.error(
        "[prepareCivicEngagementUpdateData] Error generating embedding:",
        embeddingError,
      );
      // Continue without embedding - the civic engagement can still be updated
      processedData.embedding = [];
    }
  }

  return processedData;
}
