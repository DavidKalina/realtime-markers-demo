import { useCallback, useEffect, useState } from "react";
import { BaseEvent, EventTypes } from "@/services/EventBroker";
import { useEventBroker } from "@/hooks/useEventBroker";

interface UseMapLoadingStateOptions {
  isLoadingLocation: boolean;
}

export function useMapLoadingState({
  isLoadingLocation,
}: UseMapLoadingStateOptions) {
  const { publish } = useEventBroker();

  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);

  // Update map loading state when map becomes ready
  useEffect(() => {
    if (isMapReady && isMapLoading) {
      const timer = setTimeout(() => {
        setIsMapLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isMapReady, isMapLoading]);

  // Fallback: dismiss loading overlay after 5s even if onDidFinishLoadingMap
  // doesn't fire (known issue with @rnmapbox/maps on New Architecture/Fabric)
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!isMapReady) {
        console.warn("Map ready timeout — forcing dismiss of loading overlay");
        setIsMapReady(true);
      }
    }, 5000);
    return () => clearTimeout(fallback);
  }, []);

  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    publish<BaseEvent>(EventTypes.MAP_READY, {
      timestamp: Date.now(),
      source: "HomeScreen",
    });
  }, [publish]);

  return {
    isMapReady,
    isMapLoading,
    handleMapReady,
  };
}
