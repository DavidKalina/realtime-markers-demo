import { useCallback, useEffect, useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";
import { scheduleOnRN } from "react-native-worklets";
import type MapboxGL from "@rnmapbox/maps";
import { useAnchorPlanStore } from "@/stores/useAnchorPlanStore";
import { apiClient } from "@/services/ApiClient";
import {
  CameraAnimateToLocationEvent,
  EventTypes,
} from "@/services/EventBroker";
import type { NearbyPlace } from "@/services/api/modules/places";

interface UseAnchorPlanningOptions {
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  zoomLevel: number;
  activeItinerary: unknown;
  publish: <T>(type: string, event: T) => void;
}

/**
 * Anchor pin lifecycle: drop, edit, remove, nearby place selection,
 * search-based anchoring, reverse geocoding, and itinerary result handling.
 */
export function useAnchorPlanning({
  cameraRef,
  zoomLevel,
  activeItinerary,
  publish,
}: UseAnchorPlanningOptions) {
  // Store selectors
  const anchorAnchors = useAnchorPlanStore((s) => s.anchors);
  const anchorCity = useAnchorPlanStore((s) => s.city);
  const addAnchor = useAnchorPlanStore((s) => s.addAnchor);
  const updateAnchor = useAnchorPlanStore((s) => s.updateAnchor);
  const removeAnchor = useAnchorPlanStore((s) => s.removeAnchor);
  const pendingAnchorId = useAnchorPlanStore((s) => s.pendingAnchorId);
  const setPendingAnchor = useAnchorPlanStore((s) => s.setPendingAnchor);
  const exitPlanMode = useAnchorPlanStore((s) => s.exitPlanMode);
  const addEnrichedAnchor = useAnchorPlanStore((s) => s.addEnrichedAnchor);

  // Pending anchor's coordinates (for the nearby picker inside ItineraryDialogBox)
  const pendingAnchor = useMemo(
    () => anchorAnchors.find((a) => a.id === pendingAnchorId) ?? null,
    [anchorAnchors, pendingAnchorId],
  );
  const nearbyPlacesInput = useMemo(
    () =>
      pendingAnchor
        ? {
            lat: pendingAnchor.coordinates[1],
            lng: pendingAnchor.coordinates[0],
            zoom: zoomLevel,
            selectedPlaceId: pendingAnchor.placeId,
          }
        : null,
    [pendingAnchor, zoomLevel],
  );

  // Reverse geocode city from first anchor
  useEffect(() => {
    if (anchorAnchors.length !== 1) return;
    const [lng, lat] = anchorAnchors[0].coordinates;
    apiClient.places
      .searchCityState({ query: "", coordinates: { lat, lng } })
      .then((res) => {
        if (res.success && res.cityState) {
          useAnchorPlanStore
            .getState()
            .setCity(`${res.cityState.city}, ${res.cityState.state}`);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorAnchors.length === 1 ? anchorAnchors[0]?.id : null]);

  // Anchor-mode add handler (called from worklet via scheduleOnRN)
  const handleAddAnchor = useCallback(
    (coords: { lat: number; lng: number }) => {
      const id = addAnchor(coords);
      if (id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        publish<CameraAnimateToLocationEvent>(
          EventTypes.CAMERA_ANIMATE_TO_LOCATION,
          {
            timestamp: Date.now(),
            source: "AnchorDrop",
            coordinates: [coords.lng, coords.lat],
            duration: 800,
            animationMode: "easeTo",
          },
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [addAnchor, publish],
  );

  // Track active itinerary in a ref so the worklet long-press handler can read it
  const hasActiveItineraryRef = useRef(!!activeItinerary);
  hasActiveItineraryRef.current = !!activeItinerary;

  // Long press handler — drops anchor pin (pin has its own ripple)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapLongPress = useCallback((event: any) => {
    "worklet";
    if (event?.geometry?.coordinates) {
      const [lng, lat] = event.geometry.coordinates;
      if (typeof lat === "number" && typeof lng === "number") {
        scheduleOnRN(
          (coords: { lat: number; lng: number }) => {
            if (hasActiveItineraryRef.current) return;
            handleAddAnchor(coords);
          },
          { lat, lng },
        );
      }
    }
  }, []);

  // Nearby places sheet callbacks
  const handleNearbySelect = useCallback(
    (place: NearbyPlace) => {
      if (!pendingAnchorId) return;
      updateAnchor(pendingAnchorId, {
        coordinates: place.coordinates,
        label: place.name,
        address: place.address,
        placeId: place.placeId,
        primaryType: place.primaryType,
        rating: place.rating,
      });
      setPendingAnchor(null);
      publish<CameraAnimateToLocationEvent>(
        EventTypes.CAMERA_ANIMATE_TO_LOCATION,
        {
          timestamp: Date.now(),
          source: "NearbySelect",
          coordinates: place.coordinates,
          duration: 800,
          animationMode: "easeTo",
        },
      );
    },
    [pendingAnchorId, updateAnchor, setPendingAnchor, publish],
  );

  const handleNearbyKeepPin = useCallback(() => {
    setPendingAnchor(null);
  }, [setPendingAnchor]);

  const handleNearbyDismiss = useCallback(() => {
    if (pendingAnchorId) {
      removeAnchor(pendingAnchorId);
    }
    setPendingAnchor(null);
  }, [pendingAnchorId, removeAnchor, setPendingAnchor]);

  const handleAnchorEdit = useCallback(
    (anchorId: string) => {
      setPendingAnchor(anchorId);
    },
    [setPendingAnchor],
  );

  const handleAnchorRemove = useCallback(
    (anchorId: string) => {
      removeAnchor(anchorId);
    },
    [removeAnchor],
  );

  // Handle itinerary result — fit camera to stops
  const handleItineraryResult = useCallback(
    (items: { latitude?: number; longitude?: number }[]) => {
      const coords: [number, number][] = items
        .filter(
          (i): i is { latitude: number; longitude: number } =>
            i.latitude != null && i.longitude != null,
        )
        .map((i) => [i.longitude, i.latitude]);
      if (coords.length >= 2) {
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        cameraRef.current?.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          60,
          1500,
        );
      }
      exitPlanMode();
    },
    [exitPlanMode, cameraRef],
  );

  const handleAnchorDismiss = useCallback(() => {
    exitPlanMode();
  }, [exitPlanMode]);

  // Search → fly camera to coordinates
  const handleSearchFlyTo = useCallback(
    (coords: [number, number]) => {
      cameraRef.current?.setCamera({
        centerCoordinate: coords,
        zoomLevel: 16,
        animationDuration: 1500,
        animationMode: "flyTo",
      });
    },
    [cameraRef],
  );

  // Search → drop anchor at searched place (enriched — skips nearby picker)
  const handleSearchPlaceAnchor = useCallback(
    (place: {
      coordinates: [number, number];
      name: string;
      address: string;
      placeId: string;
      primaryType?: string;
      rating?: number;
    }) => {
      const id = addEnrichedAnchor({
        coordinates: place.coordinates,
        label: place.name,
        address: place.address,
        placeId: place.placeId,
        primaryType: place.primaryType,
        rating: place.rating,
      });
      if (id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [addEnrichedAnchor],
  );

  return {
    anchorAnchors,
    anchorCity,
    nearbyPlacesInput,
    handleMapLongPress,
    handleNearbySelect,
    handleNearbyKeepPin,
    handleNearbyDismiss,
    handleAnchorEdit,
    handleAnchorRemove,
    handleItineraryResult,
    handleAnchorDismiss,
    handleSearchFlyTo,
    handleSearchPlaceAnchor,
  };
}
