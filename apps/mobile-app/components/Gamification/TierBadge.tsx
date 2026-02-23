import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
} from "@/theme";
import { getTierByName } from "@/utils/gamification";

interface TierBadgeProps {
  tier: string;
  size?: "sm" | "md";
}

const TIER_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  Explorer: {
    bg: "rgba(147, 197, 253, 0.15)",
    border: "rgba(147, 197, 253, 0.3)",
    text: "#93c5fd",
  },
  Scout: {
    bg: "rgba(52, 211, 153, 0.15)",
    border: "rgba(52, 211, 153, 0.3)",
    text: "#34d399",
  },
  Curator: {
    bg: "rgba(251, 191, 36, 0.15)",
    border: "rgba(251, 191, 36, 0.3)",
    text: "#fbbf24",
  },
  Ambassador: {
    bg: "rgba(167, 139, 250, 0.15)",
    border: "rgba(167, 139, 250, 0.3)",
    text: "#a78bfa",
  },
};

const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = "md" }) => {
  const tierInfo = getTierByName(tier);
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.Explorer;
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tierColor.bg,
          borderColor: tierColor.border,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
          paddingVertical: isSmall ? 2 : spacing.xs,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: tierColor.text,
            fontSize: isSmall ? fontSize.xs : fontSize.sm,
          },
        ]}
      >
        {tierInfo.emoji} {tierInfo.name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
});

export default TierBadge;
