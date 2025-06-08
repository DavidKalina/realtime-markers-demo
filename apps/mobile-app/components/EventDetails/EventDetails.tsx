import { useMapStyle } from "@/contexts/MapStyleContext";
import { useFlyOverCamera } from "@/hooks/useFlyOverCamera";
import { apiClient } from "@/services/ApiClient";
import { formatDate } from "@/utils/dateTimeFormatting";
import MapboxGL from "@rnmapbox/maps";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Calendar,
  ExternalLink,
  Info,
  MapPin,
  Navigation2,
  QrCode,
  Scan,
  Share,
  X,
  Repeat,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import { ErrorEventDetails } from "./ErrorEventDetails";
import EventMapPreview from "./EventMapPreview";
import LoadingEventDetails from "./LoadingEventDetails";
import RsvpButton from "./RsvpButton";
import SaveButton from "./SaveButton";
import { styles } from "./styles";
import { useEventDetails } from "./useEventDetails";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

const EmojiContainer = ({ emoji = "📍" }: { emoji?: string }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withRepeat(
            withSequence(
              withTiming(-4, {
                duration: 1000,
                easing: Easing.inOut(Easing.quad),
              }),
              withTiming(0, {
                duration: 1000,
                easing: Easing.inOut(Easing.quad),
              }),
            ),
            -1,
            true,
          ),
        },
      ],
    };
  });

  return (
    <View style={styles.emojiWrapper}>
      <Animated.View style={[styles.emojiContainer, animatedStyle]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
    </View>
  );
};

// Add helper functions before the EventDetails component
const formatRecurrenceFrequency = (frequency?: string): string => {
  if (!frequency) return "";
  switch (frequency) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "BIWEEKLY":
      return "Every 2 weeks";
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    default:
      return frequency.toLowerCase();
  }
};

const formatRecurrenceDays = (days?: string[]): string => {
  if (!days || days.length === 0) return "";
  return days.join(", ");
};

const EventDetails: React.FC<EventDetailsProps> = ({ eventId, onBack }) => {
  const router = useRouter();
  const { mapStyle } = useMapStyle();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRsvped, setIsRsvped] = useState(false);
  const [rsvpState, setRsvpState] = useState<"idle" | "loading">("idle");

  console.log("EventDetails eventId:", eventId);

  const {
    handleBack,
    loading,
    handleGetDirections,
    handleRetry,
    error,
    event,
    handleOpenMaps,
    handleShare,
    handleToggleSave,
    savingState,
    isAdmin,
    isSaved,
    distanceInfo,
    userLocation,
  } = useEventDetails(eventId, onBack);

  // Add map refs for private event preview
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { flyOver, stopFlyOver } = useFlyOverCamera({ cameraRef });

  // Fetch image when event is loaded
  useEffect(() => {
    if (!event?.id || event.isPrivate) return;

    let isMounted = true;

    const fetchImage = async () => {
      setImageLoading(true);
      setImageError(null);

      try {
        const localUri = await apiClient.events.streamEventImage(event.id);
        if (isMounted) {
          setImageUrl(localUri);
        }
      } catch (err) {
        console.error("Error fetching event image:", err);
        if (isMounted) {
          setImageError("Could not load event image");
        }
      } finally {
        if (isMounted) {
          setImageLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [event?.id, event?.isPrivate]);

  // Add effect to trigger fly-over animation when event is loaded
  useEffect(() => {
    if (event?.coordinates) {
      // Small delay to ensure map is ready
      const timer = setTimeout(() => {
        flyOver(event.coordinates, {
          minPitch: 45,
          maxPitch: 75,
          minZoom: 15,
          maxZoom: 17,
          minBearing: -30,
          maxBearing: 30,
          speed: 0.1, // Slower speed for smoother movement
        });
      }, 500);

      return () => {
        clearTimeout(timer);
        stopFlyOver();
      };
    }
  }, [event?.coordinates, flyOver, stopFlyOver]);

  // Add RSVP check effect
  useEffect(() => {
    const checkRsvpStatus = async () => {
      try {
        const { isRsvped } = await apiClient.rsvp.isEventRsvped(eventId);
        setIsRsvped(isRsvped);
      } catch (error) {
        console.error("Error checking RSVP status:", error);
      }
    };

    checkRsvpStatus();
  }, [eventId]);

  // Add RSVP handler
  const handleToggleRsvp = () => {
    if (rsvpState === "loading") return;

    // Optimistically update the UI state
    const newRsvpState = !isRsvped;
    console.log("Current RSVP state:", { isRsvped, newRsvpState });
    setIsRsvped(newRsvpState);
    setRsvpState("loading");

    // Make the API call
    apiClient.rsvp
      .toggleRSVP(eventId)
      .then((response) => {
        console.log("RSVP API Response:", {
          response,
          currentState: isRsvped,
          optimisticState: newRsvpState,
          status: response.status,
        });
        // Use the status to determine if user is RSVPed
        setIsRsvped(response.status === "GOING");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      })
      .catch((error) => {
        console.error("Error toggling RSVP:", error);
        // Revert optimistic update on error
        setIsRsvped(!newRsvpState);
      })
      .finally(() => {
        setRsvpState("idle");
      });
  };

  const handleImagePress = () => {
    if (imageUrl) {
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      await apiClient.events.deleteEvent(eventId);
      handleBack?.();
    } catch (error) {
      console.error("Error deleting event:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
    }
  };

  const handleEditEvent = () => {
    if (!event) return;

    router.push({
      pathname: "/create-private-event",
      params: {
        id: event.id,
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        emoji: event.emoji,
        latitude: event.coordinates[1]?.toString(), // latitude is second coordinate
        longitude: event.coordinates[0]?.toString(), // longitude is first coordinate
        address: event.location,
        locationNotes: event.locationNotes,
        sharedWithIds: event.sharedWithIds,
      },
    });
  };

  useEffect(() => {
    if (event?.categories) {
      console.log("Categories:", event.categories);
    }
  }, [event?.categories]);

  if (loading) {
    return <LoadingEventDetails />;
  }

  if (error) {
    return <ErrorEventDetails error={error} handleRetry={handleRetry} />;
  }

  if (!event) {
    return <Text>No event details available</Text>;
  }

  // Ensure coordinates are in the correct format [longitude, latitude]
  const coordinates = event.coordinates;

  return (
    <ScreenLayout>
      <StatusBar barStyle="light-content" />

      {/* Header with back button and action buttons */}
      <Header
        title=""
        onBack={handleBack}
        rightIcon={
          <View style={{ flexDirection: "row", gap: 12 }}>
            <RsvpButton
              isRsvped={isRsvped}
              rsvpState={rsvpState}
              onRsvp={handleToggleRsvp}
            />
            <SaveButton
              isSaved={isSaved}
              savingState={savingState}
              onSave={handleToggleSave}
            />
          </View>
        }
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Event Image with Emoji or Map Preview for Private Events */}
        <View style={styles.imageWrapper}>
          <Animated.View
            entering={FadeIn.duration(500)}
            style={styles.imageContainer}
          >
            <EventMapPreview
              coordinates={coordinates}
              eventId={eventId}
              title={event.title}
              emoji={event.emoji}
              isPrivate={event.isPrivate}
              eventDate={event.eventDate}
              imageUrl={imageUrl}
              imageLoading={imageLoading}
              imageError={imageError}
              onImagePress={handleImagePress}
              mapStyle={mapStyle}
              mapRef={mapRef}
              cameraRef={cameraRef}
            />
          </Animated.View>
          <EmojiContainer emoji={event.emoji} />
        </View>

        {/* Event Details */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(300).springify()}
          style={styles.detailsContainer}
        >
          {/* Title */}
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Description */}
          {event.description && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <Info size={18} color={COLORS.accent} strokeWidth={2.5} />
              </View>
              <View style={[styles.descriptionContainer, { flex: 1 }]}>
                <Text style={styles.detailText}>{event.description}</Text>
              </View>
            </View>
          )}

          {/* Date and Time */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Calendar size={18} color={COLORS.accent} strokeWidth={2.5} />
            </View>
            <Text style={styles.detailText}>
              {formatDate(event.eventDate, event.timezone).trim()}
              <Text style={styles.detailTextSecondary}>{"\n"}1:00 PM MDT</Text>
            </Text>
          </View>

          {/* Recurring Event Details */}
          {event.isRecurring && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(400).springify()}
              style={[styles.detailRow, styles.recurringDetailsContainer]}
            >
              <View style={styles.iconContainer}>
                <Repeat size={18} color={COLORS.accent} strokeWidth={2.5} />
              </View>
              <View style={styles.recurringDetailsContent}>
                <Text style={styles.detailText}>
                  Recurring Event
                  {event.recurrenceInterval && event.recurrenceInterval > 1 && (
                    <Text style={styles.detailTextSecondary}>
                      {"\n"}Every {event.recurrenceInterval}{" "}
                      {formatRecurrenceFrequency(
                        event.recurrenceFrequency,
                      ).toLowerCase()}
                      s
                    </Text>
                  )}
                  {!event.recurrenceInterval && (
                    <Text style={styles.detailTextSecondary}>
                      {"\n"}
                      {formatRecurrenceFrequency(event.recurrenceFrequency)}
                    </Text>
                  )}
                  {event.recurrenceDays && event.recurrenceDays.length > 0 && (
                    <Text style={styles.detailTextSecondary}>
                      {"\n"}on {formatRecurrenceDays(event.recurrenceDays)}
                    </Text>
                  )}
                  {event.recurrenceTime && (
                    <Text style={styles.detailTextSecondary}>
                      {"\n"}at {event.recurrenceTime}
                    </Text>
                  )}
                  {event.recurrenceStartDate && event.recurrenceEndDate && (
                    <Text style={styles.detailTextSecondary}>
                      {"\n"}from{" "}
                      {new Date(event.recurrenceStartDate).toLocaleDateString()}{" "}
                      to{" "}
                      {new Date(event.recurrenceEndDate).toLocaleDateString()}
                    </Text>
                  )}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Location */}
          <TouchableOpacity style={styles.detailRow} onPress={handleOpenMaps}>
            <View style={styles.iconContainer}>
              <MapPin size={18} color={COLORS.accent} strokeWidth={2.5} />
            </View>
            <View style={[styles.locationContainer, { flex: 1 }]}>
              <Text style={styles.detailText}>
                {event.location}
                {distanceInfo && (
                  <Text style={styles.detailTextSecondary}>
                    {"\n"}
                    {distanceInfo}
                  </Text>
                )}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Categories */}
        {event.categories && event.categories.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={styles.categoriesContainer}
          >
            {event.categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/category/${category.id}`);
                }}
                style={styles.categoryTag}
              >
                <Text style={styles.categoryText}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(400).springify()}
          style={styles.detailsContainer}
        >
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleGetDirections}
              disabled={!userLocation}
            >
              <Navigation2 size={22} color={COLORS.accent} strokeWidth={2.5} />
              <Text style={styles.actionButtonText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Share size={22} color={COLORS.accent} strokeWidth={2.5} />
              <Text style={styles.actionButtonText}>Share Event</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Admin Actions */}
        {isAdmin && (
          <Animated.View
            entering={FadeInDown.duration(600).delay(500).springify()}
          >
            <View style={styles.adminActionsContainer}>
              <TouchableOpacity
                style={[styles.adminButton, { backgroundColor: COLORS.accent }]}
                onPress={handleEditEvent}
              >
                <Text style={[styles.adminButtonText, { color: "#ffffff" }]}>
                  Edit Event
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adminButton, { backgroundColor: "#dc3545" }]}
                onPress={() => setDeleteModalVisible(true)}
              >
                <Text style={[styles.adminButtonText, { color: "#ffffff" }]}>
                  Delete Event
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* QR Code Section */}
        {(event.qrCodeData || event.detectedQrData) && (
          <Animated.View
            entering={FadeInDown.duration(600).delay(600).springify()}
          >
            <View style={styles.qrSection}>
              <View style={styles.qrHeader}>
                <View style={styles.qrIconContainer}>
                  <QrCode size={20} color={COLORS.accent} strokeWidth={2.5} />
                </View>
                <Text style={styles.qrTitle}>
                  {event.qrDetectedInImage
                    ? "Original Event QR Code"
                    : "Event QR Code"}
                </Text>
              </View>
              <View style={styles.qrContent}>
                <View style={styles.qrCodeWrapper}>
                  <QRCode
                    value={event.qrCodeData || event.detectedQrData || ""}
                    size={200}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                </View>
                <Text style={styles.qrDescription}>
                  {event.qrDetectedInImage
                    ? "This QR code was detected in the original event flyer"
                    : "Scan this QR code to access additional event information"}
                </Text>
                {(event.qrCodeData || event.detectedQrData) && (
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={() => {
                      const url = event.qrCodeData || event.detectedQrData;
                      if (url && url.startsWith("http")) {
                        Linking.openURL(url);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <ExternalLink
                      size={20}
                      color={COLORS.accent}
                      strokeWidth={2.5}
                    />
                    <Text style={styles.qrButtonText}>Open QR Code Link</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Discovered By Section */}
        {event.creator && (
          <Animated.View
            entering={FadeInDown.duration(600).delay(700).springify()}
          >
            <View style={styles.discoveredBySection}>
              <View style={styles.discoveredByHeader}>
                <View style={styles.discoveredByIconContainer}>
                  <Scan size={20} color={COLORS.accent} strokeWidth={2.5} />
                </View>
                <Text style={styles.discoveredByTitle}>Discovered by</Text>
                <Text style={styles.discoveredByName}>
                  {event.creator.displayName || "Anonymous User"}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Fullscreen Image Modal */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={handleCloseModal}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <X size={22} color="#f8f9fa" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={handleCloseModal}
            >
              {imageUrl && (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={deleteModalVisible}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.dialogOverlay}>
            <View style={styles.dialogContainer}>
              <Text style={styles.dialogTitle}>Delete Event</Text>
              <Text style={styles.dialogText}>
                Are you sure you want to delete this event? This action cannot
                be undone.
              </Text>
              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  onPress={() => setDeleteModalVisible(false)}
                  style={[
                    styles.dialogButton,
                    { backgroundColor: COLORS.background },
                  ]}
                  disabled={isDeleting}
                >
                  <Text
                    style={[styles.dialogButtonText, { color: COLORS.accent }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteEvent}
                  style={[styles.dialogButton, { backgroundColor: "#dc3545" }]}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text
                      style={[styles.dialogButtonText, { color: "#ffffff" }]}
                    >
                      Delete
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenLayout>
  );
};

export default EventDetails;
