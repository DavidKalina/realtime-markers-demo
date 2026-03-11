import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import CityDetailContent from "@/components/LandingPage/CityDetailContent";
import ItineraryDialogBox from "@/components/Itinerary/ItineraryDialogBox";
import useThirdSpaceScore from "@/hooks/useThirdSpaceScore";
import useLandingPageData from "@/hooks/useLandingPageData";
import { useRealtimeDiscoveries } from "@/hooks/useRealtimeDiscoveries";
import { apiClient } from "@/services/ApiClient";
import { setFlyTo } from "@/hooks/useInitialLocation";
import usePopularStops from "@/hooks/usePopularStops";

const CityDetailScreen = () => {
  const { city } = useLocalSearchParams<{ city: string }>();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showItinerary, setShowItinerary] = useState(true);

  const decodedCity = city ? decodeURIComponent(city) : "";
  const cityLabel = decodedCity.includes(",")
    ? decodedCity.split(",")[0].trim()
    : decodedCity;

  const { score: thirdSpaceScore, refetch: refetchScore } = useThirdSpaceScore(
    decodedCity || null,
  );

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

  const { stops: popularStops, refetch: refetchStops } =
    usePopularStops(decodedCity || null);

  // Haptic when new realtime events arrive
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (realtimeDiscoveries.length > prevCountRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    prevCountRef.current = realtimeDiscoveries.length;
  }, [realtimeDiscoveries]);

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

  const currentUser = apiClient.getCurrentUser();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshLanding(), refetchScore(), refetchStops()]);
      clearRealtime();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLanding, refetchScore, refetchStops, clearRealtime]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate("/spaces" as const);
  }, [router]);

  const handleExploreMap = useCallback(() => {
    // Prefer a real event location over the centroid to avoid dead zones
    const firstEvent =
      landingData?.featuredEvents?.[0] ?? landingData?.topEvents?.[0];
    const coords: [number, number] | null =
      firstEvent?.coordinates ??
      (thirdSpaceScore?.centroid
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
      bannerDescription="Third Space Score & Events"
      showBackButton
      onBack={handleBack}
      noAnimation
      bottomContent={
        showItinerary ? (
          <ItineraryDialogBox
            city={decodedCity}
            style={{ height: 105, marginBottom: 0 }}
            onDismiss={() => setShowItinerary(false)}
          />
        ) : undefined
      }
    >
      <View style={{ flex: 1 }}>
        <CityDetailContent
          data={mergedData}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          thirdSpaceScore={thirdSpaceScore}
          currentUserId={currentUser?.id}
          popularStops={popularStops}
          topEvents={landingData?.topEvents}
          onExploreMap={
            landingData?.featuredEvents?.[0] ||
            landingData?.topEvents?.[0] ||
            thirdSpaceScore?.centroid
              ? handleExploreMap
              : undefined
          }
        />
      </View>
    </Screen>
  );
};

export default CityDetailScreen;
