import { useState, useEffect } from "react";
import { Friend } from "@/services/ApiClient";
import { apiClient } from "@/services/ApiClient";

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

  const fetchFriends = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedFriends = await apiClient.friends.getFriends();
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
    refetch: fetchFriends,
  };
};
