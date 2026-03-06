import React, { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import LandingPageContent from "@/components/LandingPage/LandingPageContent";
import useThirdSpaceScore from "@/hooks/useThirdSpaceScore";
import useLandingPageData from "@/hooks/useLandingPageData";
import { apiClient } from "@/services/ApiClient";

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

  const currentUser = apiClient.getCurrentUser();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshLanding(), refetchScore()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLanding, refetchScore]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  return (
    <Screen
      isScrollable={false}
      bannerTitle={cityLabel}
      bannerDescription="Third Space Score & Events"
      showBackButton
      onBack={handleBack}
      noAnimation
    >
      <LandingPageContent
        data={landingData}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        thirdSpaceScore={thirdSpaceScore}
        currentUserId={currentUser?.id}
        topEvents={landingData?.topEvents}
      />
    </Screen>
  );
};

export default CityDetailScreen;
