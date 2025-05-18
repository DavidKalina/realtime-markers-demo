// stores/useLocationStore.ts
import { create } from "zustand";

interface LocationState {
  // Existing state
  selectedMarkerId: string | null;
  setSelectedMarkerId: (id: string | null) => void;

  // New user location state
  userLocation: [number, number] | null;
  setUserLocation: (location: [number, number] | null) => void;

  // Location permission state
  locationPermissionGranted: boolean;
  setLocationPermissionGranted: (granted: boolean) => void;

  // Location loading state
  isLoadingLocation: boolean;
  setIsLoadingLocation: (loading: boolean) => void;
}

export const useUserLocationStore = create<LocationState>((set) => ({
  // Existing state management
  selectedMarkerId: null,
  setSelectedMarkerId: (id) => set({ selectedMarkerId: id }),

  // New user location state management
  userLocation: null,
  setUserLocation: (location) => set({ userLocation: location }),

  // Location permission state management
  locationPermissionGranted: false,
  setLocationPermissionGranted: (granted) =>
    set({ locationPermissionGranted: granted }),

  // Location loading state management
  isLoadingLocation: true,
  setIsLoadingLocation: (loading) => set({ isLoadingLocation: loading }),
}));
