import {
  useDistrictMapStore,
  streamedToBrowsePreview,
  type StreamedItinerary,
} from "@/stores/useDistrictMapStore";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";

const BATCH_WINDOW_MS = 60;

/**
 * Accumulates rapid individual itinerary WS messages (add, update, delete,
 * replace-all) over a 60ms window, then flushes them as a single atomic
 * Zustand store update.  This prevents N re-renders when the WS server
 * fans out a single server-side diff into many individual messages.
 */
export class ItineraryMessageBatcher {
  private pendingAdds: StreamedItinerary[] = [];
  private pendingUpdates: StreamedItinerary[] = [];
  private pendingDeletes: string[] = [];
  private pendingReplaceAll: StreamedItinerary[] | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  enqueueReplaceAll(itineraries: StreamedItinerary[]): void {
    this.pendingReplaceAll = itineraries;
    this.scheduleFlush();
  }

  enqueueAdd(itinerary: StreamedItinerary): void {
    this.pendingAdds.push(itinerary);
    this.scheduleFlush();
  }

  enqueueUpdate(itinerary: StreamedItinerary): void {
    this.pendingUpdates.push(itinerary);
    this.scheduleFlush();
  }

  enqueueDelete(id: string): void {
    this.pendingDeletes.push(id);
    this.scheduleFlush();
  }

  destroy(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.clear();
  }

  // ------------------------------------------------------------------
  // Private
  // ------------------------------------------------------------------

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => this.flush(), BATCH_WINDOW_MS);
  }

  private flush(): void {
    this.flushTimer = null;

    const replaceAll = this.pendingReplaceAll;
    const adds = this.pendingAdds;
    const updates = this.pendingUpdates;
    const deletes = this.pendingDeletes;
    this.clear();

    // 1. Determine base array
    let base: BrowseItineraryPreview[];
    if (replaceAll !== null) {
      base = replaceAll
        .filter(
          (it) => it.entryLatitude != null && it.entryLongitude != null,
        )
        .map(streamedToBrowsePreview);
    } else {
      base = useDistrictMapStore.getState().streamedItineraries;
    }

    // 2. Apply deletes
    if (deletes.length > 0) {
      const deleteSet = new Set(deletes);
      base = base.filter((it) => !deleteSet.has(it.id));
    }

    // 3. Apply updates
    if (updates.length > 0) {
      const updateMap = new Map(
        updates
          .filter(
            (it) => it.entryLatitude != null && it.entryLongitude != null,
          )
          .map((it) => [it.id, streamedToBrowsePreview(it)]),
      );
      base = base.map((it) => updateMap.get(it.id) ?? it);
    }

    // 4. Apply adds (append if not already present)
    if (adds.length > 0) {
      const existingIds = new Set(base.map((it) => it.id));
      const newItems = adds
        .filter(
          (it) =>
            it.entryLatitude != null &&
            it.entryLongitude != null &&
            !existingIds.has(it.id),
        )
        .map(streamedToBrowsePreview);
      if (newItems.length > 0) {
        base = [...base, ...newItems];
      }
    }

    // 5. Smart diff — preserve references for unchanged items
    const prev = useDistrictMapStore.getState().streamedItineraries;
    const prevMap = new Map(prev.map((it) => [it.id, it]));
    const result = base.map((incoming) => {
      const existing = prevMap.get(incoming.id);
      if (
        existing &&
        existing.entryLatitude === incoming.entryLatitude &&
        existing.entryLongitude === incoming.entryLongitude &&
        existing.timesAdopted === incoming.timesAdopted &&
        existing.rating === incoming.rating
      ) {
        return existing;
      }
      return incoming;
    });

    // 6. Skip no-op updates
    if (
      result.length === prev.length &&
      result.every((it, i) => it === prev[i])
    ) {
      if (__DEV__) {
        console.log("[ItineraryBatcher] Flush skipped — no changes");
      }
      return;
    }

    if (__DEV__) {
      console.log(
        `[ItineraryBatcher] Flushed: ${result.length} itineraries (adds=${adds.length}, updates=${updates.length}, deletes=${deletes.length}, replaceAll=${replaceAll !== null})`,
      );
    }

    useDistrictMapStore.getState().setStreamedItineraries(result);
  }

  private clear(): void {
    this.pendingAdds = [];
    this.pendingUpdates = [];
    this.pendingDeletes = [];
    this.pendingReplaceAll = null;
  }
}
