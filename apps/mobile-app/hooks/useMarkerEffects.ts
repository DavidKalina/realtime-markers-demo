// hooks/useMarkerEffects.ts
import { useEventBroker } from "@/hooks/useEventBroker";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventTypes } from "@/services/EventBroker";
import { useEffect, useRef } from "react";
import { generateClusterMessages, generateMessageSequence } from "../utils/messageUtils";

interface MarkerEffectsProps {
  // Selected marker/cluster state
  selectedMarker: Marker | null;
  selectedMarkerId: string | null;
  selectedItemType: "marker" | "cluster" | null;
  selectedCluster: { id: string; count: number; coordinates: [number, number] } | null;

  // User location for distance calculations
  userLocation: [number, number] | null;

  // Callback functions
  onMarkerSelect: (marker: Marker, messages: string[]) => void;
  onClusterSelect?: (
    cluster: { id: string; count: number; coordinates: [number, number] },
    messages: string[]
  ) => void;
  onMarkerDeselect: () => void;
}

/**
 * Custom hook to handle marker and cluster selection and deselection effects
 */
export const useMarkerEffects = ({
  selectedMarker,
  selectedMarkerId,
  selectedItemType,
  selectedCluster,
  userLocation,
  onMarkerSelect,
  onClusterSelect,
  onMarkerDeselect,
}: MarkerEffectsProps) => {
  // Create references to track the current active selection
  const currentMarkerIdRef = useRef<string | null>(null);
  const currentItemTypeRef = useRef<"marker" | "cluster" | null>(null);
  const lastMarkerNameRef = useRef<string>("");
  const { subscribe } = useEventBroker();

  // Reference to track already processed markers/clusters to prevent duplicate handling
  const processedItemRef = useRef<{ id: string; type: "marker" | "cluster" } | null>(null);

  // Handle deselection
  useEffect(() => {
    const wasItemSelected = Boolean(currentMarkerIdRef.current);
    const isItemSelected = Boolean(selectedMarkerId) || Boolean(selectedCluster);

    // If we just deselected an item, trigger cleanup
    const itemDeselected = wasItemSelected && !isItemSelected;

    // Update our reference
    currentMarkerIdRef.current = selectedMarkerId;
    currentItemTypeRef.current = selectedItemType;

    // Reset the processed item ref when deselected
    if (itemDeselected) {
      processedItemRef.current = null;
      onMarkerDeselect();
    }
  }, [selectedMarkerId, selectedCluster, selectedItemType, onMarkerDeselect]);

  // Handle marker selection
  useEffect(() => {
    // Skip if no marker is selected or if it's not a marker selection
    if (!selectedMarker || !selectedMarkerId || selectedItemType !== "marker") {
      return;
    }

    // Skip if we've already processed this exact marker
    if (
      processedItemRef.current?.id === selectedMarkerId &&
      processedItemRef.current?.type === "marker"
    ) {
      return;
    }

    // Update the processed item ref
    processedItemRef.current = { id: selectedMarkerId, type: "marker" };

    try {
      // Generate message sequence for this marker
      const messages = generateMessageSequence(selectedMarker, userLocation);

      // Store the marker name for goodbye message
      const markerName = selectedMarker.data?.title || "this location";
      lastMarkerNameRef.current = markerName;

      // Trigger the marker select callback with messages
      onMarkerSelect(selectedMarker, messages);
    } catch (error) {
      console.error("Error processing selected marker:", error);
      onMarkerSelect(selectedMarker, ["Sorry, I couldn't load information about this location."]);
    }
  }, [selectedMarker, selectedMarkerId, selectedItemType, userLocation, onMarkerSelect]);

  // Handle cluster selection
  useEffect(() => {
    // Skip if no cluster is selected or if it's not a cluster selection
    if (!selectedCluster || selectedItemType !== "cluster" || !onClusterSelect) {
      return;
    }

    // Skip if we've already processed this exact cluster
    if (
      processedItemRef.current?.id === selectedCluster.id &&
      processedItemRef.current?.type === "cluster"
    ) {
      return;
    }

    // Update the processed item ref
    processedItemRef.current = { id: selectedCluster.id, type: "cluster" };

    try {
      // Generate message sequence for this cluster
      const messages = generateClusterMessages(selectedCluster.count, userLocation);

      // Trigger the cluster select callback with messages
      onClusterSelect(selectedCluster, messages);
    } catch (error) {
      console.error("Error processing selected cluster:", error);
      onClusterSelect(selectedCluster, [
        "Sorry, I couldn't load information about this group of events.",
      ]);
    }
  }, [selectedCluster, selectedItemType, userLocation, onClusterSelect]);

  // Subscribe to marker/cluster selection events from the EventBroker
  useEffect(() => {
    const handleClusterSelected = (event: any) => {
      // Event handling happens via the useEffect hooks above
      // This is mainly to log the event in development
      if (__DEV__) {
        console.log("Cluster selected event:", event);
      }
    };

    // Subscribe to the cluster selected event
    subscribe(EventTypes.CLUSTER_SELECTED, handleClusterSelected);
  }, [subscribe]);

  return {
    currentMarkerId: currentMarkerIdRef.current,
    currentItemType: currentItemTypeRef.current,
    lastMarkerName: lastMarkerNameRef.current,
  };
};
