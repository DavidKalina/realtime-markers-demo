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
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, SlideInUp } from "react-native-reanimated";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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
      return "#40c057";
    case EventStatus.PENDING:
      return "#4dabf7";
    case EventStatus.REJECTED:
      return "#fa5252";
    case EventStatus.EXPIRED:
      return "#868e96";
    default:
      return "#40c057";
  }
};

const formatLocation = (point: Point) => {
  return `${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}`;
};

const DetailsScreen: React.FC = () => {
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
        <ActivityIndicator size="large" color="#4dabf7" />
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <Animated.View style={styles.card} entering={SlideInUp.delay(100).springify().damping(15)}>
          <View style={styles.eventHeader}>
            <View style={styles.eventTitleContainer}>
              <Text style={styles.emoji}>{event.emoji}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
              <Text style={styles.statusText}>{event.status}</Text>
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <Animated.View style={styles.detailRow} entering={FadeIn.delay(200).duration(400)}>
              <Text style={styles.label}>Date & Time</Text>
              <Text style={styles.value}>{formatDate(event.eventDate)}</Text>
            </Animated.View>

            {event.address && (
              <Animated.View style={styles.detailRow} entering={FadeIn.delay(250).duration(400)}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>{event.address}</Text>
              </Animated.View>
            )}

            <Animated.View style={styles.detailRow} entering={FadeIn.delay(300).duration(400)}>
              <Text style={styles.label}>Coordinates</Text>
              <Text style={styles.value}>{formatLocation(event.location)}</Text>
            </Animated.View>

            {event.description && (
              <Animated.View style={styles.detailRow} entering={FadeIn.delay(350).duration(400)}>
                <Text style={styles.label}>Description</Text>
                <Text style={styles.value}>{event.description}</Text>
              </Animated.View>
            )}

            {event.categories?.length > 0 && (
              <Animated.View style={styles.detailRow} entering={FadeIn.delay(400).duration(400)}>
                <Text style={styles.label}>Categories</Text>
                <View style={styles.categoriesContainer}>
                  {event.categories?.map((category) => (
                    <View key={category.id} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{category.name}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {event.thirdSpace && (
              <Animated.View style={styles.detailRow} entering={FadeIn.delay(450).duration(400)}>
                <Text style={styles.label}>Third Space</Text>
                <Text style={styles.value}>{event.thirdSpace.name}</Text>
              </Animated.View>
            )}

            <Animated.View style={styles.detailRow} entering={FadeIn.delay(500).duration(400)}>
              <Text style={styles.label}>Scan Count</Text>
              <Text style={styles.value}>{event.scanCount}</Text>
            </Animated.View>

            {event.confidenceScore !== undefined && (
              <Animated.View style={styles.detailRow} entering={FadeIn.delay(550).duration(400)}>
                <Text style={styles.label}>Confidence Score</Text>
                <Text style={styles.value}>{(event.confidenceScore * 100).toFixed(1)}%</Text>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push("/")}
        >
          <Feather name="home" size={16} color="#f8f9fa" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Home</Text>
        </TouchableOpacity>

        {event.status === EventStatus.PENDING && (
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleVerify}>
            <Feather name="check-circle" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Verify Event</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#fa5252",
    marginBottom: 20,
    fontFamily: "SpaceMono",
  },
  card: {
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#4a4a4a",
  },
  eventTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emoji: {
    fontSize: 24,
    marginRight: 10,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa",
    flex: 1,
    fontFamily: "SpaceMono",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: "#adb5bd",
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  value: {
    fontSize: 15,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: "#4a4a4a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#333",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  primaryButton: {
    backgroundColor: "#4dabf7",
  },
  secondaryButton: {
    backgroundColor: "#4a4a4a",
    borderWidth: 1,
    borderColor: "#5a5a5a",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  secondaryButtonText: {
    color: "#f8f9fa",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  buttonText: {},
  buttonIcon: {
    marginRight: 8,
  },
});

export default DetailsScreen;
