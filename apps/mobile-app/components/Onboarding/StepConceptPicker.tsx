import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
} from "@/theme";
import type { QuestConcept } from "@/services/api/modules/sidequests";
import { StepLayout, NextButton } from "./shared";

const SPRING = { damping: 28, stiffness: 550 };

function difficultyLabel(d: number): string {
  if (d <= 3) return "Easy";
  if (d <= 6) return "Moderate";
  return "Challenge";
}

function difficultyColor(d: number): string {
  if (d <= 3) return "rgba(52, 211, 153, 0.7)";   // teal
  if (d <= 6) return "rgba(251, 191, 36, 0.7)";    // amber
  return "rgba(244, 114, 182, 0.7)";                // pink
}

// ── Concept card ────────────────────────────────────────

function ConceptCard({
  concept,
  selected,
  onPress,
}: {
  concept: QuestConcept;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    scale.value = withSequence(
      withSpring(0.97, SPRING),
      withSpring(1, SPRING),
    );
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        style={[
          s.card,
          selected && {
            borderColor: colors.accent.border,
            backgroundColor: `rgba(${colors.accent.rgb}, 0.08)`,
          },
        ]}
      >
        <View style={s.cardHeader}>
          <Text style={s.emoji}>{concept.emoji}</Text>
          <View style={s.cardTitles}>
            <Text
              style={[
                s.cardTitle,
                selected && { color: colors.accent.primary },
              ]}
            >
              {concept.title}
            </Text>
            <View
              style={[
                s.difficultyBadge,
                {
                  backgroundColor: `${difficultyColor(concept.difficulty)}20`,
                  borderColor: difficultyColor(concept.difficulty),
                },
              ]}
            >
              <Text
                style={[
                  s.difficultyText,
                  { color: difficultyColor(concept.difficulty) },
                ]}
              >
                {difficultyLabel(concept.difficulty)}
              </Text>
            </View>
          </View>
          <View
            style={[
              s.radio,
              selected && {
                borderColor: colors.accent.primary,
                backgroundColor: `rgba(${colors.accent.rgb}, 0.25)`,
              },
            ]}
          >
            {selected && (
              <View
                style={[
                  s.radioDot,
                  { backgroundColor: colors.accent.primary },
                ]}
              />
            )}
          </View>
        </View>
        <Text style={s.pitch}>{concept.pitch}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main component ──────────────────────────────────────

export function StepConceptPicker({
  concepts,
  selectedConceptId,
  onSelectConcept,
  onConfirm,
  onBack,
  isLoading,
}: {
  concepts: QuestConcept[];
  selectedConceptId: string | null;
  onSelectConcept: (id: string) => void;
  onConfirm: () => void;
  onBack?: () => void;
  isLoading: boolean;
}) {
  return (
    <StepLayout
      title="Pick your quest"
      subtitle="Choose the one that excites you most"
      onBack={onBack}
      bottomAction={
        <NextButton
          label={isLoading ? "Generating..." : "Let's go"}
          onPress={onConfirm}
          disabled={!selectedConceptId || isLoading}
          solid
        />
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {concepts.length === 0 ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.5)" />
            <Text style={s.loadingText}>Loading ideas...</Text>
          </View>
        ) : (
          concepts.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              selected={selectedConceptId === concept.id}
              onPress={() => onSelectConcept(concept.id)}
            />
          ))
        )}
      </ScrollView>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: spacing.md,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  cardTitles: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: "rgba(255, 255, 255, 0.9)",
  },
  difficultyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  difficultyText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pitch: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255, 255, 255, 0.6)",
    paddingLeft: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
  },
});
