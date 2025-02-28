// hooks/useEventNavigation.ts
import { eventSuggestions } from "@/components/RefactoredAssistant/data";
import { EventType } from "@/components/RefactoredAssistant/types";
import { useState } from "react";

export const useEventNavigation = (initialEvent: EventType) => {
  const [currentEvent, setCurrentEvent] = useState<EventType>(initialEvent);
  const [currentIndex, setCurrentIndex] = useState(0);

  const navigateToNext = () => {
    const nextIndex = (currentIndex + 1) % eventSuggestions.length;
    setCurrentIndex(nextIndex);
    setCurrentEvent(eventSuggestions[nextIndex]);
    return eventSuggestions[nextIndex];
  };

  const navigateToPrevious = () => {
    const prevIndex = (currentIndex - 1 + eventSuggestions.length) % eventSuggestions.length;
    setCurrentIndex(prevIndex);
    setCurrentEvent(eventSuggestions[prevIndex]);
    return eventSuggestions[prevIndex];
  };

  return {
    currentEvent,
    setCurrentEvent: (event: EventType) => {
      setCurrentEvent(event);
      // Find the index of the event in the suggestions array
      const index = eventSuggestions.findIndex(
        (e) => e.title === event.title && e.location === event.location
      );
      if (index !== -1) {
        setCurrentIndex(index);
      }
    },
    navigateToNext,
    navigateToPrevious,
    currentIndex,
  };
};
