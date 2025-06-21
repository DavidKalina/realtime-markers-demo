import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import { EventType } from "@/types/types";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents: EventType[];
  popularCategories: Category[];
}

interface UseLandingPageDataProps {
  userLat?: number;
  userLng?: number;
  featuredLimit?: number;
  upcomingLimit?: number;
}

interface UseLandingPageDataReturn {
  landingData: LandingPageData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const useLandingPageData = ({
  userLat,
  userLng,
  featuredLimit = 5,
  upcomingLimit = 10,
}: UseLandingPageDataProps = {}): UseLandingPageDataReturn => {
  const [landingData, setLandingData] = useState<LandingPageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLandingData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await apiClient.events.getLandingPageData({
        userLat,
        userLng,
        featuredLimit,
        upcomingLimit,
      });

      setLandingData(data);
    } catch (err) {
      console.error("Error fetching landing page data:", err);
      setError("Failed to load landing page data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [userLat, userLng, featuredLimit, upcomingLimit]);

  const refresh = useCallback(async () => {
    await fetchLandingData();
  }, [fetchLandingData]);

  // Fetch data on mount and when dependencies change
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
