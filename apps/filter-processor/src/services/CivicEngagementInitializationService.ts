import {
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
} from "../types/types";
import { LegacyEventCacheHandler } from "../handlers/EventProcessor";
import type { EntityInitializationService as IEntityInitializationService } from "../types/entities";

export interface CivicEngagementInitializationServiceConfig {
  backendUrl?: string;
  pageSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class CivicEngagementInitializationService
  implements IEntityInitializationService
{
  readonly entityType = "civic_engagement";
  private eventProcessor: LegacyEventCacheHandler;
  private backendUrl: string;
  private pageSize: number;
  private maxRetries: number;
  private retryDelay: number;

  // Stats for monitoring
  private stats = {
    civicEngagementsFetched: 0,
    civicEngagementsProcessed: 0,
    apiCalls: 0,
    apiErrors: 0,
    retries: 0,
    lastInitializationTime: 0,
  };

  constructor(
    eventProcessor: LegacyEventCacheHandler,
    config: CivicEngagementInitializationServiceConfig = {},
  ) {
    this.eventProcessor = eventProcessor;
    this.backendUrl =
      config.backendUrl || process.env.BACKEND_URL || "http://backend:3000";
    this.pageSize = config.pageSize || 100;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async initializeEntities(): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 [CivicEngagementInitialization] Starting civic engagement initialization (attempt ${attempt}/${maxRetries})...`,
        );

        // Fetch civic engagements from the API
        console.log(
          "📡 [CivicEngagementInitialization] Fetching civic engagements from API...",
        );
        const civicEngagements = await this.fetchAllCivicEngagements();

        console.log(
          `📊 [CivicEngagementInitialization] Received ${civicEngagements.length} civic engagements for initialization`,
        );

        if (civicEngagements.length === 0) {
          console.warn(
            "⚠️ [CivicEngagementInitialization] No civic engagements found - this may indicate an API issue",
          );
          return;
        }

        // Process civic engagements in batches
        console.log(
          "⚙️ [CivicEngagementInitialization] Processing civic engagements...",
        );
        await this.processCivicEngagementsBatch(civicEngagements);

        this.stats.lastInitializationTime = Date.now();

        console.log(
          "✅ [CivicEngagementInitialization] Civic engagements initialization complete",
        );
        return; // Success, exit retry loop
      } catch (error) {
        console.error(
          `❌ [CivicEngagementInitialization] Error initializing civic engagements (attempt ${attempt}/${maxRetries}):`,
          error,
        );

        if (attempt === maxRetries) {
          console.error(
            "💥 [CivicEngagementInitialization] Max retries reached, giving up",
          );
          throw error;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(
          `⏳ [CivicEngagementInitialization] Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  clearAllEntities(): void {
    console.log(
      "[CivicEngagementInitialization] Clearing all civic engagements",
    );
  }

  getStats(): Record<string, unknown> {
    return {
      entityType: this.entityType,
      ...this.stats,
      backendUrl: this.backendUrl,
      pageSize: this.pageSize,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
    };
  }

  /**
   * Fetch all civic engagements from the API or database
   */
  private async fetchAllCivicEngagements(): Promise<CivicEngagement[]> {
    try {
      console.log(
        `🌐 [CivicEngagementInitialization] Fetching civic engagements from: ${this.backendUrl}`,
      );

      let currentPage = 1;
      let hasMorePages = true;
      let allCivicEngagements: CivicEngagement[] = [];

      while (hasMorePages) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            const url = `${this.backendUrl}/api/internal/civic-engagements?limit=${this.pageSize}&offset=${
              (currentPage - 1) * this.pageSize
            }`;

            console.log(
              `📡 [CivicEngagementInitialization] Fetching page ${currentPage}: ${url}`,
            );

            const response = await fetch(url, {
              headers: {
                Accept: "application/json",
              },
            });

            if (!response.ok) {
              throw new Error(
                `HTTP error! status: ${response.status} - ${response.statusText}`,
              );
            }

            const data = await response.json();

            if (!data || !Array.isArray(data.items)) {
              console.error(
                "❌ [CivicEngagementInitialization] Invalid response format:",
                data,
              );
              throw new Error("Invalid response format from backend");
            }

            const { items, hasMore } = data;

            console.log(
              `📄 [CivicEngagementInitialization] Page ${currentPage}: received ${items.length} civic engagements, hasMore: ${hasMore}`,
            );

            // Process and validate civic engagements
            const validCivicEngagements = items
              .filter(
                (civicEngagement: { location?: { coordinates?: number[] } }) =>
                  civicEngagement.location?.coordinates,
              )
              .map(this.normalizeCivicEngagementData);

            console.log(
              `✅ [CivicEngagementInitialization] Page ${currentPage}: ${validCivicEngagements.length} valid civic engagements after filtering`,
            );

            // Add to our collection, ensuring no duplicates
            const newCivicEngagements = validCivicEngagements.filter(
              (civicEngagement: CivicEngagement) =>
                !allCivicEngagements.some(
                  (existing) => existing.id === civicEngagement.id,
                ),
            );
            allCivicEngagements = [
              ...allCivicEngagements,
              ...newCivicEngagements,
            ];

            console.log(
              `📊 [CivicEngagementInitialization] Total civic engagements so far: ${allCivicEngagements.length}`,
            );

            // Update pagination state
            hasMorePages = hasMore;
            currentPage++;

            this.stats.apiCalls++;
            this.stats.civicEngagementsFetched += validCivicEngagements.length;

            break; // Success, exit retry loop
          } catch (error) {
            console.error(
              `❌ [CivicEngagementInitialization] Attempt ${attempt}/${this.maxRetries} failed for page ${currentPage}:`,
              error,
            );

            if (attempt === this.maxRetries) {
              console.error(
                "💥 [CivicEngagementInitialization] Max API retries reached for page",
                currentPage,
              );
              hasMorePages = false; // Stop pagination on persistent failure
              break;
            }

            this.stats.retries++;
            this.stats.apiErrors++;

            // Exponential backoff
            const currentRetryDelay =
              this.retryDelay * Math.pow(2, attempt - 1);
            console.log(
              `⏳ [CivicEngagementInitialization] Retrying in ${currentRetryDelay}ms...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, currentRetryDelay),
            );
          }
        }
      }

      console.log(
        `🎯 [CivicEngagementInitialization] Total civic engagements fetched: ${allCivicEngagements.length}`,
      );

      return allCivicEngagements;
    } catch (error) {
      console.error(
        "❌ [CivicEngagementInitialization] Error fetching civic engagements:",
        error,
      );
      throw error;
    }
  }

  /**
   * Process a batch of civic engagements
   */
  private async processCivicEngagementsBatch(
    civicEngagements: CivicEngagement[],
  ): Promise<void> {
    console.log(
      `⚙️ [CivicEngagementInitialization] Processing ${civicEngagements.length} civic engagements...`,
    );

    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < civicEngagements.length; i += batchSize) {
      batches.push(civicEngagements.slice(i, i + batchSize));
    }

    console.log(
      `📦 [CivicEngagementInitialization] Processing ${batches.length} batches of up to ${batchSize} civic engagements each`,
    );

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(
        `📦 [CivicEngagementInitialization] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} civic engagements)`,
      );

      const promises = batch.map(async (civicEngagement) => {
        try {
          await this.eventProcessor.processCivicEngagement({
            operation: "CREATE",
            record: civicEngagement,
          });
          this.stats.civicEngagementsProcessed++;
        } catch (error) {
          console.error(
            `❌ [CivicEngagementInitialization] Error processing civic engagement ${civicEngagement.id}:`,
            error,
          );
        }
      });

      await Promise.all(promises);

      console.log(
        `✅ [CivicEngagementInitialization] Batch ${batchIndex + 1} complete`,
      );
    }

    console.log(
      `🎯 [CivicEngagementInitialization] All batches complete. Processed ${this.stats.civicEngagementsProcessed} civic engagements`,
    );
  }

  private normalizeCivicEngagementData(civicEngagement: {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    location?: { coordinates: number[] };
    address?: string;
    locationNotes?: string;
    imageUrls?: string[];
    creatorId: string;
    creator?: { id: string; email: string; displayName?: string };
    adminNotes?: string;
    implementedAt?: string;
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
  }): CivicEngagement {
    // Normalize date fields
    const createdAt = civicEngagement.createdAt || civicEngagement.created_at;
    const updatedAt = civicEngagement.updatedAt || civicEngagement.updated_at;

    // Normalize type
    let type: CivicEngagementType;
    switch (civicEngagement.type.toUpperCase()) {
      case "POSITIVE_FEEDBACK":
        type = CivicEngagementType.POSITIVE_FEEDBACK;
        break;
      case "NEGATIVE_FEEDBACK":
        type = CivicEngagementType.NEGATIVE_FEEDBACK;
        break;
      case "IDEA":
        type = CivicEngagementType.IDEA;
        break;
      default:
        type = CivicEngagementType.IDEA; // Default fallback
    }

    // Normalize status
    let status: CivicEngagementStatus;
    switch (civicEngagement.status.toUpperCase()) {
      case "PENDING":
        status = CivicEngagementStatus.PENDING;
        break;
      case "UNDER_REVIEW":
        status = CivicEngagementStatus.UNDER_REVIEW;
        break;
      case "APPROVED":
        status = CivicEngagementStatus.APPROVED;
        break;
      case "REJECTED":
        status = CivicEngagementStatus.REJECTED;
        break;
      case "IMPLEMENTED":
        status = CivicEngagementStatus.IMPLEMENTED;
        break;
      default:
        status = CivicEngagementStatus.PENDING; // Default fallback
    }

    return {
      id: civicEngagement.id,
      title: civicEngagement.title,
      description: civicEngagement.description,
      type,
      status,
      location: civicEngagement.location
        ? {
            type: "Point",
            coordinates: civicEngagement.location.coordinates as [
              number,
              number,
            ],
          }
        : undefined,
      address: civicEngagement.address,
      locationNotes: civicEngagement.locationNotes,
      imageUrls: civicEngagement.imageUrls || [],
      creatorId: civicEngagement.creatorId,
      creator: civicEngagement.creator,
      adminNotes: civicEngagement.adminNotes,
      implementedAt: civicEngagement.implementedAt,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString(),
    };
  }
}

/**
 * Factory function to create civic engagement initialization service
 */
export function createCivicEngagementInitializationService(
  eventProcessor: LegacyEventCacheHandler,
  config: CivicEngagementInitializationServiceConfig = {},
): CivicEngagementInitializationService {
  return new CivicEngagementInitializationService(eventProcessor, config);
}
