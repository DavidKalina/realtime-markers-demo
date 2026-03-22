import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictEmoji, getTagColor } from "@/utils/districtUtils";
import {
  useColors,
  type Colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
} from "@/theme";

const MOMENTUM_ARROWS: Record<string, string> = {
  rising: "\u2191",
  steady: "",
  cooling: "\u2193",
};

const MOMENTUM_COLORS: Record<string, string> = {
  rising: "#4ade80",
  cooling: "#7dd3fc",
};

// Slot reel emojis — cycled through before landing on the real one
const REEL_EMOJIS = [
  "\u{1F5FA}\uFE0F", "\u{1F3AF}", "\u{1F3AA}", "\u{1F3AD}",
  "\u{1F3A8}", "\u{1F3B5}", "\u{1F37D}\uFE0F", "\u2615",
  "\u{1F333}", "\u{1F97E}", "\u{1F3DB}\uFE0F", "\u{1F378}",
];

const ITEM_HEIGHT = 18;
const SPIN_ITEMS = 8; // How many emoji to spin through before landing

/* ── Mini slot reel for emoji ──────────────────────────────────── */

const EmojiSlot: React.FC<{ emoji: string; districtId: string }> = React.memo(
  ({ emoji, districtId }) => {
    const translateY = useSharedValue(0);
    const prevIdRef = useRef(districtId);

    // Build reel: random emojis + final landing emoji
    const reel = useMemo(() => {
      const items: string[] = [];
      for (let i = 0; i < SPIN_ITEMS; i++) {
        items.push(REEL_EMOJIS[Math.floor(Math.random() * REEL_EMOJIS.length)]);
      }
      items.push(emoji);
      return items;
    }, [emoji]);

    useEffect(() => {
      if (prevIdRef.current === districtId) {
        // First mount — just show the emoji, no spin
        translateY.value = -SPIN_ITEMS * ITEM_HEIGHT;
        prevIdRef.current = districtId;
        return;
      }
      prevIdRef.current = districtId;

      // Spin: start at top, animate down to the landing emoji
      translateY.value = 0;
      translateY.value = withTiming(-SPIN_ITEMS * ITEM_HEIGHT, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [districtId, reel.length]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    return (
      <View style={slotStyles.container}>
        <Animated.View style={animStyle}>
          {reel.map((e, i) => (
            <Text key={i} style={slotStyles.item}>{e}</Text>
          ))}
        </Animated.View>
      </View>
    );
  },
);

EmojiSlot.displayName = "EmojiSlot";

const slotStyles = StyleSheet.create({
  container: {
    width: 18,
    height: ITEM_HEIGHT,
    overflow: "hidden",
  },
  item: {
    height: ITEM_HEIGHT,
    lineHeight: ITEM_HEIGHT,
    fontSize: 14,
    textAlign: "center",
  },
});

/* ── Name slot (vertical scroll) ──────────────────────────────── */

const NAME_HEIGHT = 14;

const NameSlot: React.FC<{
  name: string;
  districtId: string;
  style: Record<string, unknown>;
}> = React.memo(({ name, districtId, style }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prevIdRef = useRef(districtId);

  useEffect(() => {
    if (prevIdRef.current === districtId) {
      translateY.value = 0;
      opacity.value = 1;
      prevIdRef.current = districtId;
      return;
    }
    prevIdRef.current = districtId;

    // Slide up + fade in
    translateY.value = 8;
    opacity.value = 0;
    translateY.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 350 }),
    );
  }, [districtId, name]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[style, animStyle]} numberOfLines={1}>
      {name}
    </Animated.Text>
  );
});

NameSlot.displayName = "NameSlot";

/* ── DistrictChip ────────────────────────────────────────────── */

const DistrictChipInner: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const focusedDistrictId = useDistrictMapStore((s) => s.focusedDistrictId);
  const districts = useDistrictMapStore((s) => s.districts);
  const completedCountMap = useDistrictMapStore((s) => s.completedCountMap);

  const district = useMemo(
    () => districts.find((d) => d.id === focusedDistrictId) ?? null,
    [districts, focusedDistrictId],
  );

  const handlePress = useCallback(() => {
    if (district) {
      router.push(`/browse/${district.id}`);
    }
  }, [district, router]);

  if (!district) return null;

  const emoji = getDistrictEmoji(district);
  const momentum = district.momentum?.momentum ?? null;
  const arrow = momentum ? MOMENTUM_ARROWS[momentum] : "";
  const arrowColor = momentum ? MOMENTUM_COLORS[momentum] : undefined;
  const completed = completedCountMap[district.id] ?? 0;
  const total = district.itineraryCount;

  // Build DNA segments from activity tags (equal weight per tag)
  const tags = district.activityTags.slice(0, 5);
  const segmentPct = tags.length > 0 ? 100 / tags.length : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(150)}
    >
      <Pressable
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        onPress={handlePress}
      >
        {/* Top row: emoji + name + momentum + quest count */}
        <View style={styles.topRow}>
          <EmojiSlot emoji={emoji} districtId={district.id} />
          <NameSlot
            name={district.name}
            districtId={district.id}
            style={styles.name}
          />
          {arrow ? (
            <Text style={[styles.arrow, arrowColor ? { color: arrowColor } : undefined]}>
              {arrow}
            </Text>
          ) : null}
          <Text style={styles.questCount}>
            {completed}/{total}
          </Text>
        </View>

        {/* DNA bar */}
        {tags.length > 0 && (
          <View style={styles.dnaBar}>
            {tags.map((tag, i) => (
              <View
                key={tag}
                style={[
                  styles.dnaSegment,
                  {
                    backgroundColor: getTagColor(tag),
                    width: `${segmentPct}%`,
                    borderTopLeftRadius: i === 0 ? 2 : 0,
                    borderBottomLeftRadius: i === 0 ? 2 : 0,
                    borderTopRightRadius: i === tags.length - 1 ? 2 : 0,
                    borderBottomRightRadius: i === tags.length - 1 ? 2 : 0,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

export const DistrictChip = React.memo(DistrictChipInner);

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    chip: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: 5,
      borderWidth: 1,
      borderColor: colors.border.default,
      maxWidth: 200,
    },
    chipPressed: {
      backgroundColor: colors.bg.elevated,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    name: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      flexShrink: 1,
    },
    arrow: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
    },
    questCount: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
    },
    dnaBar: {
      flexDirection: "row",
      height: 3,
      marginTop: 4,
      borderRadius: 2,
      overflow: "hidden",
    },
    dnaSegment: {
      height: 3,
    },
  });
