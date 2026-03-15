import { useCallback } from "react";
import { useLocationStore } from "@/stores/useLocationStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { BaseEvent, EventTypes, MapItemEvent } from "@/services/EventBroker";

interface UseMapInteractionsOptions {
  selectedItineraryIndex: number | null;
  handleCarouselDismiss: () => void;
}

/**
 * Map surface interaction handlers: press, pan, and item deselection.
 */
export function useMapInteractions({
  selectedItineraryIndex,
  handleCarouselDismiss,
}: UseMapInteractionsOptions) {
  const { publish } = useEventBroker();
  const selectMapItem = useLocationStore((s) => s.selectMapItem);
  const selectedItem = useLocationStore((s) => s.selectedItem);

  // Create map item event utility
  const createMapItemEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any): MapItemEvent["item"] => {
      return item.type === "marker"
        ? {
            id: item.id,
            type: "marker",
            coordinates: item.coordinates,
            markerData: item.data,
          }
        : {
            id: item.id,
            type: "cluster",
            coordinates: item.coordinates,
            count: item.count,
            childMarkers: item.childrenIds,
          };
    },
    [],
  );

  // Handle user pan — only publish the panning event.
  const handleUserPan = useCallback(() => {
    publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
      timestamp: Date.now(),
      source: "MapPress",
    });
  }, [publish]);

  // Handle map press
  const handleMapPress = useCallback(() => {
    // Dismiss itinerary carousel if open
    if (selectedItineraryIndex != null) {
      handleCarouselDismiss();
    }

    if (!selectedItem) return;

    try {
      const item = createMapItemEvent(selectedItem);
      publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
        timestamp: Date.now(),
        source: "MapPress",
        item,
      });
      selectMapItem(null);
    } catch (error) {
      console.error("Error handling map press:", error);
      selectMapItem(null);
    }
  }, [
    selectMapItem,
    selectedItem,
    selectedItineraryIndex,
    createMapItemEvent,
    publish,
    handleCarouselDismiss,
  ]);

  return { handleMapPress, handleUserPan };
}
