import {
  useColors,
  type Colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import { LucideIcon } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  actionText?: string;
  onActionPress?: () => void;
  iconColor?: string;
}

export default function SectionHeader({
  icon: Icon,
  title,
  actionText,
  onActionPress,
  iconColor,
}: SectionHeaderProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolvedIconColor = iconColor ?? colors.accent.primary;
  const handleActionPress = () => {
    if (onActionPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onActionPress();
    }
  };

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconContainer}>
        <Icon size={20} color={resolvedIconColor} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionText && onActionPress && (
        <TouchableOpacity
          style={styles.sectionActionButton}
          onPress={handleActionPress}
        >
          <Text style={styles.sectionActionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
      marginLeft: spacing.xs,
    },
    sectionIconContainer: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.border.default,
      borderRadius: radius.md,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      marginLeft: spacing.md,
      letterSpacing: 0.3,
    },
    sectionActionButton: {
      marginLeft: "auto",
      backgroundColor: colors.border.medium,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing._6,
      borderRadius: radius.sm,
    },
    sectionActionText: {
      color: colors.accent.primary,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
    },
  });
