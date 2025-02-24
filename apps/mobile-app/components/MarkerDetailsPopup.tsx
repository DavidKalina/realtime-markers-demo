import { useFloatingAnimation } from "@/hooks/useFloatingAnimation";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

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

interface MarkerDetailsPopupProps {
  marker: {
    id: string;
    title: string;
    emoji: string;
  };
  onClose?: () => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const MarkerDetailsPopup: React.FC<MarkerDetailsPopupProps> = ({ marker, onClose }) => {
  const { floatingStyle } = useFloatingAnimation();
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <Animated.View
      style={styles.container}
      entering={ZoomIn.duration(500)}
      exiting={ZoomOut.duration(500)}
    >
      <Animated.View style={[floatingStyle]}>
        <View style={styles.questDetails}>
          {/* Header */}
          <View style={styles.titleAndClose}>
            <View style={styles.titleContainer}>
              <Text style={styles.emoji}>{marker.emoji}</Text>
              <Text numberOfLines={1} style={styles.title}>
                {marker.title}
              </Text>
            </View>
            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
              <>
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
              </>
            )
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  questDetails: {
    borderRadius: 10,
    padding: 20,
    backgroundColor: "#333",
    justifyContent: "space-between",
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
  address: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: "#CCC",
    marginBottom: 12,
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

export default MarkerDetailsPopup;
