import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import apiClient from "../../services/ApiClient";
import { EventDetailsSkeleton } from "./EventDetailsSkeleton";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { styles } from "./styles";
import { styles as globalStyles } from "@/components/globalStyles";

interface EventDetailsProps {
  eventId: string;
}

const EventDetails: React.FC<EventDetailsProps> = ({ eventId }) => {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch event details when eventId changes
  useEffect(() => {
    let isMounted = true;

    const fetchEventDetails = async () => {
      if (!eventId) return;

      setLoading(true);
      setError(null);

      try {
        const eventData = await apiClient.getEventById(eventId);
        if (isMounted) {
          setEvent(eventData);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
          );
          console.error("Error fetching event details:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEventDetails();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Status badge component for details view
  const StatusBadge = () => (
    <View>
      <Text style={styles.statusText}>VERIFIED</Text>
    </View>
  );

  // Format the event time (helper for details view)
  const formatDate = (timeString: string) => {
    return timeString;
  };

  if (loading) {
    return <EventDetailsSkeleton />;
  }

  if (error) {
    return (
      <Animated.View style={styles.centerContent} entering={FadeIn.duration(300)}>
        <Text>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setEvent(null);
            setError(null);
            setLoading(true);
            apiClient
              .getEventById(eventId)
              .then((data) => setEvent(data))
              .catch((err) =>
                setError(
                  `Failed to load event details: ${
                    err instanceof Error ? err.message : "Unknown error"
                  }`
                )
              )
              .finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (!event) {
    return (
      <Animated.View style={styles.centerContent} entering={FadeIn.duration(300)}>
        <Text>No event details available</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={globalStyles.actionContent}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleContainer}>
          <Text style={globalStyles.eventEmoji}>{event.emoji}</Text>
          <Text style={styles.eventTitle}>{event.title}</Text>
        </View>
        <StatusBadge />
      </View>

      <View style={styles.detailsContainer}>
        <View style={globalStyles.detailRow}>
          <Text style={styles.label}>Date & Time</Text>
          <Text style={styles.value}>{formatDate(event.time)}</Text>
        </View>

        <View style={globalStyles.detailRow}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{event.location}</Text>
        </View>

        <View style={globalStyles.detailRow}>
          <Text style={styles.label}>Distance</Text>
          <Text style={styles.value}>{event.distance}</Text>
        </View>

        <View style={globalStyles.detailRow}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.value}>{event.description}</Text>
        </View>

        {event.categories && event.categories.length > 0 && (
          <View style={globalStyles.detailRow}>
            <Text style={styles.label}>Categories</Text>
            <View style={styles.categoriesContainer}>
              {event.categories.map((category: any, index: number) => (
                <View key={index} style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export default EventDetails;
