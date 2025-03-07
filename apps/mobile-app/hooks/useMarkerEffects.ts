// hooks/useMarkerEffects.ts
import { useEventBroker } from "@/hooks/useEventBroker";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventTypes } from "@/services/EventBroker";
import { useEffect, useRef } from "react";
import { generateClusterMessages, generateMessageSequence } from "../utils/messageUtils";

// Define the unified MapItem types - these should be imported from a common types file
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

interface MarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

type MapItem = MarkerItem | ClusterItem;

interface MarkerEffectsProps {
  // Unified selection state
  selectedItem: MapItem | null;

  // User location for distance calculations
  userLocation: [number, number] | null;

  // Callback functions with unified approach
  onItemSelect: (item: MapItem, messages: string[]) => void;
  onItemDeselect: () => void;
}

/**
 * Custom hook to handle map item (marker or cluster) selection and deselection effects
 * Using the unified MapItem approach
 */
export const useMarkerEffects = ({
  selectedItem,
  userLocation,
  onItemSelect,
  onItemDeselect,
}: MarkerEffectsProps) => {
  // Create references to track the current active selection
  const currentItemIdRef = useRef<string | null>(null);
  const currentItemTypeRef = useRef<"marker" | "cluster" | null>(null);
  const lastItemNameRef = useRef<string>("");
  const { subscribe } = useEventBroker();

  // Reference to track already processed items to prevent duplicate handling
  const processedItemRef = useRef<{ id: string; type: "marker" | "cluster" } | null>(null);

  // Handle deselection
  useEffect(() => {
    const wasItemSelected = Boolean(currentItemIdRef.current);
    const isItemSelected = Boolean(selectedItem);

    // If we just deselected an item, trigger cleanup
    if (wasItemSelected && !isItemSelected) {
      // Update our references
      currentItemIdRef.current = null;
      currentItemTypeRef.current = null;

      // Reset the processed item ref when deselected
      processedItemRef.current = null;

      // Call the deselect callback
      onItemDeselect();
    }

    // Update references if selection changed
    if (isItemSelected && selectedItem) {
      currentItemIdRef.current = selectedItem.id;
      currentItemTypeRef.current = selectedItem.type;
    }
  }, [selectedItem, onItemDeselect]);

  // Unified handler for both marker and cluster selection
  useEffect(() => {
    // Skip if no item is selected
    if (!selectedItem) {
      return;
    }

    // Skip if we've already processed this exact item
    if (
      processedItemRef.current?.id === selectedItem.id &&
      processedItemRef.current?.type === selectedItem.type
    ) {
      return;
    }

    // Update the processed item ref
    processedItemRef.current = { id: selectedItem.id, type: selectedItem.type };

    try {
      let messages: string[] = [];

      // Use type discrimination to handle different item types
      if (selectedItem.type === "marker") {
        // It's a marker - create a compatible Marker object
        const markerObj: Marker = {
          id: selectedItem.id,
          coordinates: selectedItem.coordinates,
          data: selectedItem.data,
        };

        // Generate message sequence for this marker
        messages = generateMessageSequence(markerObj, userLocation);

        // Store the marker name for goodbye message
        const markerName = selectedItem.data?.title || "this location";
        lastItemNameRef.current = markerName;
      } else if (selectedItem.type === "cluster") {
        // It's a cluster
        messages = generateClusterMessages(selectedItem.count, userLocation);
        lastItemNameRef.current = "this group";
      }

      // Trigger the unified item select callback with messages
      onItemSelect(selectedItem, messages);
    } catch (error) {
      console.error(`Error processing selected ${selectedItem.type}:`, error);
      onItemSelect(selectedItem, [
        `Sorry, I couldn't load information about this ${selectedItem.type}.`,
      ]);
    }
  }, [selectedItem, userLocation, onItemSelect]);

  // Subscribe to marker/cluster selection events from the EventBroker
  useEffect(() => {
    const handleItemSelected = (event: any) => {
      // Event handling happens via the useEffect hooks above
      // This is mainly to log the event in development
      if (__DEV__) {
        console.log(`${event.type} event:`, event);
      }
    };

    // Subscribe to both types of selection events
    subscribe(EventTypes.MARKER_SELECTED, handleItemSelected);
    subscribe(EventTypes.CLUSTER_SELECTED, handleItemSelected);

    return () => {
      // No explicit unsubscribe needed as the EventBroker handles this
    };
  }, [subscribe]);

  return {
    currentItemId: currentItemIdRef.current,
    currentItemType: currentItemTypeRef.current,
    lastItemName: lastItemNameRef.current,
  };
};
