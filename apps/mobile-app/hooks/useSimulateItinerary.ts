/**
 * DEV-ONLY hook: injects a fake itinerary and simulates check-in events
 * so you can see the celebration animations without walking to real locations.
 *
 * Usage: call `startSimulation()` — it sets a fake active itinerary, then
 * fires ITINERARY_CHECKIN events for each stop on a timer.
 */
import { useCallback, useRef } from "react";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";

/** Delay before the first check-in fires (let camera settle on the route). */
const FIRST_CHECKIN_DELAY = 5000;
/** Gap between successive simulated check-ins. */
const CHECKIN_INTERVAL = 5000;

/**
 * Build a fake itinerary centred on the given coordinates.
 * Stops are placed in a rough walking-distance cluster nearby.
 */
function buildFakeItinerary(
  center: [number, number],
): ItineraryResponse {
  const [lng, lat] = center;

  // Small offsets (~200-400m apart) so the route looks realistic
  const stops: {
    title: string;
    emoji: string;
    lat: number;
    lng: number;
    travelNote: string;
  }[] = [
    {
      title: "Morning Coffee",
      emoji: "\u2615",
      lat: lat + 0.001,
      lng: lng - 0.0015,
      travelNote: "2 min walk east",
    },
    {
      title: "Vintage Bookshop",
      emoji: "\uD83D\uDCDA",
      lat: lat + 0.0025,
      lng: lng + 0.001,
      travelNote: "5 min walk north",
    },
    {
      title: "Street Art Alley",
      emoji: "\uD83C\uDFA8",
      lat: lat - 0.001,
      lng: lng + 0.003,
      travelNote: "8 min walk through the park",
    },
    {
      title: "Ramen Spot",
      emoji: "\uD83C\uDF5C",
      lat: lat - 0.002,
      lng: lng - 0.001,
      travelNote: "6 min walk south",
    },
  ];

  return {
    id: `sim-${Date.now()}`,
    city: "Simulated City",
    plannedDate: new Date().toISOString().split("T")[0],
    budgetMin: 20,
    budgetMax: 60,
    durationHours: 3,
    activityTypes: ["food", "culture"],
    title: "Simulated Adventure",
    summary: "A fake itinerary to preview check-in animations.",
    status: "READY",
    createdAt: new Date().toISOString(),
    items: stops.map((s, i) => ({
      id: `sim-item-${i}`,
      sortOrder: i + 1,
      startTime: `${9 + i}:00`,
      endTime: `${10 + i}:00`,
      title: s.title,
      emoji: s.emoji,
      latitude: s.lat,
      longitude: s.lng,
      travelNote: s.travelNote,
      venueName: s.title,
      venueAddress: "123 Simulated St",
    })),
  };
}

export function useSimulateItinerary(
  center: [number, number] | null,
) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startSimulation = useCallback(() => {
    if (!center) return;

    // Clean up any previous simulation
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const itinerary = buildFakeItinerary(center);
    const store = useActiveItineraryStore.getState();

    // Inject the fake itinerary directly (skip API call)
    useActiveItineraryStore.setState({ itinerary });

    // Fire simulated check-ins one by one
    itinerary.items.forEach((item, idx) => {
      const delay = FIRST_CHECKIN_DELAY + idx * CHECKIN_INTERVAL;
      const isLast = idx === itinerary.items.length - 1;

      timersRef.current.push(
        setTimeout(() => {
          console.log(
            `[Sim] Check-in ${idx + 1}/${itinerary.items.length}: ${item.title}`,
          );
          eventBroker.emit(EventTypes.ITINERARY_CHECKIN, {
            itineraryId: itinerary.id,
            itemId: item.id,
            completed: isLast,
          });
        }, delay),
      );
    });
  }, [center]);

  const stopSimulation = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    useActiveItineraryStore.setState({
      itinerary: null,
      completionData: null,
    });
  }, []);

  return { startSimulation, stopSimulation };
}
