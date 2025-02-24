import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type Point } from "geojson";

const API_URL = `https://c8b6-69-162-231-94.ngrok-free.app/api`;

interface Category {
  id: string;
  name: string;
}

interface ThirdSpace {
  id: string;
  name: string;
}

enum EventStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

interface Event {
  id: string;
  emoji: string;
  title: string;
  description?: string;
  eventDate: string;
  address?: string;
  location: Point;
  scanCount: number;
  confidenceScore?: number;
  status: EventStatus;
  thirdSpace?: ThirdSpace;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status: EventStatus) => {
  switch (status) {
    case EventStatus.VERIFIED:
      return "#4CAF50";
    case EventStatus.PENDING:
      return "#FFC107";
    case EventStatus.REJECTED:
      return "#F44336";
    case EventStatus.EXPIRED:
      return "#9E9E9E";
    default:
      return "#000000";
  }
};

const formatLocation = (point: Point) => {
  return `${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}`;
};

const ResultsScreen: React.FC = () => {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const { eventId } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/events/${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      const data = await response.json();
      setEvent(data);
    } catch (error) {
      Alert.alert("Error", "Failed to load event details. Please try again.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const response = await fetch(`${API_URL}/events/${eventId}/verify`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to verify event");
      }
      Alert.alert("Success", "Event verified successfully!");
      router.push("/");
    } catch (error) {
      Alert.alert("Error", "Failed to verify event. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>{event.emoji}</Text>
          <Text style={styles.title}>{event.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
            <Text style={styles.statusText}>{event.status}</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date & Time</Text>
            <Text style={styles.value}>{formatDate(event.eventDate)}</Text>
          </View>

          {event.address && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{event.address}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.label}>Coordinates</Text>
            <Text style={styles.value}>{formatLocation(event.location)}</Text>
          </View>

          {event.description && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.value}>{event.description}</Text>
            </View>
          )}

          {event.categories.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Categories</Text>
              <View style={styles.categoriesContainer}>
                {event.categories.map((category) => (
                  <View key={category.id} style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {event.thirdSpace && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Third Space</Text>
              <Text style={styles.value}>{event.thirdSpace.name}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.label}>Scan Count</Text>
            <Text style={styles.value}>{event.scanCount}</Text>
          </View>

          {event.confidenceScore !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Confidence Score</Text>
              <Text style={styles.value}>{(event.confidenceScore * 100).toFixed(1)}%</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Scan Again</Text>
        </TouchableOpacity>

        {event.status === EventStatus.PENDING && (
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleVerify}>
            <Text style={[styles.buttonText, styles.primaryButtonText]}>Verify Event</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#000000",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#F44336",
    marginBottom: 20,
  },
  detailsContainer: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: "#000000",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    color: "#000000",
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#000000",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  primaryButtonText: {
    color: "#ffffff",
  },
});

export default ResultsScreen;
