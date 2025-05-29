import { useState, useEffect, useCallback } from "react";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import { EventScope } from "@/components/EventScopeSelector/EventScopeSelector";

interface UseEventScopeProps {
  initialScope?: EventScope;
  initialGroupId?: string;
}

interface UseEventScopeReturn {
  eventScope: EventScope;
  selectedGroupId?: string;
  ownedGroups: ClientGroup[];
  isLoading: boolean;
  error: string | null;
  handleScopeChange: (scope: EventScope, groupId?: string) => void;
  refreshGroups: () => Promise<void>;
}

export const useEventScope = ({
  initialScope = "FRIENDS",
  initialGroupId,
}: UseEventScopeProps = {}): UseEventScopeReturn => {
  const [eventScope, setEventScope] = useState<EventScope>(initialScope);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(
    initialGroupId,
  );
  const [ownedGroups, setOwnedGroups] = useState<ClientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.groups.getUserGroups();
      const currentUserId = apiClient.auth.getCurrentUser()?.id;

      // Filter groups where the current user is the owner
      const owned = response.groups.filter(
        (group) => group.ownerId === currentUserId,
      );

      setOwnedGroups(owned);

      // If we have owned groups and no group is selected, select the first one
      if (owned.length > 0 && !selectedGroupId && eventScope === "GROUP") {
        setSelectedGroupId(owned[0].id);
      }
    } catch (err) {
      setError("Failed to fetch user groups");
      console.error("Error fetching user groups:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventScope, selectedGroupId]);

  // Initial fetch
  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  const handleScopeChange = useCallback(
    (scope: EventScope, groupId?: string) => {
      setEventScope(scope);
      setSelectedGroupId(groupId);
    },
    [],
  );

  return {
    eventScope,
    selectedGroupId,
    ownedGroups,
    isLoading,
    error,
    handleScopeChange,
    refreshGroups: fetchUserGroups,
  };
};
