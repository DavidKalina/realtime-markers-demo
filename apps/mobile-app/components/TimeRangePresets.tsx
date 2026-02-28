import {
  addDays,
  format,
  nextFriday,
  nextSunday,
  isFriday,
  isSaturday,
  isSunday,
} from "date-fns";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInUp } from "react-native-reanimated";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

interface TimeRangePresetsProps {
  onPresetSelect: (start: string, end: string, label: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  onClearFilters?: () => void;
  isFilteredMode?: boolean;
  activePresetLabel?: string;
}

interface Preset {
  label: string;
  getRange: () => { start: string; end: string };
}

const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

const buildPresets = (): Preset[] => {
  const today = new Date();

  return [
    {
      label: "Tonight",
      getRange: () => ({
        start: formatDate(today),
        end: formatDate(today),
      }),
    },
    {
      label: "This Weekend",
      getRange: () => {
        if (isSunday(today)) {
          return { start: formatDate(today), end: formatDate(today) };
        }
        const fri =
          isFriday(today) || isSaturday(today) ? today : nextFriday(today);
        const sun = isSunday(today) ? today : nextSunday(today);
        return { start: formatDate(fri), end: formatDate(sun) };
      },
    },
    {
      label: "This Week",
      getRange: () => {
        const sun = isSunday(today) ? today : nextSunday(today);
        return { start: formatDate(today), end: formatDate(sun) };
      },
    },
    {
      label: "Next 2 Weeks",
      getRange: () => ({
        start: formatDate(today),
        end: formatDate(addDays(today, 14)),
      }),
    },
  ];
};

const TimeRangePresets: React.FC<TimeRangePresetsProps> = ({
  onPresetSelect,
  onClose,
  isLoading = false,
  onClearFilters,
  isFilteredMode,
  activePresetLabel,
}) => {
  const presets = useMemo(() => buildPresets(), []);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const handlePresetPress = useCallback(
    (preset: Preset) => {
      if (isLoading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { start, end } = preset.getRange();
      onPresetSelect(start, end, preset.label);
    },
    [isLoading, onPresetSelect],
  );

  return (
    <Animated.View
      style={styles.container}
      pointerEvents="auto"
      entering={SlideInUp.springify().damping(40).stiffness(300)}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <X size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>When?</Text>
      </View>

      <View style={styles.presetsContainer}>
        {presets.map((preset) => {
          const isActive = activePresetLabel === preset.label;
          return (
            <TouchableOpacity
              key={preset.label}
              style={[
                styles.presetButton,
                isActive && styles.presetButtonActive,
              ]}
              onPress={() => handlePresetPress(preset)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading && isActive ? (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              ) : (
                <Text
                  style={[
                    styles.presetLabel,
                    isActive && styles.presetLabelActive,
                  ]}
                >
                  {preset.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {isFilteredMode && onClearFilters && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClearFilters}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    maxWidth: 500,
    borderRadius: radius["2xl"],
    overflow: "hidden",
    width: "85%",
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
    marginRight: 36,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  presetsContainer: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  presetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: spacing["5xl"],
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
    gap: spacing.sm,
  },
  presetButtonActive: {
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.border,
  },
  presetLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  presetLabelActive: {
    color: colors.accent.primary,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  clearButton: {
    height: spacing["5xl"],
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.border.subtle,
  },
  clearButtonText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});

export default TimeRangePresets;
