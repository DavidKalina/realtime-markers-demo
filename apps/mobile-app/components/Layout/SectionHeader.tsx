import { COLORS } from "./ScreenLayout";
import { LucideIcon } from "lucide-react-native";
import React from "react";
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
  iconColor = COLORS.accent,
}: SectionHeaderProps) {
  const handleActionPress = () => {
    if (onActionPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onActionPress();
    }
  };

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconContainer}>
        <Icon size={20} color={iconColor} />
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

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Poppins-Regular",
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  sectionActionButton: {
    marginLeft: "auto",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionActionText: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    fontWeight: "600",
  },
});
