import { EventType } from "@/types/types";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import { Calendar, ChevronRight, MapPin } from "lucide-react-native";
import React, { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

interface EventItemProps {
  event: EventType;
  onPress: (event: EventType) => void;
  index?: number;
  variant?: "default" | "compact" | "featured";
  showChevron?: boolean;
  showDistance?: boolean;
  footerContent?: React.ReactNode;
}

const EventItem: React.FC<EventItemProps> = ({
  event,
  onPress,
  index = 0,
  variant = "default",
  showChevron = true,
  showDistance = false,
  footerContent,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const navigate = useCallback(() => {
    onPress(event);
  }, [event, onPress]);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withTiming(0.98, { duration: 80 }),
      withTiming(1, { duration: 100 }, () => {
        scheduleOnRN(navigate);
      }),
    );
  }, [navigate, scale]);

  const getStyles = () => {
    switch (variant) {
      case "compact":
        return compactStyles;
      case "featured":
        return featuredStyles;
      default:
        return defaultStyles;
    }
  };

  const styles = getStyles();

  return (
    <Animated.View
      style={[styles.eventCard, animatedStyle]}
      entering={FadeInDown.duration(600)
        .delay(index * 100)
        .springify()}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(300)}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={styles.eventCardContent}>
          <View style={styles.emojiContainer}>
            <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
          </View>

          <View style={styles.resultTextContainer}>
            <Text
              style={styles.resultTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {event.title}
            </Text>

            <View style={styles.detailsContainer}>
              <View style={styles.resultDetailsRow}>
                <Calendar
                  size={14}
                  color={colors.accent.primary}
                  style={{ marginRight: spacing._6 }}
                />
                <Text
                  style={styles.resultDetailText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {event.time}
                </Text>
              </View>

              <View style={styles.resultDetailsRow}>
                <MapPin
                  size={14}
                  color={colors.accent.primary}
                  style={{ marginRight: spacing._6 }}
                />
                <Text
                  style={styles.resultDetailText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {showDistance && event.distance
                    ? event.distance
                    : event.location}
                </Text>
              </View>
            </View>
          </View>

          {showChevron && (
            <View style={styles.chevronContainer}>
              <ChevronRight size={16} color=colors.text.detail />
            </View>
          )}
        </View>
      </TouchableOpacity>
      {footerContent && (
        <View style={styles.footerContainer}>{footerContent}</View>
      )}
    </Animated.View>
  );
};

const defaultStyles = StyleSheet.create({
  eventCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    marginHorizontal: 0,
    marginVertical: spacing._6,
    borderRadius: radius.md,
    flexDirection: "column",
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  emojiContainer: {
    width: spacing["4xl"],
    height: spacing["4xl"],
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  resultEmoji: {
    fontSize: fontSize.xl,
  },
  resultTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing._6,
  },
  detailsContainer: {
    gap: spacing.xs,
  },
  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultDetailText: {
    fontSize: 13,
    color: colors.text.detail,
    fontFamily: fontFamily.mono,
    flex: 1,
  },
  chevronContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  footerContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
});

const compactStyles = StyleSheet.create({
  ...defaultStyles,
  eventCard: {
    ...defaultStyles.eventCard,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  emojiContainer: {
    ...defaultStyles.emojiContainer,
    width: spacing["3xl"],
    height: spacing["3xl"],
  },
  resultTitle: {
    ...defaultStyles.resultTitle,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  resultDetailText: {
    ...defaultStyles.resultDetailText,
    fontSize: fontSize.xs,
  },
  footerContainer: {
    ...defaultStyles.footerContainer,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
});

const featuredStyles = StyleSheet.create({
  ...defaultStyles,
  eventCard: {
    ...defaultStyles.eventCard,
    padding: spacing.lg,
    marginVertical: spacing.sm,
  },
  emojiContainer: {
    ...defaultStyles.emojiContainer,
    width: spacing["5xl"],
    height: spacing["5xl"],
  },
  resultTitle: {
    ...defaultStyles.resultTitle,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  resultDetailText: {
    ...defaultStyles.resultDetailText,
    fontSize: fontSize.sm,
  },
  footerContainer: {
    ...defaultStyles.footerContainer,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
});

export default EventItem;
