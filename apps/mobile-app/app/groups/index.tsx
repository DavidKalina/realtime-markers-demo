import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Users, Star, Map } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List from "@/components/Layout/List";

const GroupsScreen = () => {
  const router = useRouter();

  // Mock data for groups - replace with real data later
  const recentGroups = [
    {
      id: "1",
      icon: Users,
      title: "Photography Enthusiasts",
      description: "Share and discuss photography tips",
      badge: "New",
    },
    {
      id: "2",
      icon: Users,
      title: "Hiking Club",
      description: "Weekly hiking meetups",
    },
    {
      id: "3",
      icon: Users,
      title: "Tech Meetup",
      description: "Local tech community",
    },
  ];

  const favoriteGroups = [
    {
      id: "4",
      icon: Star,
      title: "Coffee Lovers",
      description: "Discover new coffee shops",
    },
    {
      id: "5",
      icon: Star,
      title: "Book Club",
      description: "Monthly book discussions",
    },
  ];

  const nearbyGroups = [
    {
      id: "6",
      icon: Map,
      title: "Yoga Studio",
      description: "0.5 miles away",
      badge: "2 new",
    },
    {
      id: "7",
      icon: Map,
      title: "Art Gallery",
      description: "1.2 miles away",
    },
  ];

  const sections = useMemo(
    () => [
      {
        title: "Recent Groups",
        icon: Users,
        content: (
          <List
            items={recentGroups}
            onItemPress={(item) =>
              router.push({
                pathname: "/group/[id]",
                params: { id: item.id },
              })
            }
            onViewAllPress={() =>
              router.push({
                pathname: "/groups/list",
                params: { filter: "recent" },
              })
            }
            maxItems={3}
            emptyState={{
              icon: Users,
              title: "No Recent Groups",
              description: "Groups you've recently visited will appear here",
            }}
          />
        ),
        actionButton: {
          label: "View All",
          onPress: () =>
            router.push({
              pathname: "/groups/list",
              params: { filter: "recent" },
            }),
          variant: "ghost" as const,
        },
      },
      {
        title: "Favorite Groups",
        icon: Star,
        content: (
          <List
            items={favoriteGroups}
            onItemPress={(item) =>
              router.push({
                pathname: "/group/[id]",
                params: { id: item.id },
              })
            }
            onViewAllPress={() =>
              router.push({
                pathname: "/groups/list",
                params: { filter: "favorites" },
              })
            }
            maxItems={2}
            emptyState={{
              icon: Star,
              title: "No Favorite Groups",
              description: "Groups you've favorited will appear here",
            }}
          />
        ),
        actionButton: {
          label: "Manage",
          onPress: () =>
            router.push({
              pathname: "/groups/list",
              params: { filter: "favorites" },
            }),
          variant: "secondary" as const,
        },
      },
      {
        title: "Nearby Groups",
        icon: Map,
        content: (
          <List
            items={nearbyGroups}
            onItemPress={(item) =>
              router.push({
                pathname: "/group/[id]",
                params: { id: item.id },
              })
            }
            onViewAllPress={() =>
              router.push({
                pathname: "/groups/list",
                params: { filter: "nearby" },
              })
            }
            maxItems={2}
            emptyState={{
              icon: Map,
              title: "No Nearby Groups",
              description: "Groups near your location will appear here",
            }}
          />
        ),
        actionButton: {
          label: "Explore",
          onPress: () =>
            router.push({
              pathname: "/groups/list",
              params: { filter: "nearby" },
            }),
          variant: "primary" as const,
        },
      },
    ],
    [router],
  );

  const footerButtons = useMemo(
    () => [
      {
        label: "Create Group",
        onPress: () => router.push("/create-group"),
        variant: "primary" as const,
      },
      {
        label: "Search Groups",
        onPress: () => router.push("/groups/list"),
        variant: "outline" as const,
      },
    ],
    [router],
  );

  return (
    <Screen
      bannerTitle="Groups"
      bannerDescription="Discover and join groups in your area"
      bannerEmoji="👥"
      sections={sections}
      footerButtons={footerButtons}
    />
  );
};

export default GroupsScreen;
