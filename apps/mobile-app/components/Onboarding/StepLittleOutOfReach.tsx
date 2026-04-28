import React, { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { EdLabel, EdBtn } from "@/components/Editorial";
import { edColors, edFont, edRadius, edShadows } from "@/theme/editorial";

type CategoryColor = "coral" | "amber" | "sage" | "sky";

const COLOR_HEX: Record<CategoryColor, string> = {
  coral: edColors.coral,
  amber: edColors.amber,
  sage: edColors.sage,
  sky: edColors.sky,
};

interface TileOption {
  key: string;
  emoji: string;
  label: string;
  color: CategoryColor;
}

export const LITTLE_OUT_OF_REACH_OPTIONS: TileOption[] = [
  { key: "make_friends", emoji: "☕", label: "Make new friends", color: "coral" },
  { key: "date_more", emoji: "💌", label: "Date more", color: "amber" },
  { key: "touch_grass", emoji: "🌿", label: "Touch grass", color: "sage" },
  { key: "make_stuff", emoji: "🎨", label: "Make stuff", color: "amber" },
  { key: "move_body", emoji: "🏃", label: "Move my body", color: "coral" },
  { key: "learn_things", emoji: "📚", label: "Learn weird things", color: "sky" },
];

const TOTAL_STEPS = 6;
const CURRENT_STEP = 3;
const SOFT_TARGET = 3;
const MAX_SELECTIONS = 4;

interface StepLittleOutOfReachProps {
  selected: string[];
  onToggle: (key: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
}

interface TileProps {
  option: TileOption;
  selected: boolean;
  onPress: () => void;
}

function Tile({ option, selected, onPress }: TileProps) {
  const tintHex = COLOR_HEX[option.color];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
        selected ? styles.tileSelected : styles.tileUnselected,
      ]}
    >
      <View style={[styles.iconWell, { backgroundColor: `${tintHex}38` }]}>
        <Text style={styles.iconEmoji}>{option.emoji}</Text>
      </View>
      <Text style={styles.tileLabel}>{option.label}</Text>
      {selected ? (
        <View style={styles.checkBadge}>
          <Check size={12} color={edColors.paper} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function StepLittleOutOfReach({
  selected,
  onToggle,
  onContinue,
  onSkip,
}: StepLittleOutOfReachProps) {
  const insets = useSafeAreaInsets();

  const handleToggle = useCallback(
    (key: string) => {
      const isOn = selected.includes(key);
      if (!isOn && selected.length >= MAX_SELECTIONS) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.selectionAsync();
      onToggle(key);
    },
    [selected, onToggle],
  );

  const canContinue = selected.length >= 1;
  const hintText =
    selected.length === 0
      ? "Pick at least one"
      : `${selected.length} of ${SOFT_TARGET} chosen`;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.headerRow}>
        <EdLabel>{`STEP 0${CURRENT_STEP} / 0${TOTAL_STEPS}`}</EdLabel>
        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSeg,
              i < CURRENT_STEP ? styles.progressSegFill : styles.progressSegEmpty,
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>
          What feels just{"\n"}
          <Text style={styles.h1Italic}>a little out of reach?</Text>
        </Text>
        <Text style={styles.body}>
          Pick what&apos;s been tugging at you. We&apos;ll start one notch easier than this.
        </Text>

        <View style={styles.grid}>
          {LITTLE_OUT_OF_REACH_OPTIONS.map((opt) => (
            <Tile
              key={opt.key}
              option={opt}
              selected={selected.includes(opt.key)}
              onPress={() => handleToggle(opt.key)}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={[styles.footerFade, { height: 130 + insets.bottom }]}
        pointerEvents="none"
      >
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <Defs>
            <SvgLinearGradient id="onboardFade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={edColors.paper} stopOpacity={0} />
              <Stop offset="30%" stopColor={edColors.paper} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#onboardFade)" />
        </Svg>
      </View>
      <View style={[styles.footer, { bottom: 18 + insets.bottom }]}>
        <Text style={styles.hint}>{hintText}</Text>
        <EdBtn
          label="Continue"
          variant="primary"
          onPress={onContinue}
          disabled={!canContinue}
        />
      </View>
    </SafeAreaView>
  );
}

const TILE_GAP = 10;
const SCREEN_PAD = 22;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: edColors.paper },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  skipText: {
    fontFamily: edFont.sansMedium,
    fontSize: 13,
    color: edColors.inkSoft,
  },

  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  progressSegFill: { backgroundColor: edColors.coral },
  progressSegEmpty: { backgroundColor: edColors.rule },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SCREEN_PAD, paddingTop: 22 },

  h1: {
    fontFamily: edFont.serifRegular,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: edColors.ink,
  },
  h1Italic: {
    fontFamily: edFont.serifMediumItalic,
    color: edColors.coral,
  },
  body: {
    fontFamily: edFont.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: edColors.inkSoft,
    marginTop: 14,
    maxWidth: 280,
  },

  grid: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },
  tile: {
    width: `${(100 - (TILE_GAP / 3.5)) / 2}%`,
    padding: 14,
    borderRadius: 18,
    backgroundColor: edColors.paperHi,
  },
  tileUnselected: {
    borderWidth: 1,
    borderColor: edColors.rule,
    ...edShadows.cardResting,
  },
  tileSelected: {
    borderWidth: 1.5,
    borderColor: edColors.ink,
    ...edShadows.cardLifted,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 22 },
  tileLabel: {
    marginTop: 10,
    fontFamily: edFont.sansSemibold,
    fontSize: 14,
    color: edColors.ink,
    letterSpacing: -0.1,
  },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: edColors.ink,
    alignItems: "center",
    justifyContent: "center",
  },

  footerFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footer: {
    position: "absolute",
    left: SCREEN_PAD,
    right: SCREEN_PAD,
    alignItems: "stretch",
    gap: 10,
  },
  hint: {
    textAlign: "center",
    fontFamily: edFont.sansMedium,
    fontSize: 12,
    color: edColors.inkMute,
    letterSpacing: -0.05,
  },
});
