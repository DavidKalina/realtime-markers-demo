import { useCallback, useState } from "react";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import {
  getFirstStop,
  type ItineraryPreviewStop,
} from "@/components/Itinerary/ItineraryCarousel";

interface UseItineraryBrowsingOptions {
  itineraries: ItineraryResponse[];
  handlePreviewStop: (stop: ItineraryPreviewStop | null) => void;
}

/**
 * State and callbacks for browsing recent itineraries via map markers
 * and the carousel.
 */
export function useItineraryBrowsing({
  itineraries,
  handlePreviewStop,
}: UseItineraryBrowsingOptions) {
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState<
    number | null
  >(null);

  // Tap itinerary map marker → open carousel + start orbit
  const handleItineraryMarkerSelect = useCallback(
    (index: number) => {
      setSelectedItineraryIndex(index);
      const itinerary = itineraries[index];
      if (!itinerary) return;
      const stop = getFirstStop(itinerary);
      if (stop) handlePreviewStop(stop);
    },
    [itineraries, handlePreviewStop],
  );

  // Carousel swipe → update selected index (orbit triggers via carousel's effect)
  const handleCarouselIndexChange = useCallback((index: number) => {
    setSelectedItineraryIndex(index);
  }, []);

  // Dismiss carousel (back button or map press while carousel is open)
  const handleCarouselDismiss = useCallback(() => {
    setSelectedItineraryIndex(null);
    handlePreviewStop(null);
  }, [handlePreviewStop]);

  return {
    selectedItineraryIndex,
    handleItineraryMarkerSelect,
    handleCarouselIndexChange,
    handleCarouselDismiss,
  };
}
