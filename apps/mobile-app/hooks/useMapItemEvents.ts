// hooks/useMapItemEvents.ts
import { useCallback, useEffect, useRef } from "react";
import { useEventBroker } from "./useEventBroker";
import {
  EventTypes,
  MapItemEvent,
  MarkerItem,
  ClusterItem,
  BaseEvent,
} from "@/services/EventBroker";
import { Marker } from "@/hooks/useMapWebsocket";
import {
  generateMessageSequence,
  generateClusterMessages,
  generateGoodbyeMessage,
} from "@/utils/messageUtils";

// Define the map item types for internal use
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

interface AppMarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

interface AppClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

type MapItem = AppMarkerItem | AppClusterItem;

interface UseMapItemEventsOptions {
  // User's location for distance calculations
  userLocation?: [number, number] | null;

  // Callback when a map item is selected
  onItemSelect?: (item: MapItem, messages: string[], itemId: string) => void;

  // Callback when a map item is deselected
  onItemDeselect?: (itemName: string) => void;

  // Callback when user is panning the viewport
  onUserPanning?: () => void;

  // Track mounted state to prevent updates on unmounted components
  isMountedRef?: React.RefObject<boolean>;
}

/**
 * Hook for handling MAP_ITEM_SELECTED and MAP_ITEM_DESELECTED events
 * Generates appropriate messages and calls the provided callbacks
 */
export const useMapItemEvents = ({
  userLocation,
  onItemSelect,
  onItemDeselect,
  onUserPanning,
  isMountedRef,
}: UseMapItemEventsOptions) => {
  const { subscribe } = useEventBroker();

  // Store the previous selected item for comparison
  const previousItemRef = useRef<MapItem | null>(null);

  // Check if the component is mounted (if no ref provided, assume always mounted)
  const isMounted = useCallback(() => {
    if (isMountedRef) {
      return isMountedRef.current;
    }
    return true;
  }, [isMountedRef]);

  // Handle map item selection
  const handleMapItemSelected = useCallback(
    (event: MapItemEvent) => {
      if (!isMounted() || !onItemSelect) return;

      const item = event.item;
      const itemId = item.id;

      // Convert from EventBroker types to our internal types
      const mapItem: MapItem =
        item.type === "marker"
          ? {
              id: item.id,
              type: "marker",
              coordinates: item.coordinates,
              data: (item as MarkerItem).markerData,
            }
          : {
              id: item.id,
              type: "cluster",
              coordinates: item.coordinates,
              count: (item as ClusterItem).count,
              childrenIds: (item as ClusterItem).childMarkers,
            };

      // Store as previous item for reference
      previousItemRef.current = mapItem;

      // Generate appropriate messages based on item type
      let messages: string[] = [];
      if (item.type === "marker") {
        // Create a marker object compatible with the message utils
        const markerData = {
          id: item.id,
          coordinates: item.coordinates,
          data: (item as MarkerItem).markerData,
        };

        messages = generateMessageSequence(markerData, userLocation ?? [0, 0]);
      } else {
        // Generate cluster messages
        messages = generateClusterMessages(
          (item as ClusterItem).count,
          userLocation ?? [0, 0],
        );
      }

      // Call the selection callback with the item, messages, and ID
      onItemSelect(mapItem, messages, itemId);
    },
    [userLocation, onItemSelect, isMounted],
  );

  // Handle map item deselection
  const handleMapItemDeselected = useCallback(
    (event: MapItemEvent) => {
      if (!isMounted() || !onItemDeselect) return;

      // Clear stored previous item
      previousItemRef.current = null;

      // Get item name for the goodbye message
      let itemName = "";
      if (event.item.type === "marker") {
        itemName =
          (event.item as MarkerItem).markerData?.title || "this location";
      } else {
        itemName = "this group of events";
      }

      // Call the deselection callback with the item name
      onItemDeselect(itemName);
    },
    [onItemDeselect, isMounted],
  );

  // Handle user panning the viewport
  const handleUserPanning = useCallback(() => {
    if (!isMounted() || !onUserPanning) return;

    // Call the user panning callback
    onUserPanning();
  }, [onUserPanning, isMounted]);

  // Subscribe to MAP_ITEM events
  useEffect(() => {
    // Subscribe to selection event
    const selectUnsubscribe = subscribe<MapItemEvent>(
      EventTypes.MAP_ITEM_SELECTED,
      handleMapItemSelected,
    );

    // Subscribe to deselection event
    const deselectUnsubscribe = subscribe<MapItemEvent>(
      EventTypes.MAP_ITEM_DESELECTED,
      handleMapItemDeselected,
    );

    // Subscribe to user panning event
    const userPanningUnsubscribe = subscribe<BaseEvent>(
      EventTypes.USER_PANNING_VIEWPORT,
      handleUserPanning,
    );

    // Cleanup subscriptions on unmount
    return () => {
      selectUnsubscribe();
      deselectUnsubscribe();
      userPanningUnsubscribe();
    };
  }, [
    subscribe,
    handleMapItemSelected,
    handleMapItemDeselected,
    handleUserPanning,
  ]);

  // Return the stored previously selected item and conversion utilities
  return {
    previousSelectedItem: previousItemRef.current,

    // Utility to convert a map item to corresponding messages
    getItemMessages: useCallback(
      (item: MapItem): string[] => {
        if (item.type === "marker") {
          // Create a marker object compatible with message utils
          const markerData = {
            id: item.id,
            coordinates: item.coordinates,
            data: item.data,
          };
          return generateMessageSequence(markerData, userLocation ?? [0, 0]);
        } else {
          return generateClusterMessages(item.count, userLocation ?? [0, 0]);
        }
      },
      [userLocation],
    ),

    // Utility to generate a goodbye message
    getGoodbyeMessage: useCallback((itemName: string = ""): string => {
      return generateGoodbyeMessage(itemName);
    }, []),

    // Convert EventBroker item to our MapItem type
    convertEventItem: useCallback(
      (eventItem: MarkerItem | ClusterItem): MapItem => {
        if (eventItem.type === "marker") {
          return {
            id: eventItem.id,
            type: "marker",
            coordinates: eventItem.coordinates,
            data: (eventItem as MarkerItem).markerData,
          };
        } else {
          return {
            id: eventItem.id,
            type: "cluster",
            coordinates: eventItem.coordinates,
            count: (eventItem as ClusterItem).count,
            childrenIds: (eventItem as ClusterItem).childMarkers,
          };
        }
      },
      [],
    ),
  };
};
