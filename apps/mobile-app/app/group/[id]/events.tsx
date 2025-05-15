import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Calendar, Clock, MapPin, Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

export default function GroupEventsScreen() {
  console.log("GroupEventsScreen component definition");
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log("GroupEventsScreen params:", { id });
  const router = useRouter();
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const isMounted = useRef(true);

  const loadGroupDetails = useCallback(async () => {
    console.log("loadGroupDetails called with id:", id);
    if (!id) {
      console.log("No id provided, returning early");
      return;
    }

    try {
      console.log("Setting loading state to true");
      setLoading(true);
      console.log("Fetching group and events data...");
      const [groupData, eventsData] = await Promise.all([
        apiClient.getGroupById(id),
        apiClient.getGroupEvents(id, { limit: 20 }),
      ]);
      console.log("Data fetched successfully:", {
        group: groupData ? "exists" : "null",
        eventsCount: eventsData.events.length,
        hasNextCursor: !!eventsData.nextCursor,
      });
      if (isMounted.current) {
        setGroup(groupData);
        setEvents(eventsData.events);
        setNextCursor(eventsData.nextCursor);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError("Failed to load group events");
        console.error("Error fetching group:", err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    console.log("GroupEventsScreen mounted with id:", id);
    loadGroupDetails();
    return () => {
      console.log("GroupEventsScreen unmounting");
      isMounted.current = false;
    };
  }, [loadGroupDetails]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const handleCreateEvent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to create event screen
    router.push(`/create-private-event?groupId=${id}`);
  }, []);

  const loadMoreEvents = useCallback(async () => {
    if (!nextCursor || loading) {
      console.log("Skipping loadMoreEvents:", { nextCursor, loading });
      return;
    }

    console.log("Loading more events with cursor:", nextCursor);
    try {
      const eventsData = await apiClient.getGroupEvents(id, {
        cursor: nextCursor,
        limit: 20,
      });

      console.log("Successfully loaded more events:", eventsData.events.length);
      if (isMounted.current) {
        setEvents((prev) => [...prev, ...eventsData.events]);
        setNextCursor(eventsData.nextCursor);
      }
    } catch (err) {
      console.error("Error loading more events:", err);
    }
  }, [id, nextCursor, loading]);

  const handleEventPress = useCallback(
    (eventId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/details?eventId=${eventId}`);
    },
    [router]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <ArrowLeft size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Group Events</Text>
      <TouchableOpacity onPress={handleCreateEvent} style={styles.createButton}>
        <Plus size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  const renderEventItem = ({ item }: { item: EventType }) => (
    <TouchableOpacity style={styles.eventItem} onPress={() => handleEventPress(item.id)}>
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleContainer}>
          <Text style={styles.eventEmoji}>{item.emoji || "📍"}</Text>
          <Text style={styles.eventTitle}>{item.title}</Text>
        </View>
        <View style={styles.attendeesBadge}>
          <Text style={styles.attendeesText}>{item.saveCount} saved</Text>
        </View>
      </View>
      <Text style={styles.eventDescription}>{item.description}</Text>
      <View style={styles.eventDetails}>
        <View style={styles.eventDetail}>
          <Calendar size={16} color={COLORS.accent} />
          <Text style={styles.eventDetailText}>{formatDate(item.eventDate)}</Text>
        </View>
        <View style={styles.eventDetail}>
          <Clock size={16} color={COLORS.accent} />
          <Text style={styles.eventDetailText}>{formatTime(item.eventDate)}</Text>
        </View>
        <View style={styles.eventDetail}>
          <MapPin size={16} color={COLORS.accent} />
          <Text style={styles.eventDetailText}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!nextCursor) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={COLORS.accent} />
      </View>
    );
  };

  if (loading && events.length === 0) {
    return (
      <ScreenLayout>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading Events...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error || !group) {
    return (
      <ScreenLayout>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || "Group not found"}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {renderHeader()}
      <Animated.View
        style={styles.container}
        entering={FadeInDown.duration(600)}
        layout={LinearTransition.springify()}
      >
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.eventsList}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreEvents}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      </Animated.View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backButton: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
  createButton: {
    padding: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  eventsList: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  eventItem: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  eventTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  eventEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    color: COLORS.textPrimary,
    flex: 1,
  },
  attendeesBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  attendeesText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  eventDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginBottom: 12,
    lineHeight: 20,
  },
  eventDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  eventDetail: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  eventDetailText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
