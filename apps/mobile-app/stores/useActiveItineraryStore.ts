import { create } from "zustand";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { apiClient } from "@/services/ApiClient";

interface ActiveItineraryStore {
  /** The currently active itinerary (being walked) */
  itinerary: ItineraryResponse | null;
  /** Loading state for activate/deactivate */
  isLoading: boolean;

  /** Activate an itinerary for check-in tracking */
  activate: (itinerary: ItineraryResponse) => Promise<boolean>;
  /** Deactivate the current itinerary */
  deactivate: () => Promise<void>;
  /** Mark a specific item as checked in (from push notification or manual) */
  markCheckedIn: (itemId: string, checkedInAt: string) => void;
  /** Refresh the active itinerary from server */
  refresh: () => Promise<void>;
  /** Load active itinerary on app start */
  loadActive: () => Promise<void>;
  /** Clear state (e.g., on logout) */
  clear: () => void;
}

export const useActiveItineraryStore = create<ActiveItineraryStore>(
  (set, get) => ({
    itinerary: null,
    isLoading: false,

    activate: async (itinerary) => {
      set({ isLoading: true });
      try {
        const { success } = await apiClient.itineraries.activate(itinerary.id);
        if (success) {
          set({ itinerary, isLoading: false });
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

      // Check if all items are now checked in
      const allChecked = updatedItems.every((item) => item.checkedInAt);

      set({
        itinerary: { ...itinerary, items: updatedItems },
        // Auto-clear if fully complete (server already deactivated)
        ...(allChecked ? {} : {}),
      });

      if (allChecked) {
        // Delay clear so completion UI can show
        setTimeout(() => {
          set({ itinerary: null });
        }, 5000);
      }
    },

    refresh: async () => {
      const { itinerary } = get();
      if (!itinerary) return;

      try {
        const updated = await apiClient.itineraries.getById(itinerary.id);
        set({ itinerary: updated });
      } catch (err) {
        console.error("[ActiveItinerary] Failed to refresh:", err);
      }
    },

    loadActive: async () => {
      try {
        const result = await apiClient.itineraries.getActive();
        if (result.active && result.itinerary) {
          set({ itinerary: result.itinerary });
        }
      } catch (err) {
        console.error("[ActiveItinerary] Failed to load active:", err);
      }
    },

    clear: () => set({ itinerary: null, isLoading: false }),
  }),
);
