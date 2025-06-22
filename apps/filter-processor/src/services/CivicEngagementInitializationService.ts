import {
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
  Point,
} from "../types/types";
import { EventProcessor } from "../handlers/EventProcessor";

export interface CivicEngagementInitializationService {
  initializeCivicEngagements(): Promise<void>;
  clearAllCivicEngagements(): void;
  getStats(): Record<string, unknown>;
}

export interface CivicEngagementInitializationServiceConfig {
  backendUrl?: string;
  pageSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export function createCivicEngagementInitializationService(
  eventProcessor: EventProcessor,
  config: CivicEngagementInitializationServiceConfig = {},
): CivicEngagementInitializationService {
  const {
    backendUrl = process.env.BACKEND_URL || "http://backend:3000",
    pageSize = 100,
    maxRetries = 3,
    retryDelay = 1000,
  } = config;

  // Stats for monitoring
  const stats = {
    civicEngagementsFetched: 0,
    civicEngagementsProcessed: 0,
    apiCalls: 0,
    apiErrors: 0,
    retries: 0,
    lastInitializationTime: 0,
  };

  /**
   * Initialize civic engagements by fetching from API and processing them
   */
  async function initializeCivicEngagements(): Promise<void> {
    try {
      console.log(
        "🔄 [CivicEngagementInitialization] Starting civic engagement initialization...",
      );

      // Fetch civic engagements from the API
      console.log(
        "📡 [CivicEngagementInitialization] Fetching civic engagements from API...",
      );
      const civicEngagements = await fetchAllCivicEngagements();

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
      await processCivicEngagementsBatch(civicEngagements);

      stats.lastInitializationTime = Date.now();

      console.log(
        "✅ [CivicEngagementInitialization] Civic engagements initialization complete",
      );
    } catch (error) {
      console.error(
        "❌ [CivicEngagementInitialization] Error initializing civic engagements:",
        error,
      );
      throw error;
    }
  }

  /**
   * Clear all civic engagements (for cleanup operations)
   */
  function clearAllCivicEngagements(): void {
    console.log(
      "[CivicEngagementInitialization] Clearing all civic engagements",
    );
  }

  /**
   * Fetch all civic engagements from the API or database
   */
  async function fetchAllCivicEngagements(): Promise<CivicEngagement[]> {
    try {
      console.log(
        `🌐 [CivicEngagementInitialization] Fetching civic engagements from: ${backendUrl}`,
      );

      let currentPage = 1;
      let hasMorePages = true;
      let allCivicEngagements: CivicEngagement[] = [];

      while (hasMorePages) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const url = `${backendUrl}/api/internal/civic-engagements?limit=${pageSize}&offset=${
              (currentPage - 1) * pageSize
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
              .map(normalizeCivicEngagementData);

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

            stats.apiCalls++;
            stats.civicEngagementsFetched += validCivicEngagements.length;

            break; // Success, exit retry loop
          } catch (error) {
            console.error(
              `❌ [CivicEngagementInitialization] Attempt ${attempt}/${maxRetries} failed for page ${currentPage}:`,
              error,
            );

            if (attempt === maxRetries) {
              console.error(
                "💥 [CivicEngagementInitialization] Max API retries reached for page",
                currentPage,
              );
              hasMorePages = false; // Stop pagination on persistent failure
              break;
            }

            stats.retries++;
            stats.apiErrors++;

            // Exponential backoff
            const currentRetryDelay = retryDelay * Math.pow(2, attempt - 1);
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
        `🎯 [CivicEngagementInitialization] Fetch complete: ${allCivicEngagements.length} total civic engagements`,
      );
      return allCivicEngagements;
    } catch (error) {
      console.error(
        "💥 [CivicEngagementInitialization] Error fetching civic engagements:",
        error,
      );
      return [];
    }
  }

  /**
   * Process a batch of civic engagements
   */
  async function processCivicEngagementsBatch(
    civicEngagements: CivicEngagement[],
  ): Promise<void> {
    try {
      console.log(
        `⚙️ [CivicEngagementInitialization] Processing ${civicEngagements.length} civic engagements...`,
      );

      // Remove duplicates based on civic engagement ID
      const uniqueCivicEngagements = Array.from(
        new Map(
          civicEngagements.map((civicEngagement) => [
            civicEngagement.id,
            civicEngagement,
          ]),
        ).values(),
      );

      console.log(
        `🔄 [CivicEngagementInitialization] Processing ${uniqueCivicEngagements.length} unique civic engagements...`,
      );

      // Process each civic engagement
      for (const civicEngagement of uniqueCivicEngagements) {
        try {
          await eventProcessor.processCivicEngagement({
            operation: "CREATE",
            record: civicEngagement,
          });
          stats.civicEngagementsProcessed++;

          if (stats.civicEngagementsProcessed % 50 === 0) {
            console.log(
              `📈 [CivicEngagementInitialization] Processed ${stats.civicEngagementsProcessed} civic engagements so far...`,
            );
          }
        } catch (error) {
          console.error(
            `❌ [CivicEngagementInitialization] Error processing civic engagement ${civicEngagement.id}:`,
            error,
          );
        }
      }

      console.log(
        `✅ [CivicEngagementInitialization] Successfully processed ${stats.civicEngagementsProcessed} civic engagements`,
      );
    } catch (error) {
      console.error(
        "💥 [CivicEngagementInitialization] Error processing civic engagements batch:",
        error,
      );
    }
  }

  /**
   * Normalize civic engagement data from API response
   */
  function normalizeCivicEngagementData(civicEngagement: {
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
    return {
      id: civicEngagement.id,
      title: civicEngagement.title,
      description: civicEngagement.description,
      type: civicEngagement.type as CivicEngagementType,
      status: civicEngagement.status as CivicEngagementStatus,
      location: civicEngagement.location as Point,
      address: civicEngagement.address,
      locationNotes: civicEngagement.locationNotes,
      imageUrls: civicEngagement.imageUrls,
      creatorId: civicEngagement.creatorId,
      creator: civicEngagement.creator,
      adminNotes: civicEngagement.adminNotes,
      implementedAt: civicEngagement.implementedAt,
      createdAt:
        civicEngagement.created_at ||
        civicEngagement.createdAt ||
        new Date().toISOString(),
      updatedAt:
        civicEngagement.updated_at ||
        civicEngagement.updatedAt ||
        new Date().toISOString(),
    };
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      civicEngagementsFetched: stats.civicEngagementsFetched,
      civicEngagementsProcessed: stats.civicEngagementsProcessed,
      apiCalls: stats.apiCalls,
      apiErrors: stats.apiErrors,
      retries: stats.retries,
      lastInitializationTime: stats.lastInitializationTime,
    };
  }

  return {
    initializeCivicEngagements,
    clearAllCivicEngagements,
    getStats,
  };
}
