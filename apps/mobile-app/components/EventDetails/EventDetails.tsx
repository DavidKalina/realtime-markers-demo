import { formatDate } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Info,
  MapPin,
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
import Animated, { FadeInDown } from "react-native-reanimated";
import Screen from "../Layout/Screen";
import { colors } from "@/theme";
import { ErrorEventDetails } from "./ErrorEventDetails";
import EventEngagementDisplay from "./EventEngagementDisplay";
import LoadingEventDetails from "./LoadingEventDetails";
import { styles } from "./styles";
import { formatRecurrenceFrequency, formatRecurrenceDays } from "./formatters";
import { useEventDetails } from "./useEventDetails";
import { useEventEngagement } from "./useEventEngagement";
import TierBadge from "../Gamification/TierBadge";
import { CategoryPieChart } from "../AreaScan/AreaScanComponents";
import VibeTagSection from "./VibeTagSection";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

// Rotating palette for category chips
const CATEGORY_COLORS = [
  {
    text: "#34d399",
    bg: "rgba(52, 211, 153, 0.15)",
    border: "rgba(52, 211, 153, 0.3)",
  },
  {
    text: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.15)",
    border: "rgba(251, 191, 36, 0.3)",
  },
  {
    text: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.15)",
    border: "rgba(167, 139, 250, 0.3)",
  },
  {
    text: "#fb7185",
    bg: "rgba(251, 113, 133, 0.15)",
    border: "rgba(251, 113, 133, 0.3)",
  },
  {
    text: "#22d3ee",
    bg: "rgba(34, 211, 238, 0.15)",
    border: "rgba(34, 211, 238, 0.3)",
  },
  {
    text: "#fb923c",
    bg: "rgba(251, 146, 60, 0.15)",
    border: "rgba(251, 146, 60, 0.3)",
  },
] as const;

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

// Memoize the main component
const EventDetails: React.FC<EventDetailsProps> = memo(
  ({ eventId, onBack }) => {
    const router = useRouter();

    const {
      handleBack,
      loading,
      handleRetry,
      error,
      event,
      handleOpenMaps,
      distanceInfo,
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
          message: shareUrl,
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
        variant: isRsvped ? "secondary" : "ghost",
        loading: rsvpState === "loading",
        style: {
          flex: 2,
          backgroundColor: isRsvped
            ? colors.status.success.bg
            : colors.action.rsvpMuted,
          borderColor: isRsvped
            ? colors.status.success.border
            : colors.action.rsvpBorder,
          borderWidth: 1,
        },
        textStyle: {
          color: isRsvped ? colors.fixed.white : colors.action.rsvp,
        },
      },
      {
        label: isSaved ? "Saved ✓" : "Save",
        onPress: () => handleToggleSave(),
        variant: "ghost",
        loading: savingState === "loading",
        style: {
          flex: 1,
          backgroundColor: isSaved
            ? colors.action.saveMuted
            : colors.action.saveMuted,
          borderColor: colors.action.saveBorder,
          borderWidth: 1,
        },
        textStyle: { color: colors.action.save },
      },
      {
        label: "Share",
        onPress: handleShare,
        variant: "ghost",
        style: {
          flex: 1,
          backgroundColor: colors.action.shareMuted,
          borderColor: colors.action.shareBorder,
          borderWidth: 1,
        },
        textStyle: { color: colors.action.share },
      },
    ];

    const qrUrl = event.qrUrl || event.qrCodeData || event.detectedQrData;

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
        {/* Hero: centered emoji + title + date subtitle */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(0).springify()}
          style={styles.titleSection}
        >
          <Text style={styles.eventEmoji}>{event.emoji}</Text>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {formattedDate ? (
            <Text style={styles.heroDateSubtitle}>{formattedDate}</Text>
          ) : null}
        </Animated.View>

        {event.categories && event.categories.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(300).delay(240).springify()}
            style={styles.categoryDnaSection}
          >
            <Text style={styles.categoryDnaLabel}>EVENT DNA</Text>
            <View style={styles.categoryPieRow}>
              <CategoryPieChart
                breakdown={event.categories.map((cat) => ({
                  name: cat.name,
                  pct: Math.round(100 / event.categories!.length),
                }))}
                colors={CATEGORY_COLORS.map((c) => c.text)}
              />
              <View style={styles.categoryPieLegend}>
                {event.categories.map((category, index) => {
                  const palette =
                    CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/category/${category.id}`);
                      }}
                      style={styles.dnaLegendItem}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.dnaLegendDot,
                          { backgroundColor: palette.text },
                        ]}
                      />
                      <Text style={styles.dnaLegendText}>{category.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}

        <View style={styles.detailsSection}>
          {/* Location — simple tappable row */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(80).springify()}
          >
            <TouchableOpacity
              onPress={handleOpenMaps}
              activeOpacity={0.7}
              style={styles.infoCard}
            >
              <View style={styles.locationRow}>
                <MapPin
                  size={20}
                  color={colors.accent.primary}
                  strokeWidth={2}
                />
                <View style={styles.locationContent}>
                  <Text style={styles.locationAddress} numberOfLines={2}>
                    {event.address || "View on map"}
                  </Text>
                  {distanceInfo && (
                    <Text style={styles.locationDistance}>{distanceInfo}</Text>
                  )}
                </View>
                <Text style={styles.chevronText}>›</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* About */}
          {event.description && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(160).springify()}
            >
              <View style={styles.infoCard}>
                <SectionLabel title="About" icon={Info} />
                <Text style={styles.descriptionText}>{event.description}</Text>
              </View>
            </Animated.View>
          )}

          {/* Categories — DNA bar */}

          {/* Recurring Schedule */}
          {event.isRecurring && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(320).springify()}
            >
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
              entering={FadeInDown.duration(300).delay(400).springify()}
            >
              <View style={styles.infoCard}>
                <SectionLabel title="Engagement" icon={TrendingUp} />
                <EventEngagementDisplay engagement={engagement} delay={450} />
              </View>
            </Animated.View>
          )}

          {/* Vibe Tags */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(440).springify()}
          >
            <View style={styles.infoCard}>
              <VibeTagSection eventId={event.id} />
            </View>
          </Animated.View>

          {/* QR Code — compact tappable row */}
          {qrUrl && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(480).springify()}
            >
              <TouchableOpacity
                onPress={() => {
                  if (qrUrl.startsWith("http")) {
                    Linking.openURL(qrUrl);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                }}
                activeOpacity={0.7}
                style={styles.infoCard}
              >
                <View style={styles.qrRow}>
                  <QrCode
                    size={18}
                    color={colors.text.secondary}
                    strokeWidth={2}
                  />
                  <Text style={styles.qrRowText}>
                    {event.qrDetectedInImage
                      ? "Detected in flyer"
                      : "Scan for info"}
                  </Text>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Discovered By */}
          {event.creator && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(560).springify()}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.infoCard}>
                  <SectionLabel title="Discovered by" icon={Scan} />
                  <View style={styles.discoveredByContent}>
                    {event.creator?.currentTier && (
                      <TierBadge tier={event.creator.currentTier} size="sm" />
                    )}
                    <View>
                      <Text style={styles.discoveredByText}>
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
                      {event.creator?.scanCount != null &&
                        event.creator.scanCount > 0 && (
                          <Text style={styles.discoveredByStats}>
                            {event.creator.scanCount} events found
                          </Text>
                        )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Screen>
    );
  },
);

EventDetails.displayName = "EventDetails";

export default EventDetails;
