import React, { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import LandingPageContent from "@/components/LandingPage/LandingPageContent";
import { useCityInsight } from "@/components/LandingPage/useCityInsight";
import { DialogBox } from "@/components/AreaScan/AreaScanComponents";
import useThirdSpaceScore from "@/hooks/useThirdSpaceScore";
import useLandingPageData from "@/hooks/useLandingPageData";
import { useRealtimeDiscoveries } from "@/hooks/useRealtimeDiscoveries";
import { apiClient } from "@/services/ApiClient";
import { setFlyTo } from "@/hooks/useInitialLocation";

const CityDetailScreen = () => {
  const { city } = useLocalSearchParams<{ city: string }>();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const decodedCity = city ? decodeURIComponent(city) : "";
  const cityLabel = decodedCity.includes(",")
    ? decodedCity.split(",")[0].trim()
    : decodedCity;

  const { score: thirdSpaceScore, refetch: refetchScore } =
    useThirdSpaceScore(decodedCity || null);

  const {
    landingData,
    isLoading,
    refresh: refreshLanding,
  } = useLandingPageData({
    city: decodedCity || undefined,
    featuredLimit: 5,
    upcomingLimit: 10,
    communityLimit: 5,
    discoveryLimit: 8,
    trendingLimit: 5,
  });

  const { realtimeDiscoveries, clearRealtime } =
    useRealtimeDiscoveries(decodedCity);

  const mergedData = useMemo(() => {
    if (!landingData) return landingData;
    const existingIds = new Set(
      (landingData.justDiscoveredEvents ?? []).map((e) => e.id),
    );
    const newEvents = realtimeDiscoveries
      .filter((e) => !existingIds.has(e.id))
      .map((e) => ({ ...e, _isRealtime: true as const }));
    return {
      ...landingData,
      justDiscoveredEvents: [
        ...newEvents,
        ...(landingData.justDiscoveredEvents ?? []),
      ],
    };
  }, [landingData, realtimeDiscoveries]);

  const {
    isLoading: insightLoading,
    error: insightError,
    dialog: insightDialog,
    feedPending: insightFeedPending,
  } = useCityInsight(decodedCity || null);

  const currentUser = apiClient.getCurrentUser();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshLanding(), refetchScore()]);
      clearRealtime();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLanding, refetchScore, clearRealtime]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleExploreMap = useCallback(() => {
    // Prefer a real event location over the centroid to avoid dead zones
    const firstEvent = landingData?.featuredEvents?.[0] ?? landingData?.topEvents?.[0];
    const coords: [number, number] | null = firstEvent?.coordinates
      ?? (thirdSpaceScore?.centroid
        ? [thirdSpaceScore.centroid.lng, thirdSpaceScore.centroid.lat]
        : null);
    if (!coords) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlyTo(coords, 15);
    router.navigate("/");
  }, [router, landingData, thirdSpaceScore?.centroid]);

  return (
    <Screen
      isScrollable={false}
      bannerTitle={cityLabel}
      bannerDescription="Third Space Score & Events"
      showBackButton
      onBack={handleBack}
      noAnimation
      bottomContent={
        <DialogBox
          isLoading={insightLoading}
          error={insightError}
          displayText={insightDialog.displayText}
          showContinue={insightDialog.showContinue}
          showDone={insightDialog.showDone}
          blinkAnim={insightDialog.blinkAnim}
          onTap={insightDialog.handleTap}
          onRestart={insightDialog.restart}
          onExpandComplete={insightFeedPending}
          style={{ height: 105, marginBottom: 0 }}
        />
      }
    >
      <LandingPageContent
        data={mergedData}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        thirdSpaceScore={thirdSpaceScore}
        currentUserId={currentUser?.id}
        topEvents={landingData?.topEvents}
        onExploreMap={
          landingData?.featuredEvents?.[0] || landingData?.topEvents?.[0] || thirdSpaceScore?.centroid
            ? handleExploreMap
            : undefined
        }
      />
    </Screen>
  );
};

export default CityDetailScreen;
