import { create } from "zustand";

export interface AnchorStop {
  id: string;
  coordinates: [number, number]; // [lng, lat]
  label?: string;
  address?: string;
  placeId?: string;
  primaryType?: string;
  rating?: number;
}

interface AnchorPlanState {
  isActive: boolean;
  anchors: AnchorStop[];
  city: string | null;
  /** The anchor currently pending nearby-place selection (just dropped) */
  pendingAnchorId: string | null;
  enterPlanMode: () => void;
  exitPlanMode: () => void;
  addAnchor: (coords: { lat: number; lng: number }) => string;
  /** Add a fully-resolved anchor (from search) — skips the nearby picker */
  addEnrichedAnchor: (stop: Omit<AnchorStop, "id">) => string;
  removeAnchor: (id: string) => void;
  updateAnchor: (id: string, data: Partial<AnchorStop>) => void;
  setPendingAnchor: (id: string | null) => void;
  setCity: (city: string) => void;
  clear: () => void;
}

const MAX_ANCHORS = 3;
let anchorCounter = 0;

export const useAnchorPlanStore = create<AnchorPlanState>((set, get) => ({
  isActive: false,
  anchors: [],
  city: null,
  pendingAnchorId: null,

  enterPlanMode: () => set({ isActive: true }),

  exitPlanMode: () =>
    set({ isActive: false, anchors: [], city: null, pendingAnchorId: null }),

  addAnchor: (coords) => {
    if (get().anchors.length >= MAX_ANCHORS) return "";
    const id = `anchor-${++anchorCounter}`;
    set((state) => ({
      anchors: [
        ...state.anchors,
        {
          id,
          coordinates: [coords.lng, coords.lat],
        },
      ],
      pendingAnchorId: id,
    }));
    return id;
  },

  addEnrichedAnchor: (stop) => {
    if (get().anchors.length >= MAX_ANCHORS) return "";
    const id = `anchor-${++anchorCounter}`;
    set((state) => ({
      anchors: [...state.anchors, { ...stop, id }],
      // No pendingAnchorId — skip the nearby picker
    }));
    return id;
  },

  removeAnchor: (id) =>
    set((state) => ({
      anchors: state.anchors.filter((a) => a.id !== id),
      pendingAnchorId:
        state.pendingAnchorId === id ? null : state.pendingAnchorId,
    })),

  updateAnchor: (id, data) =>
    set((state) => ({
      anchors: state.anchors.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),

  setPendingAnchor: (id) => set({ pendingAnchorId: id }),

  setCity: (city) => set({ city }),

  clear: () =>
    set({ isActive: false, anchors: [], city: null, pendingAnchorId: null }),
}));
