import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Screen from "@/components/Layout/Screen";
import { apiClient } from "@/services/ApiClient";
import type { AreaScanMetadata } from "@/services/api/modules/areaScan";
import {
  CHARS_PER_PAGE,
  splitIntoPages,
  getRadiusForZoom,
  ZoneHero,
  StatPillRow,
  ZoneEncounters,
  DialogBox,
  useDialogStreamer,
  layoutStyles,
} from "@/components/AreaScan/AreaScanComponents";
import EventDnaChart from "@/components/EventDetails/EventDnaChart";

export default function AreaScanScreen() {
  const { lat, lng, zoom } = useLocalSearchParams<{
    lat: string;
    lng: string;
    zoom: string;
  }>();
  const router = useRouter();
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const fullTextRef = useRef("");

  const [zoneStats, setZoneStats] = useState<AreaScanMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const dialog = useDialogStreamer(() => router.back());

  // --- Fetch ---
  useEffect(() => {
    if (!lat || !lng) return;

    const radius = getRadiusForZoom(zoom ? parseFloat(zoom) : 12);

    const handle = apiClient.areaScan.streamAreaProfile(
      parseFloat(lat),
      parseFloat(lng),
      radius,
      {
        onMetadata: (meta) => setZoneStats(meta),
        onContent: (chunk) => {
          fullTextRef.current += chunk;
        },
        onDone: () => {
          setIsLoading(false);
          if (fullTextRef.current) {
            dialog.feedPages(
              splitIntoPages(fullTextRef.current, CHARS_PER_PAGE),
            );
          }
        },
        onError: (err) => {
          setError(err.message);
          setIsLoading(false);
        },
      },
    );
    abortRef.current = handle;

    return () => {
      handle.abort();
    };
  }, [lat, lng]);

  return (
    <Screen
      bannerTitle="Area Scan"
      onBack={() => router.back()}
      isScrollable={false}
    >
      {zoneStats && <ZoneHero zoneStats={zoneStats} />}

      {zoneStats && zoneStats.categoryBreakdown.length > 0 && (
        <EventDnaChart
          categories={zoneStats.categoryBreakdown}
          variant="bar"
          label="AREA DNA"
        />
      )}

      {zoneStats && zoneStats.eventCount > 0 && (
        <StatPillRow zoneStats={zoneStats} />
      )}

      {zoneStats && zoneStats.events?.length > 0 ? (
        <ZoneEncounters
          events={zoneStats.events}
          onEventPress={(eventId) =>
            router.push(`/details?eventId=${eventId}` as never)
          }
        />
      ) : (
        <View style={layoutStyles.spacer} />
      )}

      <DialogBox
        isLoading={isLoading}
        error={error}
        displayText={dialog.displayText}
        showContinue={dialog.showContinue}
        showDone={dialog.showDone}
        blinkAnim={dialog.blinkAnim}
        onTap={dialog.handleTap}
        style={{ height: 140 }}
      />
    </Screen>
  );
}
