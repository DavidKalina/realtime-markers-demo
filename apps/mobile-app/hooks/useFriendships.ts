import { useState, useEffect } from "react";
import apiClient, { Friend, FriendRequest } from "@/services/ApiClient";

interface UseFriendshipsResult {
  friends: Friend[];
  requests: (FriendRequest & { type: "incoming" | "outgoing" })[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useFriendships = (): UseFriendshipsResult => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { type: "incoming" | "outgoing" })[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [friendsResponse, incomingResponse, outgoingResponse] = await Promise.all([
        apiClient.getFriends(),
        apiClient.getPendingFriendRequests(),
        apiClient.getOutgoingFriendRequests(),
      ]);

      setFriends(friendsResponse);

      // Combine and label the requests
      const combinedRequests = [
        ...incomingResponse.map((req) => ({ ...req, type: "incoming" as const })),
        ...outgoingResponse.map((req) => ({ ...req, type: "outgoing" as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRequests(combinedRequests);
    } catch (err) {
      setError("Failed to load friends and requests. Please try again.");
      console.error("Error fetching friends and requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    friends,
    requests,
    isLoading,
    error,
    refetch: fetchData,
  };
};
