import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  FadeIn,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

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
  location?: any;
  scanCount: number;
  confidenceScore?: number;
  status: EventStatus;
  thirdSpace?: ThirdSpace;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

interface SuccessScreenProps {
  imageUri: string;
  onNewScan: () => void;
  eventId?: string;
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
      return "#69db7c";
  }
};

const formatLocation = (point: any) => {
  if (!point || !point.coordinates) return "Not available";
  return `${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}`;
};

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ imageUri, onNewScan, eventId }) => {
  const router = useRouter();
  const checkmarkScale = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Animate checkmark
    checkmarkScale.value = withSequence(
      withSpring(1.2, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );

    // Animate card
    cardScale.value = withDelay(400, withSpring(1, { damping: 15 }));

    // Fetch event details if eventId is provided
    if (eventId) {
      fetchEventDetails();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      const data = await response.json();
      setEvent(data);
    } catch (error) {
      console.error("Error fetching event details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!event) return;

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/events/${event.id}/verify`, {
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

  const checkmarkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
    };
  });

  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: cardScale.value }],
    };
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#69db7c" />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerContainer}>
        <Animated.View style={[styles.successIndicator]} entering={ZoomIn.springify().damping(10)}>
          <Animated.View style={checkmarkStyle}>
            <Feather name="check" size={28} color="#69db7c" />
          </Animated.View>
        </Animated.View>

        <Animated.Text style={styles.successTitle} entering={FadeIn.delay(300).duration(500)}>
          Scan Successful
        </Animated.Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Document Preview Section */}
        <Animated.View
          style={[styles.card, cardStyle]}
          entering={SlideInDown.delay(400).springify().damping(15)}
        >
          <Text style={styles.sectionTitle}>Captured Document</Text>
          <View style={styles.imageContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={styles.placeholderImage}>
                <Feather name="file-text" size={32} color="#aaa" />
                <Text style={styles.placeholderText}>No preview available</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Event Details Section */}
        {event && (
          <Animated.View
            style={[styles.card, { marginTop: 16 }]}
            entering={SlideInDown.delay(600).springify().damping(15)}
          >
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

              {event.location && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Coordinates</Text>
                  <Text style={styles.value}>{formatLocation(event.location)}</Text>
                </View>
              )}

              {event.description && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Description</Text>
                  <Text style={styles.value}>{event.description}</Text>
                </View>
              )}

              {event.categories?.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Categories</Text>
                  <View style={styles.categoriesContainer}>
                    {event.categories?.map((category) => (
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
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onNewScan}>
          <Feather name="camera" size={18} color="#333" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>New Scan</Text>
        </TouchableOpacity>

        {event && event.status === EventStatus.PENDING ? (
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleVerify}>
            <Feather name="check-circle" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Verify Event</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push("/")}
          >
            <Feather name="home" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Go to Home</Text>
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
    borderBottomColor: "#444",
  },
  successIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#69db7c",
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
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
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "SpaceMono",
  },
  card: {
    backgroundColor: "#444",
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 12,
    fontFamily: "SpaceMono",
  },
  imageContainer: {
    width: "100%",
    height: 200,
    backgroundColor: "#333",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#aaa",
    marginTop: 8,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#555",
  },
  eventTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emoji: {
    fontSize: 20,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#aaa",
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  value: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "SpaceMono",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: "#555",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: "SpaceMono",
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: "#444",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#333",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  primaryButton: {
    backgroundColor: "#69db7c",
  },
  secondaryButton: {
    backgroundColor: "#e9ecef",
  },
  primaryButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  buttonIcon: {
    marginRight: 8,
  },
});
