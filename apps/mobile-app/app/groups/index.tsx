import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Users, Star, Map } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List, { ListItem } from "@/components/Layout/List";
import { useRecentGroups } from "@/hooks/useRecentGroups";
import { ActivityIndicator, View } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";

const RecentGroupsSection = () => {
  const router = useRouter();
  const { groups, isLoading, error } = useRecentGroups({
    initialLimit: 3, // Match the maxItems in List component
  });

  const listItems = useMemo<ListItem[]>(() => {
    return groups.map((group) => ({
      id: group.id,
      icon: Users,
      title: group.name,
      description: group.description,
      badge: group.memberCount,
      onPress: () => {
        router.push({
          pathname: "/group/[id]",
          params: { id: group.id },
        });
      },
    }));
  }, [groups, router]);

  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <List
        items={[]}
        emptyState={{
          icon: Users,
          title: "Error loading groups",
          description: error,
        }}
      />
    );
  }

  return (
    <List
      items={listItems}
      maxItems={3}
      onViewAllPress={() =>
        router.push({
          pathname: "/groups/list",
          params: { filter: "recent" },
        })
      }
      emptyState={{
        icon: Users,
        title: "No recent groups",
        description: "Groups you've recently interacted with will appear here",
      }}
    />
  );
};

const GroupsScreen = () => {
  const router = useRouter();

  const sections = useMemo(
    () => [
      {
        title: "Recent Groups",
        icon: Users,
        content: <RecentGroupsSection />,
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
            items={[]}
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
            items={[]}
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
      onBack={() => router.back()}
      bannerTitle="Groups"
      bannerDescription="Discover and join groups in your area"
      bannerEmoji="👥"
      sections={sections}
      footerButtons={footerButtons}
    />
  );
};

export default GroupsScreen;
