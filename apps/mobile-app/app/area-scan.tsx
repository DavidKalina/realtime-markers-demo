import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import Screen from "@/components/Layout/Screen";
import {
  ZoneHero,
  StatPillRow,
  ZoneEncounters,
  ZoneTrails,
  AreaTabBar,
  ScanningAnimation,
  DialogBox,
  layoutStyles,
} from "@/components/AreaScan/AreaScanComponents";
import { useAreaInsight } from "@/components/AreaScan/useAreaInsight";
import EventDnaChart from "@/components/EventDetails/EventDnaChart";

export default function AreaScanScreen() {
  const { lat, lng, zoom } = useLocalSearchParams<{
    lat: string;
    lng: string;
    zoom: string;
  }>();
  const router = useRouter();

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "trails">("events");

  const { zoneStats, isLoading, error, dialog, feedPending, refeedOnFocus } =
    useAreaInsight(lat, lng, zoom);

  // Re-feed dialog pages when returning from a sub-screen (e.g. trail detail)
  // because useFocusEffect cleanup in useDialogStreamer cancels the stream on blur
  useFocusEffect(
    useCallback(() => {
      refeedOnFocus();
    }, [refeedOnFocus]),
  );

  // Minimum animation display time
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const showScanAnimation = isLoading || !minTimeElapsed;

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
          onExpandComplete={feedPending}
          loadingText="Scanning area"
          style={{ height: 140, marginBottom: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        />
      }
    >
      {showScanAnimation && lat && lng && (
        <ScanningAnimation
          lat={parseFloat(lat)}
          lng={parseFloat(lng)}
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
