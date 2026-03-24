import { CommunityItinerary, BoundingBox, Filter } from "../types/types";
import { ItineraryPublisher } from "../handlers/ItineraryPublisher";

export interface ItineraryFilteringService {
  calculateAndSendDiff(
    userId: string,
    itineraries: CommunityItinerary[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void>;

  clearUserState(userId: string): void;

  getStats(): Record<string, unknown>;
}

export interface ItineraryFilteringServiceConfig {
  maxItineraries?: number;
}

function computeContentHash(itinerary: CommunityItinerary): string {
  return `${itinerary.id}:${itinerary.rating ?? 0}:${itinerary.timesAdopted}`;
}

export function createItineraryFilteringService(
  itineraryPublisher: ItineraryPublisher,
  config: ItineraryFilteringServiceConfig = {},
): ItineraryFilteringService {
  const { maxItineraries = 100 } = config;

  // Per-user last-sent state: userId -> Map<itineraryId, contentHash>
  const userLastSentState = new Map<string, Map<string, string>>();

  const stats = {
    totalItinerariesFiltered: 0,
    messagesSent: 0,
    diffsSent: 0,
    fullSendsFallback: 0,
    noopSkipped: 0,
  };

  async function calculateAndSendDiff(
    userId: string,
    itineraries: CommunityItinerary[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void> {
    try {
      // Filter itineraries
      let filtered = filterItineraries(itineraries, filters);

      // Sort by popularity (timesAdopted descending)
      filtered.sort((a, b) => b.timesAdopted - a.timesAdopted);

      // Cap
      if (filtered.length > maxItineraries) {
        filtered = filtered.slice(0, maxItineraries);
      }

      // Build new state map
      const newState = new Map<string, string>();
      const itineraryById = new Map<string, CommunityItinerary>();
      for (const it of filtered) {
        newState.set(it.id, computeContentHash(it));
        itineraryById.set(it.id, it);
      }

      const previousState = userLastSentState.get(userId);

      // First connection: send full list
      if (!previousState) {
        console.log(
          `[ItineraryFiltering] First send for user ${userId}, publishing ${filtered.length} itineraries`,
        );

        await itineraryPublisher.publishFilteredItineraries(
          userId,
          viewport ? "viewport" : "all",
          filtered,
        );

        userLastSentState.set(userId, newState);
        stats.fullSendsFallback++;
        stats.totalItinerariesFiltered += filtered.length;
        stats.messagesSent++;
        return;
      }

      // Compute diff
      const creates: CommunityItinerary[] = [];
      const updates: CommunityItinerary[] = [];
      const deletes: string[] = [];

      for (const [id, hash] of newState) {
        const prevHash = previousState.get(id);
        if (!prevHash) {
          creates.push(itineraryById.get(id)!);
        } else if (prevHash !== hash) {
          updates.push(itineraryById.get(id)!);
        }
      }

      for (const id of previousState.keys()) {
        if (!newState.has(id)) {
          deletes.push(id);
        }
      }

      // Noop
      if (
        creates.length === 0 &&
        updates.length === 0 &&
        deletes.length === 0
      ) {
        stats.noopSkipped++;
        return;
      }

      const totalChanges = creates.length + updates.length + deletes.length;
      const totalItems = Math.max(previousState.size, newState.size, 1);

      // Large diff: fall back to full send
      if (totalChanges > totalItems * 0.5) {
        await itineraryPublisher.publishFilteredItineraries(
          userId,
          viewport ? "viewport" : "all",
          filtered,
        );

        userLastSentState.set(userId, newState);
        stats.fullSendsFallback++;
        stats.totalItinerariesFiltered += filtered.length;
        stats.messagesSent++;
        return;
      }

      // Publish individual diffs
      const publishPromises: Promise<void>[] = [];

      for (const it of creates) {
        publishPromises.push(
          itineraryPublisher.publishAddItinerary(userId, it),
        );
      }
      for (const it of updates) {
        publishPromises.push(
          itineraryPublisher.publishUpdateItinerary(userId, it),
        );
      }
      for (const id of deletes) {
        publishPromises.push(
          itineraryPublisher.publishDeleteItinerary(userId, id),
        );
      }

      await Promise.all(publishPromises);

      userLastSentState.set(userId, newState);
      stats.diffsSent++;
      stats.totalItinerariesFiltered += filtered.length;
      stats.messagesSent++;
    } catch (error) {
      console.error(
        `[ItineraryFiltering] Error in calculateAndSendDiff for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Filter itineraries by user's active category filters.
   * Itineraries have no MapMoji scoring — just category matching.
   */
  function filterItineraries(
    itineraries: CommunityItinerary[],
    filters: Filter[],
  ): CommunityItinerary[] {
    if (filters.length === 0) return itineraries;

    // Collect all active category includes from user's filters
    const includeCategories = new Set<string>();
    for (const filter of filters) {
      if (!filter.isActive) continue;
      for (const catId of filter.criteria.includeCategoryIds ?? []) {
        includeCategories.add(catId);
      }
    }

    // If no category filters active, return all
    if (includeCategories.size === 0) return itineraries;

    return itineraries.filter((it) =>
      it.categories.some((cat) => includeCategories.has(cat)),
    );
  }

  function clearUserState(userId: string): void {
    userLastSentState.delete(userId);
  }

  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      trackedUsers: userLastSentState.size,
    };
  }

  return {
    calculateAndSendDiff,
    clearUserState,
    getStats,
  };
}
