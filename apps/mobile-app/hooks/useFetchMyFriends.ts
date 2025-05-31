import { useState, useEffect, useRef } from "react";
import { Friend } from "@/services/ApiClient";
import { apiClient } from "@/services/ApiClient";

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Global cache instance
const globalCache: CacheEntry<Friend[]> = {
  data: [],
  timestamp: 0,
};

// Request queue to prevent concurrent requests
let requestQueue: Promise<void> = Promise.resolve();
const queueRequest = <T>(request: () => Promise<T>): Promise<T> => {
  const result = requestQueue.then(
    () => request(),
    () => request(),
  );
  requestQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

interface UseFetchMyFriendsResult {
  friends: Friend[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useFetchMyFriends = (): UseFetchMyFriendsResult => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef(globalCache);

  const fetchFriends = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const now = Date.now();
      const cache = cacheRef.current;

      // Check if cache is valid and not forcing refresh
      if (!forceRefresh && now - cache.timestamp < CACHE_TTL) {
        setFriends(cache.data);
        setIsLoading(false);
        return;
      }

      // Queue the request
      const fetchedFriends = await queueRequest(async () => {
        const data = await apiClient.friends.getFriends();
        cache.data = data;
        cache.timestamp = now;
        return data;
      });

      setFriends(fetchedFriends);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch friends"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  return {
    friends,
    isLoading,
    error,
    refetch: () => fetchFriends(true),
  };
};
