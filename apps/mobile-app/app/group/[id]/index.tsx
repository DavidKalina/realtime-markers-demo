import React, { useCallback, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Users, Calendar, MapPin, Info } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List, { ListItem } from "@/components/Layout/List";
import { useGroupDetails, useGroupActions } from "@/hooks/useGroupDetails";

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

const GroupDetailsScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { group, loading, error, isAdmin } = useGroupDetails(id);
  const { isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup } =
    useGroupActions(group);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const handleViewAllPress = useCallback(
    (type: "members" | "events") => {
      router.push(`/group/${id}/${type}`);
    },
    [router, id],
  );

  // Convert group info to list items
  const convertToInfoItems = useCallback(
    (groupData: Group): ListItem[] => [
      {
        id: "visibility",
        icon: Info,
        title: "Visibility",
        description: groupData.visibility,
      },
      {
        id: "address",
        icon: MapPin,
        title: "Location",
        description: groupData.address,
      },
    ],
    [],
  );

  // Convert members to list items
  const convertToMemberItems = useCallback(
    (groupData: Group): ListItem[] =>
      groupData.members?.slice(0, 5).map((member: GroupMember) => ({
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
      groupData.events?.slice(0, 5).map((event: GroupEvent) => ({
        id: event.id,
        icon: Calendar,
        title: event.title,
        description: event.location,
        badge: event.date,
      })),
    [],
  );

  // Memoize sections
  const sections = useMemo(() => {
    if (!group) return [];

    const groupData = group as unknown as Group;
    return [
      {
        title: "Group Info",
        icon: Info,
        content: (
          <List
            items={convertToInfoItems(groupData)}
            scrollable={false}
            emptyState={{
              icon: Info,
              title: "No Group Info",
              description: "Group information will appear here",
            }}
          />
        ),
      },
      {
        title: "Members",
        icon: Users,
        content: (
          <List
            items={convertToMemberItems(groupData)}
            onItemPress={(item) => {
              // Handle member press if needed
              console.log("Member pressed:", item.id);
            }}
            scrollable={false}
            onViewAllPress={() => handleViewAllPress("members")}
            emptyState={{
              icon: Users,
              title: "No Members",
              description: "Group members will appear here",
            }}
          />
        ),
        onPress: () => handleViewAllPress("members"),
        actionButton: {
          label: "View All",
          onPress: () => handleViewAllPress("members"),
          variant: "outline" as const,
        },
      },
      {
        title: "Events",
        icon: Calendar,
        content: (
          <List
            items={convertToEventItems(groupData)}
            onItemPress={(item) => {
              router.push({
                pathname: "/details",
                params: { id: item.id },
              });
            }}
            scrollable={false}
            onViewAllPress={() => handleViewAllPress("events")}
            emptyState={{
              icon: Calendar,
              title: "No Events",
              description: "Group events will appear here",
            }}
          />
        ),
        onPress: () => handleViewAllPress("events"),
        actionButton: {
          label: "View All",
          onPress: () => handleViewAllPress("events"),
          variant: "outline" as const,
        },
      },
    ];
  }, [
    group,
    convertToInfoItems,
    convertToMemberItems,
    convertToEventItems,
    handleViewAllPress,
    router,
  ]);

  // Memoize footer buttons
  const footerButtons = useMemo(
    () => [
      {
        label: isAdmin ? "Delete Group" : "Leave Group",
        onPress: isAdmin ? handleDeleteGroup : handleLeaveGroup,
        variant: "error" as const,
        loading: isAdmin ? isDeleting : isLeaving,
      },
    ],
    [isAdmin, handleDeleteGroup, handleLeaveGroup, isDeleting, isLeaving],
  );

  if (loading) {
    return (
      <Screen
        onBack={handleBack}
        bannerTitle="Loading..."
        bannerDescription="Please wait while we load the group details"
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
      bannerTitle={group.name}
      bannerDescription={group.description}
      bannerEmoji={group.emoji || "👥"}
      sections={sections}
      footerButtons={footerButtons}
    />
  );
};

export default GroupDetailsScreen;
