"use client";

import { useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  CreateItineraryForm,
  type ItineraryItemFormData,
} from "@/components/dashboard/CreateItineraryForm";
import { ItineraryMapPreview } from "@/components/dashboard/ItineraryMapPreview";

const emptyItem = (): ItineraryItemFormData => ({
  title: "",
  startTime: "",
  endTime: "",
  latitude: null,
  longitude: null,
  emoji: "",
  description: "",
  venueName: "",
  venueCategory: "",
});

export default function CreateItineraryPage() {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null,
  );
  const [items, setItems] = useState<ItineraryItemFormData[]>([emptyItem()]);
  const [debugCenter, setDebugCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (selectedItemIndex !== null && selectedItemIndex < items.length) {
        // Set coordinates for selected item
        setItems((prev) => {
          const updated = [...prev];
          updated[selectedItemIndex] = {
            ...updated[selectedItemIndex],
            latitude: lat,
            longitude: lng,
          };
          return updated;
        });
      } else {
        // Set as debug center
        setDebugCenter({ lat, lng });
      }
    },
    [selectedItemIndex, items.length],
  );

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 h-full">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Create Itinerary
            </h1>
            <p className="text-muted-foreground">
              Admin tool: create debug itineraries with manually-placed items
              for testing proximity check-ins
            </p>
          </div>
          <div
            className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0"
            style={{ height: "calc(100vh - 160px)" }}
          >
            <div className="flex-1 min-w-0 flex flex-col">
              <CreateItineraryForm
                onMapClickTarget={setSelectedItemIndex}
                selectedItemIndex={selectedItemIndex}
                items={items}
                setItems={setItems}
                debugCenter={debugCenter}
                setDebugCenter={setDebugCenter}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <ItineraryMapPreview
                items={items}
                selectedItemIndex={selectedItemIndex}
                debugCenter={debugCenter}
                onMapClick={handleMapClick}
              />
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
