import { useEffect, useState, useCallback } from "react";
import { eventBroker, EventTypes, DiscoveryEvent } from "@/services/EventBroker";
import { DiscoveredEventType } from "@/types/types";

const MAX_REALTIME = 5;

const normalizeCity = (city: string) =>
  city.split(",")[0].trim().toLowerCase();

export function useRealtimeDiscoveries(cityName: string) {
  const [realtimeDiscoveries, setRealtimeDiscoveries] = useState<
    DiscoveredEventType[]
  >([]);

  useEffect(() => {
    if (!cityName) return;

    const normalizedTarget = normalizeCity(cityName);

    const unsubscribe = eventBroker.on<DiscoveryEvent>(
      EventTypes.EVENT_DISCOVERED,
      (data) => {
        const evt = data.event;
        if (!evt.city) return;
        if (normalizeCity(evt.city) !== normalizedTarget) return;

        // location may be a GeoJSON point (from backend) or a string (from sim)
        const loc = evt.location;
        const isGeoJSON =
          loc && typeof loc === "object" && Array.isArray(loc.coordinates);
        const coordinates: [number, number] = isGeoJSON
          ? [loc.coordinates[0], loc.coordinates[1]]
          : [0, 0];
        const locationStr: string = isGeoJSON
          ? evt.address || ""
          : typeof loc === "string"
            ? loc
            : evt.address || "";

        const discovered: DiscoveredEventType = {
          id: evt.id,
          title: evt.title,
          emoji: evt.emoji,
          location: locationStr,
          description: evt.description,
          eventDate: evt.eventDate,
          endDate: evt.endDate,
          address: evt.address,
          locationNotes: evt.locationNotes,
          categories: evt.categories ?? [],
          confidenceScore: evt.confidenceScore,
          originalImageUrl: evt.originalImageUrl,
          creatorId: evt.creatorId,
          createdAt: evt.createdAt,
          updatedAt: evt.updatedAt,
          coordinates,
          viewCount: 0,
          status: "active",
          time: "",
          distance: "",
          timezone: "",
          discoveredAt: evt.createdAt,
        };

        setRealtimeDiscoveries((prev) => {
          if (prev.some((e) => e.id === discovered.id)) return prev;
          return [discovered, ...prev].slice(0, MAX_REALTIME);
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [cityName]);

  const clearRealtime = useCallback(() => {
    setRealtimeDiscoveries([]);
  }, []);

  return { realtimeDiscoveries, clearRealtime };
}
