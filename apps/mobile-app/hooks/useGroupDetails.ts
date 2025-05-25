import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import { useSharedValue } from "react-native-reanimated";
import { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

export const useGroupDetails = (groupId: string) => {
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;

    try {
      setLoading(true);
      const groupData = await apiClient.groups.getGroupById(groupId);
      if (isMounted.current) {
        setGroup(groupData);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError("Failed to load group details");
        console.error("Error fetching group:", err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [groupId]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  const isAdmin = group?.ownerId === apiClient.auth.getCurrentUser()?.id;

  return {
    group,
    loading,
    error,
    isAdmin,
    refreshGroup: loadGroupDetails,
  };
};

export const useGroupActions = (group: ClientGroup | null) => {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLeaveGroup = useCallback(async () => {
    if (!group || isLeaving) return;

    try {
      setIsLeaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.groups.leaveGroup(group.id);
      router.back();
    } catch (err) {
      console.error("Error leaving group:", err);
    } finally {
      setIsLeaving(false);
    }
  }, [group, isLeaving, router]);

  const handleDeleteGroup = useCallback(async () => {
    if (!group || isDeleting) return;

    try {
      setIsDeleting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.groups.deleteGroup(group.id);
      router.back();
    } catch (err) {
      console.error("Error deleting group:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [group, isDeleting, router]);

  return {
    isLeaving,
    isDeleting,
    handleLeaveGroup,
    handleDeleteGroup,
  };
};

export const useGroupScroll = () => {
  const scrollY = useSharedValue(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  return {
    scrollY,
    handleScroll,
  };
};
