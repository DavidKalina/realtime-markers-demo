import * as Location from "expo-location";
import { create } from "zustand";
import type {
  SidequestResponse,
  ObjectiveResponse,
} from "@/services/api/modules/sidequests";
import { apiClient } from "@/services/ApiClient";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "@/hooks/useBackgroundLocation";
import {
  startGeofencing,
  updateGeofences,
  stopGeofencing,
  ensureGeofencesFromStore,
} from "@/hooks/useGeofencing";
import { apiClient } from "@/services/ApiClient";

export interface CompletionData {
  itinerary: SidequestResponse;
  completedAt: string;
}

export interface CheckinReplay {
  itemId: string;
  checkedInAt: string;
}

interface ActiveItineraryStore {
  /** The currently active itinerary (being walked) */
  itinerary: SidequestResponse | null;
  /** Loading state for activate/deactivate */
  isLoading: boolean;
  /** Data for the completion celebration overlay */
  completionData: CompletionData | null;
  /** Check-ins that happened while backgrounded, waiting to be animated */
  pendingCheckinReplays: CheckinReplay[];
  /** Objective IDs that were optimistically checked in but not yet confirmed */
  pendingConfirmations: Set<string>;

  /** Activate an itinerary for check-in tracking */
  activate: (itinerary: SidequestResponse) => Promise<boolean>;
  /** Deactivate the current itinerary */
  deactivate: () => Promise<void>;
  /** Mark a specific item as checked in (from push notification or manual) */
  markCheckedIn: (itemId: string, checkedInAt: string) => void;
  /** Confirm an optimistic check-in with the server; rolls back on failure */
  confirmCheckin: (itemId: string) => Promise<boolean>;
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
  localItems: ObjectiveResponse[],
  serverItems: ObjectiveResponse[],
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
  itinerary: SidequestResponse,
  replays: CheckinReplay[],
): SidequestResponse {
  if (replays.length === 0) return itinerary;
  const replayIds = new Set(replays.map((r) => r.itemId));
  return {
    ...itinerary,
    objectives: itinerary.objectives.map((item) =>
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
    pendingConfirmations: new Set(),

    activate: async (itinerary) => {
      set({ isLoading: true });
      try {
        const { success } = await apiClient.sidequests.activate(itinerary.id);
        if (success) {
          set({ itinerary, isLoading: false });
          // Start background location tracking + geofencing when user activates
          startBackgroundLocationTracking().catch(() => {});
          startGeofencing(itinerary.objectives).catch(() => {});
          // Immediate proximity check in case user is already at a venue
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          })
            .then((loc) =>
              apiClient.users.sendLocation(loc.coords.latitude, loc.coords.longitude),
            )
            .catch(() => {});
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
        await apiClient.sidequests.deactivate();
      } catch (err) {
        console.error("[ActiveItinerary] Failed to deactivate:", err);
      }
      stopGeofencing().catch(() => {});
      stopBackgroundLocationTracking().catch(() => {});
      set({ itinerary: null, isLoading: false });
    },

    markCheckedIn: (itemId, checkedInAt) => {
      const { itinerary, pendingConfirmations } = get();
      if (!itinerary) return;

      const updatedObjectives = itinerary.objectives.map((item) =>
        item.id === itemId ? { ...item, checkedInAt } : item,
      );

      const updatedItinerary = { ...itinerary, objectives: updatedObjectives };

      // Track this as pending server confirmation
      const nextPending = new Set(pendingConfirmations);
      nextPending.add(itemId);

      // Always update the itinerary first so the pin celebration animation plays
      set({ itinerary: updatedItinerary, pendingConfirmations: nextPending });

      // Update geofences: remove the checked-in objective's region
      updateGeofences(updatedObjectives).catch(() => {});

      // Don't trigger completion here — wait for confirmCheckin to verify
      // server state before declaring the quest complete.
    },

    confirmCheckin: async (itemId) => {
      const { itinerary, pendingConfirmations } = get();
      if (!itinerary) return false;

      try {
        await apiClient.sidequests.checkin(itinerary.id, itemId);

        // Confirmed — remove from pending set
        const nextPending = new Set(pendingConfirmations);
        nextPending.delete(itemId);
        set({ pendingConfirmations: nextPending });

        // Now check if all objectives are confirmed (none pending + all checked)
        const { itinerary: current, pendingConfirmations: remaining } = get();
        if (current) {
          const allChecked = current.objectives.every((item) => item.checkedInAt);
          if (allChecked && remaining.size === 0) {
            const completedItinerary = current;
            setTimeout(() => {
              set({
                completionData: {
                  itinerary: completedItinerary,
                  completedAt: new Date().toISOString(),
                },
                itinerary: null,
              });
            }, 2500);
          }
        }

        return true;
      } catch (err) {
        console.error("[ActiveItinerary] Checkin confirmation failed, rolling back:", err);

        // Roll back the optimistic update
        const { itinerary: current } = get();
        if (current) {
          const rolledBackObjectives = current.objectives.map((item) =>
            item.id === itemId ? { ...item, checkedInAt: undefined } : item,
          );
          const nextPending = new Set(get().pendingConfirmations);
          nextPending.delete(itemId);
          set({
            itinerary: { ...current, objectives: rolledBackObjectives },
            pendingConfirmations: nextPending,
          });

          // Re-register geofences so this objective is monitored again
          updateGeofences(rolledBackObjectives).catch(() => {});
        }

        return false;
      }
    },

    dismissCompletion: () => set({ completionData: null }),

    refresh: async () => {
      const { itinerary } = get();
      if (!itinerary) return;

      try {
        const fetched = await apiClient.sidequests.getById(itinerary.id);
        const replays = detectMissedCheckins(itinerary.objectives, fetched.objectives);

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
        const result = await apiClient.sidequests.getActive();
        if (result.active && result.sidequest) {
          const { itinerary: prev } = get();
          const fetched = result.sidequest;

          // Detect check-ins that happened while app was killed/backgrounded
          if (prev && prev.id === fetched.id) {
            const replays = detectMissedCheckins(prev.objectives, fetched.objectives);
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

        // Re-register geofences on app restart
        ensureGeofencesFromStore().catch(() => {});
      } catch (err) {
        console.error("[ActiveItinerary] Failed to load active:", err);
      }
    },

    consumePendingReplays: () => {
      const replays = get().pendingCheckinReplays;
      set({ pendingCheckinReplays: [] });
      return replays;
    },

    clear: () => {
      stopGeofencing().catch(() => {});
      set({
        itinerary: null,
        isLoading: false,
        completionData: null,
        pendingCheckinReplays: [],
        pendingConfirmations: new Set(),
      });
    },
  }),
);
