import React, { useCallback, useState } from "react";
import { View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import CityDetailContent from "@/components/LandingPage/CityDetailContent";
import ItineraryDialogBox from "@/components/Itinerary/ItineraryDialogBox";
import useThirdSpaceScore from "@/hooks/useThirdSpaceScore";
import usePopularStops from "@/hooks/usePopularStops";
import useBrowseItineraries from "@/hooks/useBrowseItineraries";
import { setFlyTo } from "@/hooks/useInitialLocation";

const CityDetailScreen = () => {
  const { city } = useLocalSearchParams<{ city: string }>();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showItinerary, setShowItinerary] = useState(true);

  const decodedCity = city ? decodeURIComponent(city) : "";

  const { score: thirdSpaceScore, refetch: refetchScore } = useThirdSpaceScore(
    decodedCity || null,
  );

  const { stops: popularStops, refetch: refetchStops } = usePopularStops(
    decodedCity || null,
  );

  const {
    groupedByIntention,
    isLoading,
    refetch: refetchItineraries,
  } = useBrowseItineraries(decodedCity || null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchScore(), refetchStops(), refetchItineraries()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchScore, refetchStops, refetchItineraries]);

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  const handleExploreMap = useCallback(() => {
    const coords: [number, number] | null = thirdSpaceScore?.centroid
      ? [thirdSpaceScore.centroid.lng, thirdSpaceScore.centroid.lat]
      : null;
    if (!coords) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlyTo(coords, 15);
    router.navigate("/");
  }, [router, thirdSpaceScore?.centroid]);

  return (
    <Screen
      isScrollable={false}
      bannerDescription="Third Space Score & Adventures"
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
          isLoading={isLoading}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          thirdSpaceScore={thirdSpaceScore}
          popularStops={popularStops}
          groupedItineraries={groupedByIntention}
          onSearch={handleSearch}
          onExploreMap={
            thirdSpaceScore?.centroid ? handleExploreMap : undefined
          }
          onItineraryAdopted={refetchItineraries}
        />
      </View>
    </Screen>
  );
};

export default CityDetailScreen;
