import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Users, Star, Map } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List from "@/components/Layout/List";

const GroupsScreen = () => {
  const router = useRouter();

  const sections = useMemo(
    () => [
      {
        title: "Recent Groups",
        icon: Users,
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
