import React, { useCallback, useEffect, useRef, useState } from "react";
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
  ZoneTrails,
  AreaTabBar,
  ScanningAnimation,
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
  const pendingPagesRef = useRef<string[] | null>(null);

  const [zoneStats, setZoneStats] = useState<AreaScanMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "trails">("events");

  const dialog = useDialogStreamer();

  // Minimum animation display time
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const showScanAnimation = isLoading || !minTimeElapsed;

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
            pendingPagesRef.current = splitIntoPages(
              fullTextRef.current,
              CHARS_PER_PAGE,
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

  const eventCount = zoneStats?.events?.length ?? 0;
  const trailCount = zoneStats?.trails?.length ?? 0;

  return (
    <Screen
      bannerTitle="Area Scan"
      onBack={() => router.back()}
      isScrollable={false}
      bottomContent={
        <DialogBox
          isLoading={showScanAnimation}
          error={error}
          displayText={dialog.displayText}
          showContinue={dialog.showContinue}
          showDone={dialog.showDone}
          blinkAnim={dialog.blinkAnim}
          onTap={dialog.handleTap}
          onRestart={dialog.restart}
          onExpandComplete={() => {
            if (pendingPagesRef.current) {
              dialog.feedPages(pendingPagesRef.current);
              pendingPagesRef.current = null;
            }
          }}
          style={{ height: 140, marginBottom: 0 }}
        />
      }
    >
      {showScanAnimation && (
        <ScanningAnimation
          lat={parseFloat(lat || "0")}
          lng={parseFloat(lng || "0")}
        />
      )}

      {!showScanAnimation && zoneStats && <ZoneHero zoneStats={zoneStats} />}

      {!showScanAnimation && zoneStats && zoneStats.categoryBreakdown.length > 0 && (
        <EventDnaChart
          categories={zoneStats.categoryBreakdown}
          variant="bar"
          label="AREA DNA"
        />
      )}

      {!showScanAnimation && zoneStats && zoneStats.eventCount > 0 && (
        <StatPillRow zoneStats={zoneStats} />
      )}

      {!showScanAnimation && zoneStats && (eventCount > 0 || trailCount > 0) && (
        <AreaTabBar
          activeTab={activeTab}
          onTabPress={setActiveTab}
          eventCount={eventCount}
          trailCount={trailCount}
        />
      )}

      {!showScanAnimation && zoneStats && activeTab === "events" && eventCount > 0 ? (
        <ZoneEncounters
          events={zoneStats.events}
          onEventPress={(eventId) =>
            router.push(`/details?eventId=${eventId}` as never)
          }
        />
      ) : !showScanAnimation && zoneStats && activeTab === "trails" && trailCount > 0 ? (
        <ZoneTrails
          trails={zoneStats.trails}
          onTrailPress={(trail) =>
            router.push(`/trail?id=${trail.id}` as never)
          }
        />
      ) : (
        !showScanAnimation && !isLoading && <View style={layoutStyles.spacer} />
      )}
    </Screen>
  );
}
