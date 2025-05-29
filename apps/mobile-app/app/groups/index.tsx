import List, { ListItem } from "@/components/Layout/List";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useUserLocation } from "@/contexts/LocationContext";
import { useNearbyGroups } from "@/hooks/useNearbyGroups";
import { useRouter } from "expo-router";
import { Map, Users } from "lucide-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

const NearbyGroupsSection = () => {
  const router = useRouter();
  const { userLocation, isLoadingLocation, getUserLocation } =
    useUserLocation();
  const { groups, isLoading, error, refresh } = useNearbyGroups({
    initialLimit: 10,
    coordinates: userLocation
      ? { lat: userLocation[1], lng: userLocation[0] }
      : { lat: 0, lng: 0 },
    autoFetch: !!userLocation,
  });

  // Request location if not available
  React.useEffect(() => {
    if (!userLocation && !isLoadingLocation) {
      Alert.alert(
        "Location Access Required",
        "Please enable location access to see nearby groups.",
        [
          {
            text: "Enable Location",
            onPress: getUserLocation,
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
      );
    }
  }, [userLocation, isLoadingLocation, getUserLocation]);

  const listItems = useMemo<ListItem[]>(() => {
    if (!userLocation) return [];
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
  }, [groups, router, userLocation]);

  if (isLoadingLocation || isLoading) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!userLocation) {
    return (
      <List
        items={[]}
        emptyState={{
          icon: Map,
          title: "Location Access Required",
          description: "Enable location access to see nearby groups",
        }}
        scrollable
        refreshing={isLoading}
        onRefresh={refresh}
      />
    );
  }

  if (error) {
    return (
      <List
        items={[]}
        emptyState={{
          icon: Map,
          title: "Error loading groups",
          description: error,
        }}
        scrollable
        refreshing={isLoading}
        onRefresh={refresh}
      />
    );
  }

  return (
    <List
      items={listItems}
      scrollable
      refreshing={isLoading}
      onRefresh={refresh}
      emptyState={{
        icon: Map,
        title: "No Nearby Groups",
        description: "Groups near your location will appear here",
      }}
    />
  );
};

const GroupsScreen = () => {
  const router = useRouter();

  const sections = useMemo(
    () => [
      {
        title: "Nearby Groups",
        icon: Map,
        content: <NearbyGroupsSection />,
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
