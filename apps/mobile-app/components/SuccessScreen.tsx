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
  SlideInUp,
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

const formatLocation = (point: any) => {
  if (!point || !point.coordinates) return "Not available";
  return `${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}`;
};

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ imageUri, onNewScan, eventId }) => {
  const router = useRouter();
  const checkmarkScale = useSharedValue(0);
  const cardScale = useSharedValue(0.95);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Animate checkmark with a more subtle animation
    checkmarkScale.value = withSequence(
      withSpring(1.1, { damping: 12 }),
      withSpring(1, { damping: 15 })
    );

    // Animate card with a smoother transition
    cardScale.value = withDelay(300, withSpring(1, { damping: 15 }));

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
      opacity: cardScale.value,
    };
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dabf7" />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerContainer}>
        <Animated.View style={[styles.successIndicator]} entering={ZoomIn.springify().damping(12)}>
          <Animated.View style={checkmarkStyle}>
            <Feather name="check-circle" size={24} color="#37D05C" />
          </Animated.View>
        </Animated.View>

        <Animated.Text style={styles.successTitle} entering={FadeIn.delay(200).duration(400)}>
          Scan Successful
        </Animated.Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Document Preview Section */}
        <Animated.View
          style={[styles.card, cardStyle]}
          entering={SlideInUp.delay(300).springify().damping(15)}
        >
          <View style={styles.imageContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={styles.placeholderImage}>
                <Feather name="file-text" size={24} color="#aaa" />
                <Text style={styles.placeholderText}>No preview available</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Event Details Section */}
        {event && (
          <Animated.View
            style={[styles.card, { marginTop: 12 }]}
            entering={SlideInUp.delay(400).springify().damping(15)}
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
          <Feather name="camera" size={16} color="#f8f9fa" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>New Scan</Text>
        </TouchableOpacity>

        {event && event.status === EventStatus.PENDING ? (
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleVerify}>
            <Feather name="check-circle" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Verify Event</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push("/")}
          >
            <Feather name="home" size={16} color="#FFFFFF" style={styles.buttonIcon} />
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
    borderBottomColor: "#3a3a3a",
  },
  successIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#37D05C",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  scrollView: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
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
  card: {
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#333",
    borderRadius: 6,
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
    fontSize: 12,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#4a4a4a",
  },
  eventTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emoji: {
    fontSize: 18,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#f8f9fa",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#adb5bd",
    marginBottom: 3,
    fontFamily: "SpaceMono",
  },
  value: {
    fontSize: 14,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 3,
  },
  categoryBadge: {
    backgroundColor: "#4a4a4a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 6,
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
    paddingHorizontal: 14,
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
  buttonIcon: {
    marginRight: 6,
  },
});
