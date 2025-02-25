import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface EventDetails {
  id: string;
  emoji: string;
  title: string;
  description?: string;
  eventDate: string;
  address?: string;
  categories: { id: string; name: string }[];
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
}

interface MarkerDetailsBottomSheetProps {
  marker: {
    id: string;
    title: string;
    emoji: string;
  };
  onClose?: () => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const { height } = Dimensions.get("window");
const SNAP_POINTS = {
  CLOSED: 0,
  PEEK: height * 0.25,
  OPEN: height * 0.7,
};

const MarkerDetailsBottomSheet: React.FC<MarkerDetailsBottomSheetProps> = ({ marker, onClose }) => {
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const translateY = useRef(new Animated.Value(height)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const resetBottomSheet = Animated.timing(translateY, {
    toValue: 0,
    duration: 300,
    useNativeDriver: true,
  });

  const closeBottomSheet = () => {
    Animated.timing(translateY, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onClose && onClose());
  };

  // Set up pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Only allow dragging down
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // If dragged down far enough, close the sheet
          closeBottomSheet();
        } else {
          // Otherwise, snap back to open position
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    // Fetch data when marker changes
    const fetchEventDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/${marker.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch event details");
        }
        const data = await response.json();
        setEventDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventDetails();

    // Open the bottom sheet
    Animated.spring(translateY, {
      toValue: -SNAP_POINTS.PEEK,
      tension: 20,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [marker.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Combine the translation from the animated position and the pan gesture
  const translateYWithPan = Animated.add(translateY, panY);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: translateYWithPan }],
        },
      ]}
    >
      <View style={styles.sheet}>
        {/* Drag indicator */}
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <View style={styles.dragIndicator} />
        </View>

        {/* Header */}
        <View style={styles.titleAndClose}>
          <View style={styles.titleContainer}>
            <Text style={styles.emoji}>{marker.emoji}</Text>
            <Text numberOfLines={1} style={styles.title}>
              {marker.title}
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={closeBottomSheet} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#69db7c" style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          eventDetails && (
            <View style={styles.content}>
              {/* Status Badge */}
              <View style={[styles.statusBadge, styles[`status${eventDetails.status}`]]}>
                <Text style={styles.statusText}>{eventDetails.status}</Text>
              </View>

              {/* Date & Address */}
              <Text style={styles.date}>{formatDate(eventDetails.eventDate)}</Text>

              {/* Description */}
              {eventDetails.description && (
                <Text style={styles.description}>{eventDetails.description}</Text>
              )}

              {/* Categories */}
              {eventDetails.categories && eventDetails.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {eventDetails.categories.map((category) => (
                    <View key={category.id} style={styles.categoryChip}>
                      <Text style={styles.categoryText}>{category.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.directionsButton}>
                  <Text style={styles.buttonText}>Get Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareButton}>
                  <Text style={styles.buttonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: -SNAP_POINTS.PEEK,
    left: 0,
    right: 0,
    height: SNAP_POINTS.OPEN,
    zIndex: 100,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#333",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  dragHandle: {
    width: "100%",
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  dragIndicator: {
    width: 50,
    height: 5,
    backgroundColor: "#aaa",
    borderRadius: 5,
  },
  content: {
    flex: 1,
  },
  titleAndClose: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emoji: {
    fontSize: 24,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: "BungeeInline",
    fontWeight: "bold",
    color: "#FFF",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: "#FFF",
    fontSize: 18,
  },
  date: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: "#FFF",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: "#CCC",
    marginBottom: 15,
    lineHeight: 20,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "#444",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusPENDING: {
    backgroundColor: "#ffd43b",
  },
  statusVERIFIED: {
    backgroundColor: "#69db7c",
  },
  statusREJECTED: {
    backgroundColor: "#ff6b6b",
  },
  statusEXPIRED: {
    backgroundColor: "#868e96",
  },
  statusText: {
    color: "#000",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "bold",
  },
  loader: {
    marginVertical: 20,
  },
  errorText: {
    color: "#ff6b6b",
    textAlign: "center",
    marginVertical: 20,
    fontFamily: "SpaceMono",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: "auto",
    paddingTop: 20,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: "#69db7c",
    padding: 10,
    borderRadius: 5,
  },
  shareButton: {
    flex: 1,
    backgroundColor: "#4dabf7",
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    textAlign: "center",
    color: "#FFF",
    fontFamily: "BungeeInline",
    fontSize: 14,
  },
});

export default MarkerDetailsBottomSheet;
