import { formatDateTime } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo } from "react";
import {
  Linking,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import Animated, { FadeInDown, FadeInRight, Easing } from "react-native-reanimated";
import Screen from "../Layout/Screen";
import { useColors } from "@/theme";
import { ErrorEventDetails } from "./ErrorEventDetails";
import EventEngagementDisplay from "./EventEngagementDisplay";
import LoadingEventDetails from "./LoadingEventDetails";
import { createStyles } from "./styles";
import { formatRecurrenceFrequency, formatRecurrenceDays } from "./formatters";
import { useEventDetails } from "./useEventDetails";
import { useEventEngagement } from "./useEventEngagement";
import { useEventInsight } from "./useEventInsight";
import { DialogBox } from "../AreaScan/AreaScanComponents";
import DiscovererCard from "./DiscovererCard";
import TicketmasterSourceCard from "./TicketmasterSourceCard";
import { getCategoryColor } from "@/utils/categoryColors";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

// Memoize the main component
const EventDetails: React.FC<EventDetailsProps> = memo(
  ({ eventId, onBack }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const {
      handleBack,
      loading,
      handleRetry,
      error,
      event,
      handleOpenMaps,
      isRsvped,
      rsvpState,
      handleToggleRsvp,
      isSaved,
      savingState,
      handleToggleSave,
      distanceInfo,
    } = useEventDetails(eventId, onBack);

    const {
      engagement,
      loading: engagementLoading,
      error: engagementError,
    } = useEventEngagement(eventId, true);

    const {
      isLoading: insightLoading,
      error: insightError,
      idle: insightIdle,
      dialog: insightDialog,
      feedPending: insightFeedPending,
      fetchInsight,
    } = useEventInsight(eventId);

    const handleInsightTap = useCallback(() => {
      if (insightIdle) {
        fetchInsight();
      } else {
        insightDialog.handleTap();
      }
    }, [insightIdle, fetchInsight, insightDialog.handleTap]);

    const formattedDate = useMemo(() => {
      if (!event?.eventDate) return "";
      const dateStr =
        event.eventDate instanceof Date
          ? event.eventDate.toISOString()
          : event.eventDate;
      return formatDateTime(dateStr, event.timezone).trim();
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
        label: isRsvped ? "RSVP'd" : "RSVP",
        onPress: () => handleToggleRsvp(),
        variant: isRsvped ? "secondary" : "ghost",
        loading: rsvpState === "loading",
        style: {
          flex: 1,
          backgroundColor: isRsvped
            ? colors.status.success.bg
            : colors.action.rsvpMuted,
          borderRadius: 0,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: colors.border.medium,
        },
        textStyle: {
          color: isRsvped ? colors.fixed.white : colors.action.rsvp,
        },
      },
      {
        label: isSaved ? "SAVED" : "SAVE",
        onPress: () => handleToggleSave(),
        variant: "ghost",
        loading: savingState === "loading",
        style: {
          flex: 1,
          backgroundColor: isSaved
            ? colors.action.saveMuted
            : colors.action.saveMuted,
          borderRadius: 0,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: colors.border.medium,
        },
        textStyle: { color: colors.action.save },
      },
      {
        label: "MAP",
        onPress: handleOpenMaps,
        variant: "ghost",
        style: {
          flex: 1,
          backgroundColor: colors.action.mapMuted,
          borderRadius: 0,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: colors.border.medium,
        },
        textStyle: { color: colors.action.map },
      },
      {
        label: "SHARE",
        onPress: handleShare,
        variant: "ghost",
        style: {
          flex: 1,
          backgroundColor: colors.action.shareMuted,
          borderRadius: 0,
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
        bottomContent={
          <DialogBox
            isLoading={insightLoading}
            error={insightError}
            displayText={insightDialog.displayText}
            showContinue={insightDialog.showContinue}
            showDone={insightDialog.showDone}
            blinkAnim={insightDialog.blinkAnim}
            onTap={handleInsightTap}
            onRestart={insightDialog.restart}
            onExpandComplete={insightFeedPending}
            startCollapsed={insightIdle}
            style={{ height: 140 }}
          />
        }
      >
        {/* ── Hero Section ── */}
        <Animated.View
          entering={FadeInDown.duration(450).easing(Easing.out(Easing.cubic))}
          style={styles.hero}
        >
          {/* Title */}
          <Animated.View
            entering={FadeInDown.delay(100)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
          >
            <Text style={styles.heroTitle}>
              {event.emoji} {event.title}
            </Text>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroLabelPill}>
                <Text style={styles.heroLabelText}>EVENT</Text>
              </View>
              {formattedDate && (
                <>
                  <Text style={styles.heroDot}> · </Text>
                  <Text style={styles.heroDate}>{formattedDate}</Text>
                </>
              )}
            </View>
          </Animated.View>

          {/* Summary */}
          {event.eventDigest?.summary && (
            <Animated.View
              entering={FadeInDown.delay(200)
                .duration(450)
                .easing(Easing.out(Easing.cubic))}
            >
              <Text style={styles.heroSummary}>{event.eventDigest.summary}</Text>
            </Animated.View>
          )}

          {/* Stat chips */}
          <Animated.View
            entering={FadeInDown.delay(300)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
            style={styles.chipRow}
          >
            {distanceInfo && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(147, 197, 253, 0.25)" },
                ]}
              >
                <Text style={[styles.statChipValue, { color: "#93c5fd" }]}>
                  {distanceInfo}
                </Text>
              </View>
            )}
            {event.eventDigest?.cost && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(134, 239, 172, 0.25)" },
                ]}
              >
                <Text style={[styles.statChipValue, { color: "#86efac" }]}>
                  {event.eventDigest.cost}
                </Text>
              </View>
            )}
            {event.address && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(196, 181, 253, 0.25)" },
                ]}
              >
                <Text style={[styles.statChipValue, { color: "#c4b5fd" }]}>
                  {event.address}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Category chips */}
          {event.categories && event.categories.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(400)
                .duration(400)
                .easing(Easing.out(Easing.cubic))}
              style={styles.chipRow}
            >
              {event.categories.map((cat, i) => {
                const color = getCategoryColor(cat.name);
                return (
                  <Animated.View
                    key={cat.id ?? cat.name}
                    entering={FadeInRight.delay(450 + i * 60).duration(350)}
                    style={[
                      styles.vibePill,
                      {
                        borderColor: `${color}33`,
                        backgroundColor: `${color}14`,
                      },
                    ]}
                  >
                    <Text style={[styles.vibeText, { color }]}>{cat.name}</Text>
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Divider ── */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          style={styles.divider}
        />

        <View style={styles.detailsSection}>
          {/* About / Digest */}
          {event.eventDigest ? (
            <Animated.View
              entering={FadeInDown.duration(300).delay(80).springify()}
            >
              {event.eventDigest.highlights &&
                event.eventDigest.highlights.length > 0 && (
                  <View>
                    <Text style={styles.infoCardTitle}>Highlights</Text>
                    <View style={styles.highlightsList}>
                      {event.eventDigest.highlights.map(
                        (item: string, i: number) => (
                          <Text key={i} style={styles.highlightItem}>
                            <Text style={styles.highlightBullet}>{"·  "}</Text>
                            {item}
                          </Text>
                        ),
                      )}
                    </View>
                  </View>
                )}

              {event.eventDigest.contact && (
                <View style={styles.sectionDivider}>
                  <Text style={styles.infoCardTitle}>Contact</Text>
                  {typeof event.eventDigest.contact === "string" ? (
                    <Text style={styles.descriptionText}>
                      {event.eventDigest.contact}
                    </Text>
                  ) : (
                    <>
                      {event.eventDigest.contact.phone && (
                        <Text style={styles.descriptionText}>
                          {event.eventDigest.contact.phone}
                        </Text>
                      )}
                      {event.eventDigest.contact.website && (
                        <Text style={styles.descriptionText}>
                          {event.eventDigest.contact.website}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
            </Animated.View>
          ) : (
            event.description && (
              <Animated.View
                entering={FadeInDown.duration(300).delay(80).springify()}
              >
                <Text style={styles.infoCardTitle}>About</Text>
                <Text style={styles.descriptionText}>{event.description}</Text>
              </Animated.View>
            )
          )}

          {/* Recurring Schedule */}
          {event.isRecurring && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(320).springify()}
              style={styles.sectionDivider}
            >
              <Text style={styles.infoCardTitle}>Recurring</Text>
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
            </Animated.View>
          )}

          {/* Engagement */}
          {engagement && !engagementLoading && !engagementError && (
            <Animated.View
              entering={FadeInDown.duration(300).delay(400).springify()}
              style={styles.sectionDivider}
            >
              <Text style={styles.infoCardTitle}>Engagement</Text>
              <EventEngagementDisplay engagement={engagement} delay={450} />
            </Animated.View>
          )}

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
                style={styles.sectionDivider}
              >
                <View style={styles.qrRow}>
                  <Text style={styles.qrRowText}>
                    {event.qrDetectedInImage
                      ? "QR detected in flyer"
                      : "QR — scan for info"}
                  </Text>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Discovered By / Source */}
          {event.creator ? (
            <Animated.View
              entering={FadeInDown.duration(300).delay(560).springify()}
              style={styles.sectionDivider}
            >
              <Text style={styles.infoCardTitle}>Discovered by</Text>
              <DiscovererCard
                userId={event.creator.id}
                firstName={event.creator.firstName}
                lastName={event.creator.lastName}
                currentTier={event.creator.currentTier}
                totalXp={event.creator.totalXp}
                discoveryCount={event.creator.discoveryCount}
              />
            </Animated.View>
          ) : event.source === "TICKETMASTER" ? (
            <Animated.View
              entering={FadeInDown.duration(300).delay(560).springify()}
              style={styles.sectionDivider}
            >
              <Text style={styles.infoCardTitle}>Source</Text>
              <TicketmasterSourceCard externalUrl={event.externalUrl} />
            </Animated.View>
          ) : null}
        </View>
      </Screen>
    );
  },
);

EventDetails.displayName = "EventDetails";

export default EventDetails;
