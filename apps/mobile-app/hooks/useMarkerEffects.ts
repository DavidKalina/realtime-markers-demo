// hooks/useMarkerEffects.ts
import { useEffect, useRef } from "react";
import { Marker } from "@/hooks/useMapWebsocket";
import { generateMessageSequence, generateGoodbyeMessage } from "../utils/messageUtils";

interface MarkerEffectsProps {
  // Selected marker state
  selectedMarker: Marker | null;
  selectedMarkerId: string | null;

  // User location for distance calculations
  userLocation: [number, number] | null;

  // Callback functions
  onMarkerSelect: (marker: Marker, messages: string[]) => void;
  onMarkerDeselect: (goodbyeMessage: string) => void;
}

/**
 * Custom hook to handle marker selection and deselection effects
 */
export const useMarkerEffects = ({
  selectedMarker,
  selectedMarkerId,
  userLocation,
  onMarkerSelect,
  onMarkerDeselect,
}: MarkerEffectsProps) => {
  // Create a reference to track the current active marker ID and last marker name
  const currentMarkerIdRef = useRef<string | null>(null);
  const lastMarkerNameRef = useRef<string>("");

  // Update currentMarkerIdRef when selectedMarkerId changes and detect deselection
  useEffect(() => {
    // Note: we need to keep track of marker deselection
    const wasMarkerSelected = Boolean(currentMarkerIdRef.current);
    const isMarkerSelected = Boolean(selectedMarkerId);

    // If we just deselected a marker, we'll want to show a goodbye message
    const markerDeselected = wasMarkerSelected && !isMarkerSelected;

    // Update our reference
    currentMarkerIdRef.current = selectedMarkerId;

    // Handle marker deselection with goodbye message
    if (markerDeselected) {
      const markerName = lastMarkerNameRef.current;
      const goodbyeMessage = generateGoodbyeMessage(markerName);
      onMarkerDeselect(goodbyeMessage);
    }
  }, [selectedMarkerId, onMarkerDeselect]);

  const processedMarkerRef = useRef<string | null>(null);

  // When selected marker changes, handle selection effects
  useEffect(() => {
    // Skip if no marker is selected
    if (!selectedMarker || !selectedMarkerId) {
      return;
    }

    // Skip if we've already processed this exact marker
    if (processedMarkerRef.current === selectedMarkerId) {
      return;
    }

    // Set the processed marker ref
    processedMarkerRef.current = selectedMarkerId;

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
  }, [selectedMarker, selectedMarkerId, userLocation, onMarkerSelect]);
  // We're only using refs here, not Reanimated shared values, so this should be fine
  return {
    currentMarkerId: currentMarkerIdRef.current,
    lastMarkerName: lastMarkerNameRef.current,
  };
};
