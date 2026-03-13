import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Dimensions,
  FlatList,
  type ViewToken,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { apiClient } from "@/services/ApiClient";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
  duration,
} from "@/theme";

interface RecentCompletionsProps {
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const STARS = [1, 2, 3, 4, 5] as const;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH * 0.82;
const CARD_GAP = spacing.sm;

const STOP_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#67e8f9",
];

const RecentCompletions: React.FC<RecentCompletionsProps> = ({
  onRefetchRef,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [completions, setCompletions] = useState<ItineraryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchCompletions = useCallback(async () => {
    try {
      const result = await apiClient.itineraries.listCompleted();
      setCompletions(result.data.filter((it) => it.rating == null));
    } catch (err) {
      console.error("[RecentCompletions] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  useEffect(() => {
    if (onRefetchRef) {
      onRefetchRef.current = fetchCompletions;
    }
  }, [onRefetchRef, fetchCompletions]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const handleRated = useCallback((id: string) => {
    setCompletions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.text.secondary} />
      </View>
    );
  }

  if (completions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>RATE YOUR ADVENTURES</Text>
      <FlatList
        data={completions}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <CompletionCard itinerary={item} onRated={handleRated} />
        )}
      />
      {completions.length > 1 && (
        <View style={styles.dotsRow}>
          {completions.map((c, i) => (
            <View
              key={c.id}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const CompletionCard: React.FC<{
  itinerary: ItineraryResponse;
  onRated: (id: string) => void;
}> = ({ itinerary, onRated }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sortedItems = useMemo(
    () => [...itinerary.items].sort((a, b) => a.sortOrder - b.sortOrder),
    [itinerary.items],
  );

  const completedDate = itinerary.completedAt
    ? new Date(itinerary.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

  const totalCost = itinerary.items.reduce(
    (sum, i) => sum + (Number(i.estimatedCost) || 0),
    0,
  );

  const handleStarPress = (star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRating(star);
  };

  const handleSubmit = async () => {
    if (!selectedRating) return;
    setSubmitting(true);
    try {
      await apiClient.itineraries.rate(
        itinerary.id,
        selectedRating,
        comment.trim() || undefined,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRated(itinerary.id);
    } catch (err) {
      console.error("[RecentCompletions] Failed to rate:", err);
      setSubmitting(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(duration.normal)}
      exiting={FadeOut.duration(duration.fast)}
      style={styles.card}
    >
      {/* Header: title + meta */}
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {itinerary.title || "Untitled Adventure"}
          </Text>
          <Text style={styles.cardMeta}>
            {itinerary.city} {"\u00B7"} {completedDate}
            {totalCost > 0 ? ` \u00B7 ~$${totalCost}` : ""}
          </Text>
        </View>
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>
            {"\u2713"} {sortedItems.length} stops
          </Text>
        </View>
      </View>

      {/* Mini timeline — condensed stop list */}
      <View style={styles.timeline}>
        {sortedItems.slice(0, 3).map((item, idx) => {
          const stopColor = STOP_COLORS[idx % STOP_COLORS.length];
          const isLast = idx === 2 || idx === sortedItems.length - 1;
          return (
            <View key={item.id} style={styles.stopRow}>
              {/* Rail */}
              <View style={styles.rail}>
                <View style={[styles.stopDot, { backgroundColor: stopColor }]}>
                  <Text style={styles.stopEmoji}>
                    {item.emoji || "\u{1F4CD}"}
                  </Text>
                </View>
                {!isLast && (
                  <View
                    style={[styles.lineBelow, { backgroundColor: stopColor }]}
                  />
                )}
              </View>
              {/* Content */}
              <View style={styles.stopContent}>
                <View style={styles.stopTopRow}>
                  <Text style={styles.stopTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {Number(item.estimatedCost) > 0 && (
                    <Text style={[styles.stopCost, { color: stopColor }]}>
                      ${Number(item.estimatedCost)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
        <Text style={styles.moreText}>
          {sortedItems.length > 3 ? `+${sortedItems.length - 3} more` : " "}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Star rating */}
      <View style={styles.rateRow}>
        <View style={styles.starsRow}>
          {STARS.map((star) => (
            <Pressable
              key={star}
              onPress={() => handleStarPress(star)}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.star,
                  selectedRating != null && star <= selectedRating
                    ? styles.starActive
                    : styles.starInactive,
                ]}
              >
                {"\u2605"}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedRating != null && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.rateForm}
          >
            <TextInput
              style={styles.commentInput}
              placeholder="Note..."
              placeholderTextColor={colors.text.label}
              value={comment}
              onChangeText={setComment}
              maxLength={200}
            />
            <Pressable
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.bg.primary} />
              ) : (
                <Text style={styles.submitText}>Rate</Text>
              )}
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    loadingContainer: {
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    listContent: {
      paddingRight: spacing.lg,
      gap: CARD_GAP,
    },

    // Card
    card: {
      width: CARD_WIDTH,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: spacing.xs,
    },

    // Header
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    headerInfo: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    cardMeta: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    completedBadge: {
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      backgroundColor: "rgba(134, 239, 172, 0.08)",
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    completedText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: "#86efac",
    },

    // Timeline
    timeline: {
      gap: 0,
    },
    stopRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    rail: {
      width: 24,
      alignItems: "center",
    },
    stopDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    stopEmoji: {
      fontSize: 11,
    },
    lineBelow: {
      flex: 1,
      width: 2,
      minHeight: 6,
      opacity: 0.3,
    },
    stopContent: {
      flex: 1,
      justifyContent: "center",
      minHeight: 22,
    },
    stopTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stopTitle: {
      flex: 1,
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      lineHeight: 18,
    },
    stopCost: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      marginLeft: spacing.sm,
    },
    moreText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      marginLeft: 32,
      marginTop: 2,
    },

    // Divider
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
    },

    // Rate
    rateRow: {
      gap: spacing.xs,
    },
    starsRow: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    star: {
      fontSize: 18,
    },
    starActive: {
      color: "#fbbf24",
    },
    starInactive: {
      color: colors.border.medium,
    },
    rateForm: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    submitButton: {
      backgroundColor: "#86efac",
      borderRadius: radius.md,
      paddingVertical: 5,
      paddingHorizontal: spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.bg.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Dots
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.border.medium,
    },
    dotActive: {
      backgroundColor: "#86efac",
      width: 14,
      borderRadius: 3,
    },
  });

export default RecentCompletions;
