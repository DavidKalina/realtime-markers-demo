import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/services/ApiClient";
import {
  EventType,
  DiscoveredEventType,
  TrendingEventType,
} from "@/types/types";

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents: EventType[];
  communityEvents?: EventType[];
  justDiscoveredEvents?: DiscoveredEventType[];
  trendingEvents?: TrendingEventType[];
  popularCategories: Category[];
  availableCities: string[];
  resolvedCity?: string;
  topEvents?: EventType[];
}

interface UseLandingPageDataProps {
  userLat?: number;
  userLng?: number;
  featuredLimit?: number;
  upcomingLimit?: number;
  communityLimit?: number;
  discoveryLimit?: number;
  trendingLimit?: number;
  radius?: number;
  city?: string;
  includeCategoryIds?: string[];
  excludeCategoryIds?: string[];
}

interface UseLandingPageDataReturn {
  landingData: LandingPageData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Round to ~1.1 km — prevents GPS micro-drift from triggering refetches
const stabilize = (coord: number | undefined): number | undefined =>
  coord !== undefined ? Math.round(coord * 100) / 100 : undefined;

const useLandingPageData = ({
  userLat,
  userLng,
  featuredLimit = 5,
  upcomingLimit = 10,
  communityLimit = 5,
  discoveryLimit = 8,
  trendingLimit = 5,
  radius,
  city,
  includeCategoryIds,
  excludeCategoryIds,
}: UseLandingPageDataProps = {}): UseLandingPageDataReturn => {
  const [landingData, setLandingData] = useState<LandingPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const stableLat = stabilize(userLat);
  const stableLng = stabilize(userLng);

  const fetchLandingData = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    try {
      setIsLoading(true);
      setError(null);

      const data = await apiClient.events.getLandingPageData({
        userLat: stableLat,
        userLng: stableLng,
        featuredLimit,
        upcomingLimit,
        communityLimit,
        discoveryLimit,
        trendingLimit,
        radius,
        city,
        includeCategoryIds,
        excludeCategoryIds,
      });

      if (fetchId !== fetchIdRef.current) return;

      setLandingData(data);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      console.error("Error fetching landing page data:", err);
      setError("Failed to load landing page data. Please try again.");
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    stableLat,
    stableLng,
    featuredLimit,
    upcomingLimit,
    communityLimit,
    discoveryLimit,
    trendingLimit,
    radius,
    city,
    includeCategoryIds,
    excludeCategoryIds,
  ]);

  const refresh = useCallback(async () => {
    await fetchLandingData();
  }, [fetchLandingData]);

  useEffect(() => {
    fetchLandingData();
  }, [fetchLandingData]);

  return {
    landingData,
    isLoading,
    error,
    refresh,
  };
};

export default useLandingPageData;
