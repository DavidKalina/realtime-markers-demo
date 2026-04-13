import React, { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import {
  getCategoryColor,
  getQuestPurpose,
  PURPOSE_COLORS,
  PURPOSE_LABELS,
} from "@/utils/categoryColors";
import type { SidequestResponse } from "@/services/api/modules/sidequests";

// ── Mini card dimensions ────────────────────────────────────

const CARD_WIDTH = 140;
const CARD_HEIGHT = 196; // ~5:7 ratio

// ── Mini Quest Card ─────────────────────────────────────────

function MiniQuestCard({
  quest,
  isActive,
  onPress,
}: {
  quest: SidequestResponse;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const purpose = getQuestPurpose(quest);
  const purposeColor = PURPOSE_COLORS[purpose] ?? "#7dd3fc";
  const purposeLabel = PURPOSE_LABELS[purpose] ?? "QUEST";

  const firstObj = quest.objectives?.[0];
  const emoji = firstObj?.emoji || "\uD83D\uDCCD";
  const venueName = firstObj?.venueName;
  const venueCategory = firstObj?.venueCategory;
  const categoryColor = venueCategory
    ? getCategoryColor(venueCategory)
    : purposeColor;

  const s = useMemo(
    () => createCardStyles(colors, purposeColor, categoryColor, isActive),
    [colors, purposeColor, categoryColor, isActive],
  );

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
    >
      {/* Purpose badge */}
      <View style={s.purposeBadge}>
        <Text style={s.purposeText} numberOfLines={1}>
          {purposeLabel}
        </Text>
      </View>

      {/* Emoji */}
      <View style={s.emojiWrap}>
        <Text style={s.emoji}>{emoji}</Text>
      </View>

      {/* Title */}
      <Text style={s.title} numberOfLines={2}>
        {quest.title || "Untitled Quest"}
      </Text>

      {/* Venue */}
      {venueName && (
        <Text style={s.venue} numberOfLines={1}>
          {venueName}
        </Text>
      )}

      {/* Active indicator */}
      {isActive && (
        <View style={s.activeBadge}>
          <Text style={s.activeText}>ACTIVE</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Deck Hand Section ───────────────────────────────────────

interface DeckHandSectionProps {
  quests: SidequestResponse[];
  activeQuestId?: string | null;
}

function DeckHandSection({ quests, activeQuestId }: DeckHandSectionProps) {
  const colors = useColors();
  const s = useMemo(() => createSectionStyles(colors), [colors]);
  const router = useRouter();

  const handlePress = useCallback(
    (quest: SidequestResponse) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/itineraries/${quest.id}`);
    },
    [router],
  );

  if (quests.length === 0) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerLabel}>YOUR HAND</Text>
        <Text style={s.headerCount}>{quests.length} cards</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing.md}
        snapToAlignment="start"
      >
        {quests.map((quest) => (
          <MiniQuestCard
            key={quest.id}
            quest={quest}
            isActive={quest.id === activeQuestId}
            onPress={() => handlePress(quest)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const createCardStyles = (
  colors: Colors,
  purposeColor: string,
  categoryColor: string,
  isActive: boolean,
) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: radius.md,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderWidth: 1,
      borderColor: isActive
        ? `${purposeColor}50`
        : "rgba(255, 255, 255, 0.08)",
      padding: spacing.md,
      justifyContent: "flex-start",
      gap: spacing.xs,
      overflow: "hidden",
    },
    cardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
    purposeBadge: {
      alignSelf: "flex-start",
      backgroundColor: `${purposeColor}18`,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    purposeText: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: purposeColor,
      letterSpacing: 0.8,
    },
    emojiWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
    },
    emoji: {
      fontSize: 36,
    },
    title: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      lineHeight: 16,
    },
    venue: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: categoryColor,
      opacity: 0.8,
      lineHeight: 14,
    },
    activeBadge: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      backgroundColor: `${purposeColor}25`,
      borderRadius: radius.full,
      paddingHorizontal: spacing._6,
      paddingVertical: 2,
    },
    activeText: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      color: purposeColor,
      letterSpacing: 0.5,
    },
  });

const createSectionStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    headerLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
    },
    headerCount: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      opacity: 0.5,
    },
    scrollContent: {
      gap: spacing.md,
      paddingRight: spacing.xl,
    },
  });

export default React.memo(DeckHandSection);
