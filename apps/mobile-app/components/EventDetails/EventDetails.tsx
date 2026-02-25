import { formatDate } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Building,
  Calendar,
  ExternalLink,
  Info,
  MapPin,
  Navigation2,
  QrCode,
  Repeat,
  Scan,
  TrendingUp,
} from "lucide-react-native";
import React, { memo, useMemo } from "react";
import {
  ColorValue,
  Linking,
  Share,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import Screen from "../Layout/Screen";
import { colors } from "@/theme";
import { ErrorEventDetails } from "./ErrorEventDetails";
import EventEngagementDisplay from "./EventEngagementDisplay";
import EventMapPreview from "./EventMapPreview";
import LoadingEventDetails from "./LoadingEventDetails";
import { styles } from "./styles";
import { formatRecurrenceFrequency, formatRecurrenceDays } from "./formatters";
import { useEventDetails } from "./useEventDetails";
import { useEventEngagement } from "./useEventEngagement";
import TierBadge from "../Gamification/TierBadge";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

// Lightweight section label
const SectionLabel = memo(
  ({
    title,
    icon: Icon,
  }: {
    title: string;
    icon: React.ComponentType<{
      size?: number | string;
      color?: ColorValue;
      strokeWidth?: number | string;
    }>;
  }) => (
    <View style={styles.infoCardHeader}>
      <View style={styles.infoCardIcon}>
        <Icon size={14} color={colors.text.secondary} strokeWidth={2} />
      </View>
      <Text style={styles.infoCardTitle}>{title}</Text>
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
            backgroundColor: colors.accent.primary,
            borderColor: colors.accent.primary,
            textColor: colors.fixed.white,
          };
        case "secondary":
          return {
            backgroundColor: "#059669",
            borderColor: "#059669",
            textColor: colors.fixed.white,
          };
        case "outline":
          return {
            backgroundColor: colors.fixed.transparent,
            borderColor: colors.border.medium,
            textColor: colors.text.primary,
          };
        default:
          return {
            backgroundColor: colors.accent.primary,
            borderColor: colors.accent.primary,
            textColor: colors.fixed.white,
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
        <Icon size={18} color={buttonStyle.textColor} strokeWidth={2} />
        <Text
          style={[styles.actionButtonText, { color: buttonStyle.textColor }]}
        >
          {text}
        </Text>
      </TouchableOpacity>
    );
  },
);

// Memoize the main component
const EventDetails: React.FC<EventDetailsProps> = memo(
  ({ eventId, onBack }) => {
    const router = useRouter();

    const {
      handleBack,
      loading,
      handleGetDirections,
      handleRetry,
      error,
      event,
      handleOpenMaps,
      distanceInfo,
      userLocation,
      isRsvped,
      rsvpState,
      handleToggleRsvp,
      isSaved,
      savingState,
      handleToggleSave,
    } = useEventDetails(eventId, onBack);

    const {
      engagement,
      loading: engagementLoading,
      error: engagementError,
    } = useEventEngagement(eventId, true);

    const coordinates = useMemo(() => {
      if (!event?.coordinates) return [0, 0] as [number, number];
      return event.coordinates as [number, number];
    }, [event?.location]);

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

    if (loading) {
      return <LoadingEventDetails />;
    }

    if (error) {
      return <ErrorEventDetails error={error} handleRetry={handleRetry} />;
    }

    if (!event) {
      return <Text>No event details available</Text>;
    }

    const handleShare = async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const webUrl =
        process.env.EXPO_PUBLIC_WEB_URL || "https://dashboard.mapmoji.app";
      const shareUrl = `${webUrl}/e/${eventId}`;
      try {
        await Share.share({
          message: `${event.emoji || "📍"} ${event.title}\n${shareUrl}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed silently
      }
    };

    const footerButtons: {
      label: string;
      onPress: () => void;
      variant?:
        | "primary"
        | "secondary"
        | "outline"
        | "ghost"
        | "warning"
        | "error";
      style?: ViewStyle;
      textStyle?: TextStyle;
      loading?: boolean;
    }[] = [
      {
        label: isRsvped ? "RSVP'd ✓" : "RSVP",
        onPress: () => handleToggleRsvp(),
        variant: isRsvped ? "secondary" : "primary",
        loading: rsvpState === "loading",
        style: { flex: 2 },
      },
      {
        label: isSaved ? "Saved ✓" : "Save",
        onPress: () => handleToggleSave(),
        variant: isSaved ? "secondary" : "outline",
        loading: savingState === "loading",
        style: { flex: 1 },
      },
      {
        label: "Share",
        onPress: handleShare,
        variant: "outline",
        style: { flex: 1 },
      },
    ];

    return (
      <Screen
        bannerTitle="Details"
        bannerEmoji={event.emoji}
        showBackButton={true}
        onBack={handleBack}
        extendBannerToStatusBar={true}
        footerButtons={footerButtons}
        footerSafeArea={true}
      >
        {/* Title row: emoji + title inline */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(0).springify()}
          style={styles.titleSection}
        >
          <View style={styles.eventEmojiContainer}>
            <Text style={styles.eventEmoji}>{event.emoji}</Text>
          </View>
          <Text style={styles.eventTitle}>{event.title}</Text>
        </Animated.View>

        <View style={styles.detailsSection}>
          {/* Date & Time */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(80).springify()}
          >
            <View style={styles.sectionDivider} />
            <View style={styles.infoCard}>
              <SectionLabel title="Date & Time" icon={Calendar} />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>
          </Animated.View>

          {/* Location */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(160).springify()}
          >
            <View style={styles.sectionDivider} />
            <View style={styles.infoCard}>
              <SectionLabel title="Location" icon={MapPin} />
              <TouchableOpacity onPress={handleOpenMaps} activeOpacity={0.7}>
                <Text style={styles.locationAddress}>{event.address}</Text>
                {distanceInfo && (
                  <Text style={styles.distanceText}>{distanceInfo}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* About */}
          {event.description && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(240).springify()}
            >
              <View style={styles.sectionDivider} />
              <View style={styles.infoCard}>
                <SectionLabel title="About" icon={Info} />
                <Text style={styles.descriptionText}>{event.description}</Text>
              </View>
            </Animated.View>
          )}

          {/* Map */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(320).springify()}
          >
            <View style={styles.sectionDivider} />
            <View style={styles.infoCard}>
              <SectionLabel title="Map" icon={MapPin} />
              <EventMapPreview
                emoji={event.emoji || "📍"}
                coordinates={coordinates}
                eventId={eventId}
                title={event.title}
                eventDate={
                  event.eventDate instanceof Date
                    ? event.eventDate.toISOString()
                    : event.eventDate
                }
              />
              <View style={styles.mapCardFooter}>
                <ActionButton
                  onPress={handleGetDirections}
                  icon={Navigation2}
                  text="Get Directions"
                  variant="outline"
                  disabled={!userLocation}
                />
              </View>
            </View>
          </Animated.View>

          {/* Categories */}
          {event.categories && event.categories.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(400).springify()}
            >
              <View style={styles.sectionDivider} />
              <View style={styles.infoCard}>
                <SectionLabel title="Categories" icon={Building} />
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
              </View>
            </Animated.View>
          )}

          {/* Recurring Schedule */}
          {event.isRecurring && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(480).springify()}
            >
              <View style={styles.sectionDivider} />
              <View style={styles.infoCard}>
                <SectionLabel title="Recurring" icon={Repeat} />
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
              </View>
            </Animated.View>
          )}

          {/* Engagement */}
          {engagement && !engagementLoading && !engagementError && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(560).springify()}
            >
              <View style={styles.sectionDivider} />
              <View style={styles.infoCard}>
                <SectionLabel title="Engagement" icon={TrendingUp} />
                <EventEngagementDisplay engagement={engagement} delay={610} />
              </View>
            </Animated.View>
          )}

          {/* QR Code */}
          {(event.qrCodeData || event.detectedQrData || event.qrUrl) && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(640).springify()}
            >
              <View style={styles.sectionDivider} />
              <View style={styles.infoCard}>
                <SectionLabel title="QR Code" icon={QrCode} />
                <View style={styles.qrContent}>
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
                        size={160}
                        backgroundColor={colors.fixed.white}
                        color={colors.fixed.black}
                      />
                    </View>
                  )}

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
                      ? "Detected in the original event flyer"
                      : "Scan for additional event information"}
                  </Text>

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
                      text="Open Link"
                      variant="outline"
                    />
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Discovered By */}
          {event.creator && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(720).springify()}
            >
              <View style={styles.sectionDivider} />
              <View style={styles.infoCard}>
                <SectionLabel title="Discovered by" icon={Scan} />
                <View style={styles.discoveredByContent}>
                  {event.creator?.currentTier && (
                    <TierBadge tier={event.creator.currentTier} size="sm" />
                  )}
                  <Text style={styles.discoveredByText}>
                    {(() => {
                      if (event.creator?.firstName && event.creator?.lastName) {
                        return `${event.creator.firstName} ${event.creator.lastName}`;
                      } else if (event.creator?.firstName) {
                        return event.creator.firstName;
                      } else if (event.creator?.lastName) {
                        return event.creator.lastName;
                      }
                      return "Anonymous User";
                    })()}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </Screen>
    );
  },
);

EventDetails.displayName = "EventDetails";

export default EventDetails;
