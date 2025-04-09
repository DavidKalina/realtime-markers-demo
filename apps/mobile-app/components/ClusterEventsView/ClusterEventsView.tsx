import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useLocationStore } from "@/stores/useLocationStore";
import apiClient from "@/services/ApiClient";
import ClusterHubView from "./ClusterHubView";
import type { EventType } from "@/types/types";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2a2a2a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

const ClusterEventsView: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hubData, setHubData] = useState<{
    featuredEvent: EventType | null;
    eventsByCategory: {
      category: { id: string; name: string };
      events: EventType[];
    }[];
    eventsByLocation: {
      location: string;
      events: EventType[];
    }[];
    eventsToday: EventType[];
  } | null>(null);

  const markers = useLocationStore((state) => state.markers);
  const selectedItem = useLocationStore((state) => state.selectedItem);

  const fetchClusterHubData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get marker IDs from the selected cluster or all markers
      const markerIds =
        selectedItem?.type === "cluster"
          ? (selectedItem as any).childrenIds || []
          : markers.map((marker) => marker.id);

      if (markerIds.length === 0) {
        throw new Error("No markers found");
      }

      const data = await apiClient.getClusterHubData(markerIds);
      setHubData(data);
    } catch (error) {
      console.error("Error fetching cluster hub data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [markers, selectedItem]);

  useEffect(() => {
    fetchClusterHubData();
  }, [fetchClusterHubData]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#93c5fd" />
      </View>
    );
  }

  if (!hubData) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ClusterHubView hubData={hubData} />
    </View>
  );
};

export default ClusterEventsView;
