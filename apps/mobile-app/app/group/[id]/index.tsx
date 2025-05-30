import React, { useCallback, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Users, Calendar, MapPin, Info, Plus, Tag } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List, { ListItem } from "@/components/Layout/List";
import { useGroupDetails, useGroupActions } from "@/hooks/useGroupDetails";
import { useGroupEvents } from "@/hooks/useGroupEvents";
import Button from "@/components/Layout/Button";
import { EventType } from "@/types/types";

// Define types for our data
interface GroupMembership {
  id: string;
  role: string;
  user: {
    id: string;
    displayName: string;
    // add other user fields if needed
  };
}

interface Group {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  visibility: string;
  address: string;
  memberships: GroupMembership[];
  categories: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
  }[];
}

const GroupDetailsScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    group,
    loading: groupLoading,
    error: groupError,
    isAdmin,
  } = useGroupDetails(id);
  const { isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup } =
    useGroupActions(group);
  const {
    events,
    isLoading: eventsLoading,
    error: eventsError,
  } = useGroupEvents({
    groupId: id,
    pageSize: 5, // Only show 5 events in the preview
  });

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

  // Convert categories to list items
  const convertToCategoryItems = useCallback(
    (groupData: Group): ListItem[] =>
      groupData.categories?.map((category) => ({
        id: category.id,
        icon: Tag,
        title: category.name,
        description: category.description,
        badge: category.icon,
      })) || [],
    [],
  );

  // Convert members to list items
  const convertToMemberItems = useCallback(
    (groupData: Group): ListItem[] =>
      groupData.memberships?.slice(0, 5).map((membership: GroupMembership) => ({
        id: membership.user.id,
        icon: Users,
        title: membership.user.displayName,
        description: membership.role,
      })),
    [],
  );

  // Convert events to list items
  const convertToEventItems = useCallback(
    (events: EventType[]): ListItem[] =>
      events.map((event: EventType) => {
        // Format the date safely
        let dateStr = "No date";
        try {
          if (event.eventDate) {
            const date = new Date(event.eventDate);
            if (!isNaN(date.getTime())) {
              dateStr = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }
          }
        } catch (e) {
          console.warn("Error formatting event date:", e);
        }

        return {
          id: event.id,
          icon: Calendar,
          title: event.title,
          description: event.location || "No location",
          badge: dateStr,
        };
      }),
    [],
  );

  const handleCreateEvent = useCallback(() => {
    router.push({
      pathname: "/create-private-event",
      params: { groupId: id },
    });
  }, [router, id]);

  // Memoize sections
  const sections = useMemo(() => {
    if (!group) return [];

    const groupData = group as unknown as Group;
    const sections = [
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
        title: "Categories",
        icon: Tag,
        content: (
          <List
            items={convertToCategoryItems(groupData)}
            scrollable={false}
            emptyState={{
              icon: Tag,
              title: "No Categories",
              description: "Group categories will appear here",
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
            items={convertToEventItems(events)}
            onItemPress={(item) => {
              router.push(`/details?eventId=${item?.id}`);
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

    // Add event creation section for admins/owners
    if (isAdmin) {
      sections.push({
        title: "Event Management",
        icon: Plus,
        content: (
          <Button
            title="Create New Event"
            onPress={handleCreateEvent}
            variant="primary"
            size="large"
            fullWidth
          />
        ),
      });
    }

    return sections;
  }, [
    group,
    events,
    convertToInfoItems,
    convertToCategoryItems,
    convertToMemberItems,
    convertToEventItems,
    handleViewAllPress,
    router,
    isAdmin,
    handleCreateEvent,
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

  const loading = groupLoading || eventsLoading;
  const error = groupError || eventsError;

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
