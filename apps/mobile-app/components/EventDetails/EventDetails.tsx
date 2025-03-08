import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Info,
  User,
  Bookmark,
  BookmarkCheck,
  Share2,
  Map,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as Linking from "expo-linking";
import apiClient from "../../services/ApiClient";
import { styles } from "./styles";
import Animated, { FadeIn } from "react-native-reanimated";
import { formatDate, getUserLocalTime } from "@/utils/dateTimeFormatting";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ eventId, onBack }) => {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [savingState, setSavingState] = useState<"idle" | "loading">("idle");
  const router = useRouter();

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
          // If we have saveCount from the event, initialize it
          if (eventData.saveCount !== undefined) {
            setSaveCount(eventData.saveCount);
          }
        }

        // Check if event is saved by the user
        if (apiClient.isAuthenticated()) {
          try {
            const { isSaved: savedStatus } = await apiClient.isEventSaved(eventId);
            if (isMounted) {
              setIsSaved(savedStatus);
            }
          } catch (saveErr) {
            console.error("Error checking save status:", saveErr);
          }
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

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Retry fetching event details
  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEvent(null);
    setError(null);
    setLoading(true);
    apiClient
      .getEventById(eventId)
      .then((data) => setEvent(data))
      .catch((err) =>
        setError(
          `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      )
      .finally(() => setLoading(false));
  };

  // Handle save/unsave toggle
  const handleToggleSave = async () => {
    if (!apiClient.isAuthenticated()) {
      // Navigate to login if user is not authenticated
      router.push("/login");
      return;
    }

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic UI update
    setIsSaved((prevState) => !prevState);
    setSaveCount((prevCount) => (isSaved ? prevCount - 1 : prevCount + 1));

    setSavingState("loading");

    try {
      const result = await apiClient.toggleSaveEvent(eventId);

      // Update with the actual state from the server
      setIsSaved(result.saved);
      setSaveCount(result.saveCount);
    } catch (err) {
      console.error("Error toggling save status:", err);

      // Revert optimistic update on error
      setIsSaved((prevState) => !prevState);
      setSaveCount((prevCount) => (isSaved ? prevCount + 1 : prevCount - 1));

      // Could show an error toast here
    } finally {
      setSavingState("idle");
    }
  };

  const handleShare = async () => {
    if (!event) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create a shareable message
      const message = `${event.title}\n\n📅 ${formatDate(event.eventDate, event.timezone)}\n📍 ${
        event.location
      }\n\n${event.description || ""}`;

      // Create a deep link (if your app supports it)
      const deepLink = `eventexplorer://event/${eventId}`;

      // Combine message and deeplink
      const fullMessage = message + "\n\n" + deepLink;

      // Open SMS with the message pre-filled
      const url = `sms:&body=${encodeURIComponent(fullMessage)}`;

      // Check if we can open the URL
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error("Error sharing event:", err);
      Alert.alert("Sharing Failed", "There was a problem sharing this event.");
    }
  };

  // Open the location in the native maps app
  const handleOpenMaps = () => {
    if (!event || !event.location) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let url;
      const address = encodeURIComponent(event.location);

      // If we have coordinates, use them for more precise location
      if (event.coordinates && event.coordinates.length === 2) {
        const [longitude, latitude] = event.coordinates;

        if (Platform.OS === "ios") {
          url = `maps:0,0?q=${latitude},${longitude}`;
        } else {
          url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${address})`;
        }
      } else {
        // Otherwise use address
        if (Platform.OS === "ios") {
          url = `maps:0,0?q=${address}`;
        } else {
          url = `geo:0,0?q=${address}`;
        }
      }

      Linking.openURL(url);
    } catch (err) {
      console.error("Error opening maps:", err);
      Alert.alert("Navigation Failed", "Could not open maps application.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading event details...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !event ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No event details available</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.eventContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Event Header with Emoji and Title */}
              <View style={styles.eventHeaderContainer}>
                <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
                <View style={styles.eventTitleWrapper}>
                  <Text style={styles.resultTitle}>{event.title}</Text>
                  {event.verified && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>VERIFIED</Text>
                    </View>
                  )}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleToggleSave}
                  disabled={savingState === "loading"}
                >
                  {savingState === "loading" ? (
                    <ActivityIndicator size="small" color="#93c5fd" />
                  ) : isSaved ? (
                    <BookmarkCheck size={22} color="#93c5fd" />
                  ) : (
                    <Bookmark size={22} color="#93c5fd" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Save count display */}
              {saveCount > 0 && (
                <View style={styles.saveCountContainer}>
                  <Text style={styles.saveCountText}>
                    {saveCount} {saveCount === 1 ? "person" : "people"} saved this event
                  </Text>
                </View>
              )}

              {/* Event Details */}
              <View style={styles.detailsContainer}>
                <View style={styles.detailSection}>
                  <View style={styles.resultDetailsRow}>
                    <Calendar size={16} color="#93c5fd" style={{ marginRight: 8 }} />
                    <Text style={styles.detailLabel}>Date & Time</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {formatDate(event.eventDate, event.timezone)}
                  </Text>

                  {/* Add user's local time if different */}
                  {getUserLocalTime(event.eventDate, event.timezone) && (
                    <Text style={styles.timezoneText}>
                      {getUserLocalTime(event.eventDate, event.timezone)}
                    </Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.resultDetailsRow}>
                    <MapPin size={16} color="#93c5fd" style={{ marginRight: 8 }} />
                    <Text style={styles.detailLabel}>Location</Text>
                  </View>
                  <View style={styles.locationContainer}>
                    <Text style={styles.detailValue}>{event.location}</Text>
                    {event.distance && (
                      <Text style={styles.distanceText}>{event.distance} away</Text>
                    )}

                    {/* Map Button */}
                    <TouchableOpacity style={styles.mapButton} onPress={handleOpenMaps}>
                      <Map size={16} color="#f8f9fa" />
                      <Text style={styles.mapButtonText}>Open in Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New Scanned By Section */}
                {event.creator && (
                  <View style={styles.detailSection}>
                    <View style={styles.resultDetailsRow}>
                      <User size={16} color="#93c5fd" style={{ marginRight: 8 }} />
                      <Text style={styles.detailLabel}>Scanned By</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {event.creator.displayName || event.creator.email}
                    </Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={styles.resultDetailsRow}>
                    <Info size={16} color="#93c5fd" style={{ marginRight: 8 }} />
                    <Text style={styles.detailLabel}>Description</Text>
                  </View>
                  <Text style={styles.detailValue}>{event.description}</Text>
                </View>

                {event.categories && event.categories.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Categories</Text>
                    <View style={styles.categoriesContainer}>
                      {event.categories.map((category: any, index: number) => (
                        <View key={index} style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>
                            {typeof category === "string" ? category : category.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Share Button (Fixed at Bottom) */}
            <View style={styles.bottomButtonContainer}>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Share2 size={20} color="#f8f9fa" style={{ marginRight: 8 }} />
                <Text style={styles.shareButtonText}>Share Event</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default EventDetails;
