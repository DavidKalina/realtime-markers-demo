import React, { useCallback, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Users, Calendar } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List, { ListItem } from "@/components/Layout/List";
import { useGroupDetails } from "@/hooks/useGroupDetails";

// Define types for our data
interface GroupMember {
  id: string;
  name: string;
  role: string;
}

interface GroupEvent {
  id: string;
  title: string;
  location: string;
  date: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  visibility: string;
  address: string;
  members: GroupMember[];
  events: GroupEvent[];
}

const GroupListScreen = () => {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const router = useRouter();
  const { group, loading, error } = useGroupDetails(id);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const handleMemberPress = useCallback((item: ListItem) => {
    // Handle member press - could navigate to profile or show member details
    console.log("Member pressed:", item.id);
  }, []);

  const handleEventPress = useCallback(
    (item: ListItem) => {
      router.push({
        pathname: "/details",
        params: { id: item.id },
      });
    },
    [router],
  );

  // Convert members to list items
  const convertToMemberItems = useCallback(
    (groupData: Group): ListItem[] =>
      groupData.members.map((member: GroupMember) => ({
        id: member.id,
        icon: Users,
        title: member.name,
        description: member.role,
      })),
    [],
  );

  // Convert events to list items
  const convertToEventItems = useCallback(
    (groupData: Group): ListItem[] =>
      groupData.events.map((event: GroupEvent) => ({
        id: event.id,
        icon: Calendar,
        title: event.title,
        description: event.location,
        badge: event.date,
      })),
    [],
  );

  // Memoize list items based on type
  const listItems = useMemo(() => {
    if (!group) return [];

    const groupData = group as unknown as Group;
    return type === "members"
      ? convertToMemberItems(groupData)
      : convertToEventItems(groupData);
  }, [group, type, convertToMemberItems, convertToEventItems]);

  // Memoize screen configuration based on type
  const screenConfig = useMemo(() => {
    const isMembers = type === "members";
    return {
      title: isMembers ? "Group Members" : "Group Events",
      description: isMembers
        ? "View and manage group members"
        : "View all group events",
      emoji: isMembers ? "👥" : "📅",
      icon: isMembers ? Users : Calendar,
      onItemPress: isMembers ? handleMemberPress : handleEventPress,
      emptyState: {
        icon: isMembers ? Users : Calendar,
        title: isMembers ? "No Members" : "No Events",
        description: isMembers
          ? "Group members will appear here"
          : "Group events will appear here",
      },
    };
  }, [type, handleMemberPress, handleEventPress]);

  if (loading) {
    return (
      <Screen
        onBack={handleBack}
        bannerTitle="Loading..."
        bannerDescription="Please wait while we load the list"
        bannerEmoji="⏳"
        sections={[]}
      />
    );
  }

  if (error || !group) {
    return (
      <Screen
        onBack={handleBack}
        bannerTitle="Error"
        bannerDescription={error || "Group not found"}
        bannerEmoji="❌"
        sections={[]}
      />
    );
  }

  return (
    <Screen
      onBack={handleBack}
      bannerTitle={screenConfig.title}
      bannerDescription={screenConfig.description}
      bannerEmoji={screenConfig.emoji}
      sections={[
        {
          title: screenConfig.title,
          icon: screenConfig.icon,
          content: (
            <List
              items={listItems}
              onItemPress={screenConfig.onItemPress}
              emptyState={screenConfig.emptyState}
            />
          ),
        },
      ]}
    />
  );
};

export default GroupListScreen;
