import React, { useCallback } from "react";
import { View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import { useColors } from "@/theme";
import {
  useConversationStore,
  type ConversationData,
} from "@/stores/useConversationStore";
import type { EngineState, ContentType } from "@/hooks/useConversationEngine";
import ConversationDialogBox from "./ConversationDialogBox";
import MapPickerContent from "./MapPickerContent";

export default function ConversationOverlay() {
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const itineraryJobStore = useItineraryJobStore();

  const visible = useConversationStore((s) => s.visible);
  const steps = useConversationStore((s) => s.steps);
  const trigger = useConversationStore((s) => s.trigger);
  const autoExpand = useConversationStore((s) => s.autoExpand);
  const collapsedLabel = useConversationStore((s) => s.collapsedLabel);
  const mapPins = useConversationStore((s) => s.mapPins);
  const setMapPins = useConversationStore((s) => s.setMapPins);
  const dismiss = useConversationStore((s) => s.dismiss);

  const handleComplete = useCallback(
    async (_responses: Record<number, string>) => {
      const { data, _onComplete } = useConversationStore.getState();
      if (!data) return;

      // Let caller handle custom logic if provided
      if (_onComplete) {
        _onComplete(data);
        return;
      }

      // Default: create itinerary and navigate
      try {
        const hasPins = data.mapPins && data.mapPins.length > 0;
        const [lng, lat] = userLocation || [0, 0];

        const anchorStops = hasPins
          ? data.mapPins!.map((p) => ({
              coordinates: p.coordinates as [number, number],
            }))
          : undefined;
        const centerLat = hasPins ? data.mapPins![0].coordinates[1] : lat;
        const centerLng = hasPins ? data.mapPins![0].coordinates[0] : lng;

        const result = await apiClient.itineraries.create({
          centerLatitude: centerLat,
          centerLongitude: centerLng,
          radiusMiles: hasPins ? 15 : 10,
          plannedDate: new Date().toISOString().slice(0, 10),
          budgetMin: 0,
          budgetMax: 100,
          durationHours: 4,
          activityTypes: data.activityTypes,
          intention: data.intention,
          surpriseMe: !hasPins,
          timezone: getUserTimezone(),
          ...(anchorStops && { anchorStops }),
        });

        itineraryJobStore.startJob(result.jobId, result.itineraryId);

        if (result.itineraryId) {
          router.push({
            pathname: "/itineraries/[id]" as const,
            params: { id: result.itineraryId },
          });
        } else {
          router.push("/itineraries" as const);
        }
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.error("Failed to create itinerary:", err);
      }
    },
    [userLocation, itineraryJobStore, router],
  );

  // Map-picker custom renderer
  const renderContent = useCallback(
    (engine: EngineState, contentType: ContentType) => {
      if (contentType === "map-picker" && engine.waitingForUser) {
        return (
          <MapPickerContent
            pins={mapPins}
            onPinsChange={setMapPins}
            maxPins={3}
            onConfirm={() => {
              // Snapshot pins into store data before advancing
              const store = useConversationStore.getState();
              if (store.data) {
                useConversationStore
                  .getState()
                  .mergeData({ mapPins: [...store.mapPins] });
              }
              engine.respond("confirmed");
            }}
          />
        );
      }
      return null;
    },
    [mapPins, setMapPins],
  );

  const colors = useColors();
  const pathname = usePathname();
  const isMapScreen = pathname === "/" || pathname === "/index";

  if (!visible) return null;

  // On the map screen, float over the map so expanding doesn't shrink it
  if (isMapScreen) {
    return (
      <View
        style={{
          position: "absolute",
          bottom: 84,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
        pointerEvents="box-none"
      >
        <ConversationDialogBox
          collapsedLabel={collapsedLabel}
          steps={steps}
          trigger={trigger}
          autoExpand={autoExpand}
          onComplete={handleComplete}
          renderContent={renderContent}
          style={{ marginBottom: 0 }}
        />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.bg.primary }}>
      <ConversationDialogBox
        collapsedLabel={collapsedLabel}
        steps={steps}
        trigger={trigger}
        autoExpand={autoExpand}
        onComplete={handleComplete}
        renderContent={renderContent}
        style={{ marginBottom: 0 }}
      />
    </View>
  );
}
