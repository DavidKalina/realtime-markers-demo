import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import apiClient from "../../services/ApiClient";
import { styles } from "./styles";

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
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#4287f5" />
        <Text>Loading event details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContent}>
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
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centerContent}>
        <Text>No event details available</Text>
      </View>
    );
  }

  return (
    <View style={styles.actionContent}>
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleContainer}>
          <Text style={styles.emoji}>{event.emoji}</Text>
          <Text style={styles.eventTitle}>{event.title}</Text>
        </View>
        <StatusBadge />
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Date & Time</Text>
          <Text style={styles.value}>{formatDate(event.time)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{event.location}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Distance</Text>
          <Text style={styles.value}>{event.distance}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.value}>{event.description}</Text>
        </View>

        {event.categories && event.categories.length > 0 && (
          <View style={styles.detailRow}>
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
    </View>
  );
};

export default EventDetails;
