import { create } from "zustand";
import type {
  ItineraryResponse,
  ItineraryItemResponse,
} from "@/services/api/modules/itineraries";
import { apiClient } from "@/services/ApiClient";
import { startBackgroundLocationTracking } from "@/hooks/useBackgroundLocation";

export interface CompletionData {
  itinerary: ItineraryResponse;
  completedAt: string;
}

export interface CheckinReplay {
  itemId: string;
  checkedInAt: string;
}

interface ActiveItineraryStore {
  /** The currently active itinerary (being walked) */
  itinerary: ItineraryResponse | null;
  /** Loading state for activate/deactivate */
  isLoading: boolean;
  /** Data for the completion celebration overlay */
  completionData: CompletionData | null;
  /** Check-ins that happened while backgrounded, waiting to be animated */
  pendingCheckinReplays: CheckinReplay[];

  /** Activate an itinerary for check-in tracking */
  activate: (itinerary: ItineraryResponse) => Promise<boolean>;
  /** Deactivate the current itinerary */
  deactivate: () => Promise<void>;
  /** Mark a specific item as checked in (from push notification or manual) */
  markCheckedIn: (itemId: string, checkedInAt: string) => void;
  /** Dismiss the completion celebration */
  dismissCompletion: () => void;
  /** Refresh the active itinerary from server (detects missed check-ins) */
  refresh: () => Promise<void>;
  /** Load active itinerary on app start */
  loadActive: () => Promise<void>;
  /** Consume pending replays atomically (returns and clears them) */
  consumePendingReplays: () => CheckinReplay[];
  /** Clear state (e.g., on logout) */
  clear: () => void;
}

/**
 * Compare local items against server items for the same itinerary.
 * Returns items whose `checkedInAt` went from falsy → truthy (i.e., checked
 * in on the server while the app was backgrounded).
 */
function detectMissedCheckins(
  localItems: ItineraryItemResponse[],
  serverItems: ItineraryItemResponse[],
): CheckinReplay[] {
  const replays: CheckinReplay[] = [];
  for (const serverItem of serverItems) {
    if (!serverItem.checkedInAt) continue;
    const localItem = localItems.find((i) => i.id === serverItem.id);
    if (localItem && !localItem.checkedInAt) {
      replays.push({
        itemId: serverItem.id,
        checkedInAt: serverItem.checkedInAt,
      });
    }
  }
  return replays;
}

/**
 * Given a server itinerary and missed check-ins, return a copy with
 * those items' `checkedInAt` cleared so the pin animation can fire
 * when `markCheckedIn` is called during replay.
 */
function nullCheckins(
  itinerary: ItineraryResponse,
  replays: CheckinReplay[],
): ItineraryResponse {
  if (replays.length === 0) return itinerary;
  const replayIds = new Set(replays.map((r) => r.itemId));
  return {
    ...itinerary,
    items: itinerary.items.map((item) =>
      replayIds.has(item.id)
        ? { ...item, checkedInAt: undefined }
        : item,
    ),
  };
}

export const useActiveItineraryStore = create<ActiveItineraryStore>(
  (set, get) => ({
    itinerary: null,
    isLoading: false,
    completionData: null,
    pendingCheckinReplays: [],

    activate: async (itinerary) => {
      set({ isLoading: true });
      try {
        const { success } = await apiClient.itineraries.activate(itinerary.id);
        if (success) {
          set({ itinerary, isLoading: false });
          // Start background location tracking when user activates an itinerary
          // (contextual moment — they're about to go out)
          startBackgroundLocationTracking().catch(() => {});
          return true;
        }
        set({ isLoading: false });
        return false;
      } catch (err) {
        console.error("[ActiveItinerary] Failed to activate:", err);
        set({ isLoading: false });
        return false;
      }
    },

    deactivate: async () => {
      set({ isLoading: true });
      try {
        await apiClient.itineraries.deactivate();
      } catch (err) {
        console.error("[ActiveItinerary] Failed to deactivate:", err);
      }
      set({ itinerary: null, isLoading: false });
    },

    markCheckedIn: (itemId, checkedInAt) => {
      const { itinerary } = get();
      if (!itinerary) return;

      const updatedItems = itinerary.items.map((item) =>
        item.id === itemId ? { ...item, checkedInAt } : item,
      );

      const allChecked = updatedItems.every((item) => item.checkedInAt);
      const updatedItinerary = { ...itinerary, items: updatedItems };

      // Always update the itinerary first so the pin celebration animation plays
      set({ itinerary: updatedItinerary });

      if (allChecked) {
        // Delay clearing the itinerary so the last pin's check-in animation
        // has time to play before waypoints unmount
        setTimeout(() => {
          set({
            completionData: {
              itinerary: updatedItinerary,
              completedAt: new Date().toISOString(),
            },
            itinerary: null,
          });
        }, 2500);
      }
    },

    dismissCompletion: () => set({ completionData: null }),

    refresh: async () => {
      const { itinerary } = get();
      if (!itinerary) return;

      try {
        const fetched = await apiClient.itineraries.getById(itinerary.id);
        const replays = detectMissedCheckins(itinerary.items, fetched.items);

        if (replays.length > 0) {
          // Null the new check-ins so the animation can play during replay
          set({
            itinerary: nullCheckins(fetched, replays),
            pendingCheckinReplays: replays,
          });
        } else {
          set({ itinerary: fetched });
        }
      } catch (err) {
        console.error("[ActiveItinerary] Failed to refresh:", err);
      }
    },

    loadActive: async () => {
      try {
        const result = await apiClient.itineraries.getActive();
        if (result.active && result.itinerary) {
          const { itinerary: prev } = get();
          const fetched = result.itinerary;

          // Detect check-ins that happened while app was killed/backgrounded
          if (prev && prev.id === fetched.id) {
            const replays = detectMissedCheckins(prev.items, fetched.items);
            if (replays.length > 0) {
              set({
                itinerary: nullCheckins(fetched, replays),
                pendingCheckinReplays: replays,
              });
              return;
            }
          }

          set({ itinerary: fetched });
        }
      } catch (err) {
        console.error("[ActiveItinerary] Failed to load active:", err);
      }
    },

    consumePendingReplays: () => {
      const replays = get().pendingCheckinReplays;
      set({ pendingCheckinReplays: [] });
      return replays;
    },

    clear: () =>
      set({
        itinerary: null,
        isLoading: false,
        completionData: null,
        pendingCheckinReplays: [],
      }),
  }),
);
