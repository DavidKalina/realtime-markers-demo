import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import { useJobProgress } from "@/hooks/useJobProgress";
import { useColors } from "@/theme";
import {
  useConversationStore,
  type ConversationData,
} from "@/stores/useConversationStore";
import type { EngineState, ContentType } from "@/hooks/useConversationEngine";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { buildSidequestSteps } from "@/utils/conversationSteps";
import ConversationDialogBox from "./ConversationDialogBox";
import MapPickerContent from "./MapPickerContent";
import TimingPickerContent from "./TimingPickerContent";

export default function ConversationOverlay() {
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const itineraryJobStore = useItineraryJobStore();
  const { activeJobs, trackJob } = useJobProgress();

  const visible = useConversationStore((s) => s.visible);
  const steps = useConversationStore((s) => s.steps);
  const trigger = useConversationStore((s) => s.trigger);
  const autoExpand = useConversationStore((s) => s.autoExpand);
  const collapsedLabel = useConversationStore((s) => s.collapsedLabel);
  const mapPins = useConversationStore((s) => s.mapPins);
  const setMapPins = useConversationStore((s) => s.setMapPins);
  const dismiss = useConversationStore((s) => s.dismiss);

  // ── Result tracking state ──────────────────────────────────
  const [itineraryResult, setItineraryResult] =
    useState<ItineraryResponse | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Watch the tracked job for completion
  const trackedJob = activeJobId
    ? activeJobs.find((j) => j.jobId === activeJobId)
    : null;

  // When the tracked job completes, fetch the itinerary result
  React.useEffect(() => {
    if (!trackedJob || !activeJobId) return;

    if (trackedJob.status === "processing" || trackedJob.status === "pending") {
      itineraryJobStore.updateStep(trackedJob.stepLabel || "Crafting your day...");
    }

    if (trackedJob.status === "completed") {
      const itineraryId = (trackedJob.result as { itineraryId?: string })
        ?.itineraryId;
      if (!itineraryId) return;

      apiClient.itineraries
        .getById(itineraryId)
        .then((itinerary) => {
          setItineraryResult(itinerary);
          setActiveJobId(null);
          itineraryJobStore.completeJob();
        })
        .catch((err) => {
          console.error("[ConversationOverlay] Failed to fetch itinerary:", err);
          setActiveJobId(null);
          itineraryJobStore.failJob();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        });
    }

    if (trackedJob.status === "failed") {
      setActiveJobId(null);
      itineraryJobStore.failJob();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [trackedJob?.status, trackedJob?.stepLabel, activeJobId]);

  const handleComplete = useCallback(
    async (_responses: Record<number, string>) => {
      const { data, _onComplete } = useConversationStore.getState();
      if (!data) return;

      // Let caller handle custom logic if provided
      if (_onComplete) {
        _onComplete(data);
        return;
      }

      // Default: create itinerary and track inline
      try {
        const hasPins = data.mapPins && data.mapPins.length > 0;
        const [lng, lat] = userLocation || [0, 0];

        // Pins define the approximate area, not exact stops.
        // Compute centroid of all pins and a radius that covers them.
        let centerLat: number;
        let centerLng: number;
        let radiusMiles: number;

        if (hasPins) {
          const pins = data.mapPins!;
          centerLat =
            pins.reduce((sum, p) => sum + p.coordinates[1], 0) / pins.length;
          centerLng =
            pins.reduce((sum, p) => sum + p.coordinates[0], 0) / pins.length;

          // Find max distance from centroid to any pin (rough miles via lat/lng)
          const maxDistMiles = pins.reduce((max, p) => {
            const dLat = (p.coordinates[1] - centerLat) * 69;
            const dLng =
              (p.coordinates[0] - centerLng) *
              69 *
              Math.cos((centerLat * Math.PI) / 180);
            return Math.max(max, Math.sqrt(dLat * dLat + dLng * dLng));
          }, 0);

          // Pad so results aren't right at the edge — minimum 5mi
          radiusMiles = Math.max(5, Math.ceil(maxDistMiles + 3));
        } else {
          centerLat = lat;
          centerLng = lng;
          radiusMiles = 10;
        }

        const result = await apiClient.itineraries.create({
          centerLatitude: centerLat,
          centerLongitude: centerLng,
          radiusMiles,
          plannedDate: new Date().toISOString().slice(0, 10),
          budgetMin: 0,
          budgetMax: 100,
          durationHours: data.durationHours ?? 4,
          activityTypes: data.activityTypes,
          intention: data.intention,
          timeOfDay: data.timeOfDay,
          surpriseMe: !hasPins,
          timezone: getUserTimezone(),
        });

        itineraryJobStore.startJob(result.jobId, result.itineraryId);

        // Track the job via SSE — the effect above will handle completion
        if (result.jobId) {
          setActiveJobId(result.jobId);
          trackJob(result.jobId);
        }
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.error("Failed to create itinerary:", err);
      }
    },
    [userLocation, itineraryJobStore, trackJob],
  );

  const handleViewItinerary = useCallback(() => {
    if (!itineraryResult) return;
    router.push({
      pathname: "/itineraries/[id]" as const,
      params: { id: itineraryResult.id },
    });
  }, [itineraryResult, router]);

  const handleBuildAnother = useCallback(() => {
    setItineraryResult(null);
    // Replace steps in-place so the dialog stays open and the engine restarts
    const store = useConversationStore.getState();
    store.startConversation({
      steps: buildSidequestSteps(),
      trigger: "custom",
      autoExpand: true,
      collapsedLabel: store.collapsedLabel,
    });
  }, []);

  // Custom content renderers for special step types
  const renderContent = useCallback(
    (engine: EngineState, contentType: ContentType) => {
      if (contentType === "timing-picker" && engine.waitingForUser) {
        return (
          <TimingPickerContent
            onConfirm={(duration, timeOfDay) => {
              useConversationStore.getState().mergeData({
                durationHours: parseFloat(duration),
                timeOfDay,
              });
              engine.respond(`${duration},${timeOfDay}`);
            }}
          />
        );
      }
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

  const dialogProps = {
    collapsedLabel,
    steps,
    trigger,
    autoExpand,
    onComplete: handleComplete,
    renderContent,
    itineraryResult,
    onViewItinerary: handleViewItinerary,
    onBuildAnother: handleBuildAnother,
    style: { marginBottom: 0 } as const,
  };

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
        <ConversationDialogBox {...dialogProps} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.bg.primary }}>
      <ConversationDialogBox {...dialogProps} />
    </View>
  );
}
