import { CivicEngagement } from "../types/types";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { RelevanceScoringService } from "./RelevanceScoringService";
import { EventPublisher } from "../handlers/EventPublisher";
import Redis from "ioredis";

export interface CivicEngagementFilteringService {
  calculateAndSendDiff(
    userId: string,
    civicEngagements: CivicEngagement[],
  ): Promise<void>;

  getStats(): Record<string, unknown>;
}

export interface CivicEngagementFilteringServiceConfig {
  maxCivicEngagements?: number;
}

export function createCivicEngagementFilteringService(
  filterMatcher: FilterMatcher,
  relevanceScoringService: RelevanceScoringService,
  eventPublisher: EventPublisher,
  redisPub: Redis,
  config: CivicEngagementFilteringServiceConfig = {},
): CivicEngagementFilteringService {
  const { maxCivicEngagements = 100 } = config;

  // Stats for monitoring
  const stats = {
    civicEngagementsFiltered: 0,
    totalCivicEngagementsProcessed: 0,
  };

  /**
   * Calculate and send diff for civic engagements
   */
  async function calculateAndSendDiff(
    userId: string,
    civicEngagements: CivicEngagement[],
  ): Promise<void> {
    try {
      // For now, just include all civic engagements without complex filtering
      // This can be enhanced later with proper civic engagement filtering
      let filteredCivicEngagements = civicEngagements;

      // Basic filtering: only include civic engagements with location
      filteredCivicEngagements = filteredCivicEngagements.filter(
        (ce) => ce.location && ce.status !== "REJECTED",
      );

      // Add basic relevance scores
      const civicEngagementsWithScores = filteredCivicEngagements.map((ce) => ({
        ...ce,
        relevanceScore: calculateBasicRelevanceScore(ce),
      }));

      // Sort by relevance score and limit
      const limitedCivicEngagements = civicEngagementsWithScores
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, maxCivicEngagements);

      // Send to user's channel using the separate civic engagements publisher
      console.log(
        `[CivicEngagementFiltering] Publishing ${limitedCivicEngagements.length} civic engagements to user ${userId}:`,
        {
          userId,
          civicEngagementCount: limitedCivicEngagements.length,
          topCivicEngagementScores: limitedCivicEngagements
            .slice(0, 3)
            .map((ce: CivicEngagement & { relevanceScore?: number }) => ({
              civicEngagementId: ce.id,
              title: ce.title,
              relevanceScore: ce.relevanceScore,
              status: ce.status,
            })),
        },
      );

      // Use the separate publishFilteredCivicEngagements method
      await eventPublisher.publishFilteredCivicEngagements(
        userId,
        "viewport",
        limitedCivicEngagements,
      );

      stats.civicEngagementsFiltered += limitedCivicEngagements.length;
      stats.totalCivicEngagementsProcessed += civicEngagements.length;
    } catch (error) {
      console.error(
        `[CivicEngagementFiltering] Error filtering and sending civic engagements for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Calculate basic relevance score for civic engagement
   */
  function calculateBasicRelevanceScore(
    civicEngagement: CivicEngagement,
  ): number {
    let score = 0.5; // Base score

    // Status-based scoring
    switch (civicEngagement.status) {
      case "IMPLEMENTED":
        score += 0.3;
        break;
      case "APPROVED":
        score += 0.2;
        break;
      case "UNDER_REVIEW":
        score += 0.1;
        break;
      case "PENDING":
        score += 0.05;
        break;
      case "REJECTED":
        score -= 0.2;
        break;
    }

    // Recency bonus (newer items get higher scores)
    const createdAt = new Date(civicEngagement.createdAt);
    const now = new Date();
    const daysOld =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld <= 1) score += 0.2;
    else if (daysOld <= 7) score += 0.1;
    else if (daysOld <= 30) score += 0.05;

    return Math.max(0, Math.min(1, score)); // Clamp to 0-1
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
    };
  }

  return {
    calculateAndSendDiff,
    getStats,
  };
}
