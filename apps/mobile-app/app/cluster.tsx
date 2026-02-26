import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Screen from "@/components/Layout/Screen";
import { apiClient } from "@/services/ApiClient";
import type { AreaScanMetadata } from "@/services/api/modules/areaScan";
import type { AreaScanFilterParams } from "@/services/api/modules/areaScan";
import { useFilterStore } from "@/stores/useFilterStore";
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

export default function ClusterScreen() {
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

  const { filters, activeFilterIds } = useFilterStore();

  const resolvedFilters = useMemo((): AreaScanFilterParams | undefined => {
    if (activeFilterIds.length === 0) return undefined;
    const active = filters.find((f) => activeFilterIds.includes(f.id));
    if (!active) return undefined;

    const result: AreaScanFilterParams = {};
    if (active.criteria?.dateRange?.start && active.criteria?.dateRange?.end) {
      result.dateRange = {
        start: active.criteria.dateRange.start,
        end: active.criteria.dateRange.end,
      };
    }
    if (active.categories?.length) {
      result.categoryIds = active.categories;
    }
    return result.dateRange || result.categoryIds ? result : undefined;
  }, [filters, activeFilterIds]);

  const filterKey = resolvedFilters ? JSON.stringify(resolvedFilters) : "";

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
      resolvedFilters,
    );
    abortRef.current = handle;

    return () => {
      handle.abort();
    };
  }, [lat, lng, filterKey]); // eslint-disable-line

  return (
    <Screen
      bannerTitle="Cluster Scan"
      onBack={() => router.back()}
      isScrollable={false}
    >
      {zoneStats && <ZoneHero zoneStats={zoneStats} dnaLabel="CLUSTER DNA" />}

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
      />
    </Screen>
  );
}
