import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { EventType } from "@/types/types";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface ThisWeekendSectionProps {
  events: EventType[];
}

const { width: screenWidth } = Dimensions.get("window");
const CARD_WIDTH = screenWidth * 0.6;

const formatWeekendDate = (dateStr: string | Date): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const ThisWeekendSection: React.FC<ThisWeekendSectionProps> = ({ events }) => {
  const router = useRouter();

  if (!events || events.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>This Weekend</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing.md}
      >
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/details" as const,
                params: { eventId: event.id },
              });
            }}
          >
            <Text style={styles.emoji}>{event.emoji || "\u{1F389}"}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.cardDate}>
              {event.eventDate
                ? formatWeekendDate(event.eventDate)
                : event.time}
            </Text>
            {event.distance ? (
              <Text style={styles.cardDistance}>{event.distance}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  cardDate: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  cardDistance: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

export default ThisWeekendSection;
