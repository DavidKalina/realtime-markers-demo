/**
 * SectionMark — a tiny MiniDeck-style card paired with a section label.
 * Card alternates left/right via the `side` prop.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
} from "@/theme";

const CARD_W = 30;
const CARD_H = 40;

interface SectionMarkProps {
  icon: string;
  tint: string;
  label: string;
  /** Which side the card appears on */
  side?: "left" | "right";
  /** Optional right-aligned text (e.g. status) */
  trailing?: string;
  trailingColor?: string;
}

function SectionMark({ icon, tint, label, side = "left", trailing, trailingColor }: SectionMarkProps) {
  const colors = useColors();

  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);

  const targetRotation = side === "left" ? -4 : 4;

  useEffect(() => {
    scale.value = withDelay(
      80,
      withSpring(1, { damping: 18, stiffness: 220 }),
    );
    rotate.value = withDelay(
      120,
      withSpring(targetRotation, { damping: 20, stiffness: 180 }),
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const cardElement = (
    <Animated.View
      style={[
        s.card,
        { backgroundColor: colors.bg.card, borderColor: tint },
        cardStyle,
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`sm_${icon}`} x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={tint} stopOpacity="0.35" />
              <Stop offset="1" stopColor="transparent" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={7} fill={`url(#sm_${icon})`} />
        </Svg>
      </View>
      <View style={s.cardInner}>
        <Text style={s.cardIcon}>{icon}</Text>
        <View style={[s.cardLine, { backgroundColor: tint }]} />
      </View>
    </Animated.View>
  );

  return (
    <View style={[s.container, side === "right" && s.containerRight]}>
      {side === "left" && cardElement}

      <Text
        style={[
          s.label,
          { color: colors.text.primary },
          side === "right" && s.labelRight,
        ]}
      >
        {label}
      </Text>

      {trailing && (
        <Text
          style={[
            s.trailing,
            { color: trailingColor ?? colors.text.secondary },
          ]}
        >
          {trailing}
        </Text>
      )}

      {side === "right" && cardElement}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  containerRight: {
    // no change needed, just for semantic clarity
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 7,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    gap: 3,
  },
  cardIcon: {
    fontSize: 13,
  },
  cardLine: {
    width: "55%",
    height: 2,
    borderRadius: 1,
    opacity: 0.35,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  labelRight: {
    textAlign: "right",
  },
  trailing: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: fontWeight.medium,
  },
});

export default React.memo(SectionMark);
