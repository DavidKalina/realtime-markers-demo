import { useState, useCallback, useEffect } from "react";
import { SelectableItem } from "@/components/CheckboxGroup/CheckboxGroup";

// Extended Friend type with user details
export interface FriendWithDetails extends SelectableItem {
  userId: string;
  friendId: string;
  status: "ACCEPTED" | "PENDING" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  // User details (these would come from the API)
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
}

interface UseFetchMyFriendsReturn {
  friends: FriendWithDetails[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useFetchMyFriends = (): UseFetchMyFriendsReturn => {
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Note: This is a placeholder - the actual API call would depend on your backend
      // For now, we'll return an empty array since the friends API module doesn't exist
      const response: FriendWithDetails[] = [];

      setFriends(response);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch friends";
      setError(errorMessage);
      console.error("Error fetching friends:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  return {
    friends,
    isLoading,
    error,
    refetch: fetchFriends,
  };
};
