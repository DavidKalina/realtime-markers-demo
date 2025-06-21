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
  Clock,
  Users,
  Building,
  TrendingUp,
} from "lucide-react-native";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
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
  ColorValue,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Header from "../Layout/Header";
import ScreenLayout from "../Layout/ScreenLayout";
import { ErrorEventDetails } from "./ErrorEventDetails";
import EventEngagementDisplay from "./EventEngagementDisplay";
import EventMapPreview from "./EventMapPreview";
import LoadingEventDetails from "./LoadingEventDetails";
import RsvpButton from "./RsvpButton";
import SaveButton from "./SaveButton";
import { styles } from "./styles";
import { useEventDetails } from "./useEventDetails";
import { useEventEngagement } from "./useEventEngagement";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

// Municipal-friendly color scheme
const MUNICIPAL_COLORS = {
  primary: "#1e40af", // Professional blue
  secondary: "#059669", // Municipal green
  accent: "#f59e0b", // Warm amber
  background: "#f8fafc", // Light gray background
  card: "#ffffff", // White cards
  text: "#1e293b", // Dark slate text
  textSecondary: "#64748b", // Medium gray
  border: "#e2e8f0", // Light border
  success: "#10b981", // Green for success states
  warning: "#f59e0b", // Amber for warnings
  error: "#ef4444", // Red for errors
};

// Memoize EventBadge component
const EventBadge = memo(
  ({
    type,
    text,
  }: {
    type: "official" | "community" | "private";
    text: string;
  }) => {
    const getBadgeStyle = () => {
      switch (type) {
        case "official":
          return {
            backgroundColor: MUNICIPAL_COLORS.primary,
            color: "#ffffff",
          };
        case "community":
          return {
            backgroundColor: MUNICIPAL_COLORS.secondary,
            color: "#ffffff",
          };
        case "private":
          return {
            backgroundColor: MUNICIPAL_COLORS.warning,
            color: "#ffffff",
          };
        default:
          return {
            backgroundColor: MUNICIPAL_COLORS.textSecondary,
            color: "#ffffff",
          };
      }
    };

    const badgeStyle = getBadgeStyle();

    return (
      <View
        style={[
          styles.eventBadge,
          { backgroundColor: badgeStyle.backgroundColor },
        ]}
      >
        <Text style={[styles.eventBadgeText, { color: badgeStyle.color }]}>
          {text}
        </Text>
      </View>
    );
  },
);

// Memoize InfoCard component
const InfoCard = memo(
  ({
    children,
    title,
    icon: Icon,
  }: {
    children: React.ReactNode;
    title?: string;
    icon?: React.ComponentType<{
      size?: number | string;
      color?: ColorValue;
      strokeWidth?: number | string;
    }>;
  }) => (
    <View style={styles.infoCard}>
      {(title || Icon) && (
        <View style={styles.infoCardHeader}>
          {Icon && (
            <View style={styles.infoCardIcon}>
              <Icon
                size={18}
                color={MUNICIPAL_COLORS.primary}
                strokeWidth={2}
              />
            </View>
          )}
          {title && <Text style={styles.infoCardTitle}>{title}</Text>}
        </View>
      )}
      <View style={styles.infoCardContent}>{children}</View>
    </View>
  ),
);

// Memoize ActionButton component
const ActionButton = memo(
  ({
    onPress,
    icon: Icon,
    text,
    variant = "primary",
    disabled = false,
  }: {
    onPress: () => void;
    icon: React.ComponentType<{
      size?: number | string;
      color?: ColorValue;
      strokeWidth?: number | string;
    }>;
    text: string;
    variant?: "primary" | "secondary" | "outline";
    disabled?: boolean;
  }) => {
    const getButtonStyle = () => {
      switch (variant) {
        case "primary":
          return {
            backgroundColor: MUNICIPAL_COLORS.primary,
            borderColor: MUNICIPAL_COLORS.primary,
            textColor: "#ffffff",
          };
        case "secondary":
          return {
            backgroundColor: MUNICIPAL_COLORS.secondary,
            borderColor: MUNICIPAL_COLORS.secondary,
            textColor: "#ffffff",
          };
        case "outline":
          return {
            backgroundColor: "transparent",
            borderColor: MUNICIPAL_COLORS.border,
            textColor: MUNICIPAL_COLORS.text,
          };
        default:
          return {
            backgroundColor: MUNICIPAL_COLORS.primary,
            borderColor: MUNICIPAL_COLORS.primary,
            textColor: "#ffffff",
          };
      }
    };

    const buttonStyle = getButtonStyle();

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: buttonStyle.backgroundColor,
            borderColor: buttonStyle.borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Icon size={20} color={buttonStyle.textColor} strokeWidth={2} />
        <Text
          style={[styles.actionButtonText, { color: buttonStyle.textColor }]}
        >
          {text}
        </Text>
      </TouchableOpacity>
    );
  },
);

// Memoize helper functions
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

// Memoize the main component
const EventDetails: React.FC<EventDetailsProps> = memo(
  ({ eventId, onBack }) => {
    const router = useRouter();
    const { mapStyle } = useMapStyle();
    const [modalVisible, setModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);

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
      handleToggleRsvp,
      savingState,
      isAdmin,
      isSaved,
      distanceInfo,
      userLocation,
      isRsvped,
      rsvpState,
    } = useEventDetails(eventId, onBack);

    // Add engagement hook
    const {
      engagement,
      loading: engagementLoading,
      error: engagementError,
      refetch: refetchEngagement,
    } = useEventEngagement(
      eventId,
      !!event && !event.isPrivate, // Only fetch engagement for non-private events
    );

    // Memoize map refs
    const mapRef = useRef<MapboxGL.MapView>(null);
    const cameraRef = useRef<MapboxGL.Camera>(null);
    const { flyOver, stopFlyOver } = useFlyOverCamera({ cameraRef });

    // Memoize handlers
    const handleImagePress = useCallback(() => {
      if (imageUrl) {
        setModalVisible(true);
      }
    }, [imageUrl]);

    const handleCloseModal = useCallback(() => {
      setModalVisible(false);
    }, []);

    const handleDeleteEvent = useCallback(async () => {
      setIsDeleting(true);
      try {
        await apiClient.events.deleteEvent(eventId);
        handleBack?.();
      } catch (error) {
        console.error("Error deleting event:", error);
      } finally {
        setIsDeleting(false);
        setDeleteModalVisible(false);
      }
    }, [eventId, handleBack]);

    const handleEditEvent = useCallback(() => {
      if (!event) return;

      router.push({
        pathname: "/create-private-event",
        params: {
          id: event.id,
          title: event.title,
          description: event.description,
          eventDate:
            event.eventDate instanceof Date
              ? event.eventDate.toISOString()
              : event.eventDate,
          emoji: event.emoji,
          latitude: event.coordinates[1]?.toString(),
          longitude: event.coordinates[0]?.toString(),
          address: event.location,
          locationNotes: event.locationNotes,
          sharedWithIds: event.sharedWithIds,
        },
      });
    }, [event, router]);

    // Memoize computed values
    const coordinates = useMemo(() => {
      if (!event?.coordinates) return [0, 0] as [number, number];
      return event.coordinates as [number, number];
    }, [event?.coordinates]);

    const formattedDate = useMemo(() => {
      if (!event?.eventDate) return "";
      const dateStr =
        event.eventDate instanceof Date
          ? event.eventDate.toISOString()
          : event.eventDate;
      return formatDate(dateStr, event.timezone).trim();
    }, [event?.eventDate, event?.timezone]);

    const recurringEventDetails = useMemo(() => {
      if (!event?.isRecurring) return null;
      return {
        frequency: formatRecurrenceFrequency(event.recurrenceFrequency),
        days: formatRecurrenceDays(event.recurrenceDays),
        interval: event.recurrenceInterval,
        time: event.recurrenceTime,
        startDate: event.recurrenceStartDate,
        endDate: event.recurrenceEndDate,
      };
    }, [
      event?.isRecurring,
      event?.recurrenceFrequency,
      event?.recurrenceDays,
      event?.recurrenceInterval,
      event?.recurrenceTime,
      event?.recurrenceStartDate,
      event?.recurrenceEndDate,
    ]);

    // Memoize event type badge
    const eventTypeBadge = useMemo(() => {
      if (event?.isOfficial) {
        return <EventBadge type="official" text="Official Event" />;
      } else if (event?.isPrivate) {
        return <EventBadge type="private" text="Private Event" />;
      } else {
        return <EventBadge type="community" text="Community Event" />;
      }
    }, [event?.isOfficial, event?.isPrivate]);

    // Memoize handlers that should trigger engagement refetch
    const handleToggleSaveWithEngagement = useCallback(async () => {
      await handleToggleSave();
      setTimeout(() => refetchEngagement(), 500);
    }, [handleToggleSave, refetchEngagement]);

    const handleToggleRsvpWithEngagement = useCallback(async () => {
      await handleToggleRsvp();
      setTimeout(() => refetchEngagement(), 500);
    }, [handleToggleRsvp, refetchEngagement]);

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
        const timer = setTimeout(() => {
          flyOver(event.coordinates, {
            minPitch: 45,
            maxPitch: 75,
            minZoom: 15,
            maxZoom: 17,
            minBearing: -30,
            maxBearing: 30,
            speed: 0.1,
          });
        }, 500);

        return () => {
          clearTimeout(timer);
          stopFlyOver();
        };
      }
    }, [event?.coordinates, flyOver, stopFlyOver]);

    if (loading) {
      return <LoadingEventDetails />;
    }

    if (error) {
      return <ErrorEventDetails error={error} handleRetry={handleRetry} />;
    }

    if (!event) {
      return <Text>No event details available</Text>;
    }

    return (
      <ScreenLayout>
        <StatusBar
          barStyle="light-content"
          backgroundColor={MUNICIPAL_COLORS.primary}
        />

        {/* Header with back button and action buttons */}
        <Header
          title=""
          onBack={handleBack}
          rightIcon={
            <View style={styles.headerActions}>
              <RsvpButton
                isRsvped={isRsvped}
                rsvpState={rsvpState}
                onRsvp={handleToggleRsvpWithEngagement}
              />
              <SaveButton
                isSaved={isSaved}
                savingState={savingState}
                onSave={handleToggleSaveWithEngagement}
              />
            </View>
          }
        />

        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Hero Section with Image/Map and Event Badge */}
          <View style={styles.heroSection}>
            <Animated.View
              entering={FadeIn.duration(500)}
              style={styles.heroImageContainer}
            >
              <EventMapPreview
                coordinates={coordinates}
                eventId={eventId}
                title={event.title}
                emoji={event.emoji}
                isPrivate={event.isPrivate}
                eventDate={
                  event.eventDate instanceof Date
                    ? event.eventDate.toISOString()
                    : event.eventDate
                }
                imageUrl={imageUrl}
                imageLoading={imageLoading}
                imageError={imageError}
                onImagePress={handleImagePress}
                mapStyle={mapStyle}
                mapRef={mapRef}
                cameraRef={cameraRef}
              />

              {/* Event Badge Overlay */}
              <View style={styles.eventBadgeOverlay}>{eventTypeBadge}</View>
            </Animated.View>
          </View>

          {/* Event Title and Basic Info */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(300).springify()}
            style={styles.titleSection}
          >
            <Text style={styles.eventTitle}>{event.title}</Text>

            {/* Event Emoji */}
            <View style={styles.eventEmojiContainer}>
              <Text style={styles.eventEmoji}>{event.emoji}</Text>
            </View>
          </Animated.View>

          {/* Event Details Cards */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(400).springify()}
            style={styles.detailsSection}
          >
            {/* Date and Time Card */}
            <InfoCard title="Date & Time" icon={Calendar}>
              <View style={styles.detailRow}>
                <Clock size={16} color={MUNICIPAL_COLORS.textSecondary} />
                <Text style={styles.detailText}>{formattedDate}</Text>
              </View>
            </InfoCard>

            {/* Location Card */}
            <InfoCard title="Location" icon={MapPin}>
              <TouchableOpacity
                style={styles.detailRow}
                onPress={handleOpenMaps}
                activeOpacity={0.7}
              >
                <MapPin size={16} color={MUNICIPAL_COLORS.textSecondary} />
                <View style={styles.locationContent}>
                  <Text style={styles.detailText}>{event.location}</Text>
                  {distanceInfo && (
                    <Text style={styles.distanceText}>{distanceInfo}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </InfoCard>

            {/* Description Card */}
            {event.description && (
              <InfoCard title="About This Event" icon={Info}>
                <Text style={styles.descriptionText}>{event.description}</Text>
              </InfoCard>
            )}

            {/* Recurring Event Details */}
            {event.isRecurring && (
              <InfoCard title="Recurring Schedule" icon={Repeat}>
                <View style={styles.recurringDetails}>
                  <Text style={styles.detailText}>
                    {recurringEventDetails?.frequency}
                    {recurringEventDetails?.interval &&
                      recurringEventDetails.interval > 1 && (
                        <Text style={styles.detailTextSecondary}>
                          {" "}
                          (Every {recurringEventDetails.interval}{" "}
                          {recurringEventDetails.frequency.toLowerCase()}s)
                        </Text>
                      )}
                  </Text>
                  {recurringEventDetails?.days && (
                    <Text style={styles.detailTextSecondary}>
                      Days: {recurringEventDetails.days}
                    </Text>
                  )}
                  {recurringEventDetails?.time && (
                    <Text style={styles.detailTextSecondary}>
                      Time: {recurringEventDetails.time}
                    </Text>
                  )}
                  {recurringEventDetails?.startDate &&
                    recurringEventDetails.endDate && (
                      <Text style={styles.detailTextSecondary}>
                        From{" "}
                        {new Date(
                          recurringEventDetails.startDate,
                        ).toLocaleDateString()}{" "}
                        to{" "}
                        {new Date(
                          recurringEventDetails.endDate,
                        ).toLocaleDateString()}
                      </Text>
                    )}
                </View>
              </InfoCard>
            )}

            {/* Categories */}
            {event.categories && event.categories.length > 0 && (
              <InfoCard title="Categories" icon={Building}>
                <View style={styles.categoriesContainer}>
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
                </View>
              </InfoCard>
            )}

            {/* Event Engagement Card */}
            {!event.isPrivate &&
              engagement &&
              !engagementLoading &&
              !engagementError && (
                <InfoCard title="Event Engagement" icon={TrendingUp}>
                  <EventEngagementDisplay engagement={engagement} delay={450} />
                </InfoCard>
              )}
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(500).springify()}
            style={styles.actionsSection}
          >
            <View style={styles.actionButtonsContainer}>
              <ActionButton
                onPress={handleGetDirections}
                icon={Navigation2}
                text="Get Directions"
                variant="primary"
                disabled={!userLocation}
              />
              <ActionButton
                onPress={handleShare}
                icon={Share}
                text="Share Event"
                variant="outline"
              />
            </View>
          </Animated.View>

          {/* Admin Actions */}
          {isAdmin && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(600).springify()}
              style={styles.adminSection}
            >
              <Text style={styles.sectionTitle}>Admin Actions</Text>
              <View style={styles.adminActionsContainer}>
                <ActionButton
                  onPress={handleEditEvent}
                  icon={Building}
                  text="Edit Event"
                  variant="secondary"
                />
                <ActionButton
                  onPress={() => setDeleteModalVisible(true)}
                  icon={X}
                  text="Delete Event"
                  variant="outline"
                />
              </View>
            </Animated.View>
          )}

          {/* QR Code Section */}
          {(event.qrCodeData || event.detectedQrData || event.qrUrl) && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(700).springify()}
            >
              <InfoCard title="QR Code" icon={QrCode}>
                <View style={styles.qrContent}>
                  {/* Display QR Code */}
                  {(event.qrCodeData ||
                    event.detectedQrData ||
                    event.qrUrl) && (
                    <View style={styles.qrCodeWrapper}>
                      <QRCode
                        value={
                          event.qrCodeData ||
                          event.detectedQrData ||
                          event.qrUrl ||
                          ""
                        }
                        size={180}
                        backgroundColor="#ffffff"
                        color="#000000"
                      />
                    </View>
                  )}

                  {/* QR URL Display */}
                  {event.qrUrl && (
                    <View style={styles.qrUrlContainer}>
                      <Text style={styles.qrUrlLabel}>QR Code URL:</Text>
                      <Text style={styles.qrUrlText} numberOfLines={2}>
                        {event.qrUrl}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.qrDescription}>
                    {event.qrDetectedInImage
                      ? "This QR code was detected in the original event flyer"
                      : "Scan this QR code to access additional event information"}
                  </Text>

                  {/* Open QR Code Link Button */}
                  {(event.qrCodeData ||
                    event.detectedQrData ||
                    event.qrUrl) && (
                    <ActionButton
                      onPress={() => {
                        const url =
                          event.qrUrl ||
                          event.qrCodeData ||
                          event.detectedQrData;
                        if (url && url.startsWith("http")) {
                          Linking.openURL(url);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium,
                          );
                        }
                      }}
                      icon={ExternalLink}
                      text="Open QR Code Link"
                      variant="outline"
                    />
                  )}
                </View>
              </InfoCard>
            </Animated.View>
          )}

          {/* Discovered By Section */}
          {event.creator && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(800).springify()}
            >
              <InfoCard title="Event Discovery" icon={Users}>
                <View style={styles.discoveredByContent}>
                  <Scan size={16} color={MUNICIPAL_COLORS.textSecondary} />
                  <Text style={styles.discoveredByText}>
                    Discovered by{" "}
                    <Text style={styles.discoveredByName}>
                      {(() => {
                        if (
                          event.creator?.firstName &&
                          event.creator?.lastName
                        ) {
                          return `${event.creator.firstName} ${event.creator.lastName}`;
                        } else if (event.creator?.firstName) {
                          return event.creator.firstName;
                        } else if (event.creator?.lastName) {
                          return event.creator.lastName;
                        }
                        return "Anonymous User";
                      })()}
                    </Text>
                  </Text>
                </View>
              </InfoCard>
            </Animated.View>
          )}
        </ScrollView>

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
                <X size={24} color="#ffffff" />
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
                  style={[styles.dialogButton, styles.dialogButtonCancel]}
                  disabled={isDeleting}
                >
                  <Text style={styles.dialogButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteEvent}
                  style={[styles.dialogButton, styles.dialogButtonDelete]}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.dialogButtonTextDelete}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScreenLayout>
    );
  },
);

EventDetails.displayName = "EventDetails";

export default EventDetails;
