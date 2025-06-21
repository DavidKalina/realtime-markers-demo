import { apiClient } from "@/services/ApiClient";
import { formatDate } from "@/utils/dateTimeFormatting";
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
  Repeat,
  Clock,
  Users,
  Building,
  TrendingUp,
} from "lucide-react-native";
import React, { useState, useCallback, useMemo, memo } from "react";
import {
  ActivityIndicator,
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
import Animated, { FadeInDown } from "react-native-reanimated";
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
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const {
      handleBack,
      loading,
      handleGetDirections,
      handleRetry,
      error,
      event,
      handleOpenMaps,
      handleToggleSave,
      handleToggleRsvp,
      savingState,
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

    // Memoize handlers
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

    // Memoize handlers that should trigger engagement refetch
    const handleToggleSaveWithEngagement = useCallback(async () => {
      await handleToggleSave();
      setTimeout(() => refetchEngagement(), 500);
    }, [handleToggleSave, refetchEngagement]);

    const handleToggleRsvpWithEngagement = useCallback(async () => {
      await handleToggleRsvp();
      setTimeout(() => refetchEngagement(), 500);
    }, [handleToggleRsvp, refetchEngagement]);

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
            {/* Map Preview Card */}
            <InfoCard title="Event Location" icon={MapPin}>
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
              />

              {/* Directions Button Footer */}
              <View style={styles.mapCardFooter}>
                <ActionButton
                  onPress={handleGetDirections}
                  icon={Navigation2}
                  text="Get Directions"
                  variant="outline"
                  disabled={!userLocation}
                />
              </View>
            </InfoCard>

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
            </View>
          </Animated.View>

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
